import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Square, 
  Play, 
  Pause, 
  RotateCcw, 
  Copy, 
  Check, 
  Volume2, 
  Sparkles, 
  FileText, 
  Download, 
  Trash2,
  AlertCircle,
  Radio
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SessionAudioRecorderProps {
  isPresencial: boolean;
  isSessionActive?: boolean;
  onStartSessionRequest?: () => void;
  transcription: string;
  onTranscriptionChange: (text: string) => void;
  onAudioRecorded?: (audioUrl: string | null, audioBlob: Blob | null) => void;
  isDarkMode: boolean;
}

export const SessionAudioRecorder: React.FC<SessionAudioRecorderProps> = ({
  isPresencial,
  isSessionActive = false,
  onStartSessionRequest,
  transcription,
  onTranscriptionChange,
  onAudioRecorded,
  isDarkMode
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [interimText, setInterimText] = useState('');
  const [copied, setCopied] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronization refs to avoid stale closures in Web Speech API listeners
  const isRecordingRef = useRef(isRecording);
  const isPausedRef = useRef(isPaused);
  const transcriptionRef = useRef(transcription);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    transcriptionRef.current = transcription;
  }, [transcription]);

  // Verificar compatibilidad de Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
    }
  }, []);

  // Timer de grabación
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording, isPaused]);

  // Audio Analyser para visualizador de voz en vivo
  const startAudioVisualizer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn("Visualizador de audio no soportado en este entorno:", e);
    }
  };

  const stopAudioVisualizer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setVolumeLevel(0);
  };

  // Iniciar reconocimiento de voz continuo en tiempo real
  const initSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'es-MX'; // Español de México

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalPhrase = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptChunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalPhrase += transcriptChunk + ' ';
        } else {
          interim += transcriptChunk;
        }
      }

      setInterimText(interim.trim());

      if (finalPhrase.trim()) {
        const timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        const cleanPhrase = finalPhrase.trim();
        const currentText = transcriptionRef.current.trim();
        const updated = currentText 
          ? `${currentText}\n[${timestamp}] ${cleanPhrase}`
          : `[${timestamp}] ${cleanPhrase}`;
        
        transcriptionRef.current = updated;
        onTranscriptionChange(updated);
        setInterimText('');
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Aviso en SpeechRecognition:", event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast.error('Reconocimiento de voz no autorizado en este navegador.');
      }
    };

    recognition.onend = () => {
      // Si el usuario sigue grabando y no pausó, reiniciar automáticamente sin perder el stream
      if (isRecordingRef.current && !isPausedRef.current) {
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = setTimeout(() => {
          if (isRecordingRef.current && !isPausedRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              // Ya iniciado o ocupado
            }
          }
        }, 200);
      }
    };

    return recognition;
  };

  // Iniciar grabación de audio y transcripción
  const handleStartRecording = async () => {
    // REGLA: No permitir iniciar grabación si la sesión no ha iniciado
    if (!isSessionActive) {
      toast((t) => (
        <div className="flex flex-col gap-2 text-xs">
          <span className="font-bold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <AlertCircle size={15} /> Sesión de trabajo no iniciada
          </span>
          <span className="text-slate-600 dark:text-slate-300">
            Debes iniciar primero la sesión de trabajo con el cronómetro (botón ▶ en el panel superior) antes de poder grabar y transcribir.
          </span>
          {onStartSessionRequest && (
            <button
              onClick={() => {
                toast.dismiss(t.id);
                onStartSessionRequest();
                setTimeout(() => {
                  handleStartRecording();
                }, 400);
              }}
              className="mt-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-center transition-all shadow-md active:scale-95"
            >
              ▶ Iniciar Sesión y Comenzar a Grabar
            </button>
          )}
        </div>
      ), { duration: 6000, id: 'session-not-active' });
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      toast.error('Tu navegador o el entorno actual no soporta acceso al micrófono.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      // Iniciar visualizador de voz
      startAudioVisualizer(stream);

      // Iniciar MediaRecorder
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/mp4') 
          ? 'audio/mp4' 
          : '';

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        if (onAudioRecorded) {
          onAudioRecorded(url, blob);
        }
      };

      mediaRecorder.start(1000); // Guardar trozos cada 1s

      // Iniciar SpeechRecognition
      const recognition = initSpeechRecognition();
      if (recognition) {
        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch (err) {
          console.warn("SpeechRecognition start error:", err);
        }
      }

      isRecordingRef.current = true;
      isPausedRef.current = false;
      setIsRecording(true);
      setIsPaused(false);
      toast.success('Grabación de audio y transcripción en tiempo real iniciadas');
    } catch (err: any) {
      console.error("Error al acceder al micrófono:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.toLowerCase().includes('permission denied')) {
        toast.error('Permiso de micrófono denegado. Por favor concede permiso de micrófono a la aplicación en tu navegador.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        toast.error('No se detectó ningún micrófono conectado en tu equipo.');
      } else {
        toast.error('No se pudo acceder al micrófono. Verifica los permisos de tu navegador.');
      }
    }
  };

  // Pausar grabación
  const handlePauseRecording = () => {
    isPausedRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    stopAudioVisualizer();
    setIsPaused(true);
    toast('Grabación en pausa');
  };

  // Reanudar grabación
  const handleResumeRecording = () => {
    isPausedRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
    }
    if (streamRef.current) {
      startAudioVisualizer(streamRef.current);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
    setIsPaused(false);
    toast.success('Grabación reanudada');
  };

  // Detener grabación
  const handleStopRecording = () => {
    isRecordingRef.current = false;
    isPausedRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    stopAudioVisualizer();
    setIsRecording(false);
    setIsPaused(false);
    setInterimText('');
    toast.success('Grabación finalizada. Transcripción lista para generar la minuta.');
  };

  // Limpiar transcripción y audio
  const handleReset = () => {
    if (isRecording) {
      handleStopRecording();
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingSeconds(0);
    setInterimText('');
    onTranscriptionChange('');
    if (onAudioRecorded) {
      onAudioRecorded(null, null);
    }
    toast('Transcripción y audio reiniciados');
  };

  // Copiar transcripción al portapapeles
  const handleCopy = () => {
    if (!transcription.trim()) return;
    navigator.clipboard.writeText(transcription);
    setCopied(true);
    toast.success('Transcripción copiada al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  // Formato mm:ss o hh:mm:ss
  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all space-y-4 shadow-sm ${
      isDarkMode 
        ? 'bg-[#141414] border-white/10' 
        : 'bg-white border-slate-200'
    }`}>
      {/* Encabezado con estado e insignia */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
            isRecording && !isPaused
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 animate-pulse'
              : isPaused
                ? 'bg-amber-500 text-white'
                : 'bg-indigo-600/10 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-400'
          }`}>
            <Mic size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                Grabación & Transcripción de Sesión Presencial
              </h4>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center gap-1">
                <Sparkles size={11} /> Minuta con IA
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Captura el audio de la reunión presencial para transcribir y redactar una minuta exhaustiva con Gemini.
            </p>
          </div>
        </div>

        {/* Indicador de modalidad */}
        {isPresencial ? (
          <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1 shrink-0">
            <Radio size={11} className="animate-pulse" /> Modo Presencial Activo
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 shrink-0">
            Disponible para reuniones presenciales
          </span>
        )}
      </div>

      {/* Barra de control y visualizador de voz */}
      <div className={`p-3.5 sm:p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 min-w-0 ${
        isDarkMode ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200/80'
      }`}>
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          {/* Botones de control */}
          {!isRecording ? (
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={handleStartRecording}
                className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all active:scale-95 shrink-0 ${
                  !isSessionActive
                    ? 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500 hover:bg-slate-300 dark:hover:bg-white/15 cursor-not-allowed border border-slate-300/60 dark:border-white/10 shadow-none'
                    : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-rose-600/25'
                }`}
                title={!isSessionActive ? "Primero debes dar inicio a la sesión de trabajo arriba" : "Iniciar Grabación"}
              >
                <Mic size={15} /> Iniciar Grabación
              </button>
              {!isSessionActive && (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0">
                  <AlertCircle size={12} className="shrink-0" /> Inicia la sesión arriba (▶) para grabar
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              {isPaused ? (
                <button
                  type="button"
                  onClick={handleResumeRecording}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm shadow-emerald-600/20"
                  title="Reanudar Grabación"
                >
                  <Play size={14} className="fill-current" /> Reanudar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePauseRecording}
                  className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm shadow-amber-500/20"
                  title="Pausar Grabación"
                >
                  <Pause size={14} className="fill-current" /> Pausar
                </button>
              )}

              <button
                type="button"
                onClick={handleStopRecording}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-rose-600/20 transition-all active:scale-95"
                title="Detener y Finalizar Grabación"
              >
                <Square size={13} className="fill-current" /> Detener
              </button>
            </div>
          )}

          {/* Cronómetro de grabación */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-200/60 dark:bg-white/10 font-mono text-xs font-black shrink-0">
            <span className={`w-2 h-2 rounded-full ${isRecording && !isPaused ? 'bg-rose-500 animate-ping' : 'bg-slate-400'}`} />
            <span>{formatTime(recordingSeconds)}</span>
          </div>

          {/* Visualizador de nivel de voz (barritas animadas) */}
          {isRecording && !isPaused && (
            <div className="hidden sm:flex items-center gap-0.5 h-4 px-2 shrink-0" title="Nivel de voz en vivo">
              {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8].map((mult, i) => {
                const barHeight = Math.max(3, Math.min(16, (volumeLevel / 100) * 16 * mult));
                return (
                  <span
                    key={i}
                    className="w-1 bg-rose-500 rounded-full transition-all duration-75"
                    style={{ height: `${barHeight}px` }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Acciones auxiliares */}
        <div className="flex items-center gap-2 shrink-0">
          {audioUrl && (
            <a
              href={audioUrl}
              download={`Audio_Sesion_${new Date().toISOString().split('T')[0]}.webm`}
              className="p-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Descargar archivo de audio"
            >
              <Download size={14} />
            </a>
          )}

          {(transcription || audioUrl || recordingSeconds > 0) && (
            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 text-slate-400 hover:text-rose-500 transition-colors"
              title="Reiniciar grabación y transcripción"
            >
              <Trash2 size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            disabled={!transcription.trim()}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
              copied
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40'
            }`}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      {/* Reproductor de audio grabado si existe */}
      {audioUrl && (
        <div className={`p-3 rounded-2xl border flex items-center gap-3 overflow-hidden ${
          isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50/50 border-indigo-200/60'
        }`}>
          <Volume2 size={16} className="text-indigo-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-1 truncate">
              Audio Grabado de la Sesión Presencial ({formatTime(recordingSeconds)})
            </p>
            <audio src={audioUrl} controls className="w-full h-8 outline-none" />
          </div>
        </div>
      )}

      {/* Texto en vivo mientras se habla (Interim transcript en tiempo real) */}
      {interimText && (
        <div className={`p-3 rounded-2xl border flex items-start gap-2.5 text-xs animate-in fade-in duration-150 overflow-hidden ${
          isDarkMode ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200' : 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
        }`}>
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-rose-500 dark:text-rose-400 mb-0.5">
              <Radio size={12} className="animate-pulse" /> Transcribiendo en tiempo real:
            </div>
            <p className="italic font-medium break-words leading-relaxed text-xs sm:text-sm">"{interimText}"</p>
          </div>
        </div>
      )}

      {/* Área de Transcripción Acumulada y Editable */}
      <div className="space-y-1.5 min-w-0">
        <div className="flex justify-between items-center text-[11px] font-bold text-slate-400">
          <label className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] truncate">
            <FileText size={12} className="text-indigo-500 shrink-0" /> Transcripción Registrada (Editable)
          </label>
          <span className="text-[10px] shrink-0">
            {transcription.trim() ? `${transcription.trim().split(/\s+/).length} palabras` : '0 palabras'}
          </span>
        </div>

        <textarea
          rows={5}
          value={transcription}
          onChange={(e) => onTranscriptionChange(e.target.value)}
          placeholder={
            !isSpeechSupported
              ? "El reconocimiento automático no está soportado en este navegador. Puedes escribir o pegar la transcripción o notas de la sesión presencial aquí..."
              : "La transcripción del audio de la sesión presencial aparecerá aquí en tiempo real conforme los alumnos y el coordinador hablen. También puedes editar o agregar notas manualmente..."
          }
          className={`w-full min-h-[140px] max-h-[360px] p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm font-mono leading-relaxed border outline-none resize-y transition-all shadow-inner box-border break-words ${
            isDarkMode 
              ? 'bg-black/30 border-white/10 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20' 
              : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
          }`}
        />

        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400 px-1">
          <span className="flex items-center gap-1 truncate">
            <Sparkles size={11} className="text-purple-400 shrink-0" /> Al finalizar la sesión, Gemini procesará esta transcripción para redactar la minuta.
          </span>
          {transcription.trim().length > 0 && (
            <span className="text-emerald-500 font-bold shrink-0">
              ✓ Transcripción lista para minuta
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionAudioRecorder;
