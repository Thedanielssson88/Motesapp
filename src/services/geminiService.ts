import { GoogleGenAI, SchemaType } from "@google/genai";
import { db } from "./db";

// Hjälpfunktion för att hämta API-nyckel
const getApiKey = () => {
  const key = localStorage.getItem('GEMINI_API_KEY');
  if (!key) throw new Error("API-nyckel saknas. Lägg in den i Inställningar.");
  return key;
};

// Konvertera Blob till Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const processMeetingAI = async (meetingId: string) => {
  const apiKey = getApiKey();
  const meeting = await db.meetings.get(meetingId);
  const audioFile = await db.audioFiles.get(meetingId);
  const allPeople = await db.people.toArray();
  
  if (!meeting || !audioFile) throw new Error("Data saknas för analys");

  const genAI = new GoogleGenAI({ apiKey });
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          transcription: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                start: { type: SchemaType.NUMBER },
                end: { type: SchemaType.NUMBER },
                text: { type: SchemaType.STRING },
                speaker: { type: SchemaType.STRING }
              }
            }
          },
          summary: { type: SchemaType.STRING },
          decisions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          tasks: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING },
                assignedToName: { type: SchemaType.STRING }, 
                priority: { type: SchemaType.STRING }
              }
            }
          }
        }
      }
    }
  });

  const base64Audio = await blobToBase64(audioFile.blob);
  const peopleNames = allPeople.map(p => p.name).join(', ');

  const prompt = `
    Du är en professionell mötessekreterare. Analysera ljudfilen.
    Mötestitel: ${meeting.title}. Kategori: ${meeting.category}.
    Kända personer i systemet: ${peopleNames}.
    
    1. Transkribera ordagrant med tidsstämplar (svenska).
    2. Skriv en sammanfattning och lista beslut.
    3. Identifiera uppgifter (Tasks). Om en uppgift tilldelas någon av de kända personerna, använd deras exakta namn i 'assignedToName'.
  `;

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: audioFile.mimeType, data: base64Audio } }
  ]);

  const response = JSON.parse(result.response.text());

  // Spara analysen i databasen
  await db.meetings.update(meetingId, {
    transcription: response.transcription,
    protocol: {
      summary: response.summary,
      decisions: response.decisions,
      notes: ""
    },
    isProcessed: true
  });

  // Skapa tasks
  for (const t of response.tasks) {
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

  return response;
};

export const reprocessMeetingFromText = async (meetingId: string) => {
  const apiKey = getApiKey();
  const meeting = await db.meetings.get(meetingId);
  const allPeople = await db.people.toArray();
  
  if (!meeting || !meeting.transcription) throw new Error("Möte eller transkribering saknas");

  const genAI = new GoogleGenAI({ apiKey });
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          summary: { type: SchemaType.STRING },
          decisions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          tasks: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING },
                assignedToName: { type: SchemaType.STRING }, 
                priority: { type: SchemaType.STRING }
              }
            }
          }
        }
      }
    }
  });

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

  const result = await model.generateContent({ text: prompt });
  const response = JSON.parse(result.response.text());

  // 1. Uppdatera protokollet
  await db.meetings.update(meetingId, {
    protocol: {
      summary: response.summary,
      decisions: response.decisions,
      notes: meeting.protocol?.notes || "" // Behåll eventuella manuella anteckningar
    }
  });

  // 2. Hantera nya uppgifter
  for (const t of response.tasks) {
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

  return response;
};
