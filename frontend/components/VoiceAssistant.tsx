'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, Sparkles } from 'lucide-react';
import api from '@/lib/api';

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeechTimeRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true; // Keep listening continuously
      recognitionRef.current.interimResults = true; // Get interim results to detect speech

      recognitionRef.current.onresult = async (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        // Process all results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Update transcript with interim results for real-time feedback
        setTranscript(finalTranscript + interimTranscript);

        // If we have speech (interim or final), reset the silence timer
        if (finalTranscript || interimTranscript) {
          lastSpeechTimeRef.current = Date.now();
          
          // Clear existing timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          // Set new timer for 10 seconds of silence
          silenceTimerRef.current = setTimeout(() => {
            if (recognitionRef.current && isListening) {
              recognitionRef.current.stop();
            }
          }, 10000); // 10 seconds
        }

        // Process final transcript
        if (finalTranscript.trim() && !isProcessing) {
          // Clear the timer since we're processing
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          
          setTranscript(finalTranscript.trim());
          recognitionRef.current.stop();
          await processCommand(finalTranscript.trim());
        }
      };

      recognitionRef.current.onstart = () => {
        lastSpeechTimeRef.current = Date.now();
        // Set initial silence timer for 10 seconds
        silenceTimerRef.current = setTimeout(() => {
          if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
          }
        }, 10000); // 10 seconds
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        // Clear any remaining timers
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        
        // Process transcript if we have one and not already processing
        if (transcript.trim() && !isProcessing) {
          processCommand(transcript.trim());
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        
        // Show user-friendly error messages
        let errorMessage = '';
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech detected. Please try speaking again.';
            break;
          case 'audio-capture':
            errorMessage = 'Microphone access denied. Please allow microphone access.';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone permission denied. Please enable microphone in settings.';
            break;
          default:
            errorMessage = 'Something went wrong. Please try again.';
        }
        
        setResponse(errorMessage);
        speak(errorMessage);
      };
    }

    // Cleanup function
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [isListening]);

  const toggleListening = () => {
    if (isListening) {
      // Clear any existing timers
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      // Don't start if already processing
      if (isProcessing) return;
      
      recognitionRef.current?.start();
      setIsListening(true);
      setTranscript('');
      setResponse('');
    }
  };

  const processCommand = async (command: string) => {
    // Prevent multiple simultaneous processing
    if (isProcessing) return;
    
    setIsProcessing(true);
    
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
      
      // Handle API key errors
      if (!res.ok) {
        if (data.needsApiKey) {
          const apiKeyMessage = 'Please add your Gemini API key in profile settings to use voice commands.';
          setResponse(apiKeyMessage);
          speak(apiKeyMessage);
        } else if (data.error) {
          // Better error messages for incomplete tasks
          let errorMessage = data.error;
          
          if (data.error.includes('incomplete') || data.error.includes('unclear') || data.error.includes('understand')) {
            errorMessage = 'I didn\'t understand that clearly. Please speak again with more details.';
          } else if (data.error.includes('missing') || data.error.includes('required')) {
            errorMessage = 'Some information is missing. Please provide complete details and try again.';
          } else if (data.error.includes('invalid') || data.error.includes('not found')) {
            errorMessage = 'I didn\'t recognize that command. Please try saying it differently.';
          } else if (data.error.includes('API') || data.error.includes('key')) {
            errorMessage = 'API key issue. Please check your API key in profile settings.';
          }
          
          setResponse(errorMessage);
          speak(errorMessage);
        } else {
          const fallbackMessage = 'Something went wrong. Please try again.';
          setResponse(fallbackMessage);
          speak(fallbackMessage);
        }
        return;
      }
      
      setResponse(data.response);
      speak(data.response);
      
      if (data.action === 'create' || data.action === 'list' || data.action === 'update' || data.action === 'complete' || data.action === 'delete') {
        window.dispatchEvent(new Event('taskUpdate'));
      }
      
      // If it's a link search, also trigger links update
      if (data.action === 'searchLinks') {
        window.dispatchEvent(new Event('linksUpdate'));
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = 'Connection problem. Please check your internet and try again.';
      setResponse(errorMessage);
      speak(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to render response with clickable links
  const renderResponse = (text: string) => {
    // Split text by lines and process each line
    const lines = text.split('\n');
    
    return lines.map((line, lineIndex) => {
      // Check if line contains a URL
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = line.split(urlRegex);
      
      return (
        <div key={lineIndex} className="mb-1">
          {parts.map((part, partIndex) => {
            if (urlRegex.test(part)) {
              return (
                <a
                  key={partIndex}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline break-all"
                >
                  {part}
                </a>
              );
            }
            return <span key={partIndex}>{part}</span>;
          })}
        </div>
      );
    });
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
            disabled={isProcessing}
            className={`w-20 h-20 sm:w-24 sm:h-24 border-2 flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
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
          
          {isProcessing && (
            <div className="absolute -top-2 -left-2 bg-gradient-to-r from-cyan-500 to-blue-500 p-1.5 rounded-full">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="text-center">
          <p className="text-xs sm:text-sm text-gray-400 font-mono">
            {isProcessing ? '[ PROCESSING COMMAND... ]' : isListening ? '[ LISTENING... AUTO-STOPS AFTER 10s SILENCE ]' : '[ READY ]'}
          </p>
          {isListening && !isProcessing && (
            <p className="text-[10px] sm:text-xs text-cyan-400 font-mono mt-1">
              Click STOP to end manually or wait 10s of silence
            </p>
          )}
          {isProcessing && (
            <div className="flex items-center justify-center mt-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
              </div>
            </div>
          )}
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
              <div className="text-xs sm:text-sm text-gray-300 break-words whitespace-pre-line">
                {renderResponse(response)}
              </div>
            </div>
          )}

          {!transcript && !response && (
            <div className="text-center py-6 sm:py-8 border border-dashed border-zinc-800">
              <p className="text-[10px] sm:text-xs text-gray-600 font-mono mb-2">
                VOICE_COMMANDS_READY
              </p>
              <p className="text-[9px] sm:text-[10px] text-gray-700 font-mono">
                • Click START and speak your command<br/>
                • Auto-stops after 10 seconds of silence<br/>
                • Or click STOP to end manually
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
