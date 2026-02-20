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
  Analysera mötet och skapa ett JSON-svar med exakt denna struktur:
  1. summary: Exakt 3-5 meningar som sammanfattar mötets syfte och utfall.
  2. detailedProtocol: Ett strukturerat, professionellt mötesprotokoll formatterat i HTML (<h3>, <p>, <ul>, <li>, <strong>). 
     - OBS: Detta ska vara en SAMMANSTÄLLNING av diskussionerna uppdelat i ämnen/rubriker.
     - VIKTIGT: Lägg ABSOLUT INTE in den ordagranna dialogen eller transkriberingen här!
  3. decisions: En lista med korta, tydliga beslut som togs.
  4. tasks: En lista med uppgifter i formatet { title, assignedTo }.
  5. transcription: En ordagrann transkribering av ljudet. Detta ska vara en array där varje objekt innehåller start (sekunder), end (sekunder), text (vad som sades) och speaker (vem som sa det).
  - Om du vet vem som pratar från sammanhanget, använd deras namn från deltagarlistan.
  - Om du INTE vet vem som pratar, döp dem konsekvent till "Talare 1", "Talare 2" osv.`;
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
  await updateMeetingWithAIData(meetingId, responseData, true); // True betyder att vi vill spara transkriberingen från ljudet
  return responseData;
};

// TEXT-ANALYS
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
  
  const resultPromise = ai.models.generateContent({
    model: modelName,
    contents: [{ parts: [{ text: prompt }, { text: `\n\n--- TRANSKRIBERING ATT ANALYSERA ---\n${fullText}` }] }],
    config: { responseMimeType: "application/json", responseSchema: responseSchema }
  });

  const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout: Analysen tog för lång tid.")), 180000));
  
  const result = await Promise.race([resultPromise, timeoutPromise]);

  onProgress?.(90, 'Sparar protokoll...');
  const responseData = JSON.parse(result.text || "{}");
  
  // False betyder att vi INTE skriver över den befintliga transkriberingen i databasen
  // eftersom vi redan har den (vi skickade ju in den som text).
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
    protocol: { 
        summary: data.summary || '', 
        detailedProtocol: data.detailedProtocol || '', 
        decisions: data.decisions || [] 
    },
    isProcessed: true
  };
  
  // Bara spara transkriberingen om AI:n faktiskt levererade en OCH vi bad om det
  if (shouldUpdateTranscription && data.transcription && data.transcription.length > 0) {
      updateData.transcription = data.transcription;
  }

  await db.meetings.update(meetingId, updateData);
}
