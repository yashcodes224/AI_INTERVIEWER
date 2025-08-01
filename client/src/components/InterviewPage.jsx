import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
const socket = io('http://localhost:3001');

export default function InterviewPage() {
  const [aiResponse, setAiResponse] = useState('');
  const [transcript, setTranscript] = useState('');
  const audioRef = useRef(null);

  useEffect(() => {
    socket.on('ai-text', (data) => {
      setAiResponse(data.text);
    });

    socket.on('ai-audio', (data) => {
      const blob = new Blob([data.audio], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      audioRef.current.src = url;
      audioRef.current.play();
    });

    return () => {
      socket.off('ai-text');
      socket.off('ai-audio');
    };
  }, []);

  const startInterview = async () => {
    await fetch('http://localhost:3001/api/interview/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '+917379791595', // replace with actual
        role: 'frontend developer',
      }),
    });
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">AI Interviewer</h1>
      <button
        onClick={startInterview}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Start Interview
      </button>

      <div className="mt-6">
        <p className="text-lg"><strong>AI Response:</strong> {aiResponse}</p>
        <audio ref={audioRef} hidden controls />
      </div>
    </div>
  );
}
