import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addProjectMember, addCategory, removeProjectMember, deleteCategory } from '../services/db';
import { MemberGroup } from '../types';
import { ArrowLeft, Users, FolderTree, Trash2, Plus, UserPlus, FolderPlus, Tag } from 'lucide-react';
import { clsx } from 'clsx';

const ProjectDetailView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // 1. Live Queries (istället för useEffect) gör att vyn uppdateras blixtsnabbt!
  const project = useLiveQuery(() => db.projects.get(projectId!), [projectId]);
  const members = useLiveQuery(() => db.projectMembers.where({ projectId: projectId! }).toArray(), [projectId]);
  const categories = useLiveQuery(() => db.categories.where({ projectId: projectId! }).toArray(), [projectId]);
  const people = useLiveQuery(() => db.people.toArray());

  const [activeTab, setActiveTab] = useState<'members' | 'categories'>('members');

  // Formulär-states för medlemmar
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberGroup, setNewMemberGroup] = useState<MemberGroup>(MemberGroup.CORE_TEAM);
  const [newMemberRole, setNewMemberRole] = useState('');

  // Formulär-states för kategorier
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');

  if (!project) return <div className="p-6 text-gray-400">Laddar projekt...</div>;

  // --- Handlers ---
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newMemberId) return;
    await addProjectMember(projectId, newMemberId, newMemberGroup, newMemberRole);
    setNewMemberId('');
    setNewMemberRole('');
  };
  
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newCategoryName) return;
    const subCats = newSubCategoryName.split(',').map(s => s.trim()).filter(Boolean);
    await addCategory({ projectId, name: newCategoryName, subCategories: subCats });
    setNewCategoryName('');
    setNewSubCategoryName('');
  };

  // --- Design-hjälpare ---
  const getGroupBadgeColor = (group: MemberGroup) => {
    switch (group) {
      case MemberGroup.STEERING: return 'bg-purple-100 text-purple-700 border-purple-200';
      case MemberGroup.CORE_TEAM: return 'bg-blue-100 text-blue-700 border-blue-200';
      case MemberGroup.REFERENCE: return 'bg-amber-100 text-amber-700 border-amber-200';
      case MemberGroup.STAKEHOLDER: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Gruppera medlemmar för snyggare rendering
  const groupedMembers = members?.reduce((acc, member) => {
    if (!acc[member.group]) acc[member.group] = [];
    acc[member.group].push(member);
    return acc;
  }, {} as Record<string, typeof members>);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* HEADER */}
      <div className="bg-white p-6 pb-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{project.name}</h1>
        </div>

        {/* TABS */}
        <div className="flex gap-6 mt-6 border-b border-gray-100">
          <button
            onClick={() => setActiveTab('members')}
            className={clsx(
              "pb-3 font-medium text-sm transition-colors flex items-center gap-2",
              activeTab === 'members' ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Users size={16} /> Team & Medlemmar
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={clsx(
              "pb-3 font-medium text-sm transition-colors flex items-center gap-2",
              activeTab === 'categories' ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <FolderTree size={16} /> Kategorier
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* --- FLIK: MEDLEMMAR --- */}
        {activeTab === 'members' && (
          <div className="space-y-8">
            
            {/* Kort: Lägg till ny medlem */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <UserPlus size={16} className="text-blue-500" /> Lägg till i projektet
              </h3>
              <form onSubmit={handleAddMember} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select 
                  value={newMemberId} 
                  onChange={e => setNewMemberId(e.target.value)} 
                  className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-3"
                  required
                >
                  <option value="" disabled>Välj person från CRM...</option>
                  {people?.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                
                <select 
                  value={newMemberGroup} 
                  onChange={e => setNewMemberGroup(e.target.value as MemberGroup)} 
                  className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-3"
                >
                  {Object.values(MemberGroup).map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>

                <input 
                  type="text" 
                  value={newMemberRole} 
                  onChange={e => setNewMemberRole(e.target.value)} 
                  placeholder="Specifik roll i detta projekt (valfritt)" 
                  className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-3 md:col-span-2"
                />
                
                <button type="submit" disabled={!newMemberId} className="md:col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm px-5 py-3 text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">
                  <Plus size={18} /> Lägg till i teamet
                </button>
              </form>
            </div>

            {/* Lista: Medlemmar grupperade per roll */}
            <div className="space-y-6">
              {Object.entries(groupedMembers || {}).map(([groupName, groupMembers]) => (
                <div key={groupName} className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{groupName}</h4>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {groupMembers.map(member => {
                      const person = people?.find(p => p.id === member.personId);
                      if (!person) return null;

                      return (
                        <div key={member.id} className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-100 transition-all hover:border-gray-200">
                          <div className="flex items-center gap-4">
                            {/* Snygg Avatar */}
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                              {person.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{person.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-md border", getGroupBadgeColor(member.group))}>
                                  {member.group}
                                </span>
                                {member.customRole && (
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    • {member.customRole}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => removeProjectMember(member.id)} 
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            title="Ta bort från projekt"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {(!members || members.length === 0) && (
                <div className="text-center p-8 bg-transparent border-2 border-dashed border-gray-200 rounded-2xl">
                  <p className="text-gray-400 text-sm">Inga medlemmar tillagda i projektet ännu.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- FLIK: KATEGORIER --- */}
        {activeTab === 'categories' && (
          <div className="space-y-8">
            
            {/* Kort: Lägg till kategori */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
               <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FolderPlus size={16} className="text-blue-500" /> Skapa Ny Kategori
              </h3>
              <form onSubmit={handleAddCategory} className="flex flex-col gap-3">
                <input 
                  type="text" 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)} 
                  placeholder="Huvudkategori (t.ex. 'Design' eller 'Sälj')" 
                  className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-3"
                  required
                />
                <input 
                  type="text" 
                  value={newSubCategoryName} 
                  onChange={e => setNewSubCategoryName(e.target.value)} 
                  placeholder="Underkategorier separerade med komma (t.ex. 'Skisser, Möten, Feedback')" 
                  className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-3"
                />
                <button type="submit" disabled={!newCategoryName} className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm px-5 py-3 transition-colors disabled:opacity-50 flex justify-center items-center gap-2">
                  <Plus size={18} /> Spara Kategori
                </button>
              </form>
            </div>

            {/* Lista: Kategorier */}
            <div className="grid grid-cols-1 gap-4">
              {categories?.map(cat => (
                <div key={cat.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 group">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-gray-900 flex items-center gap-2">
                      <FolderTree size={16} className="text-blue-500" /> {cat.name}
                    </h4>
                    <button 
                      onClick={() => deleteCategory(cat.id)} 
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Radera kategori"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {cat.subCategories.length > 0 ? (
                      cat.subCategories.map(sub => (
                        <span key={sub} className="bg-gray-50 border border-gray-100 text-gray-600 text-[11px] font-medium px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <Tag size={10} className="text-gray-400" /> {sub}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400 italic">Inga underkategorier</span>
                    )}
                  </div>
                </div>
              ))}

              {(!categories || categories.length === 0) && (
                <div className="text-center p-8 bg-transparent border-2 border-dashed border-gray-200 rounded-2xl">
                  <p className="text-gray-400 text-sm">Inga kategorier skapade ännu.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetailView;
