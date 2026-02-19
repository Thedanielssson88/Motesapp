import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Link } from 'react-router-dom';
import { Mic, Clock, Calendar, Search, X, AlertTriangle, Settings } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Project, CategoryData, Meeting } from '../types';
import { hasApiKey } from '../services/geminiService'; // Import the new function

interface EnrichedMeeting extends Meeting {
  projectName?: string;
  categoryName?: string;
}

export const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<string | 'all'>('all');
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);

  // Check for API key on component mount
  useEffect(() => {
    setIsApiKeyMissing(!hasApiKey());
  }, []);

  const projects = useLiveQuery(() => db.projects.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const meetings = useLiveQuery(() => db.meetings.orderBy('date').reverse().toArray());

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
      const projectFilter = activeProjectId === 'all' || m.projectId === activeProjectId;
      
      if (!searchQuery.trim()) return projectFilter;

      const q = searchQuery.toLowerCase();
      const searchFilter = 
        m.title.toLowerCase().includes(q) || 
        m.projectName?.toLowerCase().includes(q) ||
        m.categoryName?.toLowerCase().includes(q) ||
        m.protocol?.summary.toLowerCase().includes(q);

      return projectFilter && searchFilter;
    });
  }, [enrichedMeetings, searchQuery, activeProjectId]);

  return (
    <div className="min-h-screen bg-white p-6 pb-24">
      <header className="flex justify-between items-center mb-6 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hej! 👋</h1>
          <p className="text-gray-500 text-sm">Dags att göra stordåd.</p>
        </div>
        <div className="h-10 w-10 bg-gray-200 rounded-full overflow-hidden border-2 border-white shadow">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Avatar" />
        </div>
      </header>

      {/* API Key missing warning */}
      {isApiKeyMissing && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg">
            <div className="flex">
                <div className="py-1">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3" />
                </div>
                <div>
                    <p className="font-bold">Gemini API-nyckel saknas</p>
                    <p className="text-sm">För att kunna analysera dina möten, vänligen lägg till din API-nyckel i inställningarna.</p>
                    <Link to="/settings" className="text-sm text-yellow-700 hover:text-yellow-800 font-semibold mt-2 inline-flex items-center gap-1">
                        Gå till Inställningar <Settings size={14} />
                    </Link>
                </div>
            </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          type="text" 
          placeholder="Sök möten, anteckningar..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-white border-gray-200 pl-10 pr-10 py-3 rounded-xl shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Project Filters */}
      <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveProjectId('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeProjectId === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}>
          Alla Projekt
        </button>
        {projects?.map(p => (
          <button 
            key={p.id}
            onClick={() => setActiveProjectId(p.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeProjectId === p.id ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}>
            {p.name}
          </button>
        ))}
      </div>

      <Link to="/record" className="fixed bottom-24 right-6 bg-blue-600 text-white p-4 rounded-2xl shadow-xl shadow-blue-200 hover:scale-105 transition-transform z-40 flex gap-2 items-center font-bold pr-6">
        <Mic size={24} /> Spela in
      </Link>

      <section>
        <h2 className="font-bold text-lg mb-4 text-gray-800">
          {searchQuery ? 'Sökresultat' : 'Senaste Möten'}
        </h2>
        <div className="space-y-3">
          {filteredMeetings.map(meeting => (
            <Link to={`/meeting/${meeting.id}`} key={meeting.id} className="block bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
              <div className="flex justify-between items-start mb-2">
                <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
                  {meeting.projectName || 'Inget projekt'}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Calendar size={12} /> {new Date(meeting.date).toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{meeting.title}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock size={12} /> {Math.floor(meeting.duration / 60)} min
                {meeting.isProcessed && <span className="text-green-600 bg-green-50 px-1.5 rounded ml-2">Analyserad</span>}
              </div>
            </Link>
          ))}
          {filteredMeetings.length === 0 && (
            <div className="text-center p-8 bg-white rounded-2xl border border-dashed border-gray-300">
              <p className="text-gray-400 text-sm">
                {searchQuery ? 'Inga träffar hittades' : 'Inga inspelningar än'}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
