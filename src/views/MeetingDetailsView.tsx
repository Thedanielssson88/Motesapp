import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { processMeetingAI, reprocessMeetingFromText, hasApiKey } from '../services/geminiService';
import { ArrowLeft, Edit, Save, Trash, Bot, AlertTriangle, Settings } from 'lucide-react';

export const MeetingDetailsView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  // KORRIGERING: Starta som `false`. Knappen är inaktiv tills vi har bekräftat att nyckeln finns.
  const [apiKeyExists, setApiKeyExists] = useState<boolean>(false); 

  const meeting = useLiveQuery(() => db.meetings.get(id!), [id]);
  const participants = useLiveQuery(() => 
    meeting ? db.people.where('id').anyOf(meeting.participantIds).toArray() : [],
    [meeting]
  );
  const tasks = useLiveQuery(() => 
    id ? db.tasks.where({ linkedMeetingId: id }).toArray() : [], 
    [id]
  );

  // Denna effekt körs när komponenten laddas och verifierar API-nyckeln.
  // Först när `hasApiKey()` returnerar true kommer `apiKeyExists` att sättas till true.
  useEffect(() => {
    const checkApiKey = async () => {
      const exists = await hasApiKey();
      setApiKeyExists(exists);
    };
    checkApiKey();
  }, []); // Körs en gång när komponenten monteras

  useEffect(() => {
    if (meeting) {
      setEditedTitle(meeting.title);
    }
  }, [meeting]);

  const handleSave = async () => {
    if (!id) return;
    await db.meetings.update(id, { title: editedTitle });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Är du säker på att du vill radera detta möte och tillhörande ljudfil?')) return;
    await db.meetings.delete(id);
    await db.audioFiles.delete(id);
    navigate('/');
  };

  const handleProcessAI = async () => {
    if (!id || !apiKeyExists) return; // Dubbelkoll för säkerhets skull
    setIsProcessing(true);
    setProcessingError(null);
    try {
      await processMeetingAI(id);
    } catch (error: any) {
      console.error("Fel vid analys:", error);
      setProcessingError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReprocess = async () => {
    if (!id || !apiKeyExists) return;
    setIsProcessing(true);
    setProcessingError(null);
    try {
      await reprocessMeetingFromText(id);
    } catch (error: any) {
      console.error("Fel vid ombearbetning:", error);
      setProcessingError(error.message);
    } finally {
      setIsProcessing(false);
    }
  }

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!meeting) return <div>Laddar mötesinformation...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-24">
      <div className="flex items-center mb-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-gray-100 rounded-full mr-4">
          <ArrowLeft size={20} />
        </button>
        {isEditing ? (
          <input 
            type="text" 
            value={editedTitle} 
            onChange={(e) => setEditedTitle(e.target.value)} 
            className="text-2xl font-bold bg-transparent border-b-2 border-blue-500 flex-grow"
            autoFocus
          />
        ) : (
          <h1 className="text-2xl font-bold flex-grow">{meeting.title}</h1>
        )}
        {isEditing ? (
          <button onClick={handleSave} className="p-2 bg-blue-500 text-white rounded-full ml-2">
            <Save size={20} />
          </button>
        ) : (
          <button onClick={() => setIsEditing(true)} className="p-2 bg-gray-100 rounded-full ml-2">
            <Edit size={20} />
          </button>
        )}
      </div>
      
      <div className="text-sm text-gray-500 mb-6 ml-16">
          {new Date(meeting.date).toLocaleString('sv-SE', { dateStyle: 'long', timeStyle: 'short' })} &bull; Varaktighet: {formatTime(meeting.duration)}
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold flex items-center gap-2"><Bot size={20} className="text-blue-500"/> AI-Analys</h2>
            {!meeting.isProcessed && (
                <button onClick={handleProcessAI} disabled={isProcessing || !apiKeyExists} className="btn btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {isProcessing ? 'Analyserar...' : 'Analysera mötet'}
                </button>
            )}
        </div>

        {!apiKeyExists && !isProcessing && (
            <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg flex items-center gap-3 text-sm">
                <AlertTriangle size={20} />
                <span>API-nyckel för Gemini saknas. Gå till <Link to="/settings" className="font-bold underline">Inställningar</Link> för att lägga till en.</span>
            </div>
        )}

        {processingError && <div className="text-red-500 mt-2 text-sm">Fel: {processingError}</div>}

        {meeting.isProcessed ? (
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="font-bold">Sammanfattning</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{meeting.protocol?.summary}</p>
            </div>
            {meeting.protocol?.decisions && meeting.protocol.decisions.length > 0 && (
              <div>
                <h3 className="font-bold">Beslut</h3>
                <ul className="list-disc list-inside text-gray-600">
                  {meeting.protocol.decisions.map((decision, i) => <li key={i}>{decision}</li>)}
                </ul>
              </div>
            )}
            {tasks && tasks.length > 0 && (
                <div>
                    <h3 className="font-bold">Uppgifter</h3>
                    {/* Uppgiftslista här */}
                </div>
            )}
            <button onClick={handleReprocess} disabled={isProcessing || !apiKeyExists} className="btn btn-secondary btn-sm mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
              {isProcessing ? 'Bearbetar igen...' : 'Bearbeta texten igen'}
            </button>
          </div>
        ) : (
           !apiKeyExists ? null : <p className="text-sm text-gray-500 mt-3">Tryck på knappen för att transkribera, sammanfatta och identifiera uppgifter från ljudinspelningen.</p>
        )}
      </div>

      {/* Andra flikar... */}
    </div>
  );
};
