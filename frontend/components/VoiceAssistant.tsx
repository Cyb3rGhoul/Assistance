'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import api from '@/lib/api';

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeechTimeRef = useRef<number>(0);
  const finalTranscriptRef = useRef<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false; // Don't keep listening continuously
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Update display transcript with interim results
        setTranscript(finalTranscriptRef.current + finalTranscript + interimTranscript);

        // Process final transcript immediately
        if (finalTranscript) {
          finalTranscriptRef.current += finalTranscript;
          
          // Clear any existing timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          // Process immediately after final transcript with minimal delay
          silenceTimerRef.current = setTimeout(() => {
            if (finalTranscriptRef.current.trim()) {
              recognitionRef.current.stop();
              processCommand(finalTranscriptRef.current.trim());
            }
          }, 500); // Just 0.5 seconds
        }
      };

      recognitionRef.current.onstart = () => {
        finalTranscriptRef.current = '';
        setTranscript('');
        lastSpeechTimeRef.current = Date.now();
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        
        // Process any remaining transcript immediately
        if (finalTranscriptRef.current.trim() && !isProcessing) {
          processCommand(finalTranscriptRef.current.trim());
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        
        // Only show error for meaningful errors, not "no-speech"
        if (event.error !== 'no-speech') {
          let errorMessage = '';
          switch (event.error) {
            case 'audio-capture':
              errorMessage = 'Microphone access denied. Please allow microphone access.';
              break;
            case 'not-allowed':
              errorMessage = 'Microphone permission denied. Please enable microphone in settings.';
              break;
            case 'network':
              errorMessage = 'Network error. Please check your connection.';
              break;
            default:
              errorMessage = 'Voice recognition error. Please try again.';
          }
          
          setResponse(errorMessage);
          speak(errorMessage);
        }
      };
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [isListening, isProcessing]);

  const toggleListening = () => {
    if (isListening) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      recognitionRef.current?.stop();
      setIsListening(false);
      
      // Process immediately when manually stopped
      if (finalTranscriptRef.current.trim() && !isProcessing) {
        processCommand(finalTranscriptRef.current.trim());
      }
    } else {
      if (isProcessing) return;
      
      finalTranscriptRef.current = '';
      recognitionRef.current?.start();
      setIsListening(true);
      setTranscript('');
      setResponse('');
    }
  };

  const processCommand = async (command: string) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setTranscript(command); // Set final transcript
    
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
      
      if (!res.ok) {
        if (data.needsApiKey) {
          const apiKeyMessage = 'Please add your Gemini API key in profile settings to use voice commands.';
          setResponse(apiKeyMessage);
          speak(apiKeyMessage);
        } else if (data.error) {
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
      finalTranscriptRef.current = '';
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

        {/* Futuristic 3D Voice Visualizer */}
        <div className="relative flex items-center justify-center voice-visualizer-3d">
          {/* Neural Network SVG */}
          <svg className="absolute w-48 h-48 sm:w-56 sm:h-56 opacity-30" viewBox="0 0 200 200">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Neural network paths */}
            <path d="M 50 100 Q 100 50 150 100" className="neural-path" filter="url(#glow)" />
            <path d="M 50 100 Q 100 150 150 100" className="neural-path" filter="url(#glow)" style={{animationDelay: '0.5s'}} />
            <path d="M 100 50 Q 150 100 100 150" className="neural-path" filter="url(#glow)" style={{animationDelay: '1s'}} />
            <path d="M 100 50 Q 50 100 100 150" className="neural-path" filter="url(#glow)" style={{animationDelay: '1.5s'}} />
          </svg>

          {/* Main energy core button */}
          <button
            onClick={toggleListening}
            disabled={isProcessing}
            className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 flex items-center justify-center transition-all duration-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed z-10 energy-core ${
              isListening
                ? 'border-red-500/50 bg-gradient-to-br from-red-500/30 via-red-500/20 to-red-500/10 text-red-400 shadow-2xl shadow-red-500/40'
                : isProcessing
                ? 'border-blue-500/50 bg-gradient-to-br from-blue-500/30 via-blue-500/20 to-blue-500/10 text-blue-400 shadow-2xl shadow-blue-500/40'
                : 'border-cyan-500/50 bg-gradient-to-br from-cyan-500/20 via-cyan-500/10 to-cyan-500/5 text-cyan-400 hover:from-cyan-500/40 hover:via-cyan-500/20 hover:to-cyan-500/10 hover:shadow-2xl hover:shadow-cyan-500/40'
            }`}
            style={{
              backdropFilter: 'blur(10px)',
              background: isListening 
                ? 'radial-gradient(circle, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.05))' 
                : isProcessing
                ? 'radial-gradient(circle, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.05))'
                : 'radial-gradient(circle, rgba(6, 182, 212, 0.15), rgba(6, 182, 212, 0.05))'
            }}
          >
            {isProcessing ? (
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-3 border-blue-400 border-t-transparent rounded-full animate-spin shadow-lg"></div>
            ) : isListening ? (
              <MicOff className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-lg" />
            ) : (
              <Mic className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-lg" />
            )}
          </button>

          {/* 3D Voice level visualizer */}
          {isListening && !isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center">
              {[...Array(12)].map((_, i) => (
                <div
                  key={`voice-bar-${i}`}
                  className="absolute voice-bar-3d"
                  style={{
                    width: '2px',
                    height: `${Math.random() * 20 + 8}px`,
                    transform: `rotate(${i * 30}deg) translateY(-45px) rotateX(45deg)`,
                    animationName: 'voice-pulse',
                    animationDuration: `${1 + Math.random() * 0.5}s`,
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                    animationDelay: `${i * 0.08}s`
                  }}
                />
              ))}
            </div>
          )}

          {/* Speaking breathing animation - clean and minimal */}
          {isSpeaking && (
            <div className="absolute inset-0 flex items-center justify-center">
              {[...Array(8)].map((_, i) => (
                <div
                  key={`speaking-breath-${i}`}
                  className="absolute w-1 bg-green-400 rounded-full"
                  style={{
                    height: `${Math.random() * 16 + 8}px`,
                    transform: `rotate(${i * 45}deg) translateY(-50px)`,
                    animationName: 'voice-pulse',
                    animationDuration: `${0.8 + Math.random() * 0.4}s`,
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                    animationDelay: `${i * 0.1}s`,
                    opacity: 0.7
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="text-center">
          <p className="text-xs sm:text-sm text-gray-400 font-mono">
            {isProcessing 
              ? '[ PROCESSING COMMAND... ]' 
              : isListening 
              ? '[ LISTENING... SPEAK NOW ]' 
              : '[ READY TO LISTEN ]'
            }
          </p>
          {isListening && !isProcessing && (
            <p className="text-[10px] sm:text-xs text-cyan-400 font-mono mt-1">
              Speak now - will process automatically
            </p>
          )}
          {isProcessing && (
            <div className="flex items-center justify-center mt-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          )}
        </div>

        {/* Transcript & Response */}
        <div className="w-full space-y-2 sm:space-y-3">
          {transcript && (
            <div className="bg-zinc-800/50 border border-zinc-700 p-3 sm:p-4 rounded-lg">
              <p className="text-[10px] sm:text-xs text-cyan-400 mb-1 sm:mb-2">&gt; INPUT:</p>
              <p className="text-xs sm:text-sm text-gray-300 break-words">{transcript}</p>
            </div>
          )}

          {response && (
            <div className="bg-zinc-800/50 border border-zinc-700 p-3 sm:p-4 rounded-lg">
              <p className="text-[10px] sm:text-xs text-green-400 mb-1 sm:mb-2">&gt; OUTPUT:</p>
              <div className="text-xs sm:text-sm text-gray-300 break-words whitespace-pre-line">
                {renderResponse(response)}
              </div>
            </div>
          )}

          {!transcript && !response && (
            <div className="text-center py-6 sm:py-8 border border-dashed border-zinc-800 rounded-lg">
              <p className="text-[10px] sm:text-xs text-gray-600 font-mono">
                VOICE_COMMANDS_READY
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
