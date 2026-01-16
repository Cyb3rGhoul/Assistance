'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import api from '@/lib/api';

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = async (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        await processCommand(text);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
      setTranscript('');
      setResponse('');
    }
  };

  const processCommand = async (command: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(api.endpoints.voice.process, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ command })
      });

      const data = await res.json();
      setResponse(data.response);
      speak(data.response);
      
      if (data.action === 'create' || data.action === 'list') {
        window.dispatchEvent(new Event('taskUpdate'));
      }
    } catch (error) {
      console.error('Error:', error);
      setResponse('Sorry, something went wrong.');
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
      <div className="flex flex-col items-center space-y-6">
        <div className="relative">
          <button
            onClick={toggleListening}
            className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50'
                : 'bg-gradient-to-br from-purple-500 to-pink-500 hover:scale-110 shadow-lg shadow-purple-500/50'
            }`}
          >
            {isListening ? (
              <MicOff className="w-12 h-12 text-white" />
            ) : (
              <Mic className="w-12 h-12 text-white" />
            )}
          </button>
          {isSpeaking && (
            <div className="absolute -top-2 -right-2">
              <Volume2 className="w-8 h-8 text-green-400 animate-bounce" />
            </div>
          )}
        </div>

        <div className="w-full space-y-4">
          {transcript && (
            <div className="bg-blue-500/20 rounded-xl p-4 border border-blue-400/30">
              <p className="text-sm text-blue-300 mb-1">You said:</p>
              <p className="text-white">{transcript}</p>
            </div>
          )}

          {response && (
            <div className="bg-purple-500/20 rounded-xl p-4 border border-purple-400/30">
              <p className="text-sm text-purple-300 mb-1">ARIA:</p>
              <p className="text-white">{response}</p>
            </div>
          )}

          {!transcript && !response && (
            <div className="text-center text-gray-400 py-8">
              <p className="text-lg mb-2">Click the microphone to start</p>
              <p className="text-sm">Try: "Remind me to buy groceries tomorrow at 5pm"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
