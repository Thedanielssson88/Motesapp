export type Category = 'Sälj' | 'Projekt' | 'HR' | 'Idéer' | 'Övrigt';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Person {
  id: string;
  name: string;
  role: string;
  region: string;
  email?: string;
  avatarColor?: string;
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
  decisions: string[];
  notes: string;
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

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: number;
  category: Category;
  participantIds: string[];
  description?: string;
  isProcessed: boolean;
  
  transcription?: TranscriptionSegment[];
  protocol?: MeetingProtocol;
  quickNotes?: QuickNote[];
}

export interface AudioFile {
  id: string;
  blob: Blob;
  mimeType: string;
}
