import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Link } from 'react-router-dom';
import { User, Plus } from 'lucide-react';

export const PeopleView = () => {
  const people = useLiveQuery(() => db.people.toArray());

  return (
    <div className="min-h-screen bg-white p-6 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Personer</h1>
        <Link to="/settings" className="p-2 bg-gray-100 rounded-full">
          <Plus size={20} />
        </Link>
      </div>
      <div className="space-y-3">
        {people?.map(person => (
          <Link to={`/person/${person.id}`} key={person.id} className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className={`w-12 h-12 rounded-full ${person.avatarColor || 'bg-gray-200'} flex items-center justify-center text-xl font-bold`}>
              {person.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{person.name}</h3>
              <p className="text-sm text-gray-500">{person.role}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
