import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { audioRecorder } from '../services/audioRecorder';
import { db } from '../services/db';
import { Mic, Square, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export const RecordView = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
      drawVisualizer();
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const animate = () => {
      if (!isRecording) return;
      requestAnimationFrame(animate);
      const data = audioRecorder.getVisualizerData();
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / data.length) * 2;
      let x = 0;
      
      for(let i = 0; i < data.length; i++) {
        const barHeight = (data[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(59, 130, 246, ${data[i]/255 + 0.2})`;
        ctx.beginPath();
        // @ts-ignore - roundRect is available in modern browsers
        ctx.roundRect(x, (canvas.height - barHeight) / 2, barWidth - 2, barHeight, 5);
        ctx.fill();
        x += barWidth;
      }
    };
    animate();
  };

  const handleToggle = async () => {
    if (!isRecording) {
      await audioRecorder.start();
      setIsRecording(true);
    } else {
      const blob = await audioRecorder.stop();
      setIsRecording(false);
      const id = crypto.randomUUID();
      
      await db.transaction('rw', db.meetings, db.audioFiles, async () => {
        await db.meetings.add({
          id,
          title: title || `Möte ${new Date().toLocaleDateString()}`,
          date: new Date().toISOString(),
          duration,
          category: 'Övrigt',
          participantIds: [],
          isProcessed: false
        });
        await db.audioFiles.add({ id, blob, mimeType: blob.type });
      });
      
      navigate(`/meeting/${id}`);
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-white flex flex-col p-6">
      <div className="flex items-center mb-8">
        <button onClick={() => navigate(-1)} className="p-2 bg-gray-100 rounded-full">
          <ArrowLeft size={20} />
        </button>
        <span className="ml-4 font-bold text-lg">Ny Inspelning</span>
      </div>

      <input 
        type="text" 
        placeholder="Vad handlar mötet om?"
        className="text-3xl font-bold placeholder-gray-300 border-none focus:ring-0 w-full mb-8 bg-transparent"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      <div className="flex-1 flex flex-col items-center justify-center relative">
        <canvas ref={canvasRef} width={300} height={150} className="w-full h-40" />
        <div className="text-6xl font-mono font-medium text-gray-800 mt-8 tracking-tighter">
          {formatTime(duration)}
        </div>
      </div>

      <div className="flex justify-center pb-12">
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={handleToggle}
          className={`h-20 w-20 rounded-full flex items-center justify-center shadow-xl ${isRecording ? 'bg-red-500' : 'bg-blue-600'}`}
        >
          {isRecording ? <Square fill="white" className="text-white" /> : <Mic fill="white" className="text-white" />}
        </motion.button>
      </div>
    </div>
  );
};
