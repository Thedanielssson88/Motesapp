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
  projectMembers!: Table<ProjectMember, string>;

  constructor() {
    super('RecallCRM');
    this.version(2).stores({
      meetings: 'id, date, projectId, categoryId, *participantIds',
      people: 'id, name',
      tasks: 'id, status, assignedToId, linkedMeetingId',
      audioFiles: 'id',
      personLogs: 'id, personId, date',
      projects: 'id, name',
      categories: 'id, projectId',
      projectMembers: 'id, projectId, personId, group'
    });
  }
}

export const db = new MeetingDB();

export const seedDatabase = async () => {
  const count = await db.people.count();
  if (count === 0) {
    await db.people.bulkAdd([
      { id: '1', name: 'Anna Andersson', title: 'Projektledare', region: 'Stockholm', avatarColor: 'bg-blue-100 text-blue-600' },
      { id: '2', name: 'Erik Ek', title: 'Utvecklare', region: 'Remote', avatarColor: 'bg-green-100 text-green-600' },
      { id: '3', name: 'Sara Svensson', title: 'Säljchef', region: 'Göteborg', avatarColor: 'bg-purple-100 text-purple-600' },
    ]);
  }
};
