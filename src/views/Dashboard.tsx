import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, Clock, Calendar, Search, AlertTriangle, Activity } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { hasApiKey } from '../services/geminiService';
import { clsx } from 'clsx';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
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

  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const meetings = useLiveQuery(() => db.meetings.orderBy('date').reverse().toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
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
      const searchMatch = !searchQuery.trim() || (
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.protocol?.summary?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return searchMatch;
    });
  }, [enrichedMeetings, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32 relative">
      <header className="flex justify-between items-center mb-6 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Möten</h1>
          <p className="text-gray-500 text-sm">Dina dokumenterade samtal.</p>
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

      {isApiKeyMissing && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-xl shadow-sm flex items-start gap-3">
          <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h3 className="font-bold text-yellow-800 text-sm">API-nyckel saknas</h3>
            <p className="text-yellow-700 text-xs mt-1">Gå till inställningar för att aktivera AI.</p>
          </div>
        </div>
      )}

      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input 
          type="text" 
          className="block w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm shadow-sm outline-none" 
          placeholder="Sök möten..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {filteredMeetings.length === 0 ? (
          <p className="text-center text-gray-400 mt-10 text-sm italic">Inga möten hittades.</p>
        ) : (
          filteredMeetings.map(meeting => (
            <Link key={meeting.id} to={`/meeting/${meeting.id}`} className="block bg-white p-5 rounded-2xl shadow-sm border border-gray-100 transition-transform active:scale-[0.98]">
              <div className="flex justify-between items-start mb-1">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 leading-tight">{meeting.title}</h3>
                  <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tight mt-0.5">{meeting.projectName || 'Osorterat'}</p>
                </div>
                {!meeting.isProcessed && (
                   <span className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">I kö</span>
                )}
              </div>
              
              {/* SAMMANFATTNING TILLBAKA HÄR */}
              {meeting.protocol?.summary && (
                <p className="text-gray-600 text-xs line-clamp-2 mt-2 leading-relaxed">
                  {meeting.protocol.summary}
                </p>
              )}

              <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-4 pt-3 border-t border-gray-50">
                 <div className="flex items-center gap-1"><Calendar size={12}/> {new Date(meeting.date).toLocaleDateString()}</div>
                 <div className="flex items-center gap-1"><Clock size={12}/> {Math.floor(meeting.duration / 60)} min</div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* FLYTANDE SPELA IN KNAPP */}
      <button 
        onClick={() => navigate('/record')}
        className="fixed bottom-24 right-6 w-16 h-16 bg-red-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-red-700 active:scale-90 transition-all z-50 border-4 border-white"
      >
        <Mic size={28} fill="white" />
      </button>
    </div>
  );
};