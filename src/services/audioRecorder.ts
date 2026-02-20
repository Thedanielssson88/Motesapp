import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';

export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private stream: MediaStream | null = null;
  
  // Kollar om vi är i en riktig app (APK/iOS) eller i webbläsaren
  private isNative = Capacitor.isNativePlatform();

  async start(): Promise<void> {
    if (this.isNative) {
      // --- NATIVE ANDROID / IOS ---
      const hasPermission = await VoiceRecorder.hasAudioRecordingPermission();
      if (!hasPermission.value) {
        const request = await VoiceRecorder.requestAudioRecordingPermission();
        if (!request.value) {
          throw new Error("Mikrofon-behörighet nekades av telefonen.");
        }
      }
      
      await VoiceRecorder.startRecording();
      
      // Sätter upp en array för att fejka ljudvågor i UI:t under native-inspelning
      this.dataArray = new Uint8Array(256); 
      console.log("Native inspelning startad!");

    } else {
      // --- WEBB / WINDOWS ---
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webbläsaren stödjer inte ljudinspelning. Kräver HTTPS.");
      }

      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });

      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.audioChunks.push(event.data);
      };

      this.audioContext = new AudioContext();
      
      // FIX FÖR ANDROID-WEBBEN: Väcker ljud-ritaren om den sover!
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      this.mediaRecorder.start(100);
      console.log("Webb-inspelning startad!");
    }
  }

  async stop(): Promise<Blob> {
    if (this.isNative) {
       // --- STOPPA NATIVE ---
       const result = await VoiceRecorder.stopRecording();
       if (result.value && result.value.recordDataBase64) {
          // Gör om native Base64-ljudet till en Blob som databasen förstår
          const res = await fetch(`data:${result.value.mimeType};base64,${result.value.recordDataBase64}`);
          return await res.blob();
       }
       throw new Error("Kunde inte spara app-inspelningen.");
    } else {
      // --- STOPPA WEBB ---
      return new Promise((resolve, reject) => {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
          return reject(new Error("Ingen inspelning pågår."));
        }

        this.mediaRecorder.onstop = () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          
          if (this.stream) this.stream.getTracks().forEach(track => track.stop());
          if (this.audioContext && this.audioContext.state !== 'closed') this.audioContext.close();
          
          resolve(audioBlob);
        };

        this.mediaRecorder.stop();
      });
    }
  }

  getVisualizerData(): Uint8Array {
    if (this.isNative) {
       // Native pluginet ger oss inte ljudvågorna i realtid. 
       // Vi fejkar lite data här så att grafen rör sig och det syns att den spelar in!
       if (this.dataArray) {
           for(let i=0; i < this.dataArray.length; i++) {
               this.dataArray[i] = Math.random() > 0.3 ? Math.floor(Math.random() * 80) : 0;
           }
           return this.dataArray;
       }
       return new Uint8Array(0);
    } else {
       // På webben hämtar vi de äkta ljudvågorna från mikrofonen
        if (this.analyser && this.dataArray) {
          this.analyser.getByteFrequencyData(this.dataArray);
          return this.dataArray;
        }
        return new Uint8Array(0);
    }
  }
}

export const audioRecorder = new AudioRecorderService();