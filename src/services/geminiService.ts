import { GoogleGenAI, Type } from "@google/genai";
import { db } from "./db";

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });
};

export const processMeetingAI = async (meetingId: string) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API-nyckel saknas");

  const meeting = await db.meetings.get(meetingId);
  const audioFile = await db.audioFiles.get(meetingId);
  const allPeople = await db.people.toArray();
  
  if (!meeting || !audioFile) throw new Error("Data saknas");

  const ai = new GoogleGenAI({ apiKey });
  
  const base64Audio = await blobToBase64(audioFile.blob);
  const peopleNames = allPeople.map(p => p.name).join(', ');

  const prompt = `
    Du är en professionell mötessekreterare. Analysera ljudfilen.
    Mötestitel: ${meeting.title}. Kategori: ${meeting.category}.
    Kända personer i systemet: ${peopleNames}.
    
    1. Transkribera ordagrant (svenska).
    2. Sammanfatta och lista beslut.
    3. Identifiera uppgifter (Tasks). Om en uppgift tilldelas någon av de kända personerna, använd deras exakta namn i 'assignedToName'.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: audioFile.mimeType, data: base64Audio } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          transcription: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                start: { type: Type.NUMBER },
                end: { type: Type.NUMBER },
                text: { type: Type.STRING },
                speaker: { type: Type.STRING }
              }
            }
          },
          summary: { type: Type.STRING },
          decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                assignedToName: { type: Type.STRING }, 
                priority: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  const responseData = JSON.parse(response.text);

  await db.meetings.update(meetingId, {
    transcription: responseData.transcription,
    protocol: {
      summary: responseData.summary,
      decisions: responseData.decisions,
      notes: ""
    },
    isProcessed: true
  });

  for (const t of responseData.tasks) {
    const person = allPeople.find(p => p.name.toLowerCase().includes(t.assignedToName?.toLowerCase()));
    await db.tasks.add({
      id: crypto.randomUUID(),
      title: t.title,
      status: 'todo',
      createdAt: new Date().toISOString(),
      linkedMeetingId: meetingId,
      assignedToId: person?.id
    });
  }

  return responseData;
};

export const reprocessMeetingFromText = async (meetingId: string) => {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) throw new Error("API-nyckel saknas");

  const meeting = await db.meetings.get(meetingId);
  const allPeople = await db.people.toArray();
  
  if (!meeting || !meeting.transcription) throw new Error("Möte eller transkribering saknas");

  const ai = new GoogleGenAI({ apiKey });
  
  // Bygg ihop hela transkriberingen till en stor textsträng
  const fullText = meeting.transcription
    .map(t => `[${Math.floor(t.start/60)}:${Math.floor(t.start%60).toString().padStart(2, '0')}] ${t.speaker ? t.speaker + ': ' : ''}${t.text}`)
    .join('\n');
    
  const peopleNames = allPeople.map(p => p.name).join(', ');

  const prompt = `
    Du är en professionell mötessekreterare. Här är en manuellt korrigerad transkribering av ett möte.
    Mötestitel: ${meeting.title}. Kategori: ${meeting.category}.
    Kända personer i systemet (för uppgifter): ${peopleNames}.
    
    TRANSKRIBERING:
    ${fullText}
    
    UPPGIFT:
    1. Skriv en professionell sammanfattning av mötet.
    2. Lista alla viktiga beslut.
    3. Identifiera uppgifter (Tasks). Om en uppgift tilldelas någon av de kända personerna, använd deras exakta namn i 'assignedToName'.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                assignedToName: { type: Type.STRING }, 
                priority: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  const responseData = JSON.parse(response.text);

  // 1. Uppdatera protokollet
  await db.meetings.update(meetingId, {
    protocol: {
      summary: responseData.summary,
      decisions: responseData.decisions,
      notes: meeting.protocol?.notes || "" // Behåll eventuella manuella anteckningar
    }
  });

  // 2. Hantera nya uppgifter (Valfritt: Ta bort gamla AI-genererade uppgifter om du vill att den ska "nollställa", 
  // men oftast är det bäst att bara lägga till de nya för att undvika att radera uppgifter användaren redan bockat av)
  for (const t of responseData.tasks) {
    const person = allPeople.find(p => p.name.toLowerCase().includes(t.assignedToName?.toLowerCase()));
    await db.tasks.add({
      id: crypto.randomUUID(),
      title: t.title,
      status: 'todo',
      createdAt: new Date().toISOString(),
      linkedMeetingId: meetingId,
      assignedToId: person?.id
    });
  }

  return responseData;
};
