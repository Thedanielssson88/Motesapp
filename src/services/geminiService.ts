import { GoogleGenAI } from "@google/genai";
import { db } from "./db";
import { MemberGroup, Task, TaskStatus } from "../types";

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

// --- Kärnfunktioner för AI-interaktion (omskrivna för robusthet) ---

// Hämtar AI-klienten på ett säkert och asynkront sätt.
const getAIClient = async () => {
  const apiKeySetting = await db.settings.get('geminiApiKey');
  const apiKey = apiKeySetting?.value;
  if (!apiKey) {
    console.warn("API-nyckel för Gemini saknas i databasen.");
    return null;
  }
  return new GoogleGenAI(apiKey);
};

// Kontrollerar API-nyckelns existens asynkront.
export const hasApiKey = async () => {
  try {
    const setting = await db.settings.get('geminiApiKey');
    return !!setting?.value; // Returnerar true om nyckeln finns och inte är en tom sträng.
  } catch (error) {
    console.error("Fel vid kontroll av API-nyckel:", error);
    return false;
  }
};

// Hämtar AI-modellens namn asynkront.
const getModelName = async () => {
  const modelSetting = await db.settings.get('aiModel');
  const modelKey = modelSetting?.value || 'flash';
  return modelKey === 'pro' ? 'gemini-1.5-pro-latest' : 'gemini-1.5-flash-latest';
};

// Bygger upp prompten med all nödvändig kontext.
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
    Baserat på ljudfilen eller texten, utför följande uppgifter och svara ALLTID i JSON-format.

    1.  **Sammanfattning (summary):** Skriv en koncis men heltäckande sammanfattning av mötets syfte, diskussioner och slutsatser. Använd mellan 3 och 6 meningar.
    
    2.  **Beslut (decisions):** Identifiera och lista alla konkreta beslut som fattades. Varje beslut ska vara en sträng i en array. Om inga beslut fattades, returnera en tom array. Formulera besluten tydligt och aktivt.

    3.  **Uppgifter (tasks):** Identifiera och lista alla uppgifter som delegerades. Varje uppgift ska vara ett objekt i en array med fälten \\\`title\\\` (sträng), och \\\`assignedTo\\\` (sträng, namnet på den ansvarige). Matcha namnet på den ansvarige mot deltagarlistan. Om en uppgift nämns utan att en ansvarig utses, sätt \\\`assignedTo\\\` till "Okänd".

    4.  **Transkribering (transcription):** Om du analyserar en ljudfil, transkribera den ordagrant. Identifiera vem som pratar och märk dem med deras namn från deltagarlistan, eller "Okänd talare".
  `;
}

// --- Huvudfunktioner för export ---

export const processMeetingAI = async (meetingId: string) => {
  const ai = await getAIClient();
  if (!ai) throw new Error("API-nyckel saknas. Gå till inställningar för att ange en.");

  const modelName = await getModelName();
  const meeting = await db.meetings.get(meetingId);
  const audioFile = await db.audioFiles.get(meetingId);

  if (!meeting || !audioFile) throw new Error("Nödvändig mötes- eller ljuddata kunde inte hittas.");

  const prompt = await buildPrompt(meetingId);
  const base64Audio = await blobToBase64(audioFile.blob);
  
  const model = ai.getGenerativeModel({ model: modelName });

  const result = await model.generateContent({
    contents: [{
        parts: [
            { text: prompt },
            { inlineData: { mimeType: audioFile.mimeType, data: base64Audio } }
        ]
    }],
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  const response = result.response;
  const responseData = JSON.parse(response.text());
  await updateMeetingWithAIData(meetingId, responseData);
  return responseData;
};

export const reprocessMeetingFromText = async (meetingId: string) => {
  const ai = await getAIClient();
  if (!ai) throw new Error("API-nyckel saknas. Gå till inställningar för att ange en.");
  
  const modelName = await getModelName();
  const meeting = await db.meetings.get(meetingId);

  if (!meeting || !meeting.transcription) throw new Error("Möte eller befintlig transkribering saknas");

  const prompt = await buildPrompt(meetingId);
  const fullText = meeting.transcription
    .map(t => `${t.speaker ? t.speaker + ': ' : ''}${t.text}`)
    .join('\\n');

  const model = ai.getGenerativeModel({ model: modelName });

  const result = await model.generateContent({
    contents: [{
        parts: [
            { text: prompt },
            { text: `Här är den fullständiga transkriberingen:\\n\\n${fullText}` }
        ]
    }],
    generationConfig: {
      responseMimeType: "application/json",
    }
  });
  
  const response = result.response;
  const responseData = JSON.parse(response.text());
  await updateMeetingWithAIData(meetingId, responseData, false); // Reprocess, så skriv inte över transkribering
  return responseData;
};

// --- Databasuppdatering ---

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

  if (shouldUpdateTranscription) {
    updateData.transcription = data.transcription || [];
  }

  await db.meetings.update(meetingId, updateData);
}
