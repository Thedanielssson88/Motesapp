import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addProjectMember } from '../services/db';
import { Link } from 'react-router-dom';
import { User, Plus } from 'lucide-react';
import { Person, Project, MemberGroup } from '../types';

export const PeopleView = () => {
  const people = useLiveQuery(() => db.people.toArray());
  const projects = useLiveQuery(() => db.projects.toArray());
  
  const [isAdding, setIsAdding] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonTitle, setNewPersonTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProjectGroup, setSelectedProjectGroup] = useState<MemberGroup>(MemberGroup.CORE_TEAM);
  const [selectedProjectRole, setSelectedProjectRole] = useState('');

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPersonName.trim() === '') return;

    const newPerson: Omit<Person, 'id' | 'projectIds'> & { id?: string } = {
        name: newPersonName,
        role: newPersonTitle, // General title
        region: '', // You might want to add a field for this
    };

    const personId = await db.people.add(newPerson as Person);

    if (selectedProjectId && personId) {
        await addProjectMember(selectedProjectId, personId.toString(), selectedProjectGroup, selectedProjectRole);
    }

    // Reset form
    setNewPersonName('');
    setNewPersonTitle('');
    setSelectedProjectId('');
    setSelectedProjectRole('');
    setIsAdding(false);
  };

  return (
    <div className="min-h-screen bg-white p-6 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Personer</h1>
        <button onClick={() => setIsAdding(!isAdding)} className="p-2 bg-gray-100 rounded-full">
          <Plus size={20} />
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddPerson} className="p-4 mb-6 bg-gray-50 rounded-lg shadow-inner">
            <input
              type="text"
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              placeholder="Namn"
              className="input input-bordered w-full mb-2"
              required
            />
            <input
              type="text"
              value={newPersonTitle}
              onChange={(e) => setNewPersonTitle(e.target.value)}
              placeholder="Titel (t.ex. Utvecklare)"
              className="input input-bordered w-full mb-2"
            />
            <h3 className="text-lg font-semibold mt-4 mb-2">Projektkoppling (valfritt)</h3>
            <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="select select-bordered w-full mb-2">
                <option value="">Välj projekt</option>
                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
             {selectedProjectId && (<>
                <select value={selectedProjectGroup} onChange={e => setSelectedProjectGroup(e.target.value as MemberGroup)} className="select select-bordered w-full mb-2">
                    {Object.values(MemberGroup).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input
                  type="text"
                  value={selectedProjectRole}
                  onChange={(e) => setSelectedProjectRole(e.target.value)}
                  placeholder="Roll i projektet (t.ex. Kravställare)"
                  className="input input-bordered w-full mb-2"
                />
            </>)}
            <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setIsAdding(false)} className="btn">Avbryt</button>
                <button type="submit" className="btn btn-primary">Lägg till</button>
            </div>
        </form>
      )}

      <div className="space-y-3">
        {people?.map(person => (
          <Link to={`/person/${person.id}`} key={person.id} className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className={`w-12 h-12 rounded-full ${person.avatarColor || 'bg-gray-200'} flex items-center justify-center text-xl font-bold`}>
              {person.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{person.name}</h3>
              <p className="text-sm text-gray-500">{person.role}</p> {/* Changed from person.title to person.role */}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
