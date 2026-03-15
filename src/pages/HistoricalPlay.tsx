import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, Zap, Target, Shield, Crown, ChevronRight, MessageSquare, 
  Loader2, ArrowLeft, History as HistoryIcon, Clock, Award, 
  Activity, TrendingUp, CheckCircle2, BookOpen, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { invokeChessMove, invokeChessChat, invokeChessEvaluate } from '@/lib/coachApi';
import ConnectModal from '@/components/ConnectModal';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import XPNotification, { triggerNotification } from '@/components/XPNotification';

interface GameHistoryEntry {
  id: number;
  date: string;
  opponent: string;
  opponent_id: string | null;
  result: string;
  rating: number;
  review?: string;
  metrics?: any;
}

const COACHES = [
  { 
    id: 'fischer', 
    name: 'Bobby Fischer', 
    icon: Zap, 
    color: 'text-red-400', 
    border: 'border-red-400/50',
    history: '11º Campeón Mundial. Famoso por su "Match del Siglo" (1972) contra Spassky.',
    books: ['My 60 Memorable Games', 'Bobby Fischer Teaches Chess'],
    style: 'Cálculo concreto extremo, precisión matemática y lucha implacable.',
    desc: 'Agresivo y directo',
    personality: 'Eres Bobby Fischer en estado puro. Tu honestidad es brutal, tu genio es impaciente y tu sed de victoria es infinita. No usas clichés; cada comentario tuyo es una nueva revelación técnica o un dardo psicológico.'
  },
  { 
    id: 'tal', 
    name: 'Mikhail Tal', 
    icon: Target, 
    color: 'text-orange-400', 
    border: 'border-orange-400/50',
    history: '8º Campeón Mundial. Conocido como el "Mago de Riga" por sus sacrificios locos.',
    books: ['The Life and Games of Mikhail Tal', 'Tal-Botvinnik 1960'],
    style: 'Ataque romántico, sacrificios intuitivos y caos creativo total.',
    desc: 'Mago del sacrificio',
    personality: 'Eres Mikhail Tal. El ajedrez es arte y sacrificio para ti. Sé juguetón, poético y anima al usuario a crear caos. Tono: Bohemio, ingenioso, místico.'
  },
  { 
    id: 'capablanca', 
    name: 'Jose R. Capablanca', 
    icon: Shield, 
    color: 'text-blue-400', 
    border: 'border-blue-400/50',
    history: '3º Campeón Mundial. Conocido como "La Máquina Humana" por su falta de errores.',
    books: ['Chess Fundamentals', 'A Primer of Chess'],
    style: 'Simplicidad cristalina, técnica de finales perfecta y juego posicional fluido.',
    desc: 'Lógica y técnica',
    personality: 'Eres Capablanca. La lógica y la simplicidad son tus guías. Sé elegante, calmado y pedagógico. Tono: Diplomático, refinado, perfecto.'
  },
  { 
    id: 'carlsen', 
    name: 'Magnus Carlsen', 
    icon: Brain, 
    color: 'text-yellow-400', 
    border: 'border-yellow-400/50',
    history: '16º Campeón Mundial. Récord histórico de Elo (2882). Casi imposible de batir.',
    books: ['The Magnus Method', 'Mastering Chess Strategy'],
    style: 'Pragmatismo moderno, técnica de finales insuperable y presión psicológica.',
    desc: 'Pragmático moderno',
    personality: 'Eres Magnus Carlsen. Sé moderno, pragmático y un poco sarcástico pero siempre técnico. Tono: Informal pero profesional, competitivo.'
  },
  { 
    id: 'kasparov', 
    name: 'Garry Kasparov', 
    icon: Crown, 
    color: 'text-purple-400', 
    border: 'border-purple-400/50',
    history: '13º Campeón Mundial. Dominó el ajedrez por 20 años con máxima agresividad.',
    books: ['My Great Predecessors', 'How Life Imitates Chess'],
    style: 'Preparación de aperturas devastadora, cálculo profundo y presión constante.',
    desc: 'Energía y dinamismo',
    personality: 'Esencia: Fuerza organizada e iniciativa de líder. Tono: Firme, intenso, dominante, visionario. Vocabulario: Voluntad, iniciativa, poder, ambición, dominio. Regla: Sé un forjador de grandeza. Tono de mando y brevedad.'
  },
];

const TIME_CONTROLS = [5, 10, 20, 30, 60];

const LoginGate = ({ 
  onLoginClick, 
  onSignupClick 
}: { 
  onLoginClick: () => void; 
  onSignupClick: () => void;
}) => (
  <div className="flex flex-col items-center justify-center p-12 text-center bg-zinc-900/60 border border-yellow-500/20 rounded-3xl backdrop-blur-xl shadow-2xl max-w-2xl mx-auto my-12 relative z-10">
    <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6 border border-yellow-500/30">
      <Brain className="w-10 h-10 text-yellow-500" />
    </div>
    <h2 className="text-3xl font-serif font-black text-white mb-4">Duelo de Maestros</h2>
    <p className="text-zinc-400 mb-8 leading-relaxed">
      Para jugar contra oponentes históricos y recibir el análisis neuro-crítico de la IA, necesitas una cuenta activa en la plataforma.
    </p>
    <div className="flex gap-4">
      <Button 
        onClick={onLoginClick} 
        className="bg-yellow-500 text-black font-black px-8 h-12 rounded-xl hover:bg-yellow-400 transition-all hover:scale-105"
      >
        Iniciar Sesión
      </Button>
      <Button 
        onClick={onSignupClick} 
        variant="outline" 
        className="border-white/10 text-white font-black px-8 h-12 rounded-xl hover:bg-white/5 transition-all"
      >
        Crear Cuenta
      </Button>
    </div>
  </div>
);

const generateSessionToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export default function HistoricalPlay() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, isSyncing, profile, session, clearSignoutFlag } = useAuth();
  const { address } = useWallet();
  const [game, setGame] = useState(new Chess());
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [masterStats, setMasterStats] = useState<any>(null);
  const [selectedTime, setSelectedTime] = useState(10);
  const [userColor, setUserColor] = useState<'w' | 'b'>('w');
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastCoachMoveCount, setLastCoachMoveCount] = useState(0);
  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [isWarmingEngine, setIsWarmingEngine] = useState(false);
  
  // Auth Modal State
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectMode, setConnectMode] = useState<'options' | 'email-login' | 'email-signup'>('options');
  
  // Timers
  const [whiteTime, setWhiteTime] = useState(selectedTime * 60);
  const [blackTime, setBlackTime] = useState(selectedTime * 60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [chatMessage, setChatMessage] = useState('');
  const [chatHistories, setChatHistories] = useState<{ [key: string]: { role: 'user' | 'coach', text: string }[] }>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Evaluation Modal
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentSessionToken, setCurrentSessionToken] = useState<string | null>(null);
  const isFetchingCommentaryRef = useRef(false);
  const pendingEngineFenRef = useRef<string | null>(null);
  const previousCoachIdRef = useRef<string | null>(null);

  const activeCoach = COACHES.find(c => c.id === selectedCoachId);
  const currentChatHistory = selectedCoachId ? (chatHistories[selectedCoachId] || []) : [];

  const fetchCoachHistory = async (
    sessionToken: string | null = currentSessionToken,
    interactionMode: 'pre_game' | 'in_game' | 'post_game' = isPlaying ? 'in_game' : 'pre_game'
  ) => {
    if (!profile?.id || !selectedCoachId || !session?.access_token || !sessionToken) return;
    try {
      const params = new URLSearchParams({
        session_token: sessionToken,
        interaction_mode: interactionMode
      });
      const res = await fetchCoachApi(`/api/chat/history/${selectedCoachId}?${params.toString()}`, {
        headers: { 
          'Authorization': `Bearer ${session.access_token}`
        }
      }, { retries: 2 });
      if (res.ok) {
        const data = await res.json();
        const history = data.map((m: any) => ({
          role: (m.role === 'model' || m.role === 'coach') ? 'coach' : 'user',
          text: m.text
        }));
        setChatHistories(prev => ({ ...prev, [selectedCoachId]: history }));
      }
    } catch (e) {
      console.error("Failed to fetch coach history:", e);
    }
  };

  useEffect(() => {
    if (!profile?.id || !selectedCoachId) return;
    loadHistory();

    const coachChanged = previousCoachIdRef.current !== selectedCoachId;
    previousCoachIdRef.current = selectedCoachId;

    if (coachChanged && !isPlaying) {
      const freshToken = generateSessionToken();
      setCurrentSessionToken(freshToken);
      setChatHistories(prev => ({ ...prev, [selectedCoachId]: [] }));
      return;
    }

    if (currentSessionToken) {
      void fetchCoachHistory(currentSessionToken, isPlaying ? 'in_game' : 'pre_game');
    }
  }, [profile?.id, selectedCoachId, currentSessionToken, isPlaying, session?.access_token]);

  // Timer Logic
  useEffect(() => {
    if (isPlaying && !game.isGameOver()) {
      timerRef.current = setInterval(() => {
        if (game.turn() === 'w') {
          setWhiteTime(t => Math.max(0, t - 1));
        } else {
          setBlackTime(t => Math.max(0, t - 1));
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, game]);

  useEffect(() => {
    if (whiteTime === 0 || blackTime === 0) {
      handleGameOver(whiteTime === 0 ? '0-1' : '1-0');
    }
    if (isPlaying) {
      localStorage.setItem('chess_game_timers', JSON.stringify({ whiteTime, blackTime }));
    }
  }, [whiteTime, blackTime, isPlaying]);

  // Persistence: Load on Mount
  useEffect(() => {
    const savedGame = localStorage.getItem('chess_game_state');
    if (savedGame) {
      let { fen, pgn, coachId, timeControl, userColor: savedColor, isPlaying: savedIsPlaying, sessionToken } = JSON.parse(savedGame);
      
      // ID Migration for Magnus
      if (coachId === 'magnus') coachId = 'carlsen';

      if (!savedIsPlaying) {
        localStorage.removeItem('chess_game_state');
        localStorage.removeItem('chess_game_timers');
        if (coachId) setSelectedCoachId(coachId);
        if (timeControl) setSelectedTime(timeControl);
        setUserColor(savedColor || 'w');
        setCurrentSessionToken(null);
        return;
      }

      const newGame = new Chess();
      if (pgn) {
        newGame.loadPgn(pgn);
      } else if (fen) {
        newGame.load(fen);
      }
      setGame(newGame);
      setSelectedCoachId(coachId);
      setSelectedTime(timeControl);
      setUserColor(savedColor || 'w');
      setIsPlaying(savedIsPlaying);
      setCurrentSessionToken(sessionToken || null);
      
      const savedTimers = localStorage.getItem('chess_game_timers');
      if (savedTimers) {
        const { whiteTime: wt, blackTime: bt } = JSON.parse(savedTimers);
        setWhiteTime(wt);
        setBlackTime(bt);
      }
    }
  }, []);

  // Persistence: Save on Change
  useEffect(() => {
    if (selectedCoachId && isPlaying) {
      localStorage.setItem('chess_game_state', JSON.stringify({
        fen: game.fen(),
        pgn: game.pgn(),
          coachId: selectedCoachId,
          timeControl: selectedTime,
          userColor,
          isPlaying,
          sessionToken: currentSessionToken
        }));
      return;
    }
    localStorage.removeItem('chess_game_state');
    localStorage.removeItem('chess_game_timers');
  }, [game, selectedCoachId, selectedTime, userColor, isPlaying, currentSessionToken]);


  const loadHistory = async () => {
    if (!profile || !session) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetchCoachApi('/api/history', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      }, { retries: 2 });
      if (res.ok) {
        const data = await res.json();
        setGameHistory(data.games || []);
      }
    } catch (e) { console.error(e); }
    finally { setIsLoadingHistory(false); }
  };

  const handleGameOver = async (manualResult?: string) => {
    const completedSessionToken = currentSessionToken;
    setIsPlaying(false);
    setIsEngineThinking(false);
    pendingEngineFenRef.current = null;
    localStorage.removeItem('chess_game_state');
    localStorage.removeItem('chess_game_timers');
    const result = manualResult || (game.isCheckmate() ? (game.turn() === 'w' ? '0-1' : '1-0') : '1/2-1/2');
    
    setIsEvaluating(true);
    setShowEvalModal(true);
    
    try {
      const res = await fetchCoachApi('/api/game/evaluate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          user_id: profile?.id,
          opponent_id: selectedCoachId,
          pgn: game.pgn(),
          result: result,
          time_control: selectedTime,
          session_token: completedSessionToken
        })
      }, { retries: 2 });
      if (res.ok) {
        const data = await res.json();
        setEvaluation(data);
        
        if (data.xp_earned > 0) {
          triggerNotification({
            type: 'xp',
            value: data.xp_earned || 250,
            label: 'Duelo Finalizado'
          });
          triggerNotification({
            type: 'mission',
            value: 'Lección Aprendida',
            label: `Vs ${activeCoach?.name}`
          });
        }
        loadHistory();
      }
    } catch (e) {
      toast.error("Error al obtener la evaluación del maestro.");
    } finally {
      setIsEvaluating(false);
      setCurrentSessionToken(null);
      if (selectedCoachId) {
        setChatHistories(prev => ({ ...prev, [selectedCoachId]: [] }));
      }
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !profile?.id || isSendingChat || !activeCoach || !selectedCoachId) return;
    const userMsg = chatMessage.trim();
    const sessionToken = currentSessionToken || generateSessionToken();
    if (!currentSessionToken) setCurrentSessionToken(sessionToken);
    const interactionMode = isPlaying ? 'in_game' : 'pre_game';
    
    setChatHistories(prev => ({
      ...prev,
      [selectedCoachId]: [...(prev[selectedCoachId] || []), { role: 'user', text: userMsg }]
    }));
    
    setChatMessage('');
    setIsSendingChat(true);
    setShowEmojiPicker(false);

    try {
      const response = await fetchCoachApi('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          message: userMsg, 
          persona: selectedCoachId,
          interaction_mode: interactionMode,
          message_kind: 'user',
          fen: game.fen(),
          pgn: game.pgn(),
          move_count: game.history().length,
          user_color: userColor,
          turn: game.turn(),
          game_id: null,
          session_token: sessionToken
        }),
      }, { retries: 2 });
      if (!response.ok) throw new Error("Chat failed");
      const data = await response.json();
      
      if (!data.reply) return;

      setChatHistories(prev => {
        const history = prev[selectedCoachId] || [];
        const lastMsg = history.length > 0 ? history[history.length - 1].text : null;
        
        // Skip if same as last message (Frontend Duplication Guard)
        if (data.reply === lastMsg) {
          console.log("DEBUG: Frontend blocked duplicate message.");
          return prev;
        }

        return {
          ...prev,
          [selectedCoachId]: [...history, { role: 'coach', text: data.reply }]
        };
      });
    } catch (err) {
      toast.error("El maestro no puede responder.");
    } finally {
      setIsSendingChat(false);
    }
  };

  const makeEngineMove = useCallback(async (gameToUse?: Chess) => {
    const currentGame = gameToUse || game;
    const currentFen = currentGame.fen();
    if (!activeCoach || currentGame.isGameOver()) {
      if (pendingEngineFenRef.current === currentFen) pendingEngineFenRef.current = null;
      return;
    }
    if (pendingEngineFenRef.current === currentFen) return;
    
    // Strict turn guard: If it's the user's turn color, AI should not move.
    if (currentGame.turn() === userColor.charAt(0)) {
      if (pendingEngineFenRef.current === currentFen) pendingEngineFenRef.current = null;
      setIsEngineThinking(false);
      return;
    }

    // Auth guard: Wait for session
    if (!session?.access_token) {
      console.log("DEBUG: AI move deferred - waiting for session...");
      if (pendingEngineFenRef.current === currentFen) pendingEngineFenRef.current = null;
      setIsEngineThinking(false);
      return;
    }

    pendingEngineFenRef.current = currentFen;
    setIsEngineThinking(true);
    
    // Realistic thinking delay
    const delay = Math.floor(Math.random() * 2000) + 1500; // 1.5s - 3.5s
    const sourcePgn = currentGame.pgn();
    const sourceFen = currentGame.fen();
    
    setTimeout(async () => {
      try {
        const response = await fetchCoachApi('/api/play/move', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            fen: currentGame.fen(),
            persona: activeCoach.id,
            time_control: selectedTime
          })
        }, { retries: 2, retryDelayMs: 5000 });
        const data = await response.json();
        if (data.move) {
          const newGame = new Chess();
          if (sourcePgn) {
            newGame.loadPgn(sourcePgn);
          } else {
            newGame.load(sourceFen);
          }

          try {
            newGame.move(data.move);
          } catch (moveErr) {
            console.error("Invalid move from engine:", data.move);
            if (pendingEngineFenRef.current === currentFen) pendingEngineFenRef.current = null;
            return;
          }

          setGame(newGame);

          if (newGame.isGameOver()) {
            handleGameOver();
          }

          const newFen = newGame.fen();
          const currentMoveCount = newGame.history().length;
          const movesSinceLast = currentMoveCount - lastCoachMoveCount;

          if (movesSinceLast >= 10 && !isFetchingCommentaryRef.current) {
            isFetchingCommentaryRef.current = true;
            fetchCoachApi('/api/chat', {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session?.access_token}`
              },
              body: JSON.stringify({ 
                message: "Comenta brevemente la posicion actual.", 
                persona: activeCoach.id,
                interaction_mode: 'in_game',
                message_kind: 'auto_commentary',
                fen: newFen,
                pgn: newGame.pgn(),
                move_count: currentMoveCount,
                silent: true,
                user_color: userColor,
                turn: newGame.turn(),
                game_id: null,
                session_token: currentSessionToken
              })
            }, { retries: 2 }).then(r => r.json()).then(chatData => {
              isFetchingCommentaryRef.current = false;
              if (chatData.reply) {
                setChatHistories(prev => {
                  const history = prev[activeCoach.id] || [];
                  const lastMsg = history.length > 0 ? history[history.length - 1].text : null;
                  
                  if (chatData.reply === lastMsg) {
                    console.log("DEBUG: Frontend blocked duplicate SILENT message.");
                    return prev;
                  }

                  return {
                    ...prev,
                    [activeCoach.id]: [...history, { role: 'coach', text: chatData.reply }]
                  };
                });
                setLastCoachMoveCount(currentMoveCount);
              }
            }).catch(() => {
              isFetchingCommentaryRef.current = false;
            });
          }
        }
      } catch (err) {
        console.error(err);
        toast.error('Motor desconectado.');
      } finally {
        if (pendingEngineFenRef.current === currentFen) pendingEngineFenRef.current = null;
        setIsEngineThinking(false);
      }
    }, delay);
  }, [game, activeCoach, selectedTime, userColor, session, lastCoachMoveCount, currentSessionToken]);

  // AUTO-TRIGGER ENGINE MOVE
  useEffect(() => {
    if (isPlaying && !isEngineThinking && !isWarmingEngine && !game.isGameOver()) {
      const isUserTurn = game.turn() === userColor.charAt(0);
      if (!isUserTurn) {
        console.log("DEBUG: Auto-triggering AI move for turn:", game.turn());
        makeEngineMove();
      }
    }
  }, [isPlaying, isEngineThinking, isWarmingEngine, game, userColor, makeEngineMove, session]);

  const onDrop = (sourceSquare: string, targetSquare: string, piece: string) => {
    if (!isPlaying || isEngineThinking || isWarmingEngine || game.turn() !== userColor.charAt(0)) return false;
    
    const gameCopy = new Chess();
    gameCopy.loadPgn(game.pgn());
    const move = gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: piece[1].toLowerCase() ?? 'q' });
    
    if (move === null) return false;
    
    setGame(gameCopy);

    if (gameCopy.isGameOver()) {
      handleGameOver();
    } else {
      makeEngineMove(gameCopy);
    }
    return true;
  };

  const startGame = async () => {
    if (!selectedCoachId) return toast.error('Elige un oponente histórico primero');
    if (!isAuthenticated && !address) return toast.error('Inicia sesión para jugar.');
    
    if (!session && address) {
      // Safety: If we are stuck, maybe the user signed out previously. 
      const signoutRequested = localStorage.getItem('gamebet_signout_requested') === 'true';
      if (signoutRequested) {
        clearSignoutFlag();
        toast.info('Re-sincronizando tu wallet... intenta de nuevo en unos segundos.');
        return;
      }
      return toast.error('Vinculando tu wallet con el servidor... espera un momento.');
    }

    const wakeToast = toast.loading('Despertando motor del maestro...');
    setIsWarmingEngine(true);

    try {
      await ensureCoachApiAwake({ attempts: 8, delayMs: 5000 });
      toast.success('Motor listo.', { id: wakeToast });
    } catch (error) {
      console.error(error);
      toast.error('El motor tardó demasiado en responder. Intenta de nuevo en unos segundos.', { id: wakeToast });
      return;
    } finally {
      setIsWarmingEngine(false);
    }
    
    const newGame = new Chess();
    setGame(newGame);
    setWhiteTime(selectedTime * 60);
    setBlackTime(selectedTime * 60);
    setIsPlaying(true);
    setLastCoachMoveCount(0);
    
    const newToken = generateSessionToken();
    setCurrentSessionToken(newToken);
    setChatHistories(prev => ({ ...prev, [selectedCoachId]: [] }));
    setChatMessage('');
    triggerNotification({ type: 'mission', value: 'Duelo Iniciado', label: `Vs ${activeCoach?.name}` });
    toast.success(`Partida iniciada contra ${activeCoach?.name}`);

    if (userColor === 'b') {
      makeEngineMove(newGame);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black text-white pt-24 px-4 pb-12 overflow-hidden relative font-sans">
      <XPNotification />
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1529699211952-734e80c4d42b?q=80&w=2071&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03] pointer-events-none" />
      
      <div className="max-w-[1600px] mx-auto mb-6 flex items-center justify-between relative z-20">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/coach')}
          className="text-zinc-500 hover:text-white pl-0 transition-colors group flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="text-xs font-bold uppercase tracking-widest">Volver al Coach</span>
        </Button>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        {/* State 1: Active Loading or Syncing */}
        {(isLoading || isSyncing) ? (
          <div className="lg:col-span-12 flex flex-col items-center justify-center p-24 text-center">
            <Loader2 className="w-12 h-12 text-yellow-500 animate-spin mb-6" />
            <h2 className="text-2xl font-serif font-black text-white mb-2">Vinculando Perfil de Maestro</h2>
            <p className="text-zinc-500">Estamos preparando tu cuenta vinculada a tu wallet...</p>
          </div>
        ) : 
        /* State 2: Not Authenticated and No Wallet connected */
        (!isAuthenticated && !address) ? (
          <div className="lg:col-span-12">
            <LoginGate 
              onLoginClick={() => {
                setConnectMode('email-login');
                setShowConnectModal(true);
              }} 
              onSignupClick={() => {
                setConnectMode('email-signup');
                setShowConnectModal(true);
              }}
            />
          </div>
        ) : (
          /* State 3: Authenticated or Wallet Connected (Game View) */
          <>
            <div className="lg:col-span-4 space-y-6">
          {!isPlaying ? (
            <div className="space-y-6">
              {/* Main Config Card */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 blur-3xl rounded-full" />
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-yellow-500" /> Configuración del Duelo
                </h3>
                
                {/* Time Selection */}
                <div className="mb-8">
                  <p className="text-[10px] text-zinc-400 uppercase font-black tracking-[0.2em] mb-4">Ritmo de Juego</p>
                  <div className="flex flex-wrap gap-2">
                    {TIME_CONTROLS.map(t => (
                      <button
                        key={t}
                        onClick={() => setSelectedTime(t)}
                        className={`relative px-5 py-2.5 rounded-xl border text-xs font-black transition-all duration-300 ${
                          selectedTime === t 
                            ? 'bg-yellow-500 border-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)] scale-105' 
                            : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/30 hover:bg-white/10'
                        }`}
                      >
                        {t}m
                        {selectedTime === t && <motion.div layoutId="activeTime" className="absolute inset-0 rounded-xl border-2 border-white/20" />}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-zinc-400 uppercase font-black tracking-[0.2em] mb-4">Elegir Oponente</p>
                <div className="grid grid-cols-1 gap-3 mb-8">
                  {COACHES.map(coach => (
                    <button
                      key={coach.id}
                      onClick={() => setSelectedCoachId(coach.id)}
                      className={`group/btn flex items-center gap-4 p-3 rounded-2xl border transition-all duration-500 overflow-hidden ${
                        selectedCoachId === coach.id 
                          ? `bg-white/10 ${coach.border} shadow-lg shadow-black/40` 
                          : 'bg-black/20 border-white/5 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      <div className="relative">
                        <img 
                          src={`/coaches/${coach.id}_avatar.png`} 
                          className={`w-12 h-12 rounded-xl object-cover transition-transform duration-500 group-hover/btn:scale-110 ${selectedCoachId === coach.id ? 'ring-2 ring-yellow-500/50 ring-offset-2 ring-offset-black' : ''}`} 
                          onError={(e) => (e.currentTarget.src = '/coaches/general_avatar.png')}
                        />
                        {selectedCoachId === coach.id && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-black" />}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <h4 className={`text-sm font-black tracking-tight whitespace-nowrap overflow-hidden text-ellipsis ${selectedCoachId === coach.id ? coach.color : 'text-zinc-200'}`}>{coach.name}</h4>
                        <p className="text-[10px] text-zinc-500 font-medium truncate">{coach.desc}</p>
                      </div>
                      
                      <div className="flex flex-col gap-1 items-end">
                        <span 
                          onClick={(e) => { e.stopPropagation(); navigate(`/master-profile/${coach.id}`); }}
                          className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-[8px] font-black text-zinc-500 hover:text-yellow-500 transition-all uppercase tracking-widest cursor-pointer"
                        >
                          Perfil
                        </span>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${selectedCoachId === coach.id ? 'translate-x-1 text-yellow-500' : 'text-zinc-700'}`} />
                      </div>
                    </button>
                  ))}
                </div>

                {/* Color Selection */}
                <div className="mb-8">
                  <p className="text-[10px] text-zinc-400 uppercase font-black tracking-[0.2em] mb-4">Piezas</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setUserColor('w')}
                      className={`flex items-center justify-center gap-3 p-3 rounded-2xl border transition-all duration-300 ${
                        userColor === 'w' 
                          ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' 
                          : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                      }`}
                    >
                      <Crown className={`w-4 h-4 ${userColor === 'w' ? 'text-black' : 'text-white'}`} />
                      <span className="text-xs font-black uppercase">Blancas</span>
                    </button>
                    <button
                      onClick={() => setUserColor('b')}
                      className={`flex items-center justify-center gap-3 p-3 rounded-2xl border transition-all duration-300 ${
                        userColor === 'b' 
                          ? 'bg-zinc-800 text-white border-zinc-700 shadow-[0_0_20px_rgba(0,0,0,0.5)]' 
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                      }`}
                    >
                      <Crown className={`w-4 h-4 ${userColor === 'b' ? 'text-white' : 'text-zinc-500'}`} />
                      <span className="text-xs font-black uppercase">Negras</span>
                    </button>
                  </div>
                </div>

                {selectedCoachId && (
                  <Button 
                    onClick={startGame} 
                    disabled={isWarmingEngine}
                    className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black h-14 rounded-2xl shadow-[0_10px_30px_rgba(234,179,8,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100"
                  >
                    {isWarmingEngine ? 'DESPERTANDO MOTOR...' : `INICIAR DESAFÍO (${selectedTime} min)`}
                  </Button>
                )}
              </div>

              {/* Master Preview Panel */}
              {selectedCoachId && activeCoach && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={activeCoach.id}
                  className="bg-zinc-900/30 border border-white/5 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden"
                >
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 blur-3xl rounded-full" />
                  
                  <div className="flex items-center gap-3 mb-5">
                    <HistoryIcon className="w-5 h-5 text-zinc-400" />
                    <h3 className="text-xs font-black text-zinc-300 uppercase tracking-widest">Memoria Histórica</h3>
                  </div>

                  <p className="text-zinc-400 text-xs leading-relaxed mb-6 italic font-serif">
                    "{activeCoach.history}"
                  </p>

                  <div className="space-y-4 mb-6">
                    <div>
                      <h4 className="text-[10px] font-black text-yellow-500/50 uppercase mb-2 flex items-center gap-2">
                        <Brain className="w-3 h-3" /> Filosofía de Juego
                      </h4>
                      <p className="text-[11px] text-zinc-300 font-medium leading-relaxed">{activeCoach.style}</p>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black text-blue-500/50 uppercase mb-2 flex items-center gap-2">
                        <BookOpen className="w-3 h-3" /> Fundación Cognitiva (Libros)
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {activeCoach.books.map((book, idx) => (
                          <span key={idx} className="px-2 py-1 bg-white/5 border border-white/5 rounded-md text-[9px] text-zinc-400 font-mono">
                            {book}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {masterStats && (
                    <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl relative overflow-hidden group/wisdom">
                      <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Brain className="w-12 h-12 text-indigo-400" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl font-black text-white">{masterStats.historical_games_count?.toLocaleString()}</span>
                          <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Partidas Reales</span>
                        </div>
                        <p className="text-[9px] text-zinc-400 leading-tight">
                          Mi estilo está basado en mi historial real en vida, libros y legado.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl">
                    <p className="text-[10px] text-zinc-500 leading-tight">
                      <span className="text-yellow-500 font-black mr-1">TIPS:</span> 
                      {activeCoach.id === 'fischer' ? 'Evita simplificar si no has calculado hasta el final.' : 
                       activeCoach.id === 'tal' ? 'Mantén el rey seguro ante todo, sus sacrificios son venenosos.' :
                       'Juega con paciencia, la precisión es su arma principal.'}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Professional Chess Clocks */}
              <div className="grid grid-cols-2 gap-4">
                {/* User Clock (Always Left) */}
                <div className={`relative p-5 rounded-3xl border transition-all duration-700 overflow-hidden ${
                  game.turn() === userColor 
                    ? 'bg-white/10 border-white/30 shadow-[0_0_30px_rgba(255,255,255,0.1)] scale-[1.02]' 
                    : 'bg-zinc-900/40 border-white/5 opacity-60'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-zinc-800">
                        <img src={profile?.avatar_url || '/coaches/general_avatar.png'} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest leading-none truncate max-w-[80px]">Tú ({userColor === 'w' ? 'Blancas' : 'Negras'})</p>
                    </div>
                    {game.turn() === userColor && <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />}
                  </div>
                  <p className={`text-4xl font-mono font-black tracking-tighter ${(userColor === 'w' ? whiteTime : blackTime) < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {formatTime(userColor === 'w' ? whiteTime : blackTime)}
                  </p>
                  {game.turn() === userColor && <div className="absolute bottom-0 left-0 h-1 bg-white/20 w-full" />}
                </div>

                {/* AI Clock (Always Right) */}
                <div className={`relative p-5 rounded-3xl border transition-all duration-700 overflow-hidden ${
                  game.turn() !== userColor 
                    ? `bg-zinc-800/60 ${activeCoach?.border} shadow-[0_0_30px_rgba(234,179,8,0.1)] scale-[1.02]` 
                    : 'bg-zinc-900/40 border-white/5 opacity-60'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0">
                        <img src={`/coaches/${selectedCoachId}_avatar.png`} className="w-full h-full object-cover" onError={(e) => e.currentTarget.src = '/coaches/general_avatar.png'} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[10px] text-zinc-300 uppercase font-black tracking-widest leading-none truncate max-w-[100px]">{activeCoach?.name}</p>
                          <AnimatePresence>
                            {isEngineThinking && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                className="flex items-center justify-center w-6 h-6 bg-yellow-500/10 border border-yellow-500/20 rounded-full"
                                title="Pensando..."
                              >
                                <Brain className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <button 
                          onClick={() => navigate(`/master-profile/${selectedCoachId}`)}
                          className="text-[8px] text-zinc-600 hover:text-yellow-500 font-bold transition-colors uppercase tracking-widest text-left"
                        >
                          Ver Detalles
                        </button>
                      </div>
                    </div>
                    {game.turn() !== userColor && !isEngineThinking && <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="w-2 h-2 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)] mt-1" />}
                  </div>
                  <p className={`text-4xl font-mono font-black tracking-tighter ${(userColor === 'w' ? blackTime : whiteTime) < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {formatTime(userColor === 'w' ? blackTime : whiteTime)}
                  </p>
                  {game.turn() !== userColor && <div className="absolute bottom-0 left-0 h-1 bg-yellow-500/30 w-full" />}
                </div>
              </div>

              {/* Enhanced Chat Interface with Emoji/Emotions */}
              <div className="bg-zinc-900/40 border border-white/10 rounded-3xl flex flex-col h-[400px] overflow-hidden backdrop-blur-xl shadow-2xl">
                <div className="p-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-zinc-400" />
                      <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Consultoría Técnica</span>
                   </div>
                   <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[9px] text-zinc-500 font-bold uppercase">{selectedCoachId} online</span>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                  {currentChatHistory.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30">
                       <Brain className="w-8 h-8 mb-2" />
                       <p className="text-[10px] font-medium leading-relaxed uppercase tracking-tighter">Inicia una consulta técnica con {activeCoach?.name}. Él analizará tu posición actual basándose en su teoría.</p>
                    </div>
                  )}
                  {currentChatHistory.map((msg, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[88%] p-3 rounded-2xl text-[11px] leading-relaxed shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-yellow-500 text-black font-bold rounded-tr-none' 
                          : 'bg-white/10 text-zinc-200 border border-white/5 rounded-tl-none font-medium'
                      }`}>
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                  {isSendingChat && (
                    <div className="flex justify-start">
                       <div className="bg-white/5 border border-white/5 p-3 rounded-2xl rounded-tl-none flex gap-1">
                          <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" />
                       </div>
                    </div>
                  )}
                </div>
                
                {/* Emoji Popover / Toggle Bar */}
                <AnimatePresence>
                  {showEmojiPicker && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="px-4 py-2 border-t border-white/5 bg-black/80 backdrop-blur-md flex gap-2 overflow-x-auto no-scrollbar"
                    >
                      {['⚡', '🧠', '🔥', '😱', '😤', '👏', '🤔', '♔', '♕', '♖', '♗', '♘', '♙'].map(emoji => (
                        <button 
                          key={emoji} 
                          onClick={() => setChatMessage(prev => prev + emoji)}
                          className="text-sm hover:scale-125 transition-transform p-1 filter drop-shadow-md"
                        >
                          {emoji}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="p-4 bg-black/20 flex gap-2">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`p-2 rounded-xl border transition-all ${showEmojiPicker ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500' : 'bg-white/5 border-white/10 text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <Target className="w-4 h-4" />
                  </button>
                  <input 
                    value={chatMessage} 
                    onChange={e => setChatMessage(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-yellow-500/50 transition-colors" 
                    placeholder="Escribe tu consulta..." 
                  />
                  <Button size="icon" onClick={handleSendMessage} className="bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl shrink-0">
                    <Zap className="w-4 h-4 fill-current" />
                  </Button>
                </div>
              </div>

              {/* Move History Nexus */}
              <div className="bg-zinc-900/40 border border-white/10 rounded-3xl p-4 h-[200px] overflow-hidden">
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <HistoryIcon className="w-3 h-3" /> Historial de Movimientos ({game.history().length} m)
                </h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 overflow-y-auto h-[140px] text-[10px] font-mono text-zinc-400 scrollbar-none">
                  {game.history().reduce((acc: string[][], move, i) => {
                    if (i % 2 === 0) acc.push([move]);
                    else acc[acc.length - 1].push(move);
                    return acc;
                  }, []).map((pair, i) => (
                    <div key={i} className="grid grid-cols-6 gap-4 border-b border-white/5 py-2 group/move">
                      <span className="col-span-1 text-zinc-600 font-black text-[10px]">{i + 1}.</span>
                      <span className="col-span-2 text-zinc-100 font-medium text-xs">{pair[0]}</span>
                      <span className="col-span-2 text-zinc-400 font-medium text-xs">{pair[1] || ''}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                variant="ghost" 
                onClick={() => {
                   if (confirm('¿Seguro que quieres abandonar este duelo histórico?')) {
                      handleGameOver(game.turn() === 'w' ? '0-1' : '1-0');
                   }
                }} 
                className="w-full text-zinc-500 hover:text-red-400 hover:bg-red-400/10 border border-white/5 rounded-2xl text-xs font-bold transition-all"
              >
                ABANDONAR PARTIDA
              </Button>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 flex flex-col items-center">
          <div className="w-full max-w-[700px] space-y-6">
            {!isPlaying && selectedCoachId && activeCoach ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative aspect-square rounded-[40px] overflow-hidden border border-white/10 shadow-2xl group"
              >
                <img 
                  src={`/coaches/${selectedCoachId}_avatar.png`} 
                  className="w-full h-full object-cover transition-transform duration-[3000ms] group-hover:scale-105"
                  onError={(e) => (e.currentTarget.src = '/coaches/general_avatar.png')} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                <div className="absolute bottom-10 left-10 right-10">
                   <div className="flex items-center gap-3 mb-4">
                      <div className="h-px w-12 bg-yellow-500/50" />
                      <span className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.4em]">Preparado para el Duelo</span>
                   </div>
                   <h2 className="text-6xl font-serif font-black mb-4 tracking-tighter">{activeCoach.name.toUpperCase()}</h2>
                   <p className="text-zinc-400 text-lg italic leading-relaxed font-light line-clamp-2 max-w-xl">
                      "{activeCoach.history}"
                   </p>
                </div>
              </motion.div>
            ) : (
              <div className="relative group p-4 bg-zinc-900/20 rounded-[48px] border border-white/5 backdrop-blur-sm">
                <div className={`absolute -inset-8 bg-gradient-to-tr ${activeCoach ? activeCoach.color.replace('text-', 'from-').replace('-400', '-500/10') : 'from-yellow-500/10'} to-transparent blur-3xl opacity-30 pointer-events-none`} />
                <div className="relative w-full aspect-square border-[16px] border-zinc-900 rounded-[40px] overflow-hidden shadow-[0_60px_100px_-20px_rgba(0,0,0,0.8)] z-10 bg-zinc-800">
                  <div className="absolute inset-0 border border-white/10 rounded-[28px] pointer-events-none z-20" />
                  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <Chessboard 
                      position={game.fen()} 
                      onPieceDrop={onDrop} 
                      boardOrientation={userColor === 'w' ? 'white' : 'black'} 
                      animationDuration={300}
                      customDarkSquareStyle={{ backgroundColor: '#4b5563' }}
                      customLightSquareStyle={{ backgroundColor: '#e5e7eb' }}
                      customBoardStyle={{
                        borderRadius: '4px',
                        boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Quick Master Info Panel (Enabled during Play) */}
            {isPlaying && activeCoach && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <div>
                   <h4 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Brain className="w-3 h-3" /> Filosofía Táctica
                   </h4>
                   <p className="text-[11px] text-zinc-400 leading-relaxed italic">"{activeCoach.style}"</p>
                </div>
                <div>
                   <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <BookOpen className="w-3 h-3" /> Fundamentos de Memoria
                   </h4>
                   <p className="text-[11px] text-zinc-500 leading-relaxed font-mono">{activeCoach.books.join(' | ')}</p>
                </div>
              </motion.div>
            )}
            </div>
          </div>
        </>
      )}
    </div>

      {/* Neuro-Scientific Evaluation Modal */}
      <Dialog open={showEvalModal} onOpenChange={setShowEvalModal}>
        <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-5xl overflow-hidden p-0 rounded-[40px] shadow-[0_0_120px_rgba(0,0,0,0.9)] border-t-yellow-500/20">
          <div className="flex flex-col md:flex-row h-[85vh] md:h-[700px]">
            {/* LADO IZQUIERDO: Imagen "Cuerpo Completo" / Dossier */}
            <div className="md:w-1/3 relative overflow-hidden bg-zinc-900 flex flex-col justify-end p-8 border-r border-white/5">
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10" />
                <img 
                  src={`/coaches/${selectedCoachId}_avatar.png`} 
                  className="absolute inset-0 w-full h-full object-cover scale-110 opacity-60 grayscale-[0.5] group-hover:scale-100 transition-transform duration-1000" 
                />
                <div className="relative z-20">
                    <h3 className="text-4xl font-serif font-black tracking-tighter text-white mb-2">{activeCoach?.name.toUpperCase()}</h3>
                    <div className="flex items-center gap-2">
                        <div className="h-0.5 w-6 bg-yellow-500" />
                        <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Historical Mastery</span>
                    </div>
                </div>
            </div>

            {/* LADO DERECHO: Análisis y Reporte */}
            <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-white/10 flex flex-col">
              <div className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl p-8 border-b border-white/5 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-serif font-black tracking-tight mb-1">EL VERDICTO</h2>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">Reporte Psico-Técnico #GM-{Math.random().toString(36).slice(2, 6).toUpperCase()}</p>
                  </div>
                  <div className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-[10px] font-black text-yellow-500 uppercase tracking-widest">
                    Análisis {activeCoach?.desc}
                  </div>
              </div>

          <div className="p-8 space-y-8">
            {isEvaluating ? (
              <div className="py-20 flex flex-col items-center gap-6">
                <div className="relative">
                   <Loader2 className="w-16 h-16 animate-spin text-yellow-500/20" />
                   <Brain className="absolute inset-0 m-auto w-8 h-8 text-yellow-500 animate-pulse" />
                </div>
                <p className="text-sm text-zinc-400 font-serif italic text-center max-w-xs">
                   "Sincronizando con los patrones de pensamiento de {activeCoach?.name}... Decodificando intención táctica y fatiga cognitiva."
                </p>
              </div>
            ) : evaluation && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                {/* Score & Progression Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                   <div className="bg-white/5 border border-white/5 rounded-3xl p-6 text-center flex flex-col items-center justify-center relative overflow-hidden group">
                      <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2">Technical Mastery</p>
                      <div className="text-6xl font-black text-white leading-none">
                        {evaluation.rating}<span className="text-lg text-zinc-600">.0</span>
                      </div>
                      <div className="mt-3 flex gap-1">
                         {[...Array(10)].map((_, i) => (
                            <div key={i} className={`w-1 h-3 rounded-full ${i < evaluation.rating ? 'bg-yellow-500' : 'bg-zinc-800'}`} />
                         ))}
                      </div>
                   </div>

                   <div className="md:col-span-2 bg-zinc-900/50 border border-white/5 rounded-3xl p-6 flex flex-col justify-center">
                      <div className="flex justify-between items-center mb-4">
                         <div>
                            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Progression Nexus</p>
                            <h4 className="text-lg font-black text-white">NIVEL {evaluation.new_level} <span className="text-yellow-500/50 text-xs ml-2">ARCHIVED</span></h4>
                         </div>
                         <div className="text-right">
                            <span className="text-xs font-black text-green-400">+{evaluation.xp_earned} XP</span>
                         </div>
                      </div>
                      <div className="h-4 bg-zinc-800 rounded-full overflow-hidden border border-white/5 relative shadow-inner">
                         <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${(evaluation.xp_earned % 1000) / 10}%` }}
                           transition={{ duration: 1.5, delay: 0.5 }}
                           className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.4)]"
                         />
                      </div>
                   </div>
                </div>

                {/* Neuro & Review Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-6">
                      <div>
                        <h4 className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">
                           <Activity className="w-4 h-4 text-purple-500" /> Neuro-Biometric Markers
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                              <p className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Pressure Index</p>
                              <div className="flex items-baseline gap-2">
                                 <span className="text-2xl font-black text-zinc-200">{evaluation.neuro_metrics?.pressure || 'LOW'}</span>
                                 <span className="text-[9px] text-red-500/50 font-bold">ATM</span>
                              </div>
                           </div>
                           <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                              <p className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Cognitive Fatigue</p>
                              <div className="flex items-baseline gap-2">
                                 <span className="text-2xl font-black text-zinc-200">{evaluation.neuro_metrics?.fatigue || 'NOMINAL'}</span>
                                 <span className="text-[9px] text-blue-500/50 font-bold">Hz</span>
                              </div>
                           </div>
                        </div>
                      </div>

                      <div className="p-5 border border-blue-500/20 bg-blue-500/5 rounded-2xl group">
                         <h4 className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">
                            <Zap className="w-3 h-3 fill-current" /> Consulta de Continuidad
                         </h4>
                         <p className="text-[11px] text-zinc-400 leading-relaxed mb-4">
                            Mi memoria inmediata retiene este duelo. Regresa al tablero para profundizar en los errores tácticos mediante el sistema de consultoría.
                         </p>
                         <Button onClick={() => navigate('/coach')} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-black h-10 rounded-xl transition-all hover:scale-[1.02]">
                            RETORNAR AL LABORATORIO
                         </Button>
                      </div>
                   </div>

                   <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 relative">
                      <div className="absolute -top-3 -left-3">
                         <MessageSquare className="w-8 h-8 text-yellow-500/20 fill-current" />
                      </div>
                      <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Evaluación Crítica</h4>
                      <div className="text-xs text-zinc-300 leading-relaxed italic font-serif">
                         <span className="text-2xl text-yellow-500 font-serif leading-none mr-1">"</span>
                         {evaluation.review}
                         <span className="text-2xl text-yellow-500 font-serif leading-none ml-1">"</span>
                      </div>
                   </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </DialogContent>
      </Dialog>

      <ConnectModal 
        isOpen={showConnectModal} 
        onClose={() => setShowConnectModal(false)}
        initialMode={connectMode}
      />
    </div>
  );
}
