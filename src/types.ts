export enum MemberGroup {
  STEERING = 'Styrgrupp',
  CORE_TEAM = 'Projektgrupp',
  REFERENCE = 'Referensgrupp',
  STAKEHOLDER = 'Intressent',
  OTHER = 'Övrig'
}

export interface Person {
  id: string;
  name: string;
  role: string;
  region?: string;
  department?: string;
  email?: string;
  avatarColor?: string;
  projectIds: string[];
}

export interface Task {
  id: string;
  title: string;
  status: 'todo' | 'done';
  assignedToId?: string;
  linkedMeetingId?: string;
  createdAt: string;
  projectId?: string;
  originTimestamp?: number;
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
  tagIds?: string[];
  isProcessed: boolean;
  transcription?: { start: number; end: number; text: string; speaker?: string }[];
  protocol?: {
    summary: string;
    detailedProtocol?: string;
    decisions?: string[];
  };
  quickNotes?: { timestamp: number; text: string }[];
}

export interface Tag {
  id: string;
  name: string;
  projectId: string;
}

export interface AudioFile {
  id: string;
  blob: Blob;
  mimeType: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
}

export interface CategoryData {
  id: string;
  name: string;
  projectId: string;
  subCategories: string[];
}

export interface ProjectMember {
  id: string;
  projectId: string;
  personId: string;
  group: MemberGroup;
  customRole?: string;
}

// --- NYA TYPER FÖR KÖ-SYSTEMET ---
export type JobStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface ProcessingJob {
  id: string;
  meetingId: string;
  type: 'audio' | 'text';
  status: JobStatus;
  progress: number;
  message?: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}
