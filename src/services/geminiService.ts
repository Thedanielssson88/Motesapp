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
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) throw new Error("API-nyckel saknas");

  const meeting = await db.meetings.get(meetingId);
  const audioFile = await db.audioFiles.get(meetingId);
  const allPeople = await db.people.toArray();
  
  if (!meeting || !audioFile) throw new Error("Data saknas");

  const ai = new GoogleGenAI({ apiKey });
  
  const base64Audio = await blobToBase64(audioFile.blob);
  const peopleNames = allPeople.map(p => p.name).join(', ');

  const project = meeting.projectId ? await db.projects.get(meeting.projectId) : null;
  const category = meeting.categoryId ? await db.categories.get(meeting.categoryId) : null;

  const prompt = `
    Du är en professionell mötessekreterare. Analysera ljudfilen.
    Mötestitel: ${meeting.title}. Projekt: ${project?.name || 'Inget'}. Kategori: ${category?.name || 'Ingen'}.
    Kända personer i systemet: ${peopleNames}.
    
    1. Transkribera ordagrant (svenska). Identifiera olika talare och märk dem som "Person 1", "Person 2", etc.
    2. Skriv en koncis sammanfattning av mötet.
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
          summary: { type: Type.STRING }
        }
      }
    }
  });

  const responseData = JSON.parse(response.text);

  await db.meetings.update(meetingId, {
    transcription: responseData.transcription,
    protocol: {
      summary: responseData.summary
    },
    isProcessed: true
  });

  return responseData;
};

export const reprocessMeetingFromText = async (meetingId: string) => {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) throw new Error("API-nyckel saknas");

  const meeting = await db.meetings.get(meetingId);
  const allPeople = await db.people.toArray();
  
  if (!meeting || !meeting.transcription) throw new Error("Möte eller transkribering saknas");

  const ai = new GoogleGenAI({ apiKey });
  
  const fullText = meeting.transcription
    .map(t => `[${Math.floor(t.start/60)}:${Math.floor(t.start%60).toString().padStart(2, '0')}] ${t.speaker ? t.speaker + ': ' : ''}${t.text}`)
    .join('\n');
    
  const peopleNames = allPeople.map(p => p.name).join(', ');

  const project = meeting.projectId ? await db.projects.get(meeting.projectId) : null;
  const category = meeting.categoryId ? await db.categories.get(meeting.categoryId) : null;

  const prompt = `
    Du är en professionell mötessekreterare. Här är en manuellt korrigerad transkribering av ett möte.
    Mötestitel: ${meeting.title}. Projekt: ${project?.name || 'Inget'}. Kategori: ${category?.name || 'Ingen'}.
    Kända personer i systemet (för uppgifter): ${peopleNames}.

    UPPGIFT:
    1. Skriv en professionell sammanfattning av mötet.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING }
        }
      }
    }
  });

  const responseData = JSON.parse(response.text);

  await db.meetings.update(meetingId, {
    protocol: {
      summary: responseData.summary
    }
  });

  return responseData;
};
