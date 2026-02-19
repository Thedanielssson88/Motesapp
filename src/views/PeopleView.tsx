import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Link } from 'react-router-dom';
import { User, ChevronRight, Briefcase, MapPin } from 'lucide-react';

export const PeopleView = () => {
  const people = useLiveQuery(() => db.people.toArray());

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-24">
      <h1 className="text-2xl font-bold mb-6">Personer</h1>

      <div className="grid gap-4">
        {people?.map(person => (
          <Link 
            to={`/person/${person.id}`} 
            key={person.id}
            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 active:scale-[0.98] transition-transform"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${person.avatarColor || 'bg-gray-100 text-gray-600'}`}>
              {person.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">{person.name}</h3>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                <span className="flex items-center gap-1"><Briefcase size={12} /> {person.role}</span>
                <span className="flex items-center gap-1"><MapPin size={12} /> {person.region}</span>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-300" />
          </Link>
        ))}
      </div>
    </div>
  );
};
