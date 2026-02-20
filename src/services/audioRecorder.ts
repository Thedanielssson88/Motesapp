import { registerPlugin, Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem'; // <--- NY IMPORT

// Vi registrerar pluginen manuellt
const AudioRecorder = registerPlugin<any>('CapacitorAudioRecorder');

export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  private isNative = Capacitor.isNativePlatform();

  async start(): Promise<void> {
    if (this.isNative) {
      const status = await AudioRecorder.requestPermissions();

      if (status.recordAudio !== 'granted') {
        throw new Error("Mikrofon-behörighet nekades.");
      }

      await AudioRecorder.startRecording();
      console.log("Native inspelning startad!");
    } else {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (e) => this.audioChunks.push(e.data);
      this.mediaRecorder.start();
    }
  }

  async stop(): Promise<Blob> {
    if (this.isNative) {
      const result = await AudioRecorder.stopRecording();

      // Hämta sökvägen till filen på telefonen från result.uri
      const fileUri = result.uri;

      if (!fileUri) {
        throw new Error("Fick ingen filsökväg (URI) från telefonen.");
      }

      // Läs filen från telefonens hårddisk med Capacitor Filesystem
      try {
        const fileData = await Filesystem.readFile({
          path: fileUri
        });

        // Konvertera den inlästa base64-datan till en Blob
        const base64Data = fileData.data as string;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        // Returnera filen som m4a
        return new Blob([byteArray], { type: 'audio/m4a' });

      } catch (error: any) {
        throw new Error("Kunde inte läsa in sparad ljudfil: " + error.message);
      }

    } else {
      // WEB LOGIK
      return new Promise((resolve) => {
        this.mediaRecorder!.onstop = () => {
          const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.stream?.getTracks().forEach(t => t.stop());
          resolve(blob);
        };
        this.mediaRecorder!.stop();
      });
    }
  }

  async getNativeAmplitude(): Promise<number> {
    if (this.isNative) {
      try {
        const result = await AudioRecorder.getCurrentAmplitude();
        return result.value;
      } catch (e) {
        return 0;
      }
    }
    return 0;
  }
}

export const audioRecorder = new AudioRecorderService();
