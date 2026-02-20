import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { ArrowLeft, Calendar } from 'lucide-react';
import { useState } from 'react';
import { Meeting } from '../types';

// En underkomponent för varje möte - nu utan expander-logik
const MeetingItem = ({ meeting }: { meeting: Meeting }) => {
  const summary = meeting.protocol?.summary || "Ingen sammanfattning tillgänglig.";

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md hover:border-blue-200 group">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Calendar size={12} />
            {new Date(meeting.date).toLocaleDateString()}
          </div>
          <Link to={`/meeting/${meeting.id}`} className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors">
            {meeting.title}
          </Link>
        </div>
      </div>

      {/* HÄR VISAS DEN KORTA SAMMANFATTNINGEN I SIN HELHET */}
      <div className="text-sm text-gray-600 leading-relaxed my-3 bg-slate-50 p-3 rounded-xl border border-gray-100">
        <p className="whitespace-pre-wrap">{summary}</p>
      </div>
      
      <div className="pt-2 flex justify-end">
        <Link 
          to={`/meeting/${meeting.id}`} 
          className="text-xs font-bold text-blue-600 uppercase tracking-wider hover:text-blue-800"
        >
          Läs hela protokollet →
        </Link>
      </div>
    </div>
  );
};

export const PersonDetail = () => {
  const { id } = useParams<{ id: string }>();
  const person = useLiveQuery(() => db.people.get(id!), [id]);
  const projects = useLiveQuery(() => db.projects.toArray());
  const projectMemberships = useLiveQuery(() => db.projectMembers.where('personId').equals(id!).toArray(), [id]);
  const meetings = useLiveQuery(() => db.meetings.where('participantIds').equals(id!).toArray(), [id]);
  const tasks = useLiveQuery(() => db.tasks.where('assignedToId').equals(id!).toArray(), [id]);
  const [activeTab, setActiveTab] = useState<'projects' | 'meetings' | 'tasks'>('meetings');

  if (!person) return <div className="p-10 text-center">Laddar...</div>;

  const subTitleParts = [person.role, person.department, person.region].filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white p-6 shadow-sm sticky top-0 z-10">
        <Link to="/people" className="absolute top-6 left-4 p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex flex-col items-center text-center pt-8">
          <div className={`w-24 h-24 rounded-full ${person.avatarColor || 'bg-gray-200'} flex items-center justify-center text-4xl font-bold mb-3 shadow-inner`}>
            {person.name.charAt(0)}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{person.name}</h1>
          <p className="text-gray-500 font-medium">{subTitleParts.join(' • ')}</p>
        </div>
        <div className="flex gap-8 mt-6 border-b justify-center">
          {[
            { id: 'projects', label: 'Projekt' },
            { id: 'meetings', label: 'Möten' },
            { id: 'tasks', label: 'Uppgifter' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)} 
              className={`pb-3 font-bold text-sm transition-all ${
                activeTab === tab.id 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'projects' && (
          <div className="space-y-4">
            {projectMemberships?.map(pm => {
              const project = projects?.find(p => p.id === pm.projectId);
              return project ? (
                <div key={pm.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-800">{project.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wide">
                      {pm.group}
                    </span>
                    {pm.customRole && (
                      <span className="text-xs text-gray-500 italic">
                        — {pm.customRole}
                      </span>
                    )}
                  </div>
                </div>
              ) : null;
            })}
            {projectMemberships?.length === 0 && (
              <p className="text-center text-gray-400 py-10 italic">Inga projekt kopplade.</p>
            )}
          </div>
        )}

        {activeTab === 'meetings' && (
          <div className="space-y-4">
            {meetings && meetings.length > 0 ? (
              meetings
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(m => <MeetingItem key={m.id} meeting={m} />)
            ) : (
              <p className="text-center text-gray-400 py-10 italic">Inga möten registrerade.</p>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-3">
            {tasks && tasks.length > 0 ? (
              tasks.map(t => (
                <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${t.status === 'done' ? 'bg-green-400' : 'bg-orange-400'}`} />
                  <span className={`text-sm font-medium ${t.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {t.title}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-400 py-10 italic">Inga tilldelade uppgifter.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
