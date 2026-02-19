import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { processMeetingAI } from '../services/geminiService';
import { useState, useRef, useEffect } from 'react';
import { Play, Loader2, CheckCircle2, Circle, Save, Pause } from 'lucide-react';
import { clsx } from 'clsx';

export const MeetingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const meeting = useLiveQuery(() => db.meetings.get(id!), [id]);
  const tasks = useLiveQuery(() => db.tasks.where('linkedMeetingId').equals(id!).toArray(), [id]);
  const audioFile = useLiveQuery(() => db.audioFiles.get(id!), [id]);
  
  const [activeTab, setActiveTab] = useState<'protocol' | 'transcript'>('protocol');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile.blob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [audioFile]);

  useEffect(() => {
    if (meeting?.protocol?.summary) {
      setEditedSummary(meeting.protocol.summary);
    }
  }, [meeting]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await processMeetingAI(meeting!.id);
    } catch (e) {
      alert("Fel vid analys: " + e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const jumpToTime = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    await db.tasks.update(taskId, { status: newStatus });
  };

  const saveSummary = async () => {
    if (meeting && meeting.protocol) {
      await db.meetings.update(meeting.id, {
        protocol: { ...meeting.protocol, summary: editedSummary }
      });
      setIsEditingSummary(false);
    }
  };

  if (!meeting) return <div className="p-6">Laddar...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white p-6 pb-4 shadow-sm sticky top-0 z-10">
        <div className="text-sm text-gray-500 mb-1">{new Date(meeting.date).toLocaleDateString()} • {meeting.category}</div>
        <h1 className="text-2xl font-bold leading-tight mb-4">{meeting.title}</h1>
        
        {/* Audio Player */}
        {audioUrl && (
          <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center gap-3">
            <button onClick={togglePlay} className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0">
              {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
            </button>
            <div className="flex-1">
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-100" 
                  style={{ width: `${(currentTime / meeting.duration) * 100}%` }} 
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
                <span>{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
                <span>{Math.floor(meeting.duration / 60)}:{Math.floor(meeting.duration % 60).toString().padStart(2, '0')}</span>
              </div>
            </div>
            <audio 
              ref={audioRef} 
              src={audioUrl} 
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onEnded={() => setIsPlaying(false)}
            />
          </div>
        )}

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
                {/* Summary Section */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative group">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sammanfattning</h3>
                    {!isEditingSummary ? (
                      <button onClick={() => setIsEditingSummary(true)} className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Redigera</button>
                    ) : (
                      <button onClick={saveSummary} className="text-xs text-green-600 font-medium flex items-center gap-1"><Save size={12} /> Spara</button>
                    )}
                  </div>
                  
                  {isEditingSummary ? (
                    <textarea 
                      value={editedSummary}
                      onChange={(e) => setEditedSummary(e.target.value)}
                      className="w-full text-sm text-gray-700 leading-relaxed border-gray-200 rounded-lg focus:ring-blue-500 min-h-[150px]"
                    />
                  ) : (
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{meeting.protocol?.summary}</p>
                  )}
                </div>

                {/* Tasks Section */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Identifierade Uppgifter</h3>
                  {tasks?.map(task => (
                    <div 
                      key={task.id} 
                      onClick={() => toggleTask(task.id, task.status)}
                      className="flex items-start gap-3 py-3 border-b last:border-0 border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors -mx-2 px-2 rounded-lg"
                    >
                      <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${task.status === 'done' ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                        {task.status === 'done' && <CheckCircle2 size={12} className="text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className={clsx("text-sm font-medium transition-all", task.status === 'done' ? "text-gray-400 line-through" : "text-gray-800")}>
                          {task.title}
                        </p>
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
                  <div 
                    key={i} 
                    onClick={() => jumpToTime(seg.start)}
                    className="flex gap-3 p-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors group"
                  >
                    <div className="min-w-[40px] text-xs text-gray-400 font-mono pt-1 group-hover:text-blue-500">
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
