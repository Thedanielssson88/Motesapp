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
import { TasksView } from './views/TasksView';
import { PeopleView } from './views/PeopleView';
import { PersonDetail } from './views/PersonDetail';
import { SettingsView } from './views/SettingsView';
import ProjectsView from './views/ProjectsView';
import ProjectDetailView from './views/ProjectDetailView';
import { QueueView } from './views/QueueView';
import { BottomNav } from './components/BottomNav';

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
            <Route path="/tasks" element={<TasksView />} />
            <Route path="/people" element={<PeopleView />} />
            <Route path="/person/:id" element={<PersonDetail />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/projects" element={<ProjectsView />} />
            <Route path="/project/:projectId" element={<ProjectDetailView />} />
            <Route path="/queue" element={<QueueView />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
