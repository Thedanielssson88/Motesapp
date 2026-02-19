import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Save, Key, Cpu, Building, Users, Plus, Trash2 } from 'lucide-react';
import { Project, CategoryData, Person } from '../types';

export const SettingsView = () => {
  // API & Model Settings
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('flash');

  // Data Management States
  const [newProjectName, setNewProjectName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonRole, setNewPersonRole] = useState('');
  const [selectedPersonProjects, setSelectedPersonProjects] = useState<string[]>([]);

  const projects = useLiveQuery(() => db.projects.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const people = useLiveQuery(() => db.people.toArray());

  useEffect(() => {
    setApiKey(localStorage.getItem('GEMINI_API_KEY') || '');
    setModel(localStorage.getItem('AI_MODEL') || 'flash');
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    localStorage.setItem('AI_MODEL', model);
    alert('Inställningar sparade!');
  };

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return;
    await db.projects.add({ id: crypto.randomUUID(), name: newProjectName });
    setNewProjectName('');
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !selectedProjectId) return;
    await db.categories.add({
      id: crypto.randomUUID(),
      projectId: selectedProjectId,
      name: newCategoryName,
      subCategories: [],
    });
    setNewCategoryName('');
  };

  const handleAddPerson = async () => {
    if (!newPersonName.trim() || !newPersonRole.trim()) return;
    await db.people.add({
      id: crypto.randomUUID(),
      name: newPersonName,
      role: newPersonRole,
      region: 'Okänd',
      projectIds: selectedPersonProjects,
    });
    setNewPersonName('');
    setNewPersonRole('');
    setSelectedPersonProjects([]);
  };

  const togglePersonProject = (projectId: string) => {
    setSelectedPersonProjects(prev => 
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

  return (
    <div className="min-h-screen bg-white p-6 pb-24">
      <h1 className="text-2xl font-bold mb-8">Inställningar & Admin</h1>

      <div className="space-y-8">
        {/* Projects Management */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-900 mb-4">Projekt</h2>
          <div className="flex gap-2 mb-4">
            <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Nytt projektnamn..." className="flex-1 bg-gray-50 border-gray-200 rounded-xl text-sm" />
            <button onClick={handleAddProject} className="p-2 bg-blue-600 text-white rounded-lg"><Plus size={20} /></button>
          </div>
          <div className="space-y-2">
            {projects?.map(p => <div key={p.id} className="text-sm p-2 bg-gray-50 rounded-md">{p.name}</div>)}
          </div>
        </div>

        {/* Categories Management */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-900 mb-4">Kategorier</h2>
          <select onChange={e => setSelectedProjectId(e.target.value)} className="w-full bg-gray-50 border-gray-200 rounded-xl text-sm mb-2">
            <option value="">Välj ett projekt</option>
            {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {selectedProjectId && (
            <div className="flex gap-2 mb-4">
              <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Ny kategori..." className="flex-1 bg-gray-50 border-gray-200 rounded-xl text-sm" />
              <button onClick={handleAddCategory} className="p-2 bg-blue-600 text-white rounded-lg"><Plus size={20} /></button>
            </div>
          )}
          <div className="space-y-2">
            {categories?.filter(c => c.projectId === selectedProjectId).map(c => <div key={c.id} className="text-sm p-2 bg-gray-50 rounded-md">{c.name}</div>)}
          </div>
        </div>

        {/* People Management */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-900 mb-4">Personer</h2>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <input type="text" value={newPersonName} onChange={e => setNewPersonName(e.target.value)} placeholder="Namn..." className="bg-gray-50 border-gray-200 rounded-xl text-sm" />
            <input type="text" value={newPersonRole} onChange={e => setNewPersonRole(e.target.value)} placeholder="Roll..." className="bg-gray-50 border-gray-200 rounded-xl text-sm" />
          </div>
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Välj projekt:</p>
            <div className="flex flex-wrap gap-2">
              {projects?.map(p => (
                <button key={p.id} onClick={() => togglePersonProject(p.id)} className={`px-2 py-1 text-xs rounded-full ${selectedPersonProjects.includes(p.id) ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>{p.name}</button>
              ))}
            </div>
          </div>
          <button onClick={handleAddPerson} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-bold">Lägg till Person</button>
          <div className="space-y-2 mt-4">
            {people?.map(p => <div key={p.id} className="text-sm p-2 bg-gray-50 rounded-md">{p.name} ({p.role})</div>)}
          </div>
        </div>

        {/* API & Model Settings */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-900 mb-4">AI & API</h2>
          <input 
            type="password" 
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Klistra in din Gemini API Key"
            className="w-full bg-gray-50 border-gray-200 rounded-xl text-sm mb-4"
          />
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="radio" name="model" value="flash" checked={model === 'flash'} onChange={e => setModel(e.target.value)} className="text-blue-600 focus:ring-blue-500" />
              <div>
                <div className="font-medium text-sm">Gemini Flash</div>
                <div className="text-xs text-gray-500">Snabbare, billigare</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="radio" name="model" value="pro" checked={model === 'pro'} onChange={e => setModel(e.target.value)} className="text-blue-600 focus:ring-blue-500" />
              <div>
                <div className="font-medium text-sm">Gemini Pro</div>
                <div className="text-xs text-gray-500">Bättre analys, långsammare</div>
              </div>
            </label>
          </div>
        </div>

        <button 
          onClick={handleSaveSettings}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"
        >
          <Save size={20} /> Spara Ändringar
        </button>
      </div>
    </div>
  );
};
