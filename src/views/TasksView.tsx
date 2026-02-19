import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useState } from 'react';
import { CheckCircle2, Circle, Filter } from 'lucide-react';
import { TaskStatus } from '../types';

export const TasksView = () => {
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const tasks = useLiveQuery(() => {
    if (filter === 'all') return db.tasks.toArray();
    return db.tasks.where('status').equals(filter).toArray();
  }, [filter]);

  const toggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    await db.tasks.update(taskId, { status: newStatus });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-24">
      <h1 className="text-2xl font-bold mb-6">Uppgifter</h1>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        {[
          { id: 'all', label: 'Alla' },
          { id: 'todo', label: 'Att göra' },
          { id: 'done', label: 'Klara' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === tab.id 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tasks?.map(task => (
          <div 
            key={task.id}
            onClick={() => toggleTask(task.id, task.status)}
            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-start gap-3 cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${task.status === 'done' ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
              {task.status === 'done' && <CheckCircle2 size={12} className="text-white" />}
            </div>
            <div>
              <p className={`font-medium ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {task.title}
              </p>
              <div className="flex gap-2 mt-2">
                {task.assignedToId && (
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    Tilldelad
                  </span>
                )}
                {task.deadline && (
                  <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-medium">
                    {task.deadline}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {tasks?.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">Inga uppgifter här 🎉</p>
          </div>
        )}
      </div>
    </div>
  );
};
