import { VoiceRecorder } from 'capacitor-voice-recorder';
import { Capacitor } from '@capacitor/core';

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    // 1. KONTROLLERA PLATTFORM: Kör bara plugin-behörigheten på Android/iOS
    if (Capacitor.isNativePlatform()) {
      const hasPermission = await VoiceRecorder.hasAudioRecordingPermission();
      if (!hasPermission.value) {
        const permission = await VoiceRecorder.requestAudioRecordingPermission();
        if (!permission.value) {
          throw new Error("Du måste tillåta mikrofonen i inställningarna för att kunna spela in.");
        }
      }
    }

    // 2. Webben (och mobilen) startar sedan inspelningen via standard-webb-API:t
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(100); 
    
    // 3. Sätt upp Visualizer (Animationen)
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 64;
    source.connect(this.analyser);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(new Blob());
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.cleanup();
        resolve(audioBlob);
      };
      
      this.mediaRecorder.stop();
    });
  }

  getVisualizerData(): Uint8Array {
    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);
      return this.dataArray;
    }
    return new Uint8Array(50).fill(0); // Säkerhets-fallback
  }

  private cleanup() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
  }
}

export const audioRecorder = new AudioRecorder();