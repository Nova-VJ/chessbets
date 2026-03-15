import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Users, Zap, Clock, Coins, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CurrencyType } from '@/lib/tokens';

const Matchmaking = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [stakeAmount, setStakeAmount] = useState([0.05]);
  const [timeControl, setTimeControl] = useState('10');
  const [currency, setCurrency] = useState<CurrencyType>('BNB');
  const [playersInQueue, setPlayersInQueue] = useState(0);
  const [foundMatch, setFoundMatch] = useState<any>(null);
  const [queueEntryId, setQueueEntryId] = useState<string | null>(null);

  const timeControls = [
    { value: '5', label: 'Blitz', description: '5 min' },
    { value: '10', label: 'Rápido', description: '10 min' },
    { value: '15', label: 'Rápido', description: '15 min' },
    { value: '30', label: 'Clásica', description: '30 min' },
    { value: '60', label: 'Larga', description: '1 hora' },
  ];

  const getTimeControlSeconds = (tc: string): number => {
    return parseInt(tc) * 60;
  };

  // Listen for matches in realtime
  useEffect(() => {
    if (!isSearching || !queueEntryId) return;

    const channel = supabase
      .channel('matchmaking')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matchmaking_queue',
          filter: `id=eq.${queueEntryId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status === 'matched' && updated.game_id) {
            setFoundMatch({
              gameId: updated.game_id,
              stake: stakeAmount[0],
              currency,
            });
            setIsSearching(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSearching, queueEntryId]);

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isSearching) {
      interval = setInterval(() => {
        setSearchTime(prev => prev + 1);
        // Check queue count
        checkQueueCount();
        // Try to find match
        tryMatchmaking();
      }, 2000);
    }

    return () => clearInterval(interval);
  }, [isSearching, searchTime]);

  const checkQueueCount = async () => {
    const { count } = await supabase
      .from('matchmaking_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'searching');
    setPlayersInQueue(count || 0);
  };

  const tryMatchmaking = async () => {
    if (!user || !queueEntryId) return;

    // Look for a matching player
    const tcSeconds = getTimeControlSeconds(timeControl);
    const { data: matches } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('status', 'searching')
      .eq('currency', currency)
      .eq('time_control', tcSeconds)
      .gte('stake_amount', stakeAmount[0] * 0.8)
      .lte('stake_amount', stakeAmount[0] * 1.2)
      .neq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1);

    if (matches && matches.length > 0) {
      const match = matches[0];
      
      // Create game
      const avgStake = (stakeAmount[0] + match.stake_amount) / 2;
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          creator_id: user.id,
          opponent_id: match.user_id,
          stake_amount: avgStake,
          time_control: tcSeconds,
          status: 'playing',
          started_at: new Date().toISOString(),
          creator_paid: true,
          opponent_paid: true,
          currency: currency,
        })
        .select()
        .single();

      if (gameError) return;

      // Update both queue entries
      await supabase
        .from('matchmaking_queue')
        .update({ status: 'matched', matched_at: new Date().toISOString(), game_id: game.id })
        .in('id', [queueEntryId, match.id]);

      setFoundMatch({
        gameId: game.id,
        opponentId: match.user_id,
        stake: avgStake,
        currency,
      });
      setIsSearching(false);
    }
  };

  const startSearching = async () => {
    const effectiveUser = user ?? session?.user;
    if (!effectiveUser) {
      toast.error('Debes iniciar sesión o conectar tu wallet');
      return;
    }

    const currentBalance = currency === 'USDT' ? (profile?.balance_usdt || 0) : (profile?.balance || 0);
    if (stakeAmount[0] > currentBalance) {
      toast.error(`Balance insuficiente de ${currency}`);
      return;
    }

    setSearchTime(0);
    setFoundMatch(null);

    // Insert into queue
    const tcSeconds = getTimeControlSeconds(timeControl);
    const { data, error } = await supabase
      .from('matchmaking_queue')
      .insert({
        user_id: user.id,
        stake_amount: stakeAmount[0],
        currency,
        time_control: tcSeconds,
        rating: profile?.rating || 1200,
        status: 'searching',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Already in queue, update
        const { data: updated } = await supabase
          .from('matchmaking_queue')
          .update({
            stake_amount: stakeAmount[0],
            currency,
            time_control: tcSeconds,
            status: 'searching',
            joined_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('status', 'searching')
          .select()
          .single();
        if (updated) setQueueEntryId(updated.id);
      } else {
        toast.error('Error al buscar partida');
        return;
      }
    } else if (data) {
      setQueueEntryId(data.id);
    }

    setIsSearching(true);
    toast.info('Buscando oponente...');
  };

  const cancelSearch = async () => {
    setIsSearching(false);
    setSearchTime(0);
    
    if (queueEntryId) {
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('id', queueEntryId);
      setQueueEntryId(null);
    }
    
    toast.info('Búsqueda cancelada');
  };

  const acceptMatch = () => {
    toast.success('¡Partida aceptada!');
    navigate('/play');
  };

  const declineMatch = async () => {
    setFoundMatch(null);
    if (queueEntryId) {
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('id', queueEntryId);
    }
    toast.info('Partida rechazada');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background pb-24 pt-20">
      <AppHeader />

      <main className="container mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="text-2xl font-serif font-bold mb-2">
            <span className="gradient-text">Matchmaking</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Encuentra oponentes de tu nivel • BNB & USDT
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {foundMatch ? (
            <motion.div
              key="match-found"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card p-6 text-center mb-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4"
              >
                <Users className="w-10 h-10 text-success" />
              </motion.div>
              <h2 className="text-xl font-serif font-bold mb-2 text-success">
                ¡Oponente Encontrado!
              </h2>
              <div className="glass-card p-4 mb-4">
                <p className="text-muted-foreground text-sm">
                  Apuesta: {foundMatch.stake} {foundMatch.currency}
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={declineMatch}>
                  <X className="w-4 h-4 mr-2" />
                  Rechazar
                </Button>
                <Button className="bg-success hover:bg-success/90" onClick={acceptMatch}>
                  <Zap className="w-4 h-4 mr-2" />
                  Aceptar
                </Button>
              </div>
            </motion.div>
          ) : isSearching ? (
            <motion.div
              key="searching"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card p-8 text-center mb-6"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-20 h-20 rounded-full border-4 border-primary/30 border-t-primary flex items-center justify-center mx-auto mb-4"
              >
                <Loader2 className="w-8 h-8 text-primary animate-pulse" />
              </motion.div>
              <h2 className="text-xl font-serif font-bold mb-2">
                Buscando oponente...
              </h2>
              <p className="text-3xl font-mono text-primary mb-2">
                {formatTime(searchTime)}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {playersInQueue} jugadores en cola
              </p>
              <div className="flex gap-2 justify-center text-xs text-muted-foreground mb-6">
                <span className="px-2 py-1 rounded bg-secondary">{stakeAmount[0]} {currency}</span>
                <span className="px-2 py-1 rounded bg-secondary">{timeControl}</span>
              </div>
              <Button variant="outline" onClick={cancelSearch}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="config"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Currency Selection */}
              <div className="glass-card p-5 mb-4">
                <h3 className="font-semibold mb-3">Moneda</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={currency === 'BNB' ? 'default' : 'outline'}
                    onClick={() => setCurrency('BNB')}
                    className="h-auto py-3"
                  >
                    <div className="text-center">
                      <p className="font-bold">BNB</p>
                      <p className="text-[10px] opacity-70">
                        Balance: {(profile?.balance || 0).toFixed(4)}
                      </p>
                    </div>
                  </Button>
                  <Button
                    variant={currency === 'USDT' ? 'default' : 'outline'}
                    onClick={() => setCurrency('USDT')}
                    className="h-auto py-3"
                  >
                    <div className="text-center">
                      <p className="font-bold">USDT</p>
                      <p className="text-[10px] opacity-70">
                        Balance: {(profile?.balance_usdt || 0).toFixed(2)}
                      </p>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Stake Selection */}
              <div className="glass-card p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Coins className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Apuesta</h3>
                </div>
                <div className="mb-4">
                  <Slider
                    value={stakeAmount}
                    onValueChange={setStakeAmount}
                    min={currency === 'USDT' ? 1 : 0.01}
                    max={currency === 'USDT' ? 100 : 1}
                    step={currency === 'USDT' ? 1 : 0.01}
                    className="mb-2"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{currency === 'USDT' ? '1' : '0.01'} {currency}</span>
                    <span className="text-primary font-semibold">
                      {stakeAmount[0].toFixed(currency === 'USDT' ? 0 : 2)} {currency}
                    </span>
                    <span>{currency === 'USDT' ? '100' : '1.00'} {currency}</span>
                  </div>
                </div>
              </div>

              {/* Time Control */}
              <div className="glass-card p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Control de Tiempo</h3>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {timeControls.map((tc) => (
                    <button
                      key={tc.value}
                      onClick={() => setTimeControl(tc.value)}
                      className={`p-3 rounded-xl text-center transition-all ${
                        timeControl === tc.value
                          ? 'bg-primary text-primary-foreground scale-105'
                          : 'bg-secondary hover:bg-secondary/80'
                      }`}
                    >
                      <p className="text-xs font-medium">{tc.label}</p>
                      <p className={`text-[10px] ${timeControl === tc.value ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {tc.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Play Button */}
              <Button
                size="lg"
                className="w-full btn-primary-glow bg-primary text-lg py-6"
                onClick={startSearching}
              >
                <Zap className="w-5 h-5 mr-2" />
                Buscar Partida ({currency})
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Queue Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 grid grid-cols-3 gap-3"
        >
          {[
            { label: 'En Cola', value: playersInQueue.toString() },
            { label: 'Tiempo', value: timeControl },
            { label: 'Moneda', value: currency },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-3 text-center">
              <p className="text-lg font-bold text-primary">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Matchmaking;
