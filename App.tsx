import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { ConnectionState } from './types';
import { SYSTEM_INSTRUCTION, SERVICE_PACKAGES } from './constants';
import { createBlob, decodeAudioData, decode } from './services/audioUtils';
import Visualizer from './components/Visualizer';
import ServiceCard from './components/ServiceCard';

// --- Tool Definitions ---
const bookVisitTool: FunctionDeclaration = {
  name: 'book_site_visit',
  description: 'Schedule a site visit for a quote.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      customerName: { type: Type.STRING, description: 'Name of the customer' },
      address: { type: Type.STRING, description: 'Property address' },
      preferredTime: { type: Type.STRING, description: 'Preferred date/time for visit' }
    },
    required: ['customerName', 'address', 'preferredTime']
  }
};

const App: React.FC = () => {
  // --- State ---
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isSpeaking, setIsSpeaking] = useState(false); // Model is speaking
  const [lastLog, setLastLog] = useState<string>("Ready to start.");
  const [bookedVisits, setBookedVisits] = useState<any[]>([]);

  // --- Refs for Audio & Session ---
  const sessionRef = useRef<any>(null); // Keep track of the active session
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // --- Cleanup on Unmount ---
  useEffect(() => {
    return () => {
      handleDisconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisconnect = () => {
    if (sessionRef.current) {
      sessionRef.current = null; // We can't explicitly close, just drop ref and let API close on GC or server timeout
      // Actually, per guidelines, we can't check close status easily, just stop sending.
      // But we should try to stop audio contexts.
    }
    
    // Stop Audio Contexts
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    setConnectionState(ConnectionState.DISCONNECTED);
    setIsSpeaking(false);
    setLastLog("Disconnected.");
  };

  const handleConnect = async () => {
    if (!process.env.API_KEY) {
      alert("API Key is missing!");
      return;
    }

    setConnectionState(ConnectionState.CONNECTING);
    setLastLog("Connecting to Gemini...");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Initialize Audio Contexts
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const inputAudioContext = new AudioContext({ sampleRate: 16000 });
      const outputAudioContext = new AudioContext({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputAudioContext;
      outputAudioContextRef.current = outputAudioContext;

      const outputNode = outputAudioContext.createGain();
      outputNode.connect(outputAudioContext.destination);
      outputNodeRef.current = outputNode;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Connect to Live API
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            setConnectionState(ConnectionState.CONNECTED);
            setLastLog("Connected! Say hello.");

            // Start Input Stream
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
               const inputData = e.inputBuffer.getChannelData(0);
               const pcmBlob = createBlob(inputData);
               
               // Use sessionPromise to ensure valid session
               sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
               });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsSpeaking(true);
              const ctx = outputAudioContextRef.current;
              const node = outputNodeRef.current;
              
              if (ctx && node) {
                 nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                 
                 const audioBuffer = await decodeAudioData(
                   decode(base64Audio),
                   ctx,
                   24000,
                   1
                 );
                 
                 const source = ctx.createBufferSource();
                 source.buffer = audioBuffer;
                 source.connect(node);
                 
                 source.addEventListener('ended', () => {
                   sourcesRef.current.delete(source);
                   if (sourcesRef.current.size === 0) {
                     setIsSpeaking(false);
                   }
                 });

                 source.start(nextStartTimeRef.current);
                 nextStartTimeRef.current += audioBuffer.duration;
                 sourcesRef.current.add(source);
              }
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              setLastLog("User interrupted model.");
              setIsSpeaking(false);
              sourcesRef.current.forEach(s => {
                try { s.stop(); } catch(e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            // Handle Tool Calls
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'book_site_visit') {
                  const args = fc.args as any;
                  setLastLog(`Booking visit for ${args.customerName}...`);
                  setBookedVisits(prev => [...prev, args]);
                  
                  // Respond to tool
                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: { result: "Visit successfully scheduled." }
                      }
                    });
                  });
                }
              }
            }
          },
          onclose: () => {
             console.log("Session closed");
             handleDisconnect();
          },
          onerror: (err) => {
            console.error(err);
            setLastLog("Error occurred. Please restart.");
            handleDisconnect();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: [bookVisitTool] }]
        }
      });

      sessionRef.current = sessionPromise;

    } catch (e) {
      console.error(e);
      setConnectionState(ConnectionState.ERROR);
      setLastLog("Failed to connect: " + (e as Error).message);
    }
  };

  const toggleConnection = () => {
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      handleDisconnect();
    } else {
      handleConnect();
    }
  };

  return (
    <div className="min-h-screen pb-24 relative bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-green-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white text-xl">
              🍃
            </div>
            <div>
              <h1 className="font-bold text-gray-800 text-lg leading-tight">GreenGuard</h1>
              <p className="text-xs text-green-700 font-medium">Landscaping AI Agent</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className={`w-3 h-3 rounded-full ${connectionState === ConnectionState.CONNECTED ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
             <span className="text-sm font-medium text-gray-600">
               {connectionState === ConnectionState.CONNECTED ? 'Live' : 'Offline'}
             </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Status Area */}
        <div className="mb-8 text-center">
            <div className="inline-flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-green-100 min-w-[300px]">
                <div className="mb-4">
                  <Visualizer isActive={isSpeaking || connectionState === ConnectionState.CONNECTED} color={isSpeaking ? '#22c55e' : '#cbd5e1'} />
                </div>
                <p className="text-gray-500 font-mono text-sm">{lastLog}</p>
            </div>
        </div>

        {/* Services Grid */}
        <h2 className="text-2xl font-bold text-gray-800 mb-6 px-1">Our Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {SERVICE_PACKAGES.map((pkg) => (
            <ServiceCard key={pkg.id} service={pkg} />
          ))}
        </div>

        {/* Booked Visits Section (Simulated Backend) */}
        {bookedVisits.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-8">
            <h3 className="text-emerald-800 font-bold mb-3 flex items-center">
              <span className="mr-2">📅</span> Scheduled Site Visits
            </h3>
            <div className="space-y-3">
              {bookedVisits.map((visit, i) => (
                <div key={i} className="bg-white p-3 rounded-lg shadow-sm text-sm border border-emerald-100 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-gray-800">{visit.customerName}</span>
                    <span className="text-gray-500 mx-2">|</span>
                    <span className="text-gray-600">{visit.address}</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">
                    {visit.preferredTime}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-center relative">
          
          <button
            onClick={toggleConnection}
            disabled={connectionState === ConnectionState.CONNECTING}
            className={`
              flex items-center gap-3 px-8 py-4 rounded-full font-bold text-lg transition-all transform hover:scale-105 active:scale-95 shadow-lg
              ${connectionState === ConnectionState.CONNECTED 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-200' 
                : 'bg-green-600 hover:bg-green-700 text-white shadow-green-200'}
              disabled:opacity-70 disabled:cursor-not-allowed
            `}
          >
            {connectionState === ConnectionState.CONNECTING ? (
               <span>Connecting...</span>
            ) : connectionState === ConnectionState.CONNECTED ? (
               <>
                 <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                 </span>
                 End Call
               </>
            ) : (
               <>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                 </svg>
                 Start Consultation
               </>
            )}
          </button>
          
          <div className="hidden md:block absolute right-0 text-xs text-gray-400 max-w-[200px] text-right">
             Powered by Gemini 2.5 Live API
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;