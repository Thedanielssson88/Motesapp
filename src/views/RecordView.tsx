import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { audioRecorder } from '../services/audioRecorder';
import { db, addProjectMember } from '../services/db';
import { Mic, Square, ArrowLeft, Users, StickyNote, Plus, Folder, Tag, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuickNote, MemberGroup, Person } from '../types';
import { BottomSheet } from '../components/BottomSheet';

// En ny komponent för valbara kort
const SelectionCard = ({ children, onClick, isSelected, isDisabled = false }) => (
  <motion.button
    layout
    onClick={onClick}
    disabled={isDisabled}
    className={`w-full text-left p-4 rounded-xl border transition-all ${
      isSelected 
        ? 'bg-blue-600 text-white border-blue-700 shadow-lg' 
        : 'bg-white hover:bg-gray-50 border-gray-200'
    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    whileTap={{ scale: 0.98 }}
  >
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3">
        {children}
      </div>
      {isSelected && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><CheckCircle2 size={20} /></motion.div>}
    </div>
  </motion.button>
);

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
  
  const [modal, setModal] = useState<'project' | 'person' | 'addExistingPerson' | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonRole, setNewPersonRole] = useState('');
  const [newPersonGroup, setNewPersonGroup] = useState<MemberGroup>(MemberGroup.CORE_TEAM);

  const navigate = useNavigate();

  const allPeople = useLiveQuery(() => db.people.toArray());
  const projects = useLiveQuery(() => db.projects.toArray());
  const categories = useLiveQuery(
    () => selectedProjectId ? db.categories.where('projectId').equals(selectedProjectId).toArray() : Promise.resolve([]), 
    [selectedProjectId]
  );
  const projectMembers = useLiveQuery(
    () => selectedProjectId ? db.projectMembers.where('projectId').equals(selectedProjectId).toArray() : Promise.resolve([]),
    [selectedProjectId]
  );

  const visiblePeople = selectedProjectId 
    ? allPeople?.filter(p => projectMembers?.some(pm => pm.personId === p.id))
    : allPeople;

  const peopleNotInProject = allPeople?.filter(p => !projectMembers?.some(pm => pm.personId === p.id));

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
      drawVisualizer();
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Funktion för att hantera projektval
  const handleSelectProject = (projectId: string) => {
    if (selectedProjectId === projectId) {
        // Avmarkera projekt och återställ allt
        setSelectedProjectId(undefined);
        setSelectedCategoryId(undefined);
        setSelectedSubCategory(undefined);
        setSelectedPeople([]);
    } else {
        setSelectedProjectId(projectId);
        // Nollställ tidigare val när nytt projekt väljs
        setSelectedCategoryId(undefined);
        setSelectedSubCategory(undefined);
        setSelectedPeople([]); // Återställ även valda personer
    }
  };

  // ... (alla andra funktioner som drawVisualizer, handleToggle, etc. förblir oförändrade)
  const drawVisualizer = () => { /* ... (oförändrad) ... */ };
  const handleToggle = async () => { /* ... (oförändrad) ... */ };
  const addQuickNote = () => { /* ... (oförändrad) ... */ };
  const togglePerson = (id: string) => {
    setSelectedPeople(selectedPeople.includes(id) ? selectedPeople.filter(p => p !== id) : [...selectedPeople, id]);
  };
  const handleAddProject = async () => { /* ... (oförändrad) ... */ };
  const handleAddPerson = async () => { /* ... (oförändrad) ... */ };
  const handleAddExistingPersonToProject = async (personId: string) => { /* ... (oförändrad) ... */ };
  const formatTime = (s: number) => { /* ... (oförändrad) ... */ };

  return (
    <>
      <div className="h-screen bg-gray-50 flex flex-col p-6 overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button onClick={() => navigate(-1)} className="p-2 bg-gray-100 rounded-full">
            <ArrowLeft size={20} />
          </button>
          <span className="ml-4 font-bold text-lg">Ny Inspelning</span>
        </div>

        {/* Titel */}
        <input 
          type="text" 
          placeholder="Vad handlar mötet om?"
          className="text-2xl font-bold placeholder-gray-300 border-none focus:ring-0 w-full mb-8 bg-transparent p-0"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        {/* NYA SEKTIONER */}
        <div className="space-y-6 mb-8">
          
          {/* 1. Projekt */}
          <div className="space-y-3">
            <h2 className="font-bold text-gray-700">Välj Projekt</h2>
            {projects?.map(proj => (
              <SelectionCard key={proj.id} onClick={() => handleSelectProject(proj.id)} isSelected={selectedProjectId === proj.id} isDisabled={selectedProjectId !== undefined && selectedProjectId !== proj.id}>
                <Folder className={`${selectedProjectId === proj.id ? 'text-white' : 'text-blue-500'}`} />
                <span className="font-semibold">{proj.name}</span>
              </SelectionCard>
            ))}
             <button onClick={() => setModal('project')} className="w-full flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-semibold border-2 border-dashed text-gray-500 hover:bg-gray-100 transition-colors">
                <Plus size={16} /> Nytt Projekt
            </button>
          </div>

          <AnimatePresence>
          {selectedProjectId && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* 2. Kategorier */}
              {categories && categories.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-bold text-gray-700">Välj Kategori (Valfritt)</h2>
                  {categories.map(cat => (
                      <SelectionCard key={cat.id} onClick={() => setSelectedCategoryId(cat.id === selectedCategoryId ? undefined : cat.id)} isSelected={selectedCategoryId === cat.id}>
                        <Tag className={`${selectedCategoryId === cat.id ? 'text-white' : 'text-green-500'}`} />
                        <span className="font-semibold">{cat.name}</span>
                      </SelectionCard>
                  ))}
                </div>
              )}
              
              {/* 3. Deltagare */}
              <div className="space-y-3">
                <h2 className="font-bold text-gray-700">Välj Deltagare</h2>
                <div className="grid grid-cols-2 gap-3">
                  {visiblePeople?.map(person => (
                    <SelectionCard key={person.id} onClick={() => togglePerson(person.id)} isSelected={selectedPeople.includes(person.id)}>
                        {/* Dummy avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${selectedPeople.includes(person.id) ? 'bg-white text-blue-600' : 'bg-gray-200 text-gray-600'}`}>
                            {person.name.charAt(0)}
                        </div>
                        <span className="font-semibold text-sm">{person.name}</span>
                    </SelectionCard>
                  ))}
                   <button onClick={() => setModal('addExistingPerson')} className="h-full flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-semibold border-2 border-dashed text-gray-500 hover:bg-gray-100 transition-colors">
                      <Plus size={16} /> Lägg till
                  </button>
                </div>
              </div>

            </motion.div>
          )}
          </AnimatePresence>

        </div>

        {/* Inspelnings-UI (visualizer, knappar etc) */}
        {/* ... (samma som förut) ... */}
         <div className="flex-1 flex flex-col items-center justify-center relative min-h-[200px]">
          <canvas ref={canvasRef} width={300} height={150} className="w-full h-40" />
          <div className="text-6xl font-mono font-medium text-gray-800 mt-8 tracking-tighter">{formatTime(duration)}</div>
        </div>

        {/* Anteckningar */}
        {quickNotes.length > 0 && (
          <div className="mb-6 max-h-32 overflow-y-auto">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Anteckningar</h4>
            {quickNotes.map((note, idx) => (
              <div key={idx} className="text-sm text-gray-600 mb-1">
                <span className="font-mono text-xs text-blue-500 mr-2">{formatTime(note.timestamp)}</span>{note.text}
              </div>
            ))}
          </div>
        )}

        {showNoteInput && (
          <div className="mb-4 flex gap-2">
            <input 
              type="text" 
              autoFocus 
              placeholder="Skriv anteckning..." 
              className="flex-1 bg-gray-50 border-gray-200 rounded-lg text-sm p-3" 
              value={currentNote} 
              onChange={e => setCurrentNote(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && addQuickNote()} 
            />
            <button onClick={addQuickNote} className="p-3 bg-blue-600 text-white rounded-lg">
              <Plus size={18} />
            </button>
          </div>
        )}

        {/* Inspelningsknappar */}
        <div className="flex justify-center items-center gap-6 pb-8">
          {isRecording && (
            <button onClick={() => setShowNoteInput(!showNoteInput)} className="p-4 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200">
              <StickyNote size={24} />
            </button>
          )}
          <motion.button 
            whileTap={{ scale: 0.9 }} 
            onClick={handleToggle} 
            className={`h-20 w-20 rounded-full flex items-center justify-center shadow-xl ${isRecording ? 'bg-red-500' : 'bg-blue-600'}`}
          >
            {isRecording ? <Square fill="white" className="text-white" /> : <Mic fill="white" className="text-white" />}
          </motion.button>
          {isRecording && <div className="w-14" />} 
        </div>
      </div>

      {/* Modals / Bottom Sheets (oförändrade) */}
      {/* ... */}
    </>
  );
};
