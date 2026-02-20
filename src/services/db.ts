import Dexie, { type Table } from 'dexie';
import { Meeting, Person, Task, AudioFile, Project, CategoryData, ProjectMember, Tag, ProcessingJob } from '../types';

export class MeetingDB extends Dexie {
  meetings!: Table<Meeting, string>;
  people!: Table<Person, string>;
  tasks!: Table<Task, string>;
  audioFiles!: Table<AudioFile, string>;
  projects!: Table<Project, string>;
  categories!: Table<CategoryData, string>;
  projectMembers!: Table<ProjectMember, string>;
  tags!: Table<Tag, string>;
  processingJobs!: Table<ProcessingJob, string>; // KÖ-SYSTEMET

  constructor() {
    super('RecallCRM');

    this.version(4).stores({
      meetings: 'id, date, projectId, categoryId, *participantIds',
      people: 'id, name, *projectIds',
      tasks: 'id, status, assignedToId, linkedMeetingId',
      audioFiles: 'id',
      projects: 'id, name',
      categories: 'id, projectId',
      projectMembers: 'id, projectId, personId, group'
    });

    this.version(5).stores({
      tasks: 'id, status, assignedToId, linkedMeetingId, createdAt'
    });

    this.version(6).stores({
      tags: 'id, projectId',
      meetings: 'id, date, projectId, categoryId, *participantIds, *tagIds'
    });

    // NY VERSION FÖR KÖN
    this.version(7).stores({
      processingJobs: 'id, meetingId, status, createdAt'
    });
  }
}

export const db = new MeetingDB();

export async function addProjectMember(projectId: string, personId: string, group: any, customRole?: string) {
  return await db.projectMembers.add({
    id: crypto.randomUUID(),
    projectId,
    personId,
    group,
    customRole
  });
}
