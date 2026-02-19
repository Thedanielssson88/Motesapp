import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { processMeetingAI } from '../services/geminiService';
import { useState } from 'react';
import { Play, Loader2, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';

export const MeetingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const meeting = useLiveQuery(() => db.meetings.get(id!), [id]);
  const tasks = useLiveQuery(() => db.tasks.where('linkedMeetingId').equals(id!).toArray(), [id]);
  const [activeTab, setActiveTab] = useState<'protocol' | 'transcript'>('protocol');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  if (!meeting) return <div className="p-6">Laddar...</div>;

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await processMeetingAI(meeting.id);
    } catch (e) {
      alert("Fel vid analys: " + e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white p-6 pb-4 shadow-sm sticky top-0 z-10">
        <div className="text-sm text-gray-500 mb-1">{new Date(meeting.date).toLocaleDateString()} • {meeting.category}</div>
        <h1 className="text-2xl font-bold leading-tight mb-4">{meeting.title}</h1>
        
        {!meeting.isProcessed && (
          <button 
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
          >
            {isAnalyzing ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
            {isAnalyzing ? 'Analyserar med Gemini...' : 'Analysera Mötet'}
          </button>
        )}

        {meeting.isProcessed && (
          <div className="flex gap-4 mt-4 border-b">
            {['protocol', 'transcript'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={clsx(
                  "pb-2 font-medium text-sm capitalize",
                  activeTab === tab ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"
                )}
              >
                {tab === 'protocol' ? 'Protokoll' : 'Transkribering'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-6">
        {meeting.isProcessed ? (
          <>
            {activeTab === 'protocol' && (
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Sammanfattning</h3>
                  <p className="text-gray-700 leading-relaxed">{meeting.protocol?.summary}</p>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Identifierade Uppgifter</h3>
                  {tasks?.map(task => (
                    <div key={task.id} className="flex items-start gap-3 py-2 border-b last:border-0 border-gray-50">
                      <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center ${task.status === 'done' ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                        {task.status === 'done' && <CheckCircle2 size={12} className="text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{task.title}</p>
                        {task.assignedToId && (
                           <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full mt-1 inline-block">
                             Tilldelad
                           </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {tasks?.length === 0 && <p className="text-sm text-gray-400 italic">Inga uppgifter hittades.</p>}
                </div>
              </div>
            )}

            {activeTab === 'transcript' && (
              <div className="bg-white p-4 rounded-2xl shadow-sm space-y-4">
                {meeting.transcription?.map((seg, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="min-w-[40px] text-xs text-gray-400 font-mono pt-1">
                      {Math.floor(seg.start / 60)}:{Math.floor(seg.start % 60).toString().padStart(2, '0')}
                    </div>
                    <div>
                      {seg.speaker && <div className="text-xs font-bold text-indigo-600 mb-0.5">{seg.speaker}</div>}
                      <p className="text-gray-700 text-sm leading-relaxed">{seg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-gray-400 mt-10">
            <p>Ingen data än. Starta analysen ovan.</p>
          </div>
        )}
      </div>
    </div>
  );
};
