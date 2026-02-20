import { db } from './db';
import { processMeetingAI, reprocessMeetingFromText } from './geminiService';
import { BackgroundTask } from '@capawesome/capacitor-background-task'; // UPPDATERAD IMPORT
import { Capacitor } from '@capacitor/core';

let isProcessingQueue = false;

export const addToQueue = async (meetingId: string, type: 'audio' | 'text') => {
  await db.processingJobs.add({
    id: crypto.randomUUID(),
    meetingId,
    type,
    status: 'pending',
    progress: 0,
    message: 'Ligger i kön...',
    createdAt: new Date().toISOString()
  });
  
  processQueue(); 
};

export const processQueue = async () => {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    const pendingJobs = await db.processingJobs.where('status').equals('pending').sortBy('createdAt');
    if (pendingJobs.length === 0) return;

    const job = pendingJobs[0];
    
    await db.processingJobs.update(job.id, { 
      status: 'processing', 
      message: 'Förbereder analys...', 
      startedAt: new Date().toISOString() 
    });

    let taskId: any;
    if (Capacitor.isNativePlatform()) {
      // UPPDATERAD: Här startar vi uppgiften med det nya pluginet
      taskId = await BackgroundTask.beforeExit(async () => {
        // Appen stängdes eller lades i bakgrunden.
        // Processen får nu löpa på (viktigt för iOS och Android)
      });
    }

    try {
      const onProgress = (progress: number, msg: string) => {
        db.processingJobs.update(job.id, { progress, message: msg });
      };

      if (job.type === 'audio') {
         await processMeetingAI(job.meetingId, onProgress);
      } else {
         await reprocessMeetingFromText(job.meetingId, onProgress);
      }
      
      await db.processingJobs.update(job.id, { 
        status: 'completed', 
        progress: 100, 
        message: 'Klar!', 
        completedAt: new Date().toISOString() 
      });

    } catch (error: any) {
      await db.processingJobs.update(job.id, { 
        status: 'error', 
        error: error.message || 'Okänt fel inträffade' 
      });
      await db.meetings.update(job.meetingId, { isProcessed: false });
    } finally {
      if (Capacitor.isNativePlatform() && taskId) {
         // UPPDATERAD: Säger till systemet att uppgiften är klar och det är okej att sova.
         BackgroundTask.finish({ taskId });
      }
    }
  } finally {
    isProcessingQueue = false;
    
    const moreJobs = await db.processingJobs.where('status').equals('pending').count();
    if (moreJobs > 0) {
      setTimeout(processQueue, 2000);
    }
  }
};