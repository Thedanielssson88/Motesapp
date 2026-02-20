import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Link } from 'react-router-dom';
import { Mic, Clock, Calendar, Search, X, AlertTriangle, Settings, Tag, Activity, Users } from 'lucide-react';
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
      try {
        const keyExists = await hasApiKey();
        setIsApiKeyMissing(!keyExists);
      } catch (e) {
        console.error("Kunde inte kolla API-nyckel", e);
      }
    };
    checkApiKey();
  }, []);

  // Hämta data med fallback till tomma listor för att undvika "undefined" krascher
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const meetings = useLiveQuery(() => db.meetings.orderBy('date').reverse().toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const allTags = useLiveQuery(() => db.tags.toArray()) || [];
  const activeJobs = useLiveQuery(() => db.processingJobs.where('status').anyOf(['pending', 'processing']).toArray()) || [];

  const activeJobsCount = activeJobs.length;

  const enrichedMeetings = useMemo(() => {
    if (!meetings) return [];
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
        
        <div className="flex items-center gap-4">
          <Link to="/queue" className="relative p-2.5 bg-white rounded-full shadow-sm hover:bg-gray-50 transition border border-gray-100">
            <Activity size={20} className={activeJobsCount > 0 ? "text-blue-600" : "text-gray-500"} />
            {activeJobsCount > 0 && (
              <span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </Link>
          <div className="h-10 w-10 bg-gray-200 rounded-full overflow-hidden border-2 border-white shadow">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Avatar" />
          </div>
        </div>
      </header>

      {/* Sökfält */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input 
          type="text" 
          className="block w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm shadow-sm outline-none" 
          placeholder="Sök..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Lista med möten */}
      <div className="space-y-4">
        {filteredMeetings.length === 0 ? (
          <p className="text-center text-gray-400 mt-10 text-sm italic">Hittade inga möten...</p>
        ) : (
          filteredMeetings.map(meeting => (
            <Link key={meeting.id} to={`/meeting/${meeting.id}`} className="block bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-gray-900">{meeting.title}</h3>
                {!meeting.isProcessed && (
                   <span className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">I kö</span>
                )}
              </div>
              <p className="text-xs text-blue-600 font-bold mt-1 uppercase">{meeting.projectName || 'Osorterat'}</p>
              <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-3">
                 <Calendar size={12}/> {new Date(meeting.date).toLocaleDateString()}
                 <Clock size={12}/> {Math.floor(meeting.duration / 60)} min
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};