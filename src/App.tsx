/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { seedDatabase } from './services/db';
import { processQueue } from './services/queueService';
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

// En osynlig komponent som kopplar telefonens bakåt-swipe till Reacts router
const HardwareBackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let listenerHandle: any = null;

    const setupBackButton = async () => {
      // VIKTIGT: Kolla så vi faktiskt är i Android/iOS och inte i en webbläsare
      if (Capacitor.isNativePlatform()) {
        try {
          listenerHandle = await CapacitorApp.addListener('backButton', () => {
            if (location.pathname === '/') {
              CapacitorApp.exitApp();
            } else {
              navigate(-1);
            }
          });
        } catch (error) {
          console.warn('Kunde inte registrera bakåt-knappen:', error);
        }
      }
    };

    setupBackButton();

    return () => {
      if (listenerHandle && listenerHandle.remove) {
        listenerHandle.remove();
      }
    };
  }, [location.pathname, navigate]);

  return null;
};

function App() {
  useEffect(() => { 
    seedDatabase(); 
    processQueue(); 
  }, []);

  return (
    <BrowserRouter>
      <HardwareBackButtonHandler /> 
      
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