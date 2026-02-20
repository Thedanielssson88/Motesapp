import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Link } from 'react-router-dom';
import { Mic, Clock, Calendar, Search, X, AlertTriangle, Settings, Tag, Activity } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { hasApiKey } from '../services/geminiService';
import { clsx } from 'clsx';

export const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<string | 'all'>('all');
  const [activeCategoryId, setActiveCategoryId] = useState<string | 'all'>('all');
  const [filterTag, setFilterTag] = useState<string | 'all'>('all');
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      const keyExists = await hasApiKey();
      setIsApiKeyMissing(!keyExists);
    };
    checkApiKey();
  }, []);

  const projects = useLiveQuery(() => db.projects.toArray());
  const meetings = useLiveQuery(() => db.meetings.orderBy('date').reverse().toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const allTags = useLiveQuery(() => db.tags.toArray());
  
  // Hämta aktiva jobb för att visa röd notis-prick
  const activeJobs = useLiveQuery(() => db.processingJobs.where('status').anyOf(['pending', 'processing']).toArray());
  const activeJobsCount = activeJobs?.length || 0;

  const enrichedMeetings = useMemo(() => {
    if (!meetings || !projects || !categories) return [];
    return meetings.map(m => ({
      ...m,
      projectName: projects.find(p => p.id === m.projectId)?.name,
      categoryName: categories.find(c => c.id === m.categoryId)?.name,
    }));
  }, [meetings, projects, categories]);

  const filteredMeetings = useMemo(() => {
    return enrichedMeetings.filter(m => {
      const projectMatch = activeProjectId === 'all' || m.projectId === activeProjectId;
      const categoryMatch = activeCategoryId === 'all' || m.categoryId === activeCategoryId;
      const tagMatch = filterTag === 'all' || m.tagIds?.includes(filterTag);
      const searchMatch = !searchQuery.trim() || (
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.categoryName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.protocol?.summary?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return projectMatch && categoryMatch && tagMatch && searchMatch;
    });
  }, [enrichedMeetings, activeProjectId, activeCategoryId, filterTag, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-24">
      <header className="flex justify-between items-center mb-6 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hej! 👋</h1>
          <p className="text-gray-500 text-sm">Dags att göra stordåd.</p>
        </div>
        
        {/* HÖGER HÖRN: Aktivitet och Profilbild */}
        <div className="flex items-center gap-4">
          <Link to="/queue" className="relative p-2.5 bg-white rounded-full shadow-sm hover:bg-gray-50 transition border border-gray-100">
            <Activity size={20} className={activeJobsCount > 0 ? "text-blue-600" : "text-gray-500"} />
            {activeJobsCount > 0 && (
              <span className="absolute top-0 right-0 h-3.5 w-3.5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                 {/* Liten prick för att visa att det pågår */}
              </span>
            )}
          </Link>
          <div className="h-10 w-10 bg-gray-200 rounded-full overflow-hidden border-2 border-white shadow">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Avatar" />
          </div>
        </div>
      </header>

      {isApiKeyMissing && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-xl shadow-sm flex items-start gap-3">
          <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h3 className="font-bold text-yellow-800 text-sm">API-nyckel saknas</h3>
            <p className="text-yellow-700 text-xs mt-1">Du måste lägga in en Gemini API-nyckel för att AI-analysen ska fungera.</p>
            <Link to="/settings" className="inline-flex items-center gap-1 text-yellow-800 font-bold text-xs mt-2 hover:underline">
              Gå till Inställningar <Settings size={12} />
            </Link>
          </div>
        </div>
      )}

      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input 
          type="text" 
          className="block w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" 
          placeholder="Sök bland möten, beslut och projekt..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-4 flex items-center">
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
        <button onClick={() => { setActiveProjectId('all'); setActiveCategoryId('all'); }} className={clsx("px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-sm transition-all", activeProjectId === 'all' ? "bg-gray-800 text-white" : "bg-white text-gray-600 border border-gray-200")}>
          Alla Möten
        </button>
        {projects?.map(project => (
          <button key={project.id} onClick={() => { setActiveProjectId(project.id); setActiveCategoryId('all'); }} className={clsx("px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-sm transition-all", activeProjectId === project.id ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200")}>
            {project.name}
          </button>
        ))}
      </div>

      {activeProjectId !== 'all' && categories && categories.filter(c => c.projectId === activeProjectId).length > 0 && (
         <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
           <button onClick={() => setActiveCategoryId('all')} className={clsx("px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all", activeCategoryId === 'all' ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500")}>
             Alla Kategorier
           </button>
           {categories.filter(c => c.projectId === activeProjectId).map(cat => (
             <button key={cat.id} onClick={() => setActiveCategoryId(cat.id)} className={clsx("px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all", activeCategoryId === cat.id ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500")}>
               {cat.name}
             </button>
           ))}
         </div>
      )}

      {activeProjectId !== 'all' && allTags && allTags.filter(t => t.projectId === activeProjectId).length > 0 && (
         <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1 items-center">
           <Tag size={12} className="text-gray-400 ml-1" />
           <button onClick={() => setFilterTag('all')} className={clsx("px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all", filterTag === 'all' ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500")}>
             Alla Taggar
           </button>
           {allTags.filter(t => t.projectId === activeProjectId).map(tag => (
             <button key={tag.id} onClick={() => setFilterTag(tag.id)} className={clsx("px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all", filterTag === tag.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500")}>
               {tag.name}
             </button>
           ))}
         </div>
      )}

      <div className="space-y-4">
        {filteredMeetings.length === 0 ? (
           <div className="text-center py-10">
             <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                <Search className="text-gray-400" size={24} />
             </div>
             <p className="text-gray-500 font-medium">Inga möten hittades</p>
           </div>
        ) : (
          filteredMeetings.map(meeting => (
            <Link key={meeting.id} to={`/meeting/${meeting.id}`} className="block bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-[0.98]">
              <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                   <h3 className="font-bold text-gray-900 leading-tight">{meeting.title}</h3>
                   <span className="text-xs text-blue-600 font-bold mt-1 uppercase tracking-wide">{meeting.projectName || 'Osorterat'}</span>
                </div>
                {!meeting.isProcessed && (
                   <span className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded-full animate-pulse whitespace-nowrap ml-2">I kö / Oanalyserat</span>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-xs text-gray-500 font-medium mt-3">
                <div className="flex items-center gap-1.5"><Calendar size={14}/> {new Date(meeting.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric'})}</div>
                <div className="flex items-center gap-1.5"><Clock size={14}/> {Math.floor(meeting.duration / 60)} min</div>
                {meeting.participantIds.length > 0 && (
                   <div className="flex items-center gap-1.5"><Users size={14}/> {meeting.participantIds.length}</div>
                )}
              </div>
              
              {meeting.tagIds && meeting.tagIds.length > 0 && (
                <div className="flex gap-1 mt-3">
                   {meeting.tagIds.map(tid => {
                     const tag = allTags?.find(t => t.id === tid);
                     if(!tag) return null;
                     return <span key={tid} className="bg-gray-100 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded-sm">{tag.name}</span>
                   })}
                </div>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
};