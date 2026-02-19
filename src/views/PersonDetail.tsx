import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { User, ArrowLeft, Plus, Edit } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';

export const PersonDetail = () => {
  const { id } = useParams<{ id: string }>();
  const person = useLiveQuery(() => db.people.get(id!), [id]);
  const meetings = useLiveQuery(() => db.meetings.where('participantIds').equals(id!).toArray(), [id]);
  const tasks = useLiveQuery(() => db.tasks.where('assignedToId').equals(id!).toArray(), [id]);
  const projects = useLiveQuery(() => db.projects.toArray());
  const [activeTab, setActiveTab] = useState<'meetings' | 'tasks' | 'log'>('meetings');
  const [isEditingProjects, setIsEditingProjects] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  useState(() => {
    if (person) {
      setSelectedProjects(person.projectIds || []);
    }
  });

  if (!person) return <div>Laddar...</div>;

  const handleProjectToggle = (projectId: string) => {
    const updated = selectedProjects.includes(projectId)
      ? selectedProjects.filter(id => id !== projectId)
      : [...selectedProjects, projectId];
    setSelectedProjects(updated);
  };

  const handleSaveProjects = () => {
    db.people.update(person.id, { projectIds: selectedProjects });
    setIsEditingProjects(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white p-6 shadow-sm sticky top-0 z-10">
        <Link to="/people" className="absolute top-6 left-4 p-2 bg-gray-100 rounded-full"><ArrowLeft size={20} /></Link>
        <div className="flex flex-col items-center text-center pt-8">
          <div className={`w-24 h-24 rounded-full ${person.avatarColor || 'bg-gray-200'} flex items-center justify-center text-4xl font-bold mb-2`}>
            {person.name.charAt(0)}
          </div>
          <h1 className="text-2xl font-bold">{person.name}</h1>
          <p className="text-gray-500">{person.role} • {person.region}</p>
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {person.projectIds?.map(pId => {
              const project = projects?.find(p => p.id === pId);
              return project ? <span key={pId} className="bg-blue-100 text-blue-700 px-2 py-1 text-xs rounded-full font-medium">{project.name}</span> : null;
            })}
            <button onClick={() => setIsEditingProjects(true)} className="p-1 rounded-full hover:bg-gray-200"><Edit size={14} /></button>
          </div>
        </div>
        <div className="flex gap-4 mt-6 border-b justify-center">
          <button onClick={() => setActiveTab('meetings')} className={`pb-2 font-medium text-sm ${activeTab === 'meetings' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>Möten</button>
          <button onClick={() => setActiveTab('tasks')} className={`pb-2 font-medium text-sm ${activeTab === 'tasks' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>Uppgifter</button>
          <button onClick={() => setActiveTab('log')} className={`pb-2 font-medium text-sm ${activeTab === 'log' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>Loggbok</button>
        </div>
      </div>

      <div className="p-6">
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
        {activeTab === 'log' && <div>Loggbok kommer snart...</div>}
      </div>

      <BottomSheet isOpen={isEditingProjects} onClose={() => setIsEditingProjects(false)} title="Hantera Projekt">
        <div className="flex flex-col gap-4">
          {projects?.map(p => (
            <label key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
              <input type="checkbox" checked={selectedProjects.includes(p.id)} onChange={() => handleProjectToggle(p.id)} className="w-5 h-5 rounded text-blue-600" />
              <span>{p.name}</span>
            </label>
          ))}
          <button onClick={handleSaveProjects} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold mt-4">Spara</button>
        </div>
      </BottomSheet>
    </div>
  );
};
