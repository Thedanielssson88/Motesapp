import { GoogleGenAI, Type } from "@google/genai";
import { db } from "./db";
import { Task, TaskStatus } from "../types";

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        resolve((reader.result as string).split(',')[1]);
      } else {
        reject(new Error("Kunde inte konvertera ljudfilen."));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- SYNKRONA HJÄLPFUNKTIONER (Använder LocalStorage) ---
const getAIClient = () => {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey }); 
};

export const hasApiKey = () => {
  return !!localStorage.getItem('GEMINI_API_KEY');
};

const getModelName = () => {
  const model = localStorage.getItem('GEMINI_MODEL') || 'flash';
  return model === 'pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
};

const responseSchema = {
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
          assignedTo: { type: Type.STRING }
        }
      }
    }
  }
};

const buildPrompt = async (meetingId: string): Promise<string> => {
  const meeting = await db.meetings.get(meetingId);
  if (!meeting) throw new Error("Mötet kunde inte hittas.");

  const project = meeting.projectId ? await db.projects.get(meeting.projectId) : null;
  const participants = await db.people.where('id').anyOf(meeting.participantIds).toArray();
  const projectMembers = project ? await db.projectMembers.where('projectId').equals(project.id).toArray() : [];

  const peopleWithRoles = participants.map(p => {
    const pMember = projectMembers.find(pm => pm.personId === p.id);
    const roleText = pMember ? `(${pMember.group}${pMember.customRole ? ', ' + pMember.customRole : ''})` : `(${p.role || 'Deltagare'})`;
    return `${p.name} ${roleText}`;
  }).join(', ');

  return `
    Du är en expert på att analysera och sammanfatta affärsmöten på svenska.
    
    **MÖTESINFORMATION:**
    - **Titel:** ${meeting.title}
    - **Projekt:** ${project?.name || 'Ej specificerat'}
    - **Datum:** ${new Date(meeting.date).toLocaleDateString('sv-SE')}
    - **Deltagare och deras roller i detta projekt:** ${peopleWithRoles}

    **DITT UPPDRAG:**
    Baserat på ljudfilen eller texten, utför följande uppgifter:

    1.  **Sammanfattning (summary):** Skriv en koncis men heltäckande sammanfattning av mötets syfte, diskussioner och slutsatser.
    2.  **Beslut (decisions):** Identifiera och lista alla konkreta beslut som fattades.
    3.  **Uppgifter (tasks):** Identifiera och lista alla uppgifter som delegerades. Försök matcha namnet på den ansvarige mot deltagarlistan.
    4.  **Transkribering (transcription):** Om du analyserar en ljudfil, transkribera den ordagrant och tidsstämpla. Identifiera vem som pratar.
  `;
}

// --- HUVUDFUNKTIONER ---
export const processMeetingAI = async (meetingId: string) => {
  const ai = getAIClient();
  if (!ai) throw new Error("API-nyckel saknas. Gå till inställningar.");

  const modelName = getModelName();
  const meeting = await db.meetings.get(meetingId);
  const audioFile = await db.audioFiles.get(meetingId);

  if (!meeting || !audioFile) throw new Error("Data kunde inte hittas.");

  const prompt = await buildPrompt(meetingId);
  const base64Audio = await blobToBase64(audioFile.blob);

  // KORREKT SYNTAX: ai.models.generateContent
  const result = await ai.models.generateContent({
    model: modelName,
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
      responseSchema: responseSchema
    }
  });

  const responseData = JSON.parse(result.text || "{}");
  await updateMeetingWithAIData(meetingId, responseData);
  return responseData;
};

export const reprocessMeetingFromText = async (meetingId: string) => {
  const ai = getAIClient();
  if (!ai) throw new Error("API-nyckel saknas. Gå till inställningar.");
  
  const modelName = getModelName();
  const meeting = await db.meetings.get(meetingId);

  if (!meeting || !meeting.transcription) throw new Error("Möte eller befintlig transkribering saknas");

  const prompt = await buildPrompt(meetingId);
  const fullText = meeting.transcription
    .map(t => `${t.speaker ? t.speaker + ': ' : ''}${t.text}`)
    .join('\n');

  // KORREKT SYNTAX: ai.models.generateContent
  const result = await ai.models.generateContent({
    model: modelName,
    contents: [
      {
        parts: [
          { text: prompt },
          { text: `\n\n--- TRANSKRIBERING ATT ANALYSERA ---\n${fullText}` }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema
    }
  });
  
  const responseData = JSON.parse(result.text || "{}");
  await updateMeetingWithAIData(meetingId, responseData, false); 
  return responseData;
};

const updateMeetingWithAIData = async (meetingId: string, data: any, shouldUpdateTranscription = true) => {
  const meeting = await db.meetings.get(meetingId);
  if (!meeting) return;

  const allPeople = await db.people.toArray();

  if (data.tasks && data.tasks.length > 0) {
    const newTasks: Task[] = data.tasks.map((task: any) => {
      const assignedPerson = allPeople.find(p => p.name.toLowerCase() === task.assignedTo?.toLowerCase());
      return {
        id: crypto.randomUUID(),
        title: task.title,
        status: 'todo' as TaskStatus,
        assignedToId: assignedPerson?.id,
        linkedMeetingId: meetingId,
        createdAt: new Date().toISOString()
      }
    });
    await db.tasks.bulkAdd(newTasks);
  }

  const updateData: Partial<any> = {
    protocol: {
      summary: data.summary || '',
      decisions: data.decisions || []
    },
    isProcessed: true
  };

  if (shouldUpdateTranscription && data.transcription) {
    updateData.transcription = data.transcription;
  }

  await db.meetings.update(meetingId, updateData);
}