import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Trophy, Coins, TrendingUp, History, 
  ArrowUp, ArrowDown, Clock, ChevronRight, 
  Loader2, AlertCircle, RefreshCw, XCircle, 
  ExternalLink, AlertTriangle, Medal, Settings, 
  LogOut, Wallet, DollarSign, ShieldAlert, Gamepad2, MessageSquare, Eye
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
import SettingsModal from '@/components/SettingsModal';
import { supabase } from '@/integrations/supabase/client';
import { getGameCreatedEvents, getGameFromChain, cancelGameOnChain, GameState, getContractAddress } from '@/lib/contract';
import GamificationSection from '@/components/GamificationSection';
import XPNotification from '@/components/XPNotification';
import BottomNav from '@/components/BottomNav';
import ConnectModal from '@/components/ConnectModal';
import DepositModal from '@/components/DepositModal';
import WithdrawModal from '@/components/WithdrawModal';
import RankIcon from '@/components/RankIcon';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
  currency?: string;
}

interface StuckGame {
  id: string;
  stake: string;
  isToken: boolean;
  timestamp: string;
}

interface GameHistoryEntry {
  id: number;
  date: string;
  played_at?: string | null;
  opponent: string;
  opponent_id: string | null;
  result: string;
  rating?: number;
  opening?: string;
  acpl?: number;
  session_token?: string | null;
  pgn?: string;
}

interface HistorySessionSummary {
  session_key: string;
  session_token: string | null;
  kind: 'game' | 'conversation';
  title: string;
  coach_id: string;
  coach_name: string;
  game_id: number | null;
  date: string;
  played_at: string | null;
  result: string | null;
  opening: string | null;
  opening_family?: string | null;
  time_control?: number | null;
  messages_count: number;
  interaction_modes: string[];
  preview: string;
  has_messages: boolean;
}

interface HistorySessionMessage {
  id: number;
  role: 'user' | 'coach';
  text: string;
  interaction_mode: string;
  timestamp: string | null;
  move_count?: number | null;
}

interface HistorySessionDetail extends HistorySessionSummary {
  pgn: string | null;
  messages: HistorySessionMessage[];
}



const Profile = () => {
  const navigate = useNavigate();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const { user, profile, session, isLoading: isLoadingAuth, signOut, isAuthenticated, refreshProfile } = useAuth();
  const { isConnected: isWalletConnected, address, balance, disconnect: disconnectWallet, isBSC, switchToBSC, refreshBalance } = useWallet();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(profile?.display_name || '');
  const [newAvatar, setNewAvatar] = useState(profile?.avatar_url || '');

  // Recovery Center State
  const [isScanning, setIsScanning] = useState(false);
  const [stuckGames, setStuckGames] = useState<StuckGame[]>([]);
  const [isRecovering, setIsRecovering] = useState<string | null>(null);

  // Game History State
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);
  const [historySessions, setHistorySessions] = useState<HistorySessionSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [userProgress, setUserProgress] = useState({ level: 1, xp: 0, next_level_xp: 1000, rank: 'Principiante' });
  const [activeTab, setActiveTab] = useState<'stats' | 'gamification' | 'history'>('gamification');
  const [selectedHistorySession, setSelectedHistorySession] = useState<HistorySessionDetail | null>(null);
  const [isHistoryDetailOpen, setIsHistoryDetailOpen] = useState(false);
  const [isLoadingHistoryDetail, setIsLoadingHistoryDetail] = useState(false);

  const isConnected = isAuthenticated || isWalletConnected;
  
  const platformWalletStr = import.meta.env.VITE_PLATFORM_WALLET?.toLowerCase() || '';
  const isAdmin = true; // isWalletConnected && address?.toLowerCase() === platformWalletStr;

  useEffect(() => {
    if (user && profile && session?.access_token) {
      loadTransactions();
      loadHistory();
      loadProgress();
    }
  }, [user, profile, session?.access_token]);

  const loadProgress = async () => {
    if (!profile) return;
    // Progress is now derived from local profile data
    setUserProgress(prev => ({
      ...prev,
      level: Math.max(1, Math.floor((profile.games_played || 0) / 10) + 1),
      xp: ((profile.games_played || 0) * 50) + ((profile.games_won || 0) * 100),
      rank: (profile.rating || 1200) >= 2000 ? 'Maestro' : (profile.rating || 1200) >= 1600 ? 'Avanzado' : (profile.rating || 1200) >= 1200 ? 'Intermedio' : 'Principiante',
    }));
  };

  const loadHistory = async () => {
    if (!profile?.id) return;
    setIsLoadingHistory(true);
    try {
      const COACH_NAMES: Record<string, string> = {
        fischer: "Bobby Fischer", tal: "Mikhail Tal", capablanca: "Capablanca",
        carlsen: "Magnus Carlsen", kasparov: "Garry Kasparov", general: "Coach IA",
      };

      // Load game history
      const { data: games } = await supabase
        .from('coach_game_history')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // Load conversation sessions (grouped by session_token)
      const { data: convos } = await supabase
        .from('coach_conversations')
        .select('session_token, coach_id, content, role, interaction_mode, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(200);

      const sessions: HistorySessionSummary[] = [];

      // Add game sessions
      if (games) {
        for (const g of games) {
          sessions.push({
            session_key: g.id,
            session_token: g.session_token,
            kind: 'game',
            title: `Partida vs ${COACH_NAMES[g.coach_id] || g.coach_id}`,
            coach_id: g.coach_id,
            coach_name: COACH_NAMES[g.coach_id] || g.coach_id,
            game_id: null,
            date: g.created_at,
            played_at: g.created_at,
            result: g.result,
            opening: g.opening,
            time_control: g.time_control,
            messages_count: 0,
            interaction_modes: ['in_game'],
            preview: g.review || `Resultado: ${g.result || '?'}`,
            has_messages: false,
          });
        }
      }

      // Group conversations by session_token
      if (convos) {
        const sessionMap = new Map<string, typeof convos>();
        for (const c of convos) {
          const key = c.session_token;
          if (!sessionMap.has(key)) sessionMap.set(key, []);
          sessionMap.get(key)!.push(c);
        }
        for (const [token, msgs] of sessionMap) {
          // Skip if already covered by a game session
          if (sessions.some(s => s.session_token === token)) {
            const existing = sessions.find(s => s.session_token === token);
            if (existing) {
              existing.messages_count = msgs.length;
              existing.has_messages = true;
            }
            continue;
          }
          const first = msgs[msgs.length - 1]; // oldest
          const coachId = first.coach_id;
          sessions.push({
            session_key: `conv-${token}`,
            session_token: token,
            kind: 'conversation',
            title: `Consulta con ${COACH_NAMES[coachId] || coachId}`,
            coach_id: coachId,
            coach_name: COACH_NAMES[coachId] || coachId,
            game_id: null,
            date: first.created_at,
            played_at: first.created_at,
            result: null,
            opening: null,
            time_control: null,
            messages_count: msgs.length,
            interaction_modes: [...new Set(msgs.map(m => m.interaction_mode || 'coach_room'))],
            preview: msgs.find(m => m.role === 'coach')?.content?.slice(0, 100) || 'Sin mensajes',
            has_messages: true,
          });
        }
      }

      // Sort by date
      sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setHistorySessions(sessions);
      setGameHistory(games?.map((g: any, i: number) => ({
        id: i + 1,
        date: new Date(g.created_at).toLocaleDateString('es'),
        opponent: COACH_NAMES[g.coach_id] || g.coach_id,
        opponent_id: g.coach_id,
        result: g.result || '?',
        rating: g.rating || 0,
      })) || []);
    } catch (e) {
      console.error('Error loading history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const openHistorySession = async (sessionKey: string) => {
    if (!session?.access_token) return;
    setIsHistoryDetailOpen(true);
    setIsLoadingHistoryDetail(true);
    try {
      const res = await fetch(`${API_URL}/history/sessions/${encodeURIComponent(sessionKey)}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!res.ok) throw new Error('No se pudo cargar el detalle');
      const data = await res.json();
      setSelectedHistorySession(data);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar ese historial');
      setIsHistoryDetailOpen(false);
    } finally {
      setIsLoadingHistoryDetail(false);
    }
  };

  const scanForStuckGames = async () => {
    if (!isWalletConnected || !address) {
      toast.error("Conecta tu wallet para escanear el contrato");
      return;
    }
    
    setIsScanning(true);
    setStuckGames([]);
    
    try {
      toast.loading("Escaneando blockchain...", { id: 'scan' });
      const gameIds = await getGameCreatedEvents(address);
      
      const found: StuckGame[] = [];
      
      for (const gameId of gameIds) {
        const chainData = await getGameFromChain(gameId);
        // Only interested in Waiting games
        if (chainData && chainData.state === GameState.Waiting) {
          found.push({
            id: gameId,
            stake: (Number(chainData.stake) / 1e18).toString(),
            isToken: chainData.isToken,
            timestamp: new Date(Number(chainData.createdAt) * 1000).toLocaleString()
          });
        }
      }
      
      setStuckGames(found);
      if (found.length === 0) {
        toast.success("No se encontraron fondos bloqueados", { id: 'scan' });
      } else {
        toast.success(`Se encontraron ${found.length} partidas para recuperar`, { id: 'scan' });
      }
    } catch (err: any) {
      toast.error("Error al escanear: " + err.message, { id: 'scan' });
    } finally {
      setIsScanning(false);
    }
  };

  const handleRecoverFunds = async (gameId: string) => {
    setIsRecovering(gameId);
    try {
      // Step 1: Cancel the game on-chain (moves funds to playerBalances in contract)
      toast.loading("Paso 1/2: Cancelando partida en el contrato...", { id: 'recover' });
      const tx = await cancelGameOnChain(gameId);
      if (!tx) {
        throw new Error("La transacción de cancelación falló o fue rechazada");
      }
      toast.loading("Paso 2/2: Retirando fondos a tu wallet...", { id: 'recover' });

      // Step 2: Check if it's a token game to call the right withdraw
      const gameData = await getGameFromChain(gameId);
      
      // Import withdraw functions
      const { withdrawBalance } = await import('@/lib/contract');
      const withdrawTx = await withdrawBalance(gameData?.isToken ? 'USDT' : 'BNB');
      
      if (withdrawTx) {
        toast.success("¡Fondos recuperados y enviados a tu wallet!", { id: 'recover' });
      } else {
        // Withdraw failed but cancel succeeded - funds are in contract balance
        toast.success("Partida cancelada. Los fondos están en tu balance del contrato. Usa 'Retirar' para enviarlos a tu wallet.", { id: 'recover' });
      }
      
      setStuckGames(prev => prev.filter(g => g.id !== gameId));
      if (refreshBalance) refreshBalance();
    } catch (err: any) {
      toast.error("Error al recuperar: " + err.message, { id: 'recover' });
    } finally {
      setIsRecovering(null);
    }
  };

  const handleTestRestore = async () => {
    if (!user) return;
    try {
      const { data: currentProfile, error: fetchErr } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user.id)
        .single();
      
      if (fetchErr) throw fetchErr;

      const newBalance = (currentProfile?.balance || 0) + 0.001;

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', user.id);
      
      if (updateErr) throw updateErr;

      // Also clear pending withdrawals for this user just in case
      await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id)
        .eq('type', 'withdrawal')
        .eq('status', 'pending');

      toast.success('¡Saldo restaurado para pruebas!');
      refreshProfile();
      loadTransactions();
    } catch (err: any) {
      toast.error('Error al restaurar: ' + err.message);
    }
  };

  const loadTransactions = async () => {
    if (!user) return;
    setIsLoadingTx(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setTransactions(data);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoadingTx(false);
    }
  };

  const handleDisconnect = async () => {
    if (isWalletConnected) {
      disconnectWallet();
    }
    if (isAuthenticated) {
      await signOut();
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Hace unos minutos';
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffHours < 48) return 'Ayer';
    return date.toLocaleDateString('es');
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return 'Sin fecha';
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'Depósito';
      case 'withdrawal': return 'Retiro';
      case 'game_stake': return 'Apuesta';
      case 'game_win': return 'Premio';
      case 'game_refund': return 'Reembolso';
      default: return type;
    }
  };

  const hasAnyBalance = (profile?.balance || 0) > 0 || (profile?.balance_usdt || 0) > 0;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background pb-24 pt-20">
        <AppHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="glass-card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No conectado</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Conecta tu wallet o crea una cuenta para ver tu perfil
            </p>
            <Button onClick={() => setShowConnectModal(true)}>
              <Wallet className="w-4 h-4 mr-2" />
              Conectar
            </Button>
          </div>
        </main>
        <BottomNav />
        <ConnectModal isOpen={showConnectModal} onClose={() => setShowConnectModal(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 pt-20">
      <AppHeader />
      <XPNotification />

      <main className="container mx-auto px-4 py-4">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 mb-4"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-tr from-yellow-500/40 to-transparent blur-lg rounded-full animate-pulse" />
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-900 border-2 border-white/10 relative z-10 flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-zinc-500" />
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 z-20">
                <RankIcon rank={userProgress.rank} size="sm" className="shadow-lg border-2 border-black" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-black text-xl text-white uppercase tracking-tighter">
                  {profile?.display_name || 'Maestro Anónimo'}
                </p>
                <div className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded text-[8px] font-black text-yellow-500 uppercase tracking-widest">Lvl {userProgress.level}</div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{userProgress.rank}</p>
                <div className="w-1 h-1 bg-zinc-700 rounded-full" />
                {profile?.wallet_address && (
                  <p className="font-mono text-[10px] text-zinc-600">
                    {profile.wallet_address.slice(0, 6)}...{profile.wallet_address.slice(-4)}
                  </p>
                )}
              </div>
                  {/* High Impact Progress Trigger */}
                  <div 
                    onClick={() => setActiveTab('gamification')}
                    className="mt-3 p-3 bg-zinc-900/40 border border-white/5 rounded-2xl cursor-pointer hover:border-yellow-500/30 transition-all group"
                  >
                    <div className="flex justify-between items-center mb-1.5">
                       <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-yellow-500 transition-colors">
                          Progreso del Maestro
                       </span>
                       <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(userProgress.xp % 1000) / 10}%` }}
                        className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                      />
                    </div>
                  </div>
                </div>
          </div>

          {/* Deposit/Withdraw buttons */}
          <div className="flex gap-2 mt-4">
            <Button 
              className="flex-1 bg-success hover:bg-success/90"
              onClick={() => {
                if (!isConnected) {
                  toast.error("Conecta tu wallet primero", {
                    description: "Se requiere una wallet o cuenta para depositar"
                  });
                  return;
                }
                setShowDepositModal(true);
              }}
            >
              <ArrowDown className="w-4 h-4 mr-2" />
              Depositar
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl glass-card border-white/10 hover:bg-white/5"
              onClick={() => {
                if (!hasAnyBalance) {
                  toast.error("Saldo insuficiente", {
                    description: "No tienes saldo disponible para retirar."
                  });
                } else {
                  setShowWithdrawModal(true);
                }
              }}
            >
              <ArrowUp className="w-4 h-4 mr-2" />
              Retirar
            </Button>
          </div>
        </motion.div>
          
        {/* Navigation Tabs */}
        <div className="flex gap-1 p-1 bg-zinc-900/60 border border-white/10 rounded-2xl mb-6">
           {[
             { id: 'gamification', label: 'Centro de Progreso', icon: Medal },
             { id: 'stats', label: 'Estadísticas', icon: TrendingUp },
             { id: 'history', label: 'Historial', icon: History },
           ].map((tab) => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                 activeTab === tab.id 
                   ? 'bg-white/10 text-white shadow-lg' 
                   : 'text-zinc-500 hover:text-zinc-300'
               }`}
             >
               <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-primary' : ''}`} />
               {tab.label}
             </button>
           ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'gamification' && profile && (
              <GamificationSection userId={profile.id} />
            )}

            {activeTab === 'stats' && (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'Partidas', value: profile?.games_played?.toString() || '0', icon: History },
                    { label: 'Victorias', value: profile?.wins?.toString() || '0', icon: Trophy },
                    { label: 'Rating', value: profile?.rating?.toString() || '1200', icon: TrendingUp },
                    { label: 'Total Ganado', value: `${(profile?.total_won || 0).toFixed(2)}`, icon: Coins },
                  ].map((stat) => (
                    <div key={stat.label} className="glass-card p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <stat.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-lg font-bold">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Transactions */}
                <div className="glass-card overflow-hidden mb-4">
                  <div className="p-3 border-b border-border flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Transacciones</h2>
                    <Button variant="ghost" size="sm" onClick={loadTransactions} disabled={isLoadingTx}>
                      {isLoadingTx ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualizar'}
                    </Button>
                  </div>
                  {/* ... transaction items ... */}
                </div>
              </>
            )}

            {activeTab === 'history' && (
               <div className="glass-card overflow-hidden mb-4">
                  <div className="p-3 border-b border-border flex items-center justify-between">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <History className="w-4 h-4 text-primary" />
                      Historial de Partidas y Conversaciones
                    </h2>
                    <select 
                      className="bg-zinc-900 border border-white/10 text-xs rounded-md px-2 py-1 text-zinc-300 outline-none"
                      value={historyFilter}
                      onChange={(e) => setHistoryFilter(e.target.value)}
                    >
                      <option value="all">Todos los Oponentes</option>
                      <option value="general">Coach AI</option>
                      <option value="fischer">Bobby Fischer</option>
                      <option value="kasparov">Garry Kasparov</option>
                      <option value="tal">Mikhail Tal</option>
                      <option value="capablanca">Capablanca</option>
                      <option value="carlsen">Magnus Carlsen</option>
                    </select>
                  </div>
                  <div className="divide-y divide-border max-h-80 overflow-y-auto">
                    {isLoadingHistory ? (
                      <div className="p-8 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                        <p className="text-xs text-zinc-500 mt-2">Cargando historial...</p>
                      </div>
                    ) : historySessions.length === 0 ? (
                      <div className="p-8 text-center">
                        <History className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500">No hay partidas ni conversaciones registradas</p>
                      </div>
                    ) : (
                      historySessions
                        .filter(entry => historyFilter === 'all' || entry.coach_id === historyFilter)
                        .map((entry) => {
                          const game = entry as unknown as GameHistoryEntry & HistorySessionSummary;
                          return (
                          <div 
                            key={entry.session_key} 
                            className="p-3 hover:bg-white/5 transition-colors group"
                          >
                            <div className="flex items-center justify-between mb-1 gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-2 h-2 rounded-full ${
                                  entry.kind === 'conversation'
                                    ? 'bg-primary'
                                    : entry.result === '1-0'
                                      ? 'bg-success'
                                      : entry.result === '0-1'
                                        ? 'bg-destructive'
                                        : 'bg-zinc-500'
                                }`} />
                                <span className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">
                                  {entry.kind === 'game'
                                    ? `Partida #${entry.game_id} vs ${entry.coach_name}`
                                    : `Consulta con ${entry.coach_name}`}
                                </span>
                              </div>
                              <span className="text-[10px] text-zinc-500 shrink-0">
                                {formatDate(entry.played_at || entry.date)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[10px] text-zinc-500 flex items-center gap-2 flex-wrap">
                                <span className={`uppercase font-black px-1.5 py-0.5 rounded ${
                                  entry.kind === 'conversation'
                                    ? 'bg-primary/10 text-primary'
                                    : entry.result === '1-0'
                                      ? 'bg-success/10 text-success'
                                      : entry.result === '0-1'
                                        ? 'bg-destructive/10 text-destructive'
                                        : 'bg-zinc-800 text-zinc-500'
                                }`}>
                                  {entry.kind === 'conversation'
                                    ? 'Consulta'
                                    : entry.result === '1-0'
                                      ? 'Victoria'
                                      : entry.result === '0-1'
                                        ? 'Derrota'
                                        : 'Tablas'}
                                </span>
                                {game.opening && <span>• {game.opening}</span>}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[10px] shrink-0"
                                onClick={() => openHistorySession(entry.session_key)}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                Ver detalle
                              </Button>
                            </div>
                            {entry.preview && (
                              <p className="text-[11px] text-zinc-400 mt-2 line-clamp-2">{entry.preview}</p>
                            )}
                          </div>
                          );
                        })
                    )}
                  </div>
               </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Link Wallet */}
        {isAuthenticated && !profile?.wallet_address && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-card p-4 mb-4 bg-primary/5"
          >
            <div className="flex items-center gap-3 mb-3">
              <Wallet className="w-5 h-5 text-primary" />
              <p className="text-sm font-medium">Vincula tu wallet</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Conecta una wallet crypto para poder depositar y usar el smart contract
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowConnectModal(true)}>
              Vincular Wallet
            </Button>
          </motion.div>
        )}

        {/* Admin Section */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="mb-6 p-4 rounded-xl border-2 border-primary/40 bg-primary/10"
          >
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-primary">Panel de Administración</h3>
            </div>
            <Button 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              onClick={() => navigate('/admin/test-games')}
            >
              <Gamepad2 className="w-4 h-4 mr-2" />
              Probar Juegos Offline
            </Button>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => setShowSettingsModal(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Configuración
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={handleDisconnect}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>

        </motion.div>

        <Dialog open={isHistoryDetailOpen} onOpenChange={setIsHistoryDetailOpen}>
          <DialogContent className="sm:max-w-2xl bg-card border-border">
            <DialogHeader>
              <DialogTitle>{selectedHistorySession?.title || 'Historial'}</DialogTitle>
              <DialogDescription>
                {selectedHistorySession
                  ? `${formatDateTime(selectedHistorySession.played_at)}${selectedHistorySession.game_id ? ` · Partida #${selectedHistorySession.game_id}` : ''}`
                  : 'Cargando detalle del historial'}
              </DialogDescription>
            </DialogHeader>

            {isLoadingHistoryDetail ? (
              <div className="py-10 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                <p className="text-xs text-zinc-500 mt-2">Cargando detalle...</p>
              </div>
            ) : selectedHistorySession ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                  <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10">
                    {selectedHistorySession.kind === 'game' ? 'Partida guardada' : 'Consulta guardada'}
                  </span>
                  <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10">
                    Coach: {selectedHistorySession.coach_name}
                  </span>
                  {selectedHistorySession.result && (
                    <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10">
                      Resultado: {selectedHistorySession.result}
                    </span>
                  )}
                  {selectedHistorySession.opening && (
                    <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10">
                      Apertura: {selectedHistorySession.opening}
                    </span>
                  )}
                </div>

                <div className="border border-white/10 rounded-xl bg-zinc-950/40 max-h-[420px] overflow-y-auto">
                  {selectedHistorySession.messages.length === 0 ? (
                    <div className="p-6 text-center text-sm text-zinc-500">
                      No hubo mensajes guardados en esta sesión.
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      {selectedHistorySession.messages.map((message) => (
                        <div
                          key={message.id}
                          className={`rounded-2xl px-4 py-3 ${
                            message.role === 'user'
                              ? 'bg-yellow-500 text-black ml-auto max-w-[80%]'
                              : 'bg-zinc-900 text-white mr-auto max-w-[85%] border border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-2 text-[10px] uppercase tracking-widest opacity-70">
                            <span>{message.role === 'user' ? 'Tú' : selectedHistorySession.coach_name}</span>
                            <span>{formatDateTime(message.timestamp)}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                          <p className="text-[10px] mt-2 opacity-70">
                            Modo: {message.interaction_mode}
                            {typeof message.move_count === 'number' ? ` · Ply ${message.move_count}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </main>

      <BottomNav />
      <ConnectModal isOpen={showConnectModal} onClose={() => setShowConnectModal(false)} />
      <DepositModal isOpen={showDepositModal} onClose={() => setShowDepositModal(false)} />
      <WithdrawModal isOpen={showWithdrawModal} onClose={() => setShowWithdrawModal(false)} />
      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </div>
  );
};

export default Profile;
