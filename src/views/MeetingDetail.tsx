import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { processMeetingAI, reprocessMeetingFromText } from '../services/geminiService';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Loader2, RefreshCw, Users } from 'lucide-react';
import { clsx } from 'clsx';

export const MeetingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const meeting = useLiveQuery(() => db.meetings.get(id!), [id]);
  const tasks = useLiveQuery(() => db.tasks.where('linkedMeetingId').equals(id!).toArray(), [id]);
  const audioFile = useLiveQuery(() => db.audioFiles.get(id!), [id]);
  const allPeople = useLiveQuery(() => db.people.toArray());

  const participants = useLiveQuery(
    () => db.people.where('id').anyOf(meeting?.participantIds || []).toArray(), 
    [meeting?.participantIds]
  );
  
  const [activeTab, setActiveTab] = useState<'protocol' | 'transcript' | 'participants'>('protocol');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [speakerMap, setSpeakerMap] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioFile && audioRef.current) {
      const url = URL.createObjectURL(audioFile.blob);
      audioRef.current.src = url;
    }
  }, [audioFile]);

  useEffect(() => {
    if (meeting?.speakerMap) {
      setSpeakerMap(meeting.speakerMap);
    }
  }, [meeting]);

  const uniqueSpeakers = useMemo(() => {
    if (!meeting?.transcription) return [];
    const speakers = meeting.transcription.map(s => s.speaker || 'Okänd');
    return [...new Set(speakers)];
  }, [meeting?.transcription]);

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
    const newAbsent = isAbsent ? absent.filter(id => id !== personId) : [...absent, personId];
    db.meetings.update(meeting.id, { absentParticipantIds: newAbsent });
  };

  const handleSpeakerMapChange = (speaker: string, personId: string) => {
    const newMap = { ...speakerMap, [speaker]: personId };
    setSpeakerMap(newMap);
    db.meetings.update(meeting.id, { speakerMap: newMap });
  };

  const getPersonName = (personId: string) => allPeople?.find(p => p.id === personId)?.name || 'Okänd';

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
          <button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2">
            {isAnalyzing ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
            {isAnalyzing ? 'Analyserar med Gemini...' : 'Analysera Mötet'}
          </button>
        )}

        {meeting.isProcessed && (
          <div className="flex gap-4 mt-4 border-b overflow-x-auto no-scrollbar">
            {['protocol', 'transcript', 'participants'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={clsx("pb-2 font-medium text-sm transition-colors whitespace-nowrap", activeTab === tab ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400")}>
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
              </div>
            )}

            {activeTab === 'transcript' && (
               <div className="space-y-4">
                 <div className="bg-white p-4 rounded-2xl shadow-sm mb-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Identifiera Talare</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {uniqueSpeakers.map(speaker => (
                      <div key={speaker} className="flex items-center gap-2">
                        <span className="font-bold text-sm w-24">{speaker}:</span>
                        <select value={speakerMap[speaker] || ''} onChange={e => handleSpeakerMapChange(speaker, e.target.value)} className="flex-1 bg-gray-50 border-gray-200 rounded-lg text-sm">
                          <option value="">Välj person...</option>
                          {allPeople?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                 <div className="flex justify-between items-center mb-2">
                   <p className="text-xs text-gray-500">Klicka på tidsstämpeln för uppspelning.</p>
                   <button onClick={handleRegenerateProtocol} disabled={isRegenerating} className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-200 transition-colors">
                     <RefreshCw size={14} className={isRegenerating ? "animate-spin" : ""} />
                     {isRegenerating ? 'Uppdaterar...' : 'Skapa nytt protokoll'}
                   </button>
                 </div>
                 <div className="bg-white p-4 rounded-2xl shadow-sm space-y-3">
                   {meeting.transcription?.map((seg, i) => (
                     <div key={i} className="flex gap-3 group">
                       <button onClick={() => playFromTime(seg.start)} className="min-w-[45px] text-xs font-mono pt-2 text-blue-500 hover:text-blue-700 flex items-start gap-1">
                         <Play size={10} className="mt-0.5" />
                         {Math.floor(seg.start / 60)}:{Math.floor(seg.start % 60).toString().padStart(2, '0')}
                       </button>
                       <div className="flex-1">
                         {seg.speaker && <div className="text-xs font-bold text-gray-400 mb-0.5">{speakerMap[seg.speaker] ? getPersonName(speakerMap[seg.speaker]) : seg.speaker}</div>}
                         <textarea defaultValue={seg.text} onBlur={(e) => handleTranscriptChange(i, e.target.value)} className="w-full text-gray-800 text-sm leading-relaxed bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 rounded p-1 resize-none" rows={Math.max(1, Math.ceil(seg.text.length / 60))} />
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
            )}

            {activeTab === 'participants' && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <Users size={16} className="text-gray-400" />
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Närvarolista</h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">Klicka på en person för att ändra status. Alla inkallade står som "Deltog" från början.</p>
                <div className="grid grid-cols-1 gap-2">
                  {participants?.map(person => {
                    const isAbsent = meeting.absentParticipantIds?.includes(person.id);
                    return (
                      <button key={person.id} onClick={() => toggleAttendance(person.id)} className={`flex items-center justify-between p-3 rounded-xl border transition-all active:scale-[0.98] ${isAbsent ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' : 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isAbsent ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>
                            {person.name.charAt(0)}
                          </div>
                          <span className="font-medium text-sm">{person.name}</span>
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wide">{isAbsent ? 'Deltog ej' : 'Deltog'}</span>
                      </button>
                    );
                  })}
                  {(!participants || participants.length === 0) && (
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
