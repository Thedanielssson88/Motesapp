import Dexie, { type Table } from 'dexie';
import { Meeting, Person, Task, AudioFile, Project, CategoryData, ProjectMember, Tag, ProcessingJob, MemberGroup } from '../types';

export class MeetingDB extends Dexie {
  meetings!: Table<Meeting, string>;
  people!: Table<Person, string>;
  tasks!: Table<Task, string>;
  audioFiles!: Table<AudioFile, string>;
  projects!: Table<Project, string>;
  categories!: Table<CategoryData, string>;
  projectMembers!: Table<ProjectMember, string>;
  tags!: Table<Tag, string>;
  processingJobs!: Table<ProcessingJob, string>; 

  constructor() {
    super('RecallCRM');

    // Version 4 - MÅSTE VARA KVAR FÖR ATT UPPDATERINGEN SKA FUNGERA
    this.version(4).stores({
      meetings: 'id, date, projectId, categoryId, *participantIds',
      people: 'id, name, *projectIds',
      tasks: 'id, status, assignedToId, linkedMeetingId',
      audioFiles: 'id',
      projects: 'id, name',
      categories: 'id, projectId',
      projectMembers: 'id, projectId, personId, group'
    });

    // Version 5 
    this.version(5).stores({
      tasks: 'id, status, assignedToId, linkedMeetingId, createdAt'
    });

    // Version 6 (Lade till taggar)
    this.version(6).stores({
      tags: 'id, projectId',
      meetings: 'id, date, projectId, categoryId, *participantIds, *tagIds'
    });

    // Version 7 (Lade till kö-systemet)
    this.version(7).stores({
      processingJobs: 'id, meetingId, status, createdAt'
    });
  }
}

export const db = new MeetingDB();

export const seedDatabase = async () => {};

// --- CRUD-funktioner för Projekt ---

export async function addProject(project: Omit<Project, 'id'>): Promise<string> {
  const newProject = { ...project, id: crypto.randomUUID() };
  await db.projects.add(newProject);
  return newProject.id;
}

export async function getAllProjects(): Promise<Project[]> {
  return await db.projects.toArray();
}

export async function getProject(id: string): Promise<Project | undefined> {
  return await db.projects.get(id);
}

export async function updateProject(id: string, changes: Partial<Project>): Promise<number> {
  return await db.projects.update(id, changes);
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.projectMembers, db.categories, db.meetings, async () => {
    await db.projectMembers.where({ projectId: id }).delete();
    await db.categories.where({ projectId: id }).delete();
    await db.meetings.where({ projectId: id }).modify({ projectId: undefined, categoryId: undefined });
    await db.projects.delete(id);
  });
}

// --- CRUD-funktioner för Kategorier ---

export async function addCategory(category: Omit<CategoryData, 'id'>): Promise<string> {
  const newCategory = { ...category, id: crypto.randomUUID() };
  await db.categories.add(newCategory);
  return newCategory.id;
}

export async function getCategoriesForProject(projectId: string): Promise<CategoryData[]> {
  return await db.categories.where({ projectId }).toArray();
}

export async function updateCategory(id: string, changes: Partial<CategoryData>): Promise<number> {
  return await db.categories.update(id, changes);
}

export async function deleteCategory(id: string): Promise<void> {
  await db.transaction('rw', db.categories, db.meetings, async () => {
    await db.meetings.where({ categoryId: id }).modify({ categoryId: undefined });
    await db.categories.delete(id);
  });
}

// --- CRUD-funktioner för Projektmedlemmar ---

export async function addProjectMember(projectId: string, personId: string, group: MemberGroup, customRole?: string): Promise<string> {
  const newMember: ProjectMember = {
    id: crypto.randomUUID(),
    projectId,
    personId,
    group,
    customRole
  };
  await db.projectMembers.add(newMember);
  return newMember.id;
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  return await db.projectMembers.where({ projectId }).toArray();
}

export async function getProjectsForPerson(personId: string): Promise<ProjectMember[]> {
  return await db.projectMembers.where({ personId }).toArray();
}

export async function updateProjectMember(id: string, changes: Partial<ProjectMember>): Promise<number> {
  return await db.projectMembers.update(id, changes);
}

export async function removeProjectMember(id: string): Promise<void> {
  await db.projectMembers.delete(id);
}