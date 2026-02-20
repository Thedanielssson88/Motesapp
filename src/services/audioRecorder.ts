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
      const hasPermission = await VoiceRecorder.hasAudioRecordingPermission();
      if (!hasPermission.value) {
        const request = await VoiceRecorder.requestAudioRecordingPermission();
        if (!request.value) {
          throw new Error("Mikrofon-behörighet nekades av telefonen.");
        }
      }
      
      await VoiceRecorder.startRecording();
      // Vi initierar en tom array för att hålla strukturen kompatibel med visualiseringen
      this.dataArray = new Uint8Array(128); 
      console.log("Native inspelning startad!");

    } else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webbläsaren stödjer inte ljudinspelning. Kräver HTTPS.");
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.audioChunks.push(event.data);
      };

      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      this.mediaRecorder.start(1000);
    }
  }

  async stop(): Promise<Blob> {
    if (this.isNative) {
       const result = await VoiceRecorder.stopRecording();
       if (result.value && result.value.recordDataBase64) {
          const res = await fetch(`data:${result.value.mimeType};base64,${result.value.recordDataBase64}`);
          return await res.blob();
       }
       throw new Error("Kunde inte spara app-inspelningen.");
    } else {
      return new Promise((resolve, reject) => {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return reject();
        this.mediaRecorder.onstop = () => {
          const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
          if (this.stream) this.stream.getTracks().forEach(t => t.stop());
          if (this.audioContext) this.audioContext.close();
          resolve(audioBlob);
        };
        this.mediaRecorder.stop();
      });
    }
  }

  // Hämtar data för visualisering (Webb-läge)
  getVisualizerData(): Uint8Array {
    if (!this.isNative && this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);
      return this.dataArray;
    }
    return new Uint8Array(0);
  }

  // NY FUNKTION FÖR APK: Hämtar rå amplitud (0.0 till 1.0)
  async getNativeAmplitude(): Promise<number> {
    if (this.isNative) {
      try {
        const result = await VoiceRecorder.getCurrentAmplitude();
        return result.value; // Detta är det faktiska värdet från mikrofonen
      } catch (e) {
        return 0;
      }
    }
    return 0;
  }
}

export const audioRecorder = new AudioRecorderService();