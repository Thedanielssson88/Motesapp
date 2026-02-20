import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { processMeetingAI, reprocessMeetingFromText } from '../services/geminiService';
import { useState, useRef, useEffect } from 'react';
import { Play, Loader2, RefreshCw, Users, Edit2, Check, ArrowLeft, Plus, Settings, Copy, Mail, FileText, Bold, Italic, Strikethrough, Save, X as CloseIcon, Tag as TagIcon } from 'lucide-react';
import { clsx } from 'clsx';

export const MeetingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const meeting = useLiveQuery(() => db.meetings.get(id!), [id]);
  const tasks = useLiveQuery(() => db.tasks.where('linkedMeetingId').equals(id!).toArray(), [id]);
  const audioFile = useLiveQuery(() => db.audioFiles.get(id!), [id]);

  const projects = useLiveQuery(() => db.projects.toArray());
  const allCategories = useLiveQuery(() => db.categories.toArray());
  const projectTags = useLiveQuery(() => meeting?.projectId ? db.tags.where('projectId').equals(meeting.projectId).toArray() : Promise.resolve([]), [meeting?.projectId]);

  const people = useLiveQuery(
    () => db.people.where('id').anyOf(meeting?.participantIds || []).toArray(),
    [meeting?.participantIds]
  );

  const allPeople = useLiveQuery(() => db.people.toArray());
  const peopleNotInMeeting = allPeople?.filter(p => !meeting?.participantIds?.includes(p.id)) || [];
  const [personToAdd, setPersonToAdd] = useState('');

  const [activeTab, setActiveTab] = useState<'protocol' | 'transcript' | 'participants' | 'settings'>('protocol');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
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
    if (!meeting || meeting.isProcessed || hasAutoStartedRef.current) return;
    const hasAudio = !!audioFile;
    const hasText = !!(meeting.transcription && meeting.transcription.length > 0);
    if (hasAudio || hasText) {
      hasAutoStartedRef.current = true;
      if (hasAudio) { handleAnalyze(); } else { handleAutoReprocess(); }
    }
  }, [meeting, audioFile]);

  const execCommand = (command: string) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
  };

  const handleSaveProtocol = async () => {
    if (!meeting || !editorRef.current) return;
    const newHtml = editorRef.current.innerHTML;
    await db.meetings.update(meeting.id, { "protocol.detailedProtocol": newHtml });
    setIsEditingProtocol(false);
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try { await processMeetingAI(meeting!.id); } catch (e) { alert("Fel vid analys: " + e); } finally { setIsAnalyzing(false); }
  };

  const handleAutoReprocess = async () => {
    setIsAnalyzing(true);
    try { await reprocessMeetingFromText(meeting!.id); } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
  };

  const handleRegenerateProtocol = async () => {
    setIsRegenerating(true);
    try {
      await reprocessMeetingFromText(meeting!.id);
      setActiveTab('protocol');
    } catch (e) { alert("Fel vid omgenerering: " + e); } finally { setIsRegenerating(false); }
  };

  const playFromTime = async (timeInSeconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = timeInSeconds;
      try { await audioRef.current.play(); } catch (error) { alert("Webbläsaren blockerade uppspelningen."); }
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
    let newAbsent = isAbsent ? absent.filter(id => id !== personId) : [...absent, personId];
    db.meetings.update(meeting.id, { absentParticipantIds: newAbsent });
  };

  const handleAddParticipant = () => {
    if (!meeting || !personToAdd) return;
    const newParticipantIds = [...(meeting.participantIds || []), personToAdd];
    db.meetings.update(meeting.id, { participantIds: newParticipantIds });
    setPersonToAdd('');
  };

  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  };

  const handleCopyProtocol = () => {
    if (!meeting?.protocol?.detailedProtocol) return;
    navigator.clipboard.writeText(stripHtml(meeting.protocol.detailedProtocol));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmailProtocol = () => {
    if (!meeting?.protocol?.detailedProtocol) return;
    const subject = encodeURIComponent(`Mötesprotokoll: ${meeting.title}`);
    const body = encodeURIComponent(stripHtml(meeting.protocol.detailedProtocol));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  if (!meeting) return <div className="p-6 text-center text-gray-500">Laddar möte...</div>;

  const projectCategories = allCategories?.filter(c => c.projectId === meeting.projectId) || [];
  const activeCategory = allCategories?.find(c => c.id === meeting.categoryId);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white p-6 pb-4 shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="absolute top-6 left-4 p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="text-center pt-8">
          <div className="text-sm text-gray-500 mb-1">{new Date(meeting.date).toLocaleDateString()}</div>
          <h1 className="text-2xl font-bold leading-tight mb-4">{meeting.title}</h1>
        </div>

        {audioFile && <audio ref={audioRef} controls playsInline className="w-full h-10 mb-4 rounded-lg" />}

        {!meeting.isProcessed && (
          <button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md">
            {isAnalyzing ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
            {isAnalyzing ? 'Analyserar...' : 'Starta analys manuellt'}
          </button>
        )}

        {meeting.isProcessed && (
          <div className="flex gap-4 mt-4 border-b overflow-x-auto no-scrollbar justify-start md:justify-center">
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
            <div className="bg-blue-50/50 p-5 rounded-2xl shadow-sm border border-blue-100">
              <h3 className="text-xs font-bold text-blue-600 uppercase mb-3 tracking-wider flex items-center gap-2"><Check size={14} /> Sammanfattning</h3>
              <p className="text-gray-800 font-medium leading-relaxed">{meeting.protocol?.summary}</p>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-gray-200 relative overflow-hidden flex flex-col">
              {/* Toolbar för redigering */}
              <div className={clsx("p-2 border-b border-gray-100 flex items-center justify-between transition-all overflow-x-auto", isEditingProtocol ? "bg-gray-50 h-12" : "h-0 opacity-0 overflow-hidden")}>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => execCommand('bold')} className="p-2 hover:bg-gray-200 rounded text-gray-700"><Bold size={18} /></button>
                  <button onClick={() => execCommand('italic')} className="p-2 hover:bg-gray-200 rounded text-gray-700"><Italic size={18} /></button>
                  <button onClick={() => execCommand('insertUnorderedList')} className="p-2 hover:bg-gray-200 rounded text-gray-700 text-xs font-bold px-2">LISTA</button>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setIsEditingProtocol(false)} className="px-3 py-1 text-xs font-bold text-gray-500">Avbryt</button>
                  <button onClick={handleSaveProtocol} className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-lg flex items-center gap-1"><Save size={14} /> Spara</button>
                </div>
              </div>

              <div className="p-6 md:p-8">
                {/* NY KNAPPRAD: Ligger nu alltid synlig ovanför rubriken till vänster */}
                {!isEditingProtocol && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    <button onClick={() => setIsEditingProtocol(true)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold border border-gray-200 flex items-center gap-2 transition-colors">
                      <Edit2 size={14} /> Redigera
                    </button>
                    <button onClick={handleCopyProtocol} className={clsx("px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 transition-colors", copied ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")}>
                      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Kopierad!' : 'Kopiera'}
                    </button>
                    <button onClick={handleEmailProtocol} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-100 flex items-center gap-2 transition-colors">
                      <Mail size={14} /> E-posta
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                    <FileText className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Dokumenterat Protokoll</h2>
                  </div>
                </div>

                <div 
                  ref={editorRef}
                  contentEditable={isEditingProtocol}
                  suppressContentEditableWarning={true}
                  className={clsx(
                    "font-sans text-[15px] outline-none min-h-[300px]",
                    isEditingProtocol && "ring-2 ring-blue-100 p-4 rounded-xl border-dashed border-2 border-blue-200 bg-gray-50/30",
                    "[&>h3]:text-lg [&>h3]:font-extrabold [&>h3]:text-gray-900 [&>h3]:mt-8 [&>h3]:mb-3 [&>h3]:border-b [&>h3]:border-gray-100 [&>h3]:pb-2 [&>p]:mb-4 [&>p]:leading-relaxed [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-6"
                  )}
                  dangerouslySetInnerHTML={{ __html: meeting.protocol?.detailedProtocol || '' }}
                />
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
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

        {activeTab === 'transcript' && (
           <div className="space-y-4">
             <div className="bg-white p-4 rounded-2xl shadow-sm space-y-4">
               {meeting.transcription?.map((seg, i) => (
                 <div key={i} className="flex gap-3">
                   <span className="text-xs font-mono text-gray-400 mt-1">{Math.floor(seg.start / 60)}:{Math.floor(seg.start % 60).toString().padStart(2, '0')}</span>
                   <div className="flex-1">
                     {seg.speaker && <div className="text-xs font-bold text-gray-400 mb-0.5">{seg.speaker}</div>}
                     <p onClick={() => playFromTime(seg.start)} className="text-gray-800 text-sm leading-relaxed cursor-pointer hover:bg-blue-50 p-2 rounded-lg">{seg.text}</p>
                   </div>
                 </div>
               ))}
             </div>
           </div>
        )}

        {activeTab === 'participants' && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Users size={16}/> Närvarolista</h3>
            <div className="flex gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <select value={personToAdd} onChange={e => setPersonToAdd(e.target.value)} className="flex-1 bg-white border border-gray-200 text-sm rounded-lg p-2">
                <option value="">-- Lägg till deltagare --</option>
                {peopleNotInMeeting.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={handleAddParticipant} disabled={!personToAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg"><Plus size={16} /></button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {people?.map(person => (
                <button key={person.id} onClick={() => toggleAttendance(person.id)} className={clsx("flex items-center justify-between p-3 rounded-xl border", meeting.absentParticipantIds?.includes(person.id) ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200')}>
                  <span className="text-sm font-medium">{person.name}</span>
                  <span className="text-[10px] font-bold uppercase">{meeting.absentParticipantIds?.includes(person.id) ? 'Frånvarande' : 'Närvarande'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Settings size={16}/> Mötesinställningar</h3>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Rubrik</label>
              <input type="text" value={meeting.title} onChange={e => db.meetings.update(meeting.id, { title: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Projekt</label>
              <select value={meeting.projectId || ''} onChange={e => db.meetings.update(meeting.id, { projectId: e.target.value || undefined, categoryId: undefined })} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm">
                <option value="">Inget projekt</option>
                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {/* TAGGAR I INSTÄLLNINGAR */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><TagIcon size={14}/> Taggar</label>
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 min-h-[50px]">
                {projectTags?.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      const currentTags = meeting.tagIds || [];
                      const newTags = currentTags.includes(tag.id) ? currentTags.filter(tid => tid !== tag.id) : [...currentTags, tag.id];
                      db.meetings.update(meeting.id, { tagIds: newTags });
                    }}
                    className={clsx(
                      "px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border",
                      meeting.tagIds?.includes(tag.id) ? "bg-blue-600 text-white border-blue-700 shadow-sm" : "bg-white text-gray-400 border-gray-200"
                    )}
                  >
                    {tag.name}
                  </button>
                ))}
                {(!projectTags || projectTags.length === 0) && <span className="text-xs text-gray-400 italic">Skapa taggar under Projekt-vyn först.</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};