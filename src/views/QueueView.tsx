import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Loader2, CheckCircle2, AlertTriangle, Trash2, ArrowLeft, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const QueueView = () => {
  const navigate = useNavigate();
  const jobs = useLiveQuery(() => db.processingJobs.orderBy('createdAt').reverse().toArray());

  const clearCompleted = async () => {
    if (!jobs) return;
    const completedIds = jobs.filter(j => j.status === 'completed' || j.status === 'error').map(j => j.id);
    await db.processingJobs.bulkDelete(completedIds);
  };

  const cancelJob = async (jobId: string, meetingId: string) => {
    if (window.confirm("Vill du avbryta denna pågående analys?")) {
      await db.processingJobs.delete(jobId);
      // Återställ mötet så att knappen "Starta analys" dyker upp igen i mötesvyn
      await db.meetings.update(meetingId, { isProcessed: false });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-24">
      <div className="flex items-center justify-between mb-8 pt-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow-sm border border-gray-100"><ArrowLeft size={20}/></button>
          <h1 className="font-bold text-2xl text-gray-900">Aktivitet</h1>
        </div>
        <button onClick={clearCompleted} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-red-100 transition-colors">
          <Trash2 size={14} /> Rensa klara
        </button>
      </div>

      <div className="space-y-4">
        {jobs?.map(job => (
          <div key={job.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  {job.type === 'audio' ? 'Ljudanalys' : 'Textanalys'}
                </span>
                <p className="font-bold text-gray-800 text-sm mt-1">{job.message}</p>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Avbryt-knapp om jobbet pågår eller väntar */}
                {(job.status === 'processing' || job.status === 'pending') && (
                  <button 
                    onClick={() => cancelJob(job.id, job.meetingId)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Avbryt analys"
                  >
                    <XCircle size={20} />
                  </button>
                )}
                {job.status === 'processing' && <Loader2 className="animate-spin text-blue-500" size={20} />}
                {job.status === 'pending' && <Loader2 className="text-gray-300" size={20} />}
                {job.status === 'completed' && <CheckCircle2 className="text-green-500" size={20} />}
                {job.status === 'error' && <AlertTriangle className="text-red-500" size={20} />}
              </div>
            </div>

            {(job.status === 'processing' || job.status === 'pending') && (
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${job.progress}%` }}></div>
              </div>
            )}
            
            {job.error && <p className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded-lg border border-red-100">{job.error}</p>}
          </div>
        ))}
        
        {(!jobs || jobs.length === 0) && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="text-gray-400" size={24} />
            </div>
            <p className="text-gray-500 font-medium">Allt är klart och uppdaterat.</p>
            <p className="text-xs text-gray-400 mt-1">Inga pågående analyser just nu.</p>
          </div>
        )}
      </div>
    </div>
  );
};