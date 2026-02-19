import Dexie, { type Table } from 'dexie';
import { Meeting, Person, Task, AudioFile, PersonLog, Project, CategoryData, ProjectMember } from '../types';

export class MeetingDB extends Dexie {
  meetings!: Table<Meeting, string>;
  people!: Table<Person, string>;
  tasks!: Table<Task, string>;
  audioFiles!: Table<AudioFile, string>;
  personLogs!: Table<PersonLog, string>;
  projects!: Table<Project, string>;
  categories!: Table<CategoryData, string>;
  projectMembers!: Table<ProjectMember, string>; // NY TABELL

  constructor() {
    super('RecallCRM');
    // VIKTIGT: Höj versionen till 2 så databasen uppdateras i webbläsaren!
    this.version(2).stores({
      meetings: 'id, date, projectId, categoryId, *participantIds',
      people: 'id, name, *projectIds',
      tasks: 'id, status, assignedToId, linkedMeetingId',
      audioFiles: 'id',
      personLogs: 'id, personId, date',
      projects: 'id, name',
      categories: 'id, projectId',
      projectMembers: 'id, projectId, personId, group' // Indexera så vi kan hitta alla i "Styrgruppen" snabbt
    });
  }
}

export const db = new MeetingDB();

export const seedDatabase = async () => {
  // This is an empty function to prevent the app from crashing.
};
