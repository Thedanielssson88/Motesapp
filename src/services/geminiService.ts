import { GoogleGenAI, GenerationConfig, Content, Part } from "@google/genai";
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
  return new GoogleGenAI(apiKey);
};

export const hasApiKey = () => {
  return !!localStorage.getItem('GEMINI_API_KEY');
};

const getModelName = () => {
  const model = localStorage.getItem('GEMINI_MODEL') || 'flash';
  return model === 'pro' ? 'gemini-1.5-pro-latest' : 'gemini-1.5-flash-latest';
};

// --- PROMPTBYGGARE OCH DATABASUPPDATERING ---
const buildPrompt = async (meetingId: string): Promise<string> => {
  const meeting = await db.meetings.get(meetingId);
  if (!meeting) throw new Error("Mötet kunde inte hittas i databasen.");

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
    Baserat på ljudfilen eller texten, utför följande uppgifter och svara ALLTID i ett strikt JSON-format.

    1.  **transcription:** Transkribera ljudet ordagrant. Identifiera vem som pratar och märk dem med deras namn från deltagarlistan, eller "Okänd talare". Varje del av transkriberingen ska vara ett objekt med \`start\`, \`end\`, \`text\`, och \`speaker\`.
    2.  **summary:** Skriv en koncis men heltäckande sammanfattning av mötets syfte, diskussioner och slutsatser.
    3.  **decisions:** Identifiera och lista alla konkreta beslut som fattades. Varje beslut ska vara en sträng i en array. Om inga beslut fattades, returnera en tom array.
    4.  **tasks:** Identifiera och lista alla uppgifter som delegerades. Varje uppgift ska vara ett objekt i en array med \`title\` (sträng) och \`assignedTo\` (sträng, namnet på den ansvarige). Matcha namnet på den ansvarige mot deltagarlistan. Om en uppgift nämns utan att en ansvarig utses, sätt \`assignedTo\` till "Okänd".
  `;
}

// --- HUVUDFUNKTIONER MED KORREKT SYNTAX ---
export const processMeetingAI = async (meetingId: string) => {
  const ai = getAIClient();
  if (!ai) throw new Error("API-nyckel saknas. Gå till inställningar för att ange en.");

  const modelName = getModelName();
  const meeting = await db.meetings.get(meetingId);
  const audioFile = await db.audioFiles.get(meetingId);

  if (!meeting || !audioFile) throw new Error("Nödvändig mötes- eller ljuddata kunde inte hittas.");
  
  const model = ai.getGenerativeModel({ 
    model: modelName, 
    generationConfig: { responseMimeType: "application/json" } 
  });

  const prompt = await buildPrompt(meetingId);
  const base64Audio = await blobToBase64(audioFile.blob);

  const contents: Content[] = [{
    role: 'user',
    parts: [
      { text: prompt },
      { inlineData: { mimeType: audioFile.mimeType, data: base64Audio } }
    ]
  }];

  const result = await model.generateContent({ contents });

  const responseText = result.response.text();
  const responseData = JSON.parse(responseText);
  
  await updateMeetingWithAIData(meetingId, responseData);
  return responseData;
};

export const reprocessMeetingFromText = async (meetingId: string) => {
  const ai = getAIClient();
  if (!ai) throw new Error("API-nyckel saknas. Gå till inställningar för att ange en.");
  
  const modelName = getModelName();
  const meeting = await db.meetings.get(meetingId);

  if (!meeting || !meeting.transcription) throw new Error("Möte eller befintlig transkribering saknas");
  
  const model = ai.getGenerativeModel({ 
    model: modelName, 
    generationConfig: { responseMimeType: "application/json" } 
  });

  const prompt = await buildPrompt(meetingId);
  const fullText = meeting.transcription
    .map(t => `${t.speaker ? t.speaker + ': ' : ''}${t.text}`)
    .join('\n');

  const contents: Content[] = [{
    role: 'user',
    parts: [
      { text: prompt },
      { text: `\n\n--- TRANSKRIBERING ATT ANALYSERA ---\n${fullText}` }
    ]
  }];
  
  const result = await model.generateContent({ contents });
  
  const responseText = result.response.text();
  const responseData = JSON.parse(responseText);

  await updateMeetingWithAIData(meetingId, responseData, false); 
  return responseData;
};

// --- DATABASUPPDATERING ---
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