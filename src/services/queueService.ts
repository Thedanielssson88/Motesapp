import { db } from './db';
import { processMeetingAI, reprocessMeetingFromText } from './geminiService';
import { BackgroundTask } from '@capacitor/background-task';
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
  
  processQueue(); // Trigga processen direkt
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

    // Blixtviktigt för mobila enheter: Be OS att inte döda tråden!
    let taskId: any;
    if (Capacitor.isNativePlatform()) {
      taskId = await BackgroundTask.beforeExit(async () => {
        // Appen stängdes eller lades i bakgrunden, men systemet tillåter att detta löper klart
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
      // Sätt till false så vi kan försöka igen via UI
      await db.meetings.update(job.meetingId, { isProcessed: false });
    } finally {
      if (Capacitor.isNativePlatform() && taskId) {
         BackgroundTask.finish({ taskId }); // Vi är klara, släpp låset.
      }
    }
  } finally {
    isProcessingQueue = false;
    
    // Processa nästa i kön
    const moreJobs = await db.processingJobs.where('status').equals('pending').count();
    if (moreJobs > 0) {
      setTimeout(processQueue, 2000);
    }
  }
};
