/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { seedDatabase } from './services/db';
import { Dashboard } from './views/Dashboard';
import { RecordView } from './views/RecordView';
import { MeetingDetail } from './views/MeetingDetail';
import { BottomNav } from './components/BottomNav';

const Tasks = () => <div className="p-6">Här kommer Tasks-vyn (Koppla till db.tasks)</div>;
const People = () => <div className="p-6">Här kommer CRM-vyn (Koppla till db.people)</div>;
const Settings = () => <div className="p-6">Inställningar (API Key Input här)</div>;

function App() {
  useEffect(() => { 
    seedDatabase(); 
  }, []);

  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto bg-white min-h-screen relative shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/record" element={<RecordView />} />
            <Route path="/meeting/:id" element={<MeetingDetail />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/people" element={<People />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
