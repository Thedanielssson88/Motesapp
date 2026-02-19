import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addProject } from '../services/db';
import { Plus, Briefcase } from 'lucide-react';

const ProjectsView: React.FC = () => {
  const [newProjectName, setNewProjectName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const projects = useLiveQuery(() => db.projects.toArray());

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim() === '') return;

    try {
      await addProject({ name: newProjectName.trim() });
      setNewProjectName('');
      setIsAdding(false); // Dölj formuläret efter att projektet skapats
    } catch (error) {
      console.error("Kunde inte skapa projekt:", error);
    }
  };

  return (
    <div className="min-h-screen bg-white p-6 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projekt</h1>
        <button onClick={() => setIsAdding(!isAdding)} className="p-2 bg-gray-100 rounded-full">
          <Plus size={20} />
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddProject} className="p-4 mb-6 bg-gray-50 rounded-lg shadow-inner">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Nytt projektnamn"
            className="input input-bordered w-full mb-2"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setIsAdding(false)} className="btn">Avbryt</button>
              <button type="submit" className="btn btn-primary">Skapa</button>
          </div>
        </form>
      )}

      {projects && projects.length === 0 && !isAdding && (
          <p className="text-gray-500 text-center mt-8">Det finns inga projekt än. Klicka på '+' för att skapa ett.</p>
      )}

      <div className="space-y-3">
        {projects?.map(project => (
          <Link to={`/project/${project.id}`} key={project.id} className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className={`w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center`}>
                <Briefcase size={24} className="text-gray-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{project.name}</h3>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ProjectsView;
