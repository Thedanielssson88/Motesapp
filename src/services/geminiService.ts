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
