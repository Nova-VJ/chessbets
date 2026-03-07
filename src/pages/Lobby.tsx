import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, RefreshCw, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import GameCard from '@/components/GameCard';
import CreateGameModal from '@/components/CreateGameModal';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Game {
  id: string;
  creator: string;
  stake: number;
  currency: string;
  timeControl: string;
  status: 'waiting' | 'playing' | 'finished';
}

const Lobby = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const formatTimeControl = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const inc = seconds % 60;
    return inc > 0 ? `${mins}+${inc}` : `${mins}+0`;
  };

  const loadGames = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*, profiles!games_creator_id_fkey(display_name, wallet_address)')
        .in('status', ['waiting', 'playing'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const mappedGames: Game[] = (data || []).map((g: any) => ({
        id: g.id,
        creator: g.profiles?.display_name || g.profiles?.wallet_address?.slice(0, 6) + '...' + g.profiles?.wallet_address?.slice(-4) || 'Anónimo',
        stake: g.stake_amount,
        currency: g.currency || 'BNB',
        timeControl: formatTimeControl(g.time_control),
        status: g.status === 'waiting' ? 'waiting' : g.status === 'playing' ? 'playing' : 'finished',
      }));

      setGames(mappedGames);
    } catch (error) {
      console.error('Error loading games:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGames();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('lobby-games')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        () => {
          loadGames();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateGame = (stake: number, currency: string, timeControl: string) => {
    loadGames();
  };

  const handleJoinGame = async (gameId: string) => {
    if (!user) {
      toast.error('Debes iniciar sesión para unirte');
      return;
    }

    try {
      const { data: game, error: fetchError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (fetchError) throw fetchError;

      if (game.creator_id === user.id) {
        toast.error('No puedes unirte a tu propia partida');
        return;
      }

      const { error } = await supabase
        .from('games')
        .update({ 
          opponent_id: user.id, 
          status: 'playing',
          started_at: new Date().toISOString(),
          opponent_paid: true
        })
        .eq('id', gameId)
        .eq('status', 'waiting');

      if (error) throw error;

      // Deduct stake from opponent balance
      const currency = game.currency || 'BNB';
      const balanceField = currency === 'USDT' ? 'balance_usdt' : 'balance';
      
      const { data: profile } = await supabase
        .from('profiles')
        .select(balanceField)
        .eq('id', user.id)
        .single();

      if (profile) {
        const currentBal = (profile as any)[balanceField] || 0;
        if (currentBal < game.stake_amount) {
          toast.error(`Balance insuficiente de ${currency}`);
          return;
        }

        await supabase
          .from('profiles')
          .update({ [balanceField]: currentBal - game.stake_amount })
          .eq('id', user.id);

        await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'game_stake',
          amount: game.stake_amount,
          status: 'confirmed',
          currency: currency,
        });
      }

      toast.success('¡Te has unido a la partida!');
      navigate('/play');
    } catch (error: any) {
      console.error('Error joining game:', error);
      toast.error('Error al unirse a la partida');
    }
  };

  const filteredGames = games.filter(
    (game) =>
      game.creator.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.currency.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const waitingGames = filteredGames.filter((g) => g.status === 'waiting');
  const activeGames = filteredGames.filter((g) => g.status === 'playing');

  return (
    <div className="min-h-screen bg-background pb-24 pt-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <h1 className="text-xl font-serif font-bold">
            Lobby de <span className="gradient-text">Partidas</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Encuentra una partida o crea la tuya • BNB & USDT
          </p>
        </motion.div>

        {/* Search & Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2 mb-4"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-secondary border-border text-sm"
            />
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9">
            <Filter className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={loadGames}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </motion.div>

        {/* Create Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-4"
        >
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full btn-primary-glow bg-primary h-10"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear Partida
          </Button>
        </motion.div>

        {/* Waiting Games */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Disponibles ({waitingGames.length})
          </h2>
          {waitingGames.length > 0 ? (
            <div className="space-y-3">
              {waitingGames.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <GameCard {...game} onJoin={() => handleJoinGame(game.id)} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                {isLoading ? 'Cargando partidas...' : 'No hay partidas disponibles'}
              </p>
              {!isLoading && (
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  size="sm"
                  className="bg-primary"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear partida
                </Button>
              )}
            </div>
          )}
        </motion.section>

        {/* Active Games */}
        {activeGames.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              En Curso ({activeGames.length})
            </h2>
            <div className="space-y-3">
              {activeGames.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <GameCard {...game} onWatch={() => {}} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </main>

      <CreateGameModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreateGame={handleCreateGame}
      />

      <BottomNav />
    </div>
  );
};

export default Lobby;
