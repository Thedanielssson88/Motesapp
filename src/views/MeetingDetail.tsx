import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { processMeetingAI, reprocessMeetingFromText } from '../services/geminiService';
import { useState, useRef, useEffect } from 'react';
import { Play, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

export const MeetingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const meeting = useLiveQuery(() => db.meetings.get(id!), [id]);
  const tasks = useLiveQuery(() => db.tasks.where('linkedMeetingId').equals(id!).toArray(), [id]);
  const audioFile = useLiveQuery(() => db.audioFiles.get(id!), [id]);
  
  const [activeTab, setActiveTab] = useState<'protocol' | 'transcript'>('protocol');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Ladda ljudfilen när komponenten renderas
  useEffect(() => {
    if (audioFile && audioRef.current) {
      const url = URL.createObjectURL(audioFile.blob);
      audioRef.current.src = url;
    }
  }, [audioFile]);

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

  const handleRegenerateProtocol = async () => {
    setIsRegenerating(true);
    try {
      await reprocessMeetingFromText(meeting.id);
      setActiveTab('protocol'); // Hoppa tillbaka till protokollet när det är klart
    } catch (e) {
      alert("Fel vid omgenerering: " + e);
    } finally {
      setIsRegenerating(false);
    }
  };

  const playFromTime = (timeInSeconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = timeInSeconds;
      audioRef.current.play();
    }
  };

  const handleTranscriptChange = (index: number, newText: string) => {
    if (!meeting.transcription) return;
    const updated = [...meeting.transcription];
    updated[index].text = newText;
    db.meetings.update(meeting.id, { transcription: updated });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white p-6 pb-4 shadow-sm sticky top-0 z-10">
        <div className="text-sm text-gray-500 mb-1">{new Date(meeting.date).toLocaleDateString()} • {meeting.category}</div>
        <h1 className="text-2xl font-bold leading-tight mb-4">{meeting.title}</h1>
        
        {/* Ljudspelaren */}
        {audioFile && (
          <audio ref={audioRef} controls className="w-full h-10 mb-4 rounded-lg" />
        )}
        
        {!meeting.isProcessed && (
          <button 
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2"
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
                  "pb-2 font-medium text-sm capitalize transition-colors",
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
        {meeting.isProcessed && (
          <>
            {activeTab === 'protocol' && (
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Sammanfattning</h3>
                  {/* Här kan du byta ut <p> mot en <textarea> om du vill kunna redigera protokollet fritt också */}
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{meeting.protocol?.summary}</p>
                </div>

                {meeting.protocol?.decisions && meeting.protocol.decisions.length > 0 && (
                   <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                     <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Beslut</h3>
                     <ul className="list-disc pl-5 text-gray-700 space-y-1">
                       {meeting.protocol.decisions.map((d, i) => <li key={i}>{d}</li>)}
                     </ul>
                   </div>
                )}

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Identifierade Uppgifter</h3>
                  {tasks?.map(task => (
                    <div key={task.id} className="flex items-start gap-3 py-2 border-b last:border-0 border-gray-50">
                      <input 
                        type="checkbox"
                        checked={task.status === 'done'}
                        onChange={(e) => db.tasks.update(task.id, { status: e.target.checked ? 'done' : 'todo' })}
                        className="mt-1 w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <div>
                        <p className={clsx("text-sm font-medium", task.status === 'done' ? "text-gray-400 line-through" : "text-gray-800")}>
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
                </div>
              </div>
            )}

            {activeTab === 'transcript' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-gray-500">Klicka på tidsstämpeln för att spela upp. Ändra texten direkt i fälten.</p>
                  <button 
                    onClick={handleRegenerateProtocol}
                    disabled={isRegenerating}
                    className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-200 transition-colors"
                  >
                    <RefreshCw size={14} className={isRegenerating ? "animate-spin" : ""} />
                    {isRegenerating ? 'Uppdaterar...' : 'Skapa nytt protokoll'}
                  </button>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm space-y-3">
                  {meeting.transcription?.map((seg, i) => (
                    <div key={i} className="flex gap-3 group">
                      <button 
                        onClick={() => playFromTime(seg.start)}
                        className="min-w-[45px] text-xs font-mono pt-2 text-blue-500 hover:text-blue-700 hover:underline flex items-start gap-1"
                      >
                        <Play size={10} className="mt-0.5" />
                        {Math.floor(seg.start / 60)}:{Math.floor(seg.start % 60).toString().padStart(2, '0')}
                      </button>
                      <div className="flex-1">
                        {seg.speaker && <div className="text-xs font-bold text-gray-400 mb-0.5">{seg.speaker}</div>}
                        {/* Redigerbart fält */}
                        <textarea
                          defaultValue={seg.text}
                          onBlur={(e) => handleTranscriptChange(i, e.target.value)}
                          className="w-full text-gray-800 text-sm leading-relaxed bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 rounded p-1 resize-none"
                          rows={Math.max(1, Math.ceil(seg.text.length / 60))} // Dynamisk höjd
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
