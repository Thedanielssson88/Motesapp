import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';

export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private stream: MediaStream | null = null;
  
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
      this.dataArray = new Uint8Array(256); 
      console.log("Native inspelning startad!");

    } else {
      // --- WEBB / WINDOWS / ANDROID CHROME ---
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webbläsaren stödjer inte ljudinspelning. Kräver HTTPS.");
      }

      // FIX 1: Skapa och väck AudioContext DIREKT, innan någon 'await' sker.
      // Om vi väntar på mikrofonen först, "glömmer" webbläsaren bort att användaren
      // faktiskt klickade på knappen, och blockerar ljudet för att förhindra spam.
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      // FIX 2: Enkel ljudbegäran. Vissa mobiler mutar mikrofonen om man ber om för 
      // avancerad brusreducering (echoCancellation etc) via webben.
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true 
      });

      this.audioChunks = [];

      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.audioChunks.push(event.data);
      };

      // Koppla strömmen till vår visualisering
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      // FIX 3: Sätt en timeslice på 1000ms (1 sekund) för att tvinga webbläsaren
      // att kontinuerligt skriva ner datan i minnet, annars kan Android ibland 
      // generera en fil som är 0 bytes stor i slutet.
      this.mediaRecorder.start(1000);
      console.log("Webb-inspelning startad med format:", this.mediaRecorder.mimeType);
    }
  }

  async stop(): Promise<Blob> {
    if (this.isNative) {
       // --- STOPPA NATIVE ---
       const result = await VoiceRecorder.stopRecording();
       if (result.value && result.value.recordDataBase64) {
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
          const finalMimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: finalMimeType });
          
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
       // Fejkade vågor för APK:n så det syns att den rullar
       if (this.dataArray) {
           for(let i=0; i < this.dataArray.length; i++) {
               this.dataArray[i] = Math.random() > 0.3 ? Math.floor(Math.random() * 80) : 0;
           }
           return this.dataArray;
       }
       return new Uint8Array(0);
    } else {
        if (this.analyser && this.dataArray) {
          this.analyser.getByteFrequencyData(this.dataArray);
          return this.dataArray;
        }
        return new Uint8Array(0);
    }
  }
}

export const audioRecorder = new AudioRecorderService();