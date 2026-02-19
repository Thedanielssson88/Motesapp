import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Save, Key, Cpu, Building, Users, Plus, Trash2, Edit } from 'lucide-react';
import { Project, CategoryData, Person, MemberGroup, ProjectMember } from '../types';
import { BottomSheet } from '../components/BottomSheet';

export const SettingsView = () => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('flash');
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonTitle, setNewPersonTitle] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newRole, setNewRole] = useState('');
  const [teamMember, setTeamMember] = useState<{personId: string, group: MemberGroup, customRole?: string} | null>(null);

  const projects = useLiveQuery(() => db.projects.toArray());
  const people = useLiveQuery(() => db.people.toArray());
  const projectMembers = useLiveQuery(() => db.projectMembers.toArray());

  useEffect(() => {
    setApiKey(localStorage.getItem('GEMINI_API_KEY') || '');
    setModel(localStorage.getItem('AI_MODEL') || 'flash');
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    localStorage.setItem('AI_MODEL', model);
    alert('Inställningar sparade!');
  };

  const handleAddPerson = async () => {
    if (!newPersonName.trim() || !newPersonTitle.trim()) return;
    await db.people.add({ id: crypto.randomUUID(), name: newPersonName, title: newPersonTitle, region: 'Okänd' });
    setNewPersonName('');
    setNewPersonTitle('');
  };

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return;
    await db.projects.add({ id: crypto.randomUUID(), name: newProjectName, definedRoles: [] });
    setNewProjectName('');
  };

  const handleAddRoleToProject = async () => {
    if (!editingProject || !newRole.trim()) return;
    const updatedRoles = [...(editingProject.definedRoles || []), newRole];
    await db.projects.update(editingProject.id, { definedRoles: updatedRoles });
    setEditingProject({ ...editingProject, definedRoles: updatedRoles });
    setNewRole('');
  };

  const handleAddTeamMember = async () => {
    if (!editingProject || !teamMember) return;
    await db.projectMembers.add({ id: crypto.randomUUID(), projectId: editingProject.id, ...teamMember });
    setTeamMember(null);
  };

  return (
    <>
      <div className="min-h-screen bg-white p-6 pb-24">
        <h1 className="text-2xl font-bold mb-8">Inställningar & Admin</h1>
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-900 mb-4">AI-inställningar</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1"><Key size={14}/> API Nyckel</label>
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Ange din Gemini API-nyckel" className="w-full bg-gray-50 border-gray-200 rounded-xl text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1"><Cpu size={14}/> Modell</label>
                <select value={model} onChange={e => setModel(e.target.value)} className="w-full bg-gray-50 border-gray-200 rounded-xl text-sm">
                  <option value="flash">Gemini 1.5 Flash</option>
                  <option value="pro">Gemini 1.5 Pro</option>
                </select>
              </div>
            </div>
            <button onClick={handleSaveSettings} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-bold mt-6 flex items-center justify-center gap-2">
              <Save size={16} /> Spara AI-inställningar
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-900 mb-4">Personer</h2>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input type="text" value={newPersonName} onChange={e => setNewPersonName(e.target.value)} placeholder="Namn..." className="bg-gray-50 border-gray-200 rounded-xl text-sm" />
              <input type="text" value={newPersonTitle} onChange={e => setNewPersonTitle(e.target.value)} placeholder="Yrkestitel..." className="bg-gray-50 border-gray-200 rounded-xl text-sm" />
            </div>
            <button onClick={handleAddPerson} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-bold">Lägg till Person</button>
            <div className="space-y-2 mt-4">
              {people?.map(p => <div key={p.id} className="text-sm p-2 bg-gray-50 rounded-md">{p.name} ({p.title})</div>)}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-900 mb-4">Projekt</h2>
            <div className="flex gap-2 mb-4">
              <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Nytt projektnamn..." className="flex-1 bg-gray-50 border-gray-200 rounded-xl text-sm" />
              <button onClick={handleAddProject} className="p-2 bg-blue-600 text-white rounded-lg"><Plus size={20} /></button>
            </div>
            <div className="space-y-2">
              {projects?.map(p => (
                <div key={p.id} className="text-sm p-2 bg-gray-50 rounded-md flex justify-between items-center">
                  <span>{p.name}</span>
                  <button onClick={() => setEditingProject(p)} className="p-1 hover:bg-gray-200 rounded-full"><Edit size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <BottomSheet isOpen={!!editingProject} onClose={() => setEditingProject(null)} title={`Hantera: ${editingProject?.name}`}>
        <div className="space-y-6">
          <div>
            <h3 className="font-bold mb-2">Team</h3>
            <select onChange={e => setTeamMember({personId: e.target.value, group: MemberGroup.CORE_TEAM})} className="w-full bg-gray-100 border-gray-300 rounded-lg mb-2">
              <option>Välj person...</option>
              {people?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {teamMember && (
              <div className="space-y-2">
                <select onChange={e => setTeamMember({...teamMember, group: e.target.value as MemberGroup})} value={teamMember.group} className="w-full bg-gray-100 border-gray-300 rounded-lg">
                  {Object.values(MemberGroup).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select onChange={e => setTeamMember({...teamMember, customRole: e.target.value})} className="w-full bg-gray-100 border-gray-300 rounded-lg">
                  <option value="">Välj specifik roll...</option>
                  {editingProject?.definedRoles?.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <button onClick={handleAddTeamMember} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold">Lägg till i Team</button>
              </div>
            )}
            <div className="mt-4 space-y-2">
              {projectMembers?.filter(pm => pm.projectId === editingProject?.id).map(pm => (
                <div key={pm.id} className="text-sm p-2 bg-gray-50 rounded-md">{people?.find(p => p.id === pm.personId)?.name} - {pm.group} {pm.customRole && `(${pm.customRole})`}</div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-bold mb-2">Projekt-specifika roller</h3>
            <div className="flex gap-2">
              <input type="text" value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Ny roll..." className="flex-1 bg-gray-100 border-gray-300 rounded-lg" />
              <button onClick={handleAddRoleToProject} className="p-2 bg-blue-600 text-white rounded-lg"><Plus size={20} /></button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {editingProject?.definedRoles?.map(r => <span key={r} className="bg-gray-200 px-2 py-1 text-xs rounded-full">{r}</span>)}
            </div>
          </div>
        </div>
      </BottomSheet>
    </>
  );
};
