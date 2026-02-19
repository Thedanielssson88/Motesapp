export enum MemberGroup {
  STEERING = 'Styrgrupp',
  CORE_TEAM = 'Projektgrupp',
  REFERENCE = 'Referensgrupp',
  STAKEHOLDER = 'Intressent',
  OTHER = 'Övrig'
}

export interface ProjectMember {
  id: string;
  projectId: string;
  personId: string;
  group: MemberGroup;
  customRole?: string;
}

export interface Setting {
  id: 'geminiApiKey' | 'aiModel';
  value: string;
}

export interface Project {
  id: string;
  name: string;
  color?: string;
  definedRoles?: string[];
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
  role: string;
  region: string;
  email?: string;
  avatarColor?: string;
  projectIds: string[];
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  assignedToId?: string;
  linkedMeetingId?: string;
  deadline?: string;
  createdAt: string;
  originTimestamp?: number;
  projectId?: string;
  categoryId?: string;
  subCategoryName?: string;
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

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: number;
  projectId?: string; 
  categoryId?: string; 
  subCategoryName?: string;
  participantIds: string[];
  absentParticipantIds?: string[];
  description?: string;
  isProcessed: boolean;
  transcription?: TranscriptionSegment[];
  protocol?: MeetingProtocol;
  quickNotes?: QuickNote[];
  speakerMap?: Record<string, string>;
}

export interface AudioFile {
  id: string;
  meetingId: string; // EXPLICIT KOPPLING
  blob: Blob;
  mimeType: string;
}
