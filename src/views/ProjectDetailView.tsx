import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db, getProject, getProjectMembers, getCategoriesForProject, addProjectMember, addCategory, updateProject, removeProjectMember, deleteCategory } from '../services/db';
import { Project, Person, ProjectMember, CategoryData, MemberGroup } from '../types';

const ProjectDetailView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [activeTab, setActiveTab] = useState('members');

  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberGroup, setNewMemberGroup] = useState<MemberGroup>(MemberGroup.CORE_TEAM);
  const [newMemberRole, setNewMemberRole] = useState('');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');

  useEffect(() => {
    if (!projectId) return;

    const fetchData = async () => {
      const proj = await getProject(projectId);
      setProject(proj || null);

      const projMembers = await getProjectMembers(projectId);
      setMembers(projMembers);

      const projCategories = await getCategoriesForProject(projectId);
      setCategories(projCategories);

      const allPeople = await db.people.toArray();
      setPeople(allPeople);
    };

    fetchData();
  }, [projectId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newMemberId) return;

    await addProjectMember(projectId, newMemberId, newMemberGroup, newMemberRole);
    const projMembers = await getProjectMembers(projectId);
    setMembers(projMembers);
    setNewMemberId('');
    setNewMemberRole('');
  };
  
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newCategoryName) return;

    await addCategory({ projectId, name: newCategoryName, subCategories: newSubCategoryName.split(',').map(s => s.trim()).filter(Boolean) });
    const projCategories = await getCategoriesForProject(projectId);
    setCategories(projCategories);
    setNewCategoryName('');
    setNewSubCategoryName('');
  };

  if (!project) {
    return <div>Laddar projekt...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{project.name}</h1>

      <div className="tabs">
        <a className={`tab tab-lifted ${activeTab === 'members' ? 'tab-active' : ''}`} onClick={() => setActiveTab('members')}>Medlemmar</a>
        <a className={`tab tab-lifted ${activeTab === 'categories' ? 'tab-active' : ''}`} onClick={() => setActiveTab('categories')}>Kategorier</a>
      </div>

      {activeTab === 'members' && (
        <div>
          <form onSubmit={handleAddMember} className="my-4">
            <select value={newMemberId} onChange={e => setNewMemberId(e.target.value)} className="select select-bordered mr-2">
                <option value="">Välj person</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={newMemberGroup} onChange={e => setNewMemberGroup(e.target.value as MemberGroup)} className="select select-bordered mr-2">
                {Object.values(MemberGroup).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <input type="text" value={newMemberRole} onChange={e => setNewMemberRole(e.target.value)} placeholder="Specifik roll (valfritt)" className="input input-bordered mr-2"/>
            <button type="submit" className="btn btn-primary">Lägg till medlem</button>
          </form>
          <ul>
            {members.map(member => {
                 const person = people.find(p => p.id === member.personId);
                 return (
                    <li key={member.id} className="flex items-center justify-between p-2 my-1 bg-base-200 rounded">
                        <span>{person?.name} - {member.group} {member.customRole && `(${member.customRole})`}</span>
                        <button onClick={async () => {await removeProjectMember(member.id); setMembers(await getProjectMembers(project.id))}} className="btn btn-xs btn-error">Ta bort</button>
                    </li>
                 )
            })}
          </ul>
        </div>
      )}

      {activeTab === 'categories' && (
         <div>
            <form onSubmit={handleAddCategory} className="my-4">
                <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Ny huvudkategori" className="input input-bordered mr-2"/>
                <input type="text" value={newSubCategoryName} onChange={e => setNewSubCategoryName(e.target.value)} placeholder="Underkategorier (komma-separerade)" className="input input-bordered mr-2"/>
                <button type="submit" className="btn btn-primary">Lägg till kategori</button>
            </form>
            <ul>
                {categories.map(cat => (
                    <li key={cat.id} className="p-2 my-1 bg-base-200 rounded">
                        <div className="flex items-center justify-between">
                            <span className="font-bold">{cat.name}</span>
                            <button onClick={async () => {await deleteCategory(cat.id); setCategories(await getCategoriesForProject(project.id))}} className="btn btn-xs btn-error">Ta bort</button>
                        </div>
                        <ul className="pl-4 mt-1">
                            {cat.subCategories.map(sub => <li key={sub}>{sub}</li>)}
                        </ul>
                    </li>
                ))}
            </ul>
         </div>
      )}
    </div>
  );
};

export default ProjectDetailView;
