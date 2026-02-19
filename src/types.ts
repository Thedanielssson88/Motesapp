// --- NYA TYPER FÖR ROLLER ---
export enum MemberGroup {
  STEERING = 'Styrgrupp',
  CORE_TEAM = 'Projektgrupp',
  REFERENCE = 'Referensgrupp',
  STAKEHOLDER = 'Intressent',
  OTHER = 'Övrig'
}

export interface ProjectMember {
  id: string;          // Unikt ID för just denna koppling
  projectId: string;   // Projektet det gäller
  personId: string;    // Personen det gäller
  group: MemberGroup;  // Huvudnivå (t.ex. Styrgrupp)
  customRole?: string; // Fritext/Specifik roll i detta projekt (t.ex. "Scrum Master")
}

// --- BEFINTLIGA TYPER (UPPDATERADE) ---
export interface Project {
  id: string;
  name: string;
  color?: string;
  definedRoles?: string[]; // NY: Unika roller man kan välja i just detta projekt
}

export interface CategoryData {
  id: string;
  projectId: string; 
  name: string;
  subCategories: string[];
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Person {
  id: string;
  name: string;
  role: string; // Detta blir personens "Globala/Yrkestitel" (t.ex. Utvecklare)
  region: string;
  email?: string;
  avatarColor?: string;
  projectIds: string[]; // Behålls för enkel bakåtkompatibilitet
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  assignedToId?: string;
  linkedMeetingId?: string;
  deadline?: string;
  createdAt: string;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface MeetingProtocol {
  summary: string;
  decisions?: string[];
}

export interface PersonLog {
  id: string;
  personId: string;
  date: string;
  text: string;
}

export interface QuickNote {
  timestamp: number;
  text: string;
}


// ... Behåll Task, TranscriptionSegment, MeetingProtocol, PersonLog, QuickNote oförändrade ...

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: number;
  projectId?: string; 
  categoryId?: string; 
  subCategoryName?: string;
  participantIds: string[];
  absentParticipantIds?: string[]; // Din frånvarofunktion är kvar!
  description?: string;
  isProcessed: boolean;
  
  transcription?: TranscriptionSegment[];
  protocol?: MeetingProtocol;
  quickNotes?: QuickNote[];
  speakerMap?: Record<string, string>;
}

export interface AudioFile {
  id: string;
  blob: Blob;
  mimeType: string;
}
