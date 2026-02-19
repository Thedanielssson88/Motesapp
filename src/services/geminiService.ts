import { GoogleGenAI, HarmBlockThreshold, HarmCategory, type Content, type GenerationConfig, type SafetySetting } from "@google/genai";
import { db } from "./db";
import { MemberGroup, Person, Project, ProjectMember, Task, TaskStatus, TranscriptionSegment } from "../types";

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });
};

// This function now returns null if the key is not set, instead of throwing an error.
const getAIClient = () => {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) return null;
  return new GoogleGenAI(apiKey);
}

// New exported function to check if the API key is set.
export const hasApiKey = () => {
    return localStorage.getItem('GEMINI_API_KEY') !== null;
}

const getModelName = () => {
  return localStorage.getItem('AI_MODEL') || 'flash';
}

const buildPrompt = async (meetingId: string): Promise<string> => {
  const meeting = await db.meetings.get(meetingId);
  if (!meeting) throw new Error("Mötet kunde inte hittas");

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
        *Exempel: "Styrgruppen godkände budgeten för Q3."*
        *VIKTIGT: Fatta inga egna beslut, extrahera endast de som uttryckligen nämns.*

    3.  **Uppgifter (tasks):** Identifiera och lista alla uppgifter som delegerades. Varje uppgift ska vara ett objekt i en array med fälten \\\`title\\\` (sträng), och \\\`assignedTo\\\` (sträng, namnet på den ansvarige). Matcha namnet på den ansvarige mot deltagarlistan. Om en uppgift nämns utan att en ansvarig utses, sätt \\\`assignedTo\\\` till "Okänd". Om inga uppgifter delegerades, returnera en tom array.

    4.  **Transkribering (transcription):** Om du analyserar en ljudfil, transkribera den ordagrant. Inkludera start- och sluttid i sekunder för varje segment. Försök identifiera vem som pratar och märk dem med deras namn från deltagarlistan, eller "Okänd talare" om det inte går att avgöra.
  `;
}

export const processMeetingAI = async (meetingId: string) => {
  const ai = getAIClient();
  if (!ai) throw new Error("API-nyckel saknas. Gå till inställningar för att ange en.");

  const modelName = getModelName() === 'pro' ? 'gemini-1.5-pro-latest' : 'gemini-1.5-flash-latest';

  const meeting = await db.meetings.get(meetingId);
  const audioFile = await db.audioFiles.get(meetingId);
  if (!meeting || !audioFile) throw new Error("Data saknas för mötet");

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
  const ai = getAIClient();
  if (!ai) throw new Error("API-nyckel saknas. Gå till inställningar för att ange en.");
  
  const modelName = getModelName() === 'pro' ? 'gemini-1.5-pro-latest' : 'gemini-1.5-flash-latest';

  const meeting = await db.meetings.get(meetingId);
  if (!meeting || !meeting.transcription) throw new Error("Möte eller transkribering saknas");

  const prompt = await buildPrompt(meetingId);
  const fullText = meeting.transcription
    .map(t => `[${Math.floor(t.start/60)}:${Math.floor(t.start%60).toString().padStart(2, '0')}] ${t.speaker ? t.speaker + ': ' : ''}${t.text}`)
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
  await updateMeetingWithAIData(meetingId, responseData);
  return responseData;
};


const updateMeetingWithAIData = async (meetingId: string, data: any) => {
  const meeting = await db.meetings.get(meetingId);
  if (!meeting) return;

  const allPeople = await db.people.toArray();

  // Add tasks to the tasks table
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

  // Update meeting with protocol and transcription
  await db.meetings.update(meetingId, {
    protocol: {
      summary: data.summary || meeting.protocol?.summary || '',
      decisions: data.decisions || meeting.protocol?.decisions || []
    },
    transcription: data.transcription || meeting.transcription,
    isProcessed: true
  });
}
