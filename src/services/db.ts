import Dexie, { type Table } from 'dexie';
import { Meeting, Person, Task, AudioFile, PersonLog } from '../types';

export class MeetingDB extends Dexie {
  meetings!: Table<Meeting, string>;
  people!: Table<Person, string>;
  tasks!: Table<Task, string>;
  audioFiles!: Table<AudioFile, string>;
  personLogs!: Table<PersonLog, string>;

  constructor() {
    super('RecallCRM');
    this.version(1).stores({
      meetings: 'id, date, category, *participantIds',
      people: 'id, name',
      tasks: 'id, status, assignedToId, linkedMeetingId',
      audioFiles: 'id',
      personLogs: 'id, personId, date'
    });
  }
}

export const db = new MeetingDB();

export const seedDatabase = async () => {
  const count = await db.people.count();
  if (count === 0) {
    await db.people.bulkAdd([
      { id: '1', name: 'Anna Andersson', role: 'Projektledare', region: 'Stockholm', avatarColor: 'bg-blue-100 text-blue-600' },
      { id: '2', name: 'Erik Ek', role: 'Utvecklare', region: 'Remote', avatarColor: 'bg-green-100 text-green-600' },
      { id: '3', name: 'Sara Svensson', role: 'Säljchef', region: 'Göteborg', avatarColor: 'bg-purple-100 text-purple-600' },
    ]);
  }
};
