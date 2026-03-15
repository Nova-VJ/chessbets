import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Users, 
  Trophy, 
  Clock, 
  Filter, 
  ChevronRight,
  Globe,
  Zap,
  Swords,
  Coins
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { cancelGameOnChain } from '@/lib/contract';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import AcceptanceModal from '@/components/AcceptanceModal';

interface LobbyGame {
  id: string;
  creator_user_id: string;
  creator: {
    display_name: string;
    avatar_url: string;
    country_code: string;
    rating_blitz: number;
    rating_rapid: number;
    rating_bullet: number;
    games_played: number;
  };
  time_control_minutes: number;
  increment_seconds: number;
  mode: 'bullet' | 'blitz' | 'rapid' | 'custom';
  status: 'waiting' | 'pending_accept';
  wager_amount: number;
  currency: string;
  contract_game_id: string;
  payment_method: 'web3' | 'internal';
}

const Lobby = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [activeHandshakeGame, setActiveHandshakeGame] = useState<any>(null);
  const [filterMode, setFilterMode] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const cancelledGameIdsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchGames();
    checkActiveHandshake();
    
    // Subscribe to lobby updates
    const channel = supabase
      .channel('lobby-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'lobby_games',
        filter: user ? `creator_user_id=eq.${user.id}` : undefined
      }, (payload) => {
        fetchGames();
        handleLobbyChange(payload);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lobby_games',
        filter: user ? `joiner_user_id=eq.${user.id}` : undefined
      }, (payload) => {
        fetchGames();
        handleLobbyChange(payload);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'lobby_games',
        filter: 'status=eq.waiting'
      }, () => {
        fetchGames();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleLobbyChange = (payload: any) => {
    const game = payload.new;
    if (game.status === 'pending_accept') {
      setActiveHandshakeGame(game);
    } else if (game.status === 'in_progress') {
      navigate(`/play/${game.id}`);
    } else if (game.status === 'cancelled' || game.status === 'expired') {
      setActiveHandshakeGame(null);
      // Also remove from visible list
      setGames(prev => prev.filter(g => g.id !== game.id));
    }
  };

  const checkActiveHandshake = async () => {
    if (!user) return;
    const { data } = await (supabase
      .from('lobby_games') as any)
      .select('*')
      .or(`creator_user_id.eq.${user.id},joiner_user_id.eq.${user.id}`)
      .eq('status', 'pending_accept')
      .maybeSingle();
    
    if (data) {
      setActiveHandshakeGame(data);
    }
  };

  const fetchGames = async () => {
    setIsLoading(true);
    const { data, error } = await (supabase
      .from('lobby_games') as any)
      .select(`
        *,
        creator:profiles!creator_user_id (
          display_name,
          avatar_url,
          country_code,
          rating_blitz,
          rating_rapid,
          rating_bullet,
          games_played
        )
      `)
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching games:', error);
      toast.error('Error al cargar partidas', { 
        description: error.message 
      });
    } else {
      // Filter out any games that were just cancelled locally (prevents race condition)
      const filtered = (data as any[]).filter(
        (g: any) => !cancelledGameIdsRef.current.has(g.id)
      );
      setGames(filtered as any);
    }
    setIsLoading(false);
  };

  const handleJoin = async (gameId: string) => {
    if (!user) {
      toast.error('Debes iniciar sesión para jugar');
      return;
    }

    const { error } = await (supabase
      .from('lobby_games') as any)
      .update({
        joiner_user_id: user.id,
        status: 'pending_accept',
        accept_deadline_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        joiner_rating_snapshot: profile?.rating_blitz || 1200,
        joiner_games_played_snapshot: profile?.games_played || 0
      })
      .eq('id', gameId);

    if (error) {
      toast.error('No se pudo unir a la partida');
    } else {
      toast.success('Solicitud enviada. Esperando confirmación...');
    }
  };

  const handleCancelGame = async (game: LobbyGame) => {
    setIsCancelling(true);
    
    // Immediately remove from UI
    cancelledGameIdsRef.current.add(game.id);
    setGames(prev => prev.filter(g => g.id !== game.id));
    
    try {
      // 1. Handle refund based on payment method
      if (game.contract_game_id && game.payment_method === 'web3') {
        // Web3: Cancel on blockchain (contract refunds to playerBalances mapping)
        toast.loading('Cancelando en blockchain y reembolsando...', { id: 'cancel' });
        const tx = await cancelGameOnChain(game.contract_game_id);
        if (!tx) throw new Error('Fallo al cancelar en la red blockchain');
        toast.success('Contrato cancelado. Fondos devueltos a tu balance en el contrato. Usa "Retirar" en tu perfil para enviarlos a tu wallet.', { id: 'cancel' });
      } else if (game.payment_method === 'internal' || !game.contract_game_id) {
        // Internal: Refund to profile balance in Supabase
        toast.loading('Reembolsando saldo...', { id: 'cancel' });
        const balanceField = game.currency === 'USDT' ? 'balance_usdt' : 'balance';
        const currentBalance = game.currency === 'USDT' ? (profile?.balance_usdt || 0) : (profile?.balance || 0);
        const newBalance = currentBalance + game.wager_amount;

        const { error: refundError } = await supabase
          .from('profiles')
          .update({ [balanceField]: newBalance })
          .eq('id', user!.id);

        if (refundError) {
          throw new Error('Error al reembolsar: ' + refundError.message);
        }
        toast.success(`Reembolsado ${game.wager_amount} ${game.currency} a tu cuenta GameBet.`, { id: 'cancel' });
      }

      // 2. Update game status in DB
      const { error } = await supabase
        .from('lobby_games')
        .update({ status: 'cancelled' })
        .eq('id', game.id);

      if (error) throw error;

      // 3. Refresh profile to reflect updated balance
      await refreshProfile();
      
      toast.info('Partida cancelada correctamente.');
      
      // Clear from cancelled ref after a delay (DB should be consistent by then)
      setTimeout(() => {
        cancelledGameIdsRef.current.delete(game.id);
      }, 5000);
    } catch (error: any) {
      // Restore the game in the UI if cancel failed
      cancelledGameIdsRef.current.delete(game.id);
      toast.error('Error al cancelar', { id: 'cancel', description: error.message });
      fetchGames(); // Re-fetch to restore
    } finally {
      setIsCancelling(false);
    }
  };

  const filteredGames = games.filter(game => {
    const matchesMode = filterMode === 'all' || game.mode === filterMode;
    const matchesSearch = game.creator?.display_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMode && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300">
      <Header />

      <main className="container mx-auto px-4 pt-24 pb-12 max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar / Filters */}
          <div className="w-full lg:w-72 space-y-6">
            <div className="glass-card p-6 border-zinc-800/50 bg-zinc-900/20 space-y-6">
              <div className="space-y-2">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Filtrar por</h2>
                <Tabs value={filterMode} onValueChange={setFilterMode} className="w-full">
                  <TabsList className="grid grid-cols-2 bg-black/40 border border-zinc-800 p-1 h-auto">
                    <TabsTrigger value="all" className="text-xs py-2 data-[state=active]:bg-primary">Todas</TabsTrigger>
                    <TabsTrigger value="bullet" className="text-xs py-2">Bullet</TabsTrigger>
                    <TabsTrigger value="blitz" className="text-xs py-2">Blitz</TabsTrigger>
                    <TabsTrigger value="rapid" className="text-xs py-2">Rapid</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input 
                  placeholder="Buscar jugador..." 
                  className="bg-black/40 border-zinc-800 pl-10 focus:ring-primary"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="pt-4 border-t border-zinc-800">
                <Button 
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold gap-2 shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]"
                  onClick={() => navigate('/create-game')}
                >
                  <Plus className="w-5 h-5" />
                  CREAR PARTIDA
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="glass-card p-6 border-zinc-800/50 bg-zinc-900/20">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">Plataforma</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 text-zinc-400">
                    <Users className="w-4 h-4 text-primary" /> En línea
                  </span>
                  <span className="font-mono text-white">1,204</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 text-zinc-400">
                    <Zap className="w-4 h-4 text-yellow-500" /> Partidas hoy
                  </span>
                  <span className="font-mono text-white">452</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Lobby Area */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-serif font-bold text-white flex items-center gap-3">
                <Swords className="w-7 h-7 text-primary" />
                Partidas Disponibles
              </h1>
              <div className="flex gap-2 text-[10px] uppercase font-bold text-zinc-500">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-success animate-pulse" /> Tiempo Real</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  Array(6).fill(0).map((_, i) => (
                    <div key={i} className="h-44 bg-zinc-900/50 rounded-xl border border-zinc-800 animate-pulse" />
                  ))
                ) : filteredGames.length > 0 ? (
                  filteredGames.map((game) => (
                    <motion.div
                      layout
                      key={game.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="glass-card group hover:border-primary/40 transition-all duration-300 bg-zinc-900/40 overflow-hidden"
                    >
                      <div className="p-5 flex flex-col h-full justify-between gap-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
                                {game.creator.avatar_url ? (
                                  <img src={game.creator.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Users className="w-6 h-6 text-zinc-600" />
                                )}
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center overflow-hidden">
                                {game.creator.country_code ? (
                                  <img src={`https://flagcdn.com/w20/${game.creator.country_code.toLowerCase()}.png`} className="w-3 h-3 scale-150" alt="" />
                                ) : (
                                  <Globe className="w-2 h-2 text-zinc-500" />
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-white font-bold text-sm flex items-center gap-1 group-hover:text-primary transition-colors">
                                {game.creator.display_name}
                                <span className="text-[10px] text-zinc-500 font-mono">({game.creator.rating_blitz})</span>
                              </div>
                              <div className="text-[10px] text-zinc-500 uppercase tracking-tighter">
                                {game.creator.games_played} partidas jugadas
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className="px-3 py-1 bg-black/40 rounded-full border border-zinc-800 flex items-center gap-2">
                               <Clock className="w-3 h-3 text-primary" />
                               <span className="text-xs font-mono text-zinc-300">
                                 {game.time_control_minutes}+{game.increment_seconds}
                               </span>
                            </div>
                            <div className={`px-3 py-1 bg-black/40 rounded-full border border-zinc-800 flex items-center gap-2 ${game.currency === 'USDT' ? 'text-green-500' : 'text-yellow-500'}`}>
                               <Coins className="w-3 h-3" />
                               <span className="text-xs font-mono font-bold">
                                 {game.wager_amount} {game.currency}
                               </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            game.mode === 'bullet' ? 'bg-orange-500/10 text-orange-500' :
                            game.mode === 'blitz' ? 'bg-yellow-500/10 text-yellow-500' :
                            'bg-green-500/10 text-green-500'
                          }`}>
                            {game.mode}
                          </div>
                          <div className="flex-1 h-px bg-zinc-800" />
                        </div>

                        {game.creator_user_id === user?.id ? (
                          <Button 
                            variant="outline"
                            className="w-full border-destructive/30 text-destructive hover:bg-destructive hover:text-white font-bold h-10 transition-all"
                            onClick={() => handleCancelGame(game)}
                            disabled={isCancelling}
                          >
                            {isCancelling ? 'CANCELANDO...' : 'CANCELAR PARTIDA'}
                          </Button>
                        ) : (
                          <Button 
                            className="w-full bg-zinc-100 hover:bg-white text-black font-bold h-10 group-hover:bg-primary group-hover:text-white transition-all"
                            onClick={() => handleJoin(game.id)}
                          >
                            UNIRME
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto text-zinc-700">
                      <Swords className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold">No hay partidas disponibles</h3>
                      <p className="text-sm text-zinc-500">¿Por qué no creas tú la primera?</p>
                    </div>
                    <Button variant="outline" className="border-zinc-800 text-zinc-400" onClick={() => navigate('/create-game')}>
                      <Plus className="w-4 h-4 mr-2" /> Crear partida
                    </Button>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {activeHandshakeGame && (
          <AcceptanceModal 
            lobbyGame={activeHandshakeGame} 
            onClose={() => setActiveHandshakeGame(null)}
            onStart={(id) => navigate(`/play/${id}`)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Lobby;
