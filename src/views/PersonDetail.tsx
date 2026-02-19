import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useState } from 'react';
import { ArrowLeft, Briefcase, MapPin, Mail, Plus, Calendar, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';

export const PersonDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const person = useLiveQuery(() => db.people.get(id!), [id]);
  const tasks = useLiveQuery(() => db.tasks.where('assignedToId').equals(id!).toArray(), [id]);
  const logs = useLiveQuery(() => db.personLogs.where('personId').equals(id!).reverse().sortBy('date'), [id]);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview');
  const [newLog, setNewLog] = useState('');

  const addLog = async () => {
    if (!newLog.trim()) return;
    await db.personLogs.add({
      id: crypto.randomUUID(),
      personId: id!,
      date: new Date().toISOString(),
      text: newLog
    });
    setNewLog('');
  };

  if (!person) return <div className="p-6">Laddar...</div>;

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header Profile */}
      <div className="bg-white p-6 pb-0 pt-12 relative">
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 p-2 bg-gray-100 rounded-full">
          <ArrowLeft size={20} />
        </button>
        
        <div className="flex flex-col items-center">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-4 ${person.avatarColor || 'bg-gray-100 text-gray-600'}`}>
            {person.name.charAt(0)}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{person.name}</h1>
          <p className="text-gray-500 text-sm mb-6">{person.role}</p>
          
          <div className="flex gap-6 w-full justify-center border-t border-gray-100 py-4">
            <div className="text-center">
              <div className="font-bold text-xl">{tasks?.filter(t => t.status === 'todo').length || 0}</div>
              <div className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Aktiva Uppgifter</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-xl">{tasks?.filter(t => t.status === 'done').length || 0}</div>
              <div className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Avklarade</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex w-full mt-2">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}
            >
              Översikt
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'logs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}
            >
              Loggbok
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <MapPin size={16} className="text-gray-400" /> {person.region}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Mail size={16} className="text-gray-400" /> {person.email || 'Ingen e-post'}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-3">Aktiva Uppgifter</h3>
              <div className="space-y-2">
                {tasks?.filter(t => t.status === 'todo').map(task => (
                  <div key={task.id} className="bg-white p-3 rounded-lg border border-gray-100 flex items-center gap-3">
                    <CheckSquare size={16} className="text-blue-500" />
                    <span className="text-sm font-medium text-gray-700">{task.title}</span>
                  </div>
                ))}
                {tasks?.filter(t => t.status === 'todo').length === 0 && (
                  <p className="text-sm text-gray-400 italic">Inga aktiva uppgifter.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newLog}
                onChange={e => setNewLog(e.target.value)}
                placeholder="Skriv en anteckning..."
                className="flex-1 bg-white border-gray-200 rounded-lg text-sm"
              />
              <button onClick={addLog} className="p-2 bg-blue-600 text-white rounded-lg">
                <Plus size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {logs?.map(log => (
                <div key={log.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="text-xs text-gray-400 mb-1 font-mono">
                    {format(new Date(log.date), 'yyyy-MM-dd HH:mm')}
                  </div>
                  <p className="text-gray-700 text-sm">{log.text}</p>
                </div>
              ))}
              {logs?.length === 0 && (
                <p className="text-center text-gray-400 text-sm mt-8">Inga anteckningar än.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
