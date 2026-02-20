import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteMeeting } from '../services/db';
import { addToQueue } from '../services/queueService';
import { useState, useRef, useEffect } from 'react';
import { Play, Loader2, RefreshCw, Users, Edit2, Check, ArrowLeft, Plus, Settings, Copy, Mail, FileText, Bold, Italic, Save, Tag as TagIcon, Mic, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

export const MeetingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const meeting = useLiveQuery(() => db.meetings.get(id!), [id]);
  const tasks = useLiveQuery(() => db.tasks.where('linkedMeetingId').equals(id!).toArray(), [id]);
  const audioFile = useLiveQuery(() => db.audioFiles.get(id!), [id]);

  const activeJobs = useLiveQuery(() => db.processingJobs.where('meetingId').equals(id!).toArray(), [id]);
  const currentJob = activeJobs?.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const isJobActive = currentJob && (currentJob.status === 'pending' || currentJob.status === 'processing');

  const projects = useLiveQuery(() => db.projects.toArray());
  const allCategories = useLiveQuery(() => db.categories.toArray());
  const projectTags = useLiveQuery(() => meeting?.projectId ? db.tags.where('projectId').equals(meeting.projectId).toArray() : Promise.resolve([]), [meeting?.projectId]);

  const people = useLiveQuery(() => db.people.where('id').anyOf(meeting?.participantIds || []).toArray(), [meeting?.participantIds]);
  const allPeople = useLiveQuery(() => db.people.toArray());
  const peopleNotInMeeting = allPeople?.filter(p => !meeting?.participantIds?.includes(p.id)) || [];

  const [personToAdd, setPersonToAdd] = useState('');
  const [activeTab, setActiveTab] = useState<'protocol' | 'transcript' | 'participants' | 'settings'>('protocol');
  const [copied, setCopied] = useState(false); 

  const [isEditingProtocol, setIsEditingProtocol] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    let objectUrl: string | undefined;
    if (audioFile && audioRef.current) {
      objectUrl = URL.createObjectURL(audioFile.blob);
      audioRef.current.src = objectUrl;
      audioRef.current.load();
    }
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }
  }, [audioFile]);

  useEffect(() => {
    if (!meeting || meeting.isProcessed || isJobActive || hasAutoStartedRef.current) return;
    const hasAudio = !!audioFile;
    if (hasAudio || (meeting.transcription && meeting.transcription.length > 0)) {
      hasAutoStartedRef.current = true;
      addToQueue(meeting.id, hasAudio ? 'audio' : 'text');
    }
  }, [meeting, audioFile, isJobActive]);

  const handleDeleteMeeting = async () => {
    if (window.confirm("Är du säker på att du vill ta bort detta möte? Inspelningen och alla tillhörande uppgifter kommer att raderas permanent.")) {
      if (meeting) {
        await deleteMeeting(meeting.id);
        navigate(-1); // Skicka tillbaka användaren till föregående sida efter radering
      }
    }
  };

  const handleStartAnalysisManual = () => {
    if (!meeting) return;
    addToQueue(meeting.id, audioFile ? 'audio' : 'text');
  };

  const handleRegenerateProtocol = async () => {
    if (!meeting) return;
    await db.meetings.update(meeting.id, { isProcessed: false });
    addToQueue(meeting.id, audioFile ? 'audio' : 'text');
    setActiveTab('protocol');
  };

  const handleSaveProtocol = async () => {
    if (!meeting || !editorRef.current) return;
    await db.meetings.update(meeting.id, { "protocol.detailedProtocol": editorRef.current.innerHTML });
    setIsEditingProtocol(false);
  };

  const playFromTime = async (timeInSeconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = timeInSeconds;
      try { await audioRef.current.play(); } catch (e) { console.error(e); }
    }
  };

  const handleTranscriptChange = (index: number, newText: string) => {
    if (!meeting || !meeting.transcription) return;
    const updated = [...meeting.transcription];
    updated[index].text = newText;
    db.meetings.update(meeting.id, { transcription: updated });
  };

  const toggleAttendance = (personId: string) => {
    if (!meeting) return;
    const absent = meeting.absentParticipantIds || [];
    const isAbsent = absent.includes(personId);
    const newAbsent = isAbsent ? absent.filter(id => id !== personId) : [...absent, personId];
    db.meetings.update(meeting.id, { absentParticipantIds: newAbsent });
  };

  const handleAddParticipant = () => {
    if (!meeting || !personToAdd) return;
    const newParticipantIds = [...(meeting.participantIds || []), personToAdd];
    db.meetings.update(meeting.id, { participantIds: newParticipantIds });
    setPersonToAdd('');
  };

  const execCommand = (command: string) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
  };

  const stripHtml = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent || "";
  const handleCopyProtocol = () => { if (meeting?.protocol?.detailedProtocol) { navigator.clipboard.writeText(stripHtml(meeting.protocol.detailedProtocol)); setCopied(true); setTimeout(() => setCopied(false), 2000); } };
  const handleEmailProtocol = () => { if (meeting?.protocol?.detailedProtocol) window.location.href = `mailto:?subject=${encodeURIComponent(meeting.title)}&body=${encodeURIComponent(stripHtml(meeting.protocol.detailedProtocol))}`; };

  if (!meeting) return <div className="p-6 text-center text-gray-500">Laddar möte...</div>;

  const projectCategories = allCategories?.filter(c => c.projectId === meeting.projectId) || [];

  return (
    <div className="min-h-screen bg-slate-50 pb-24 relative">
      <div className="bg-white p-6 pb-4 shadow-sm sticky top-0 z-10">
          <div className="flex justify-between items-center absolute top-6 left-4 right-4">
              <button onClick={() => navigate(-1)} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors">
                  <ArrowLeft size={20} />
              </button>
              <button onClick={handleDeleteMeeting} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors" title="Ta bort möte">
                  <Trash2 size={20} />
              </button>
          </div>

          <div className="text-center pt-8">
            <h1 className="text-2xl font-bold leading-tight mb-1">{meeting.title}</h1>
            <div className="text-sm text-gray-500 mb-1">{new Date(meeting.date).toLocaleDateString()}</div>
          </div>

        {audioFile && <audio ref={audioRef} controls playsInline className="w-full h-10 mb-4 rounded-lg" />}

        {!meeting.isProcessed && isJobActive && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-blue-800 flex items-center gap-2">
                <Loader2 className="animate-spin text-blue-600" size={16} /> 
                {currentJob.message}
              </span>
              <span className="text-xs font-bold text-blue-600">{Math.round(currentJob.progress)}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${currentJob.progress}%` }}></div>
            </div>
          </div>
        )}

        {!meeting.isProcessed && !isJobActive && (
           <button onClick={handleStartAnalysisManual} className="w-full text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600">
             <Play size={18} fill="currentColor" /> Skapa protokoll
           </button>
        )}

        {meeting.isProcessed && (
          <div className="flex gap-4 mt-4 border-b overflow-x-auto no-scrollbar justify-start">
            {['protocol', 'transcript', 'participants', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={clsx("pb-2 font-medium text-sm transition-colors whitespace-nowrap", activeTab === tab ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400")}>
                {tab === 'protocol' ? 'Protokoll' : tab === 'transcript' ? 'Transkribering' : tab === 'participants' ? 'Deltagare' : 'Inställningar'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-6">
        {meeting.isProcessed && activeTab === 'protocol' && (
          <div className="space-y-6">
            <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
              <h3 className="text-xs font-bold text-blue-600 uppercase mb-3 flex items-center gap-2"><Check size={14} /> Sammanfattning</h3>
              <p className="text-gray-800 font-medium leading-relaxed">{meeting.protocol?.summary}</p>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-gray-200 relative flex flex-col">
              <div className={clsx("p-2 border-b border-gray-100 flex items-center justify-between", isEditingProtocol ? "bg-gray-50 h-12" : "h-0 opacity-0 overflow-hidden")}>
                <div className="flex gap-1">
                  <button onClick={() => execCommand('bold')} className="p-2 hover:bg-gray-200 rounded"><Bold size={18} /></button>
                  <button onClick={() => execCommand('italic')} className="p-2 hover:bg-gray-200 rounded"><Italic size={18} /></button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsEditingProtocol(false)} className="px-3 text-xs font-bold text-gray-500">Avbryt</button>
                  <button onClick={handleSaveProtocol} className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-lg flex items-center gap-1"><Save size={14}/> Spara</button>
                </div>
              </div>

              <div className="p-6">
                {!isEditingProtocol && (
                  <div className="flex gap-2 mb-6">
                    <button onClick={() => setIsEditingProtocol(true)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-bold flex items-center gap-2"><Edit2 size={14}/> Redigera</button>
                    <button onClick={handleCopyProtocol} className="px-3 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-2">{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Kopierad' : 'Kopiera'}</button>
                    <button onClick={handleEmailProtocol} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100 flex items-center gap-2">
                      <Mail size={14} /> E-posta
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <FileText className="text-blue-600" size={20} />
                  </div>
                  <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Dokumenterat Protokoll</h2>
                </div>
                <div 
                  ref={editorRef}
                  contentEditable={isEditingProtocol}
                  suppressContentEditableWarning={true}
                  className={clsx("font-sans outline-none min-h-[200px] [&>h3]:text-lg [&>h3]:font-bold [&>h3]:mt-6 [&>ul]:list-disc [&>ul]:pl-5", isEditingProtocol && "ring-2 ring-blue-100 p-4 border-dashed border-2 bg-gray-50")}
                  dangerouslySetInnerHTML={{ __html: meeting.protocol?.detailedProtocol || '' }}
                />
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-2xl border border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Beslut & Uppgifter</h3>
              {tasks?.map(task => (
                <div key={task.id} className="flex items-start gap-3 py-2 border-b last:border-0 border-gray-50">
                  <input type="checkbox" checked={task.status === 'done'} onChange={(e) => db.tasks.update(task.id, { status: e.target.checked ? 'done' : 'todo' })} className="mt-1 w-5 h-5 rounded text-green-600" />
                  <p className={clsx("text-sm font-medium", task.status === 'done' && "text-gray-400 line-through")}>{task.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {meeting.isProcessed && activeTab === 'transcript' && (
           <div className="space-y-4">
             <div className="flex justify-between items-center mb-2">
               <p className="text-xs text-gray-500">Tryck på texten för att lyssna.</p>
               <button onClick={handleRegenerateProtocol} className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-sm font-bold">
                 <RefreshCw size={14} /> Skapa nytt protokoll
               </button>
             </div>
             <div className="bg-white p-4 rounded-2xl shadow-sm space-y-4">
               {meeting.transcription?.map((seg, i) => (
                 <div key={i} className="flex gap-3 group">
                   <div className="min-w-[50px] flex flex-col items-center pt-1 gap-1">
                     <span className="text-xs font-mono text-gray-400">{Math.floor(seg.start / 60)}:{Math.floor(seg.start % 60).toString().padStart(2, '0')}</span>
                     <button onClick={() => setEditingIndex(editingIndex === i ? null : i)} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100">
                       {editingIndex === i ? <Check size={14} /> : <Edit2 size={14} />}
                     </button>
                   </div>
                   <div className="flex-1">
                     {seg.speaker && <div className="text-xs font-bold text-gray-400 mb-0.5">{seg.speaker}</div>}
                     {editingIndex === i ? (
                       <textarea autoFocus defaultValue={seg.text} onBlur={(e) => { handleTranscriptChange(i, e.target.value); setEditingIndex(null); }} className="w-full text-gray-800 text-sm leading-relaxed bg-white border-2 border-blue-400 rounded-lg p-2" rows={4} />
                     ) : (
                       <p onClick={() => playFromTime(seg.start)} className="text-gray-800 text-sm leading-relaxed cursor-pointer hover:bg-blue-50 p-2 rounded-lg transition-colors">{seg.text}</p>
                     )}
                   </div>
                 </div>
               ))}
             </div>
           </div>
        )}

        {meeting.isProcessed && activeTab === 'participants' && (
          <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Users size={16}/> Närvarolista</h3>
            <div className="flex gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <select value={personToAdd} onChange={e => setPersonToAdd(e.target.value)} className="flex-1 bg-white border border-gray-200 text-sm rounded-lg p-2">
                <option value="">-- Lägg till saknad deltagare --</option>
                {peopleNotInMeeting.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={handleAddParticipant} disabled={!personToAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"><Plus size={16} /></button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {people?.map(person => {
                const isAbsent = meeting.absentParticipantIds?.includes(person.id);
                return (
                  <button key={person.id} onClick={() => toggleAttendance(person.id)} className={clsx("flex items-center justify-between p-3 rounded-xl border", isAbsent ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-800')}>
                    <div className="flex items-center gap-3">
                      <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs", isAbsent ? 'bg-red-200' : 'bg-green-200')}>
                        {person.name.charAt(0)}
                      </div>
                      <span className="font-medium text-sm">{person.name}</span>
                    </div>
                    <span className="text-xs font-bold uppercase">{isAbsent ? 'Deltog ej' : 'Deltog'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {meeting.isProcessed && activeTab === 'settings' && (
          <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Settings size={16}/> Mötesinställningar</h3>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Rubrik</label>
              <input type="text" value={meeting.title} onChange={e => db.meetings.update(meeting.id, { title: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm" />
            </div>

            {/* DATUMVÄLJARE */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Datum</label>
              <input 
                type="date" 
                value={new Date(meeting.date).toISOString().split('T')[0]} 
                onChange={e => {
                  const newDate = new Date(e.target.value);
                  const oldDate = new Date(meeting.date);
                  newDate.setHours(oldDate.getHours(), oldDate.getMinutes());
                  db.meetings.update(meeting.id, { date: newDate.toISOString() });
                }} 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-blue-500 outline-none" 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Projekt</label>
              <select value={meeting.projectId || ''} onChange={e => db.meetings.update(meeting.id, { projectId: e.target.value || undefined })} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm">
                <option value="">-- Inget projekt valt --</option>
                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><TagIcon size={14}/> Taggar</label>
              <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
                {projectTags?.map(tag => {
                  const isSelected = meeting.tagIds?.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => {
                        const currentTags = meeting.tagIds || [];
                        const newTags = isSelected ? currentTags.filter(tid => tid !== tag.id) : [...currentTags, tag.id];
                        db.meetings.update(meeting.id, { tagIds: newTags });
                      }}
                      className={clsx("px-3 py-1.5 rounded-full text-xs font-bold border", isSelected ? "bg-blue-600 text-white border-blue-700" : "bg-white text-gray-500 border-gray-200")}
                    >
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <button 
        onClick={() => navigate('/record')}
        className="fixed bottom-24 right-6 w-14 h-14 bg-red-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-red-700 active:scale-90 z-40 border-4 border-white"
      >
        <Mic size={24} fill="white" />
      </button>
    </div>
  );
};