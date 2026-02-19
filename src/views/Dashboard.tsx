import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Link } from 'react-router-dom';
import { Mic, Clock, Calendar, Search, X } from 'lucide-react';
import { useState } from 'react';

export const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const meetings = useLiveQuery(async () => {
    let collection = db.meetings.orderBy('date').reverse();
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      // Simple client-side filtering for search
      const all = await collection.toArray();
      return all.filter(m => 
        m.title.toLowerCase().includes(q) || 
        m.category.toLowerCase().includes(q) ||
        m.protocol?.summary.toLowerCase().includes(q)
      );
    }
    
    return collection.toArray();
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-24">
      <header className="flex justify-between items-center mb-6 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hej! 👋</h1>
          <p className="text-gray-500 text-sm">Dags att göra stordåd.</p>
        </div>
        <div className="h-10 w-10 bg-gray-200 rounded-full overflow-hidden border-2 border-white shadow">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Avatar" />
        </div>
      </header>

      {/* Search Bar */}
      <div className="relative mb-8">
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

      <Link to="/record" className="fixed bottom-24 right-6 bg-blue-600 text-white p-4 rounded-2xl shadow-xl shadow-blue-200 hover:scale-105 transition-transform z-40 flex gap-2 items-center font-bold pr-6">
        <Mic size={24} /> Spela in
      </Link>

      <section className="mb-8">
        <h2 className="font-bold text-lg mb-4 text-gray-800">
          {searchQuery ? 'Sökresultat' : 'Senaste Möten'}
        </h2>
        <div className="space-y-3">
          {meetings?.map(meeting => (
            <Link to={`/meeting/${meeting.id}`} key={meeting.id} className="block bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
              <div className="flex justify-between items-start mb-2">
                <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
                  {meeting.category}
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
          {meetings?.length === 0 && (
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
