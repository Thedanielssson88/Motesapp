import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../services/db';
import { Person, MemberGroup } from '../types';
import { Plus, Users, Briefcase, Trash2, ChevronRight, UserPlus } from 'lucide-react';
import { clsx } from 'clsx';

const AVATAR_COLORS = [
  'bg-red-200 text-red-800',
  'bg-blue-200 text-blue-800',
  'bg-green-200 text-green-800',
  'bg-yellow-200 text-yellow-800',
  'bg-purple-200 text-purple-800',
  'bg-pink-200 text-pink-800',
  'bg-indigo-200 text-indigo-800',
];

export const PeopleView: React.FC = () => {
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonTitle, setNewPersonTitle] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const people = useLiveQuery(() => db.people.toArray());
  const projects = useLiveQuery(() => db.projects.toArray());
  const allMemberships = useLiveQuery(() => db.projectMembers.toArray());
  
  const [globalRegions, setGlobalRegions] = useState<string[]>([]);
  useEffect(() => {
    const savedRegions = JSON.parse(localStorage.getItem('GLOBAL_REGIONS') || '[]');
    setGlobalRegions(savedRegions);
  }, []);

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPersonName.trim() === '') return;

    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    await db.transaction('rw', db.people, db.projectMembers, async () => {
      const personId = crypto.randomUUID();

      await db.people.add({
        id: personId,
        name: newPersonName.trim(),
        role: newPersonTitle.trim(),
        region: selectedRegion || undefined,
        avatarColor: randomColor,
        projectIds: selectedProjects
      });

      for (const projectId of selectedProjects) {
        await db.projectMembers.add({
          id: crypto.randomUUID(),
          personId: personId,
          projectId: projectId,
          group: MemberGroup.REFERENCE, // Default grupp
          customRole: ''
        });
      }
    });

    setNewPersonName('');
    setNewPersonTitle('');
    setSelectedRegion('');
    setSelectedProjects([]);
  };

  const handleDeletePerson = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Är du säker på att du vill ta bort denna kontakt permanent? Alla projektmedlemskap och uppgifter försvinner.")) {
      await db.transaction('rw', db.people, db.projectMembers, db.tasks, async () => {
        await db.people.delete(id);
        await db.projectMembers.where('personId').equals(id).delete();
        await db.tasks.where('assignedToId').equals(id).modify({ assignedToId: undefined });
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* HEADER */}
      <div className="bg-white p-6 pb-4 shadow-sm sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">Kontakter & CRM</h1>
        <p className="text-sm text-gray-500 mt-1">Hantera alla personer och deras roller</p>
      </div>

      <div className="p-6 space-y-8">
        {/* SKAPA NY PERSON - KORT */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <UserPlus size={16} className="text-blue-500" /> Lägg till ny person
          </h3>
          <form onSubmit={handleAddPerson} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="Namn"
                className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl p-3 w-full focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <input
                type="text"
                value={newPersonTitle}
                onChange={(e) => setNewPersonTitle(e.target.value)}
                placeholder="Titel (t.ex. Utvecklare)"
                className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl p-3 w-full focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select 
              value={selectedRegion} 
              onChange={e => setSelectedRegion(e.target.value)} 
              className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl p-3 w-full focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Välj Avdelning / Region --</option>
              {globalRegions.map(r => <option key={r} value={r}>{r}</option>)}
              <option value="">Annan/Extern</option>
            </select>

            <div className="pt-2">
              <button type="submit" disabled={!newPersonName.trim()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm px-5 py-3 text-center transition-colors disabled:opacity-50 flex justify-center items-center gap-2">
                <Plus size={18} /> Spara Person
              </button>
            </div>
          </form>
        </div>

        {/* LISTA MED PERSONER */}
        <div className="space-y-4">
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Alla kontakter</h3>
            {people?.map((person) => {
              const memberships = allMemberships?.filter(m => m.personId === person.id) || [];
              const projectCount = memberships.length;
              
              return (
                <Link to={`/person/${person.id}`} key={person.id} className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-100 transition-all hover:border-blue-300 hover:shadow-md group">
                   <div className="flex items-center gap-4">
                      <div className={clsx("w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0", person.avatarColor || 'bg-gray-200')}>
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">{person.name}</h3>
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1">
                          <span className="text-xs text-gray-500 flex items-center gap-1"><Users size={12} />{person.role || 'Okänd roll'}</span>
                          {person.region && <span className="text-xs text-gray-500 flex items-center gap-1">• {person.region}</span>}
                          {projectCount > 0 && <span className="text-xs text-gray-500 flex items-center gap-1">• <Briefcase size={12}/> {projectCount} projekt</span>}
                        </div>
                      </div>
                   </div>
                   <div className="flex items-center">
                    <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                    <button 
                      onClick={(e) => handleDeletePerson(e, person.id)}
                      className="p-2 text-gray-300 hover:text-red-500 rounded-full transition-colors opacity-0 group-hover:opacity-100 ml-2"
                      title="Ta bort kontakt"
                    >
                      <Trash2 size={18} />
                    </button>
                   </div>
                </Link>
              );
            })}
        </div>
      </div>
    </div>
  );
};