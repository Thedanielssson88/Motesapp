import { GoogleGenAI, Type } from "@google/genai";
import { db } from "./db";
import { Task, TaskStatus } from "../types";

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const getAIClient = () => {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey }); 
};

export const hasApiKey = () => !!localStorage.getItem('GEMINI_API_KEY');

const getModelName = () => {
  const model = localStorage.getItem('GEMINI_MODEL') || 'flash';
  return model === 'pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    transcription: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { start: { type: Type.NUMBER }, end: { type: Type.NUMBER }, text: { type: Type.STRING }, speaker: { type: Type.STRING } } } },
    summary: { type: Type.STRING },
    detailedProtocol: { type: Type.STRING },
    decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
    tasks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, assignedTo: { type: Type.STRING } } } }
  }
};

const buildPrompt = async (meetingId: string): Promise<string> => {
  const meeting = await db.meetings.get(meetingId);
  if (!meeting) throw new Error("Mötet kunde inte hittas.");

  const project = meeting.projectId ? await db.projects.get(meeting.projectId) : null;
  const participants = await db.people.where('id').anyOf(meeting.participantIds).toArray();
  const absentParticipants = meeting.absentParticipantIds ? await db.people.where('id').anyOf(meeting.absentParticipantIds).toArray() : [];
  
  const peopleWithRoles = participants.map(p => p.name).join(', ') || 'Inga angivna';
  const absentNames = absentParticipants.map(p => p.name).join(', ') || 'Inga';

  return `Du är en expert på att analysera och dokumentera affärsmöten. Skriv på SVENSKA.
  **MÖTESINFORMATION:**
  - Titel: ${meeting.title}
  - Projekt: ${project?.name || 'Ej specificerat'}
  - Datum: ${new Date(meeting.date).toLocaleDateString('sv-SE')}
  - Närvarande: ${peopleWithRoles}
  - Deltar ej: ${absentNames}

  **DITT UPPDRAG:**
  Skapa ett JSON-svar med följande:
  1. summary: Exakt 3-5 meningar som sammanfattar mötet.
  2. detailedProtocol: Ett utförligt text-protokoll formatterat i HTML (<h3>, <p>, <ul>, <li>, <strong>). Dela upp ämnen med rubriker. Skapa en Action-lista och Datum/Deadlines.
  3. decisions: Lista med korta beslut.
  4. tasks: Lista med uppgifter { title, assignedTo }.
  5. transcription: Ordagrann transkribering (om du kan extrahera det från ljudet).`;
}

export const processMeetingAI = async (meetingId: string, onProgress?: (p: number, msg: string) => void) => {
  const ai = getAIClient();
  if (!ai) throw new Error("API-nyckel saknas. Gå till inställningar.");
  const modelName = getModelName();
  const meeting = await db.meetings.get(meetingId);
  const audioFile = await db.audioFiles.get(meetingId);

  if (!meeting || !audioFile) throw new Error("Data kunde inte hittas.");

  onProgress?.(10, 'Förbereder ljudfil...');
  const prompt = await buildPrompt(meetingId);
  const base64Audio = await blobToBase64(audioFile.blob);

  onProgress?.(40, 'Analyserar ljudet. Detta kan ta en stund...');
  const result = await ai.models.generateContent({
    model: modelName,
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: audioFile.mimeType, data: base64Audio } }] }],
    config: { responseMimeType: "application/json", responseSchema: responseSchema }
  });

  onProgress?.(90, 'Sparar protokoll...');
  const responseData = JSON.parse(result.text || "{}");
  await updateMeetingWithAIData(meetingId, responseData);
  return responseData;
};

// TEXT-ANALYS (Ingen chunking, men skickar in hela texten på en gång)
export const reprocessMeetingFromText = async (meetingId: string, onProgress?: (p: number, msg: string) => void) => {
  const ai = getAIClient();
  if (!ai) throw new Error("API-nyckel saknas. Gå till inställningar.");
  
  const modelName = getModelName();
  const meeting = await db.meetings.get(meetingId);

  if (!meeting || !meeting.transcription) throw new Error("Möte eller transkribering saknas");

  onProgress?.(10, 'Förbereder texten...');
  const prompt = await buildPrompt(meetingId);
  const fullText = meeting.transcription.map(t => `${t.speaker ? t.speaker + ': ' : ''}${t.text}`).join('\n');

  onProgress?.(40, 'Analyserar mötet. Detta kan ta en stund...');
  
  // Använder Promise.race som en fail-safe om nätverket skulle "hänga" sig helt i 3 minuter.
  const resultPromise = ai.models.generateContent({
    model: modelName,
    contents: [{ parts: [{ text: prompt }, { text: `\n\n--- TRANSKRIBERING ATT ANALYSERA ---\n${fullText}` }] }],
    config: { responseMimeType: "application/json", responseSchema: responseSchema }
  });

  // Hård timeout på 3 minuter för att inte fastna för evigt
  const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout: Analysen tog för lång tid.")), 180000));
  
  const result = await Promise.race([resultPromise, timeoutPromise]);

  onProgress?.(90, 'Sparar protokoll...');
  const responseData = JSON.parse(result.text || "{}");
  await updateMeetingWithAIData(meetingId, responseData, false); 
  return responseData;
};

const updateMeetingWithAIData = async (meetingId: string, data: any, shouldUpdateTranscription = true) => {
  const allPeople = await db.people.toArray();
  if (data.tasks && data.tasks.length > 0) {
    const newTasks: Task[] = data.tasks.map((task: any) => ({
      id: crypto.randomUUID(),
      title: task.title,
      status: 'todo' as TaskStatus,
      assignedToId: allPeople.find(p => p.name.toLowerCase() === task.assignedTo?.toLowerCase())?.id,
      linkedMeetingId: meetingId,
      createdAt: new Date().toISOString()
    }));
    await db.tasks.bulkAdd(newTasks);
  }

  const updateData: Partial<any> = {
    protocol: { summary: data.summary || '', detailedProtocol: data.detailedProtocol || '', decisions: data.decisions || [] },
    isProcessed: true
  };
  if (shouldUpdateTranscription && data.transcription) updateData.transcription = data.transcription;

  await db.meetings.update(meetingId, updateData);
}
