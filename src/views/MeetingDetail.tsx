import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { processMeetingAI, reprocessMeetingFromText } from '../services/geminiService';
import { useState, useRef, useEffect } from 'react';
import { Play, Loader2, RefreshCw, Users, Edit2, Check } from 'lucide-react';
import { clsx } from 'clsx';

export const MeetingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const meeting = useLiveQuery(() => db.meetings.get(id!), [id]);
  const tasks = useLiveQuery(() => db.tasks.where('linkedMeetingId').equals(id!).toArray(), [id]);
  const audioFile = useLiveQuery(() => db.audioFiles.get(id!), [id]);
  
  const people = useLiveQuery(
    () => db.people.where('id').anyOf(meeting?.participantIds || []).toArray(), 
    [meeting?.participantIds]
  );
  
  const [activeTab, setActiveTab] = useState<'protocol' | 'transcript' | 'participants'>('protocol');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // NYTT STATE: Håller koll på vilket transkriberingssegment vi redigerar just nu
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);

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
      setActiveTab('protocol');
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

  const toggleAttendance = (personId: string) => {
    const absent = meeting.absentParticipantIds || [];
    const isAbsent = absent.includes(personId);
    
    let newAbsent;
    if (isAbsent) {
      newAbsent = absent.filter(id => id !== personId);
    } else {
      newAbsent = [...absent, personId];
    }
    
    db.meetings.update(meeting.id, { absentParticipantIds: newAbsent });
  };

  const getTabName = (tab: string) => {
    if (tab === 'protocol') return 'Protokoll';
    if (tab === 'transcript') return 'Transkribering';
    if (tab === 'participants') return 'Deltagare';
    return tab;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white p-6 pb-4 shadow-sm sticky top-0 z-10">
        <div className="text-sm text-gray-500 mb-1">{new Date(meeting.date).toLocaleDateString()}</div>
        <h1 className="text-2xl font-bold leading-tight mb-4">{meeting.title}</h1>
        
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
          <div className="flex gap-4 mt-4 border-b overflow-x-auto no-scrollbar">
            {['protocol', 'transcript', 'participants'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={clsx(
                  "pb-2 font-medium text-sm transition-colors whitespace-nowrap",
                  activeTab === tab ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"
                )}
              >
                {getTabName(tab)}
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
                  {tasks?.length === 0 && <p className="text-sm text-gray-400 italic">Inga uppgifter hittades.</p>}
                </div>
              </div>
            )}

            {/* TRANKRIBERING - NU MED SMART REDIGERING */}
            {activeTab === 'transcript' && (
               <div className="space-y-4">
                 <div className="flex justify-between items-center mb-2">
                   <p className="text-xs text-gray-500">Tryck på texten för att lyssna. Tryck på pennan för att ändra.</p>
                   <button 
                     onClick={handleRegenerateProtocol}
                     disabled={isRegenerating}
                     className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-200 transition-colors"
                   >
                     <RefreshCw size={14} className={isRegenerating ? "animate-spin" : ""} />
                     {isRegenerating ? 'Uppdaterar...' : 'Skapa nytt protokoll'}
                   </button>
                 </div>
 
                 <div className="bg-white p-4 rounded-2xl shadow-sm space-y-4">
                   {meeting.transcription?.map((seg, i) => {
                     const isEditing = editingIndex === i;

                     return (
                       <div key={i} className="flex gap-3 group">
                         
                         {/* Vänster sida: Tidsstämpel & Knapp */}
                         <div className="min-w-[50px] flex flex-col items-center pt-1 gap-1">
                           <span className="text-xs font-mono text-gray-400">
                             {Math.floor(seg.start / 60)}:{Math.floor(seg.start % 60).toString().padStart(2, '0')}
                           </span>
                           <button 
                             onClick={() => isEditing ? setEditingIndex(null) : setEditingIndex(i)}
                             className={clsx(
                               "p-1.5 rounded-md transition-all active:scale-95",
                               isEditing 
                                 ? "bg-blue-100 text-blue-700" 
                                 : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                             )}
                             title={isEditing ? "Klar" : "Redigera text"}
                           >
                             {isEditing ? <Check size={14} /> : <Edit2 size={14} />}
                           </button>
                         </div>
                         
                         {/* Höger sida: Texten */}
                         <div className="flex-1">
                           {seg.speaker && <div className="text-xs font-bold text-gray-400 mb-0.5">{seg.speaker}</div>}
                           
                           {isEditing ? (
                             // REDIGERINGSLÄGET: Blå ram, textarea
                             <textarea
                               autoFocus
                               defaultValue={seg.text}
                               onBlur={(e) => {
                                 handleTranscriptChange(i, e.target.value);
                                 setEditingIndex(null); // Stäng redigering när man klickar utanför
                               }}
                               className="w-full text-gray-800 text-sm leading-relaxed bg-white border-2 border-blue-400 focus:outline-none focus:ring-0 rounded-lg p-2 resize-none shadow-sm transition-all"
                               rows={Math.max(2, Math.ceil(seg.text.length / 60))}
                             />
                           ) : (
                             // LÅST LÄGE: Klickbar text för att spela upp
                             <p
                               onClick={() => playFromTime(seg.start)}
                               className="text-gray-800 text-sm leading-relaxed p-2 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors border border-transparent"
                               title="Klicka för att spela från denna tidpunkt"
                             >
                               {seg.text}
                             </p>
                           )}
                         </div>

                       </div>
                     );
                   })}
                 </div>
               </div>
            )}

            {activeTab === 'participants' && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <Users size={16} className="text-gray-400" />
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Närvarolista</h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Klicka på en person för att ändra status. Alla inkallade står som "Deltog" från början.
                </p>
                
                <div className="grid grid-cols-1 gap-2">
                  {people?.map(person => {
                    const isAbsent = meeting.absentParticipantIds?.includes(person.id);
                    return (
                      <button
                        key={person.id}
                        onClick={() => toggleAttendance(person.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all active:scale-[0.98] ${
                          isAbsent 
                            ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' 
                            : 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            isAbsent ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'
                          }`}>
                            {person.name.charAt(0)}
                          </div>
                          <span className="font-medium text-sm">{person.name}</span>
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wide">
                          {isAbsent ? 'Deltog ej' : 'Deltog'}
                        </span>
                      </button>
                    );
                  })}

                  {(!people || people.length === 0) && (
                    <div className="text-center p-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-sm text-gray-400 italic">Inga personer taggades i detta möte.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
