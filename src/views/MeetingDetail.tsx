import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { addToQueue } from '../services/queueService';
import { useState, useRef, useEffect } from 'react';
import { Play, Loader2, RefreshCw, Users, Edit2, Check, ArrowLeft, Plus, Settings, Copy, Mail, FileText, Bold, Italic, Strikethrough, Save, Tag as TagIcon, X as CloseIcon } from 'lucide-react';
import { clsx } from 'clsx';

export const MeetingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const meeting = useLiveQuery(() => db.meetings.get(id!), [id]);
  const tasks = useLiveQuery(() => db.tasks.where('linkedMeetingId').equals(id!).toArray(), [id]);
  const audioFile = useLiveQuery(() => db.audioFiles.get(id!), [id]);

  // Hämta det senaste aktuella jobbet för detta möte från databasen
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

  // AUTO-START ANALYS OM ALDRIG KÖRT
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
    const hasText = !!(meeting.transcription && meeting.transcription.length > 0);

    if (hasAudio || hasText) {
      hasAutoStartedRef.current = true;
      addToQueue(meeting.id, hasAudio ? 'audio' : 'text');
    }
  }, [meeting, audioFile, isJobActive]);

  const handleStartAnalysisManual = () => {
    if (!meeting) return;
    addToQueue(meeting.id, audioFile ? 'audio' : 'text');
  };

  const handleSaveProtocol = async () => {
    if (!meeting || !editorRef.current) return;
    await db.meetings.update(meeting.id, { "protocol.detailedProtocol": editorRef.current.innerHTML });
    setIsEditingProtocol(false);
  };

  const playFromTime = async (timeInSeconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = timeInSeconds;
      try { await audioRef.current.play(); } catch (e) { alert("Webbläsaren blockerade uppspelningen."); }
    }
  };

  const execCommand = (command: string) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
  };

  const stripHtml = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent || "";
  const handleCopyProtocol = () => { if (meeting?.protocol?.detailedProtocol) { navigator.clipboard.writeText(stripHtml(meeting.protocol.detailedProtocol)); setCopied(true); setTimeout(() => setCopied(false), 2000); } };
  const handleEmailProtocol = () => { if (meeting?.protocol?.detailedProtocol) window.location.href = `mailto:?subject=${encodeURIComponent(meeting.title)}&body=${encodeURIComponent(stripHtml(meeting.protocol.detailedProtocol))}` };

  if (!meeting) return <div className="p-6 text-center text-gray-500">Laddar möte...</div>;

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

        {/* PROGRESS BAR */}
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
           <button onClick={handleStartAnalysisManual} className="w-full text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md hover:shadow-lg">
             <Play size={18} fill="currentColor" /> Skapa protokoll (Lägg i kö)
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
              <h3 className="text-xs font-bold text-blue-600 uppercase mb-3 flex items-center gap-2"><Check size={14} /> Sammanfattning</h3>
              <p className="text-gray-800 font-medium leading-relaxed">{meeting.protocol?.summary}</p>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-gray-200 relative flex flex-col">
              <div className={clsx("p-2 border-b border-gray-100 flex items-center justify-between transition-all", isEditingProtocol ? "bg-gray-50 h-12" : "h-0 opacity-0 overflow-hidden")}>
                <div className="flex gap-1">
                  <button onClick={() => execCommand('bold')} className="p-2 hover:bg-gray-200 rounded"><Bold size={18} /></button>
                  <button onClick={() => execCommand('italic')} className="p-2 hover:bg-gray-200 rounded"><Italic size={18} /></button>
                  <button onClick={() => execCommand('insertUnorderedList')} className="p-2 hover:bg-gray-200 rounded text-xs font-bold">LISTA</button>
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
                  </div>
                )}
                
                <div 
                  ref={editorRef}
                  contentEditable={isEditingProtocol}
                  suppressContentEditableWarning={true}
                  className={clsx("font-sans outline-none min-h-[200px] [&>h3]:text-lg [&>h3]:font-bold [&>h3]:mt-6 [&>ul]:list-disc [&>ul]:pl-5", isEditingProtocol && "ring-2 ring-blue-100 p-4 border-dashed border-2 bg-gray-50")}
                  dangerouslySetInnerHTML={{ __html: meeting.protocol?.detailedProtocol || '' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
