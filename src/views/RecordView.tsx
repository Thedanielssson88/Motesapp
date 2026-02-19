import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { audioRecorder } from '../services/audioRecorder';
import { db } from '../services/db';
import { Mic, Square, ArrowLeft, Users, StickyNote, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { QuickNote, Project, CategoryData } from '../types';
import { BottomSheet } from '../components/BottomSheet';

export const RecordView = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | undefined>();
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [quickNotes, setQuickNotes] = useState<QuickNote[]>([]);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [currentNote, setCurrentNote] = useState('');
  const [modal, setModal] = useState<'project' | 'person' | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonRole, setNewPersonRole] = useState('');

  const navigate = useNavigate();
  const people = useLiveQuery(() => db.people.toArray());
  const projects = useLiveQuery(() => db.projects.toArray());
  const categories = useLiveQuery(() => selectedProjectId ? db.categories.where('projectId').equals(selectedProjectId).toArray() : Promise.resolve([]), [selectedProjectId]);

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
      drawVisualizer();
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const animate = () => {
      if (!isRecording) return;
      requestAnimationFrame(animate);
      const data = audioRecorder.getVisualizerData();
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / data.length) * 2;
      let x = 0;
      for(let i = 0; i < data.length; i++) {
        const barHeight = (data[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(59, 130, 246, ${data[i]/255 + 0.2})`;
        ctx.beginPath();
        // @ts-ignore
        ctx.roundRect(x, (canvas.height - barHeight) / 2, barWidth - 2, barHeight, 5);
        ctx.fill();
        x += barWidth;
      }
    };
    animate();
  };

  const handleToggle = async () => {
    if (!isRecording) {
      await audioRecorder.start();
      setIsRecording(true);
    } else {
      const blob = await audioRecorder.stop();
      setIsRecording(false);
      const id = crypto.randomUUID();
      await db.transaction('rw', db.meetings, db.audioFiles, async () => {
        await db.meetings.add({
          id,
          title: title || `Möte ${new Date().toLocaleDateString()}`,
          date: new Date().toISOString(),
          duration,
          projectId: selectedProjectId,
          categoryId: selectedCategoryId,
          subCategoryName: selectedSubCategory,
          participantIds: selectedPeople,
          isProcessed: false,
          quickNotes
        });
        await db.audioFiles.add({ id, blob, mimeType: blob.type });
      });
      navigate(`/meeting/${id}`);
    }
  };

  const addQuickNote = () => {
    if (!currentNote.trim()) return;
    setQuickNotes([...quickNotes, { timestamp: duration, text: currentNote }]);
    setCurrentNote('');
    setShowNoteInput(false);
  };

  const togglePerson = (id: string) => {
    setSelectedPeople(selectedPeople.includes(id) ? selectedPeople.filter(p => p !== id) : [...selectedPeople, id]);
  };

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return;
    const newId = crypto.randomUUID();
    await db.projects.add({ id: newId, name: newProjectName });
    setSelectedProjectId(newId);
    setNewProjectName('');
    setModal(null);
  };

  const handleAddPerson = async () => {
    if (!newPersonName.trim()) return;
    const newId = crypto.randomUUID();
    await db.people.add({ id: newId, name: newPersonName, role: newPersonRole || 'Deltagare', projectIds: [], region: 'Okänd' });
    togglePerson(newId);
    setNewPersonName('');
    setNewPersonRole('');
    setModal(null);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <div className="h-screen bg-white flex flex-col p-6 overflow-y-auto no-scrollbar">
        <div className="flex items-center mb-6">
          <button onClick={() => navigate(-1)} className="p-2 bg-gray-100 rounded-full"><ArrowLeft size={20} /></button>
          <span className="ml-4 font-bold text-lg">Ny Inspelning</span>
        </div>

        <input 
          type="text" 
          placeholder="Vad handlar mötet om?"
          className="text-2xl font-bold placeholder-gray-300 border-none focus:ring-0 w-full mb-6 bg-transparent p-0"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <div className="space-y-4 mb-8">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {projects?.map(proj => (
              <button key={proj.id} onClick={() => setSelectedProjectId(proj.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedProjectId === proj.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{proj.name}</button>
            ))}
            <button onClick={() => setModal('project')} className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-gray-200 text-gray-700 hover:bg-gray-300 flex items-center gap-1"><Plus size={12} /> Nytt</button>
          </div>

          {selectedProjectId && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {categories?.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedCategoryId === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{cat.name}</button>
              ))}
            </div>
          )}

          {selectedCategoryId && categories?.find(c => c.id === selectedCategoryId)?.subCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {categories?.find(c => c.id === selectedCategoryId)?.subCategories.map(subCat => (
                <button key={subCat} onClick={() => setSelectedSubCategory(subCat)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedSubCategory === subCat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{subCat}</button>
              ))}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2"><Users size={14} /><span>Deltagare</span></div>
            <div className="flex flex-wrap gap-2">
              {projectMembers?.filter(pm => pm.projectId === selectedProjectId).map(pm => {
                const person = people?.find(p => p.id === pm.personId);
                return person ? (
                  <button key={person.id} onClick={() => togglePerson(person.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedPeople.includes(person.id) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>{person.name}</button>
                ) : null;
              })}
              <button onClick={() => setModal('person')} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed text-gray-500 hover:bg-gray-50 flex items-center gap-1"><Plus size={12} /> Ny Person</button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative min-h-[200px]">
          <canvas ref={canvasRef} width={300} height={150} className="w-full h-40" />
          <div className="text-6xl font-mono font-medium text-gray-800 mt-8 tracking-tighter">{formatTime(duration)}</div>
        </div>

        {quickNotes.length > 0 && (
          <div className="mb-6 max-h-32 overflow-y-auto">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Anteckningar</h4>
            {quickNotes.map((note, idx) => (
              <div key={idx} className="text-sm text-gray-600 mb-1"><span className="font-mono text-xs text-blue-500 mr-2">{formatTime(note.timestamp)}</span>{note.text}</div>
            ))}
          </div>
        )}

        {showNoteInput && (
          <div className="mb-4 flex gap-2">
            <input type="text" autoFocus placeholder="Skriv anteckning..." className="flex-1 bg-gray-50 border-gray-200 rounded-lg text-sm" value={currentNote} onChange={e => setCurrentNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addQuickNote()} />
            <button onClick={addQuickNote} className="p-2 bg-blue-600 text-white rounded-lg"><Plus size={18} /></button>
          </div>
        )}

        <div className="flex justify-center items-center gap-6 pb-8">
          {isRecording && (
            <button onClick={() => setShowNoteInput(!showNoteInput)} className="p-4 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200"><StickyNote size={24} /></button>
          )}
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleToggle} className={`h-20 w-20 rounded-full flex items-center justify-center shadow-xl ${isRecording ? 'bg-red-500' : 'bg-blue-600'}`}>
            {isRecording ? <Square fill="white" className="text-white" /> : <Mic fill="white" className="text-white" />}
          </motion.button>
          {isRecording && <div className="w-14" />} 
        </div>
      </div>

      <BottomSheet isOpen={modal === 'project'} onClose={() => setModal(null)} title="Skapa Nytt Projekt">
        <div className="flex flex-col gap-4">
          <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Projektnamn..." className="w-full bg-gray-100 border-gray-300 rounded-lg" />
          <button onClick={handleAddProject} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Spara Projekt</button>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={modal === 'person'} onClose={() => setModal(null)} title="Lägg till Ny Person">
        <div className="flex flex-col gap-4">
          <input type="text" value={newPersonName} onChange={e => setNewPersonName(e.target.value)} placeholder="Namn..." className="w-full bg-gray-100 border-gray-300 rounded-lg" />
          <input type="text" value={newPersonRole} onChange={e => setNewPersonRole(e.target.value)} placeholder="Roll (valfritt)..." className="w-full bg-gray-100 border-gray-300 rounded-lg" />
          <button onClick={handleAddPerson} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Spara Person</button>
        </div>
      </BottomSheet>
    </>
  );
};
