'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, Sparkles } from 'lucide-react';
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
      
      if (data.action === 'create' || data.action === 'list' || data.action === 'update' || data.action === 'complete' || data.action === 'delete') {
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
    <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6">
      <div className="flex flex-col items-center space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="w-full border-b border-zinc-800 pb-2 sm:pb-3 mb-1 sm:mb-2">
          <p className="text-[10px] sm:text-xs text-gray-500 tracking-wider">&gt; VOICE_INTERFACE</p>
        </div>

        {/* Microphone Button */}
        <div className="relative">
          <button
            onClick={toggleListening}
            className={`w-20 h-20 sm:w-24 sm:h-24 border-2 flex items-center justify-center transition-all duration-200 active:scale-95 ${
              isListening
                ? 'border-red-500 bg-red-500/10 text-red-400'
                : 'border-cyan-500 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10'
            }`}
          >
            {isListening ? (
              <MicOff className="w-8 h-8 sm:w-10 sm:h-10" />
            ) : (
              <Mic className="w-8 h-8 sm:w-10 sm:h-10" />
            )}
          </button>
          
          {isSpeaking && (
            <div className="absolute -top-2 -right-2 bg-green-500 p-1.5">
              <Volume2 className="w-3 h-3 sm:w-4 sm:h-4 text-black" />
            </div>
          )}
        </div>

        {/* Status */}
        <div className="text-center">
          <p className="text-xs sm:text-sm text-gray-400 font-mono">
            {isListening ? '[ LISTENING... ]' : '[ READY ]'}
          </p>
        </div>

        {/* Transcript & Response */}
        <div className="w-full space-y-2 sm:space-y-3">
          {transcript && (
            <div className="bg-zinc-800/50 border border-zinc-700 p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-cyan-400 mb-1 sm:mb-2">&gt; INPUT:</p>
              <p className="text-xs sm:text-sm text-gray-300 break-words">{transcript}</p>
            </div>
          )}

          {response && (
            <div className="bg-zinc-800/50 border border-zinc-700 p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-green-400 mb-1 sm:mb-2">&gt; OUTPUT:</p>
              <p className="text-xs sm:text-sm text-gray-300 break-words">{response}</p>
            </div>
          )}

          {!transcript && !response && (
            <div className="text-center py-6 sm:py-8 border border-dashed border-zinc-800">
              <p className="text-[10px] sm:text-xs text-gray-600 font-mono">
                AWAITING_VOICE_INPUT
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
