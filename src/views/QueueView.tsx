import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Loader2, CheckCircle2, AlertTriangle, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const QueueView = () => {
  const navigate = useNavigate();
  const jobs = useLiveQuery(() => db.processingJobs.orderBy('createdAt').reverse().toArray());

  const clearCompleted = async () => {
    if (!jobs) return;
    const completedIds = jobs.filter(j => j.status === 'completed' || j.status === 'error').map(j => j.id);
    await db.processingJobs.bulkDelete(completedIds);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-24">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow-sm"><ArrowLeft size={20}/></button>
          <h1 className="font-bold text-2xl">Aktivitet</h1>
        </div>
        <button onClick={clearCompleted} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
          <Trash2 size={14} /> Rensa
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
              {job.status === 'processing' && <Loader2 className="animate-spin text-blue-500" size={20} />}
              {job.status === 'pending' && <Loader2 className="text-gray-300" size={20} />}
              {job.status === 'completed' && <CheckCircle2 className="text-green-500" size={20} />}
              {job.status === 'error' && <AlertTriangle className="text-red-500" size={20} />}
            </div>

            {(job.status === 'processing' || job.status === 'pending') && (
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${job.progress}%` }}></div>
              </div>
            )}
            
            {job.error && <p className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded-lg">{job.error}</p>}
          </div>
        ))}
        {jobs?.length === 0 && <p className="text-center text-gray-400 py-10 italic">Inga aktiva jobb just nu.</p>}
      </div>
    </div>
  );
};
