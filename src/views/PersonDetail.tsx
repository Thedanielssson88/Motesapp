import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

export const PersonDetail = () => {
  const { id } = useParams<{ id: string }>();
  const person = useLiveQuery(() => db.people.get(id!), [id]);
  const projects = useLiveQuery(() => db.projects.toArray());
  const projectMemberships = useLiveQuery(() => db.projectMembers.where('personId').equals(id!).toArray(), [id]);
  const meetings = useLiveQuery(() => db.meetings.where('participantIds').equals(id!).toArray(), [id]);
  const tasks = useLiveQuery(() => db.tasks.where('assignedToId').equals(id!).toArray(), [id]);
  const [activeTab, setActiveTab] = useState<'projects' | 'meetings' | 'tasks'>('projects');

  if (!person) return <div>Laddar...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white p-6 shadow-sm sticky top-0 z-10">
        <Link to="/people" className="absolute top-6 left-4 p-2 bg-gray-100 rounded-full"><ArrowLeft size={20} /></Link>
        <div className="flex flex-col items-center text-center pt-8">
          <div className={`w-24 h-24 rounded-full ${person.avatarColor || 'bg-gray-200'} flex items-center justify-center text-4xl font-bold mb-2`}>
            {person.name.charAt(0)}
          </div>
          <h1 className="text-2xl font-bold">{person.name}</h1>
          <p className="text-gray-500">{person.title} • {person.region}</p>
        </div>
        <div className="flex gap-4 mt-6 border-b justify-center">
          <button onClick={() => setActiveTab('projects')} className={`pb-2 font-medium text-sm ${activeTab === 'projects' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>Projekt</button>
          <button onClick={() => setActiveTab('meetings')} className={`pb-2 font-medium text-sm ${activeTab === 'meetings' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>Möten</button>
          <button onClick={() => setActiveTab('tasks')} className={`pb-2 font-medium text-sm ${activeTab === 'tasks' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>Uppgifter</button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'projects' && (
          <div className="space-y-4">
            {projectMemberships?.map(pm => {
              const project = projects?.find(p => p.id === pm.projectId);
              return project ? (
                <div key={pm.id} className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-bold">{project.name}</h3>
                  <p className="text-sm text-gray-600">{pm.group}{pm.customRole && ` (${pm.customRole})`}</p>
                </div>
              ) : null;
            })}
          </div>
        )}
        {activeTab === 'meetings' && (
          <div className="space-y-4">
            {meetings?.map(m => <div key={m.id} className="bg-white p-4 rounded-lg shadow-sm">{m.title}</div>)}
          </div>
        )}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {tasks?.map(t => <div key={t.id} className="bg-white p-4 rounded-lg shadow-sm">{t.title}</div>)}
          </div>
        )}
      </div>
    </div>
  );
};
