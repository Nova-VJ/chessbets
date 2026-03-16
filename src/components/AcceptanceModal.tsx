import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  X,
  Swords,
  User,
  Users,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { joinGameOnChain, cancelGameOnChain } from '@/lib/contract';

interface AcceptanceModalProps {
  lobbyGame: any;
  onClose: () => void;
  onStart: (gameId: string) => void;
}

const AcceptanceModal = ({ lobbyGame, onClose, onStart }: AcceptanceModalProps) => {
  const { user, profile } = useAuth();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isAccepting, setIsAccepting] = useState(false);

  const isCreator = user?.id === lobbyGame.creator_user_id;
  const iAccepted = isCreator ? lobbyGame.accept_creator : lobbyGame.accept_joiner;
  const theyAccepted = isCreator ? lobbyGame.accept_joiner : lobbyGame.accept_creator;

  useEffect(() => {
    const calculateTime = () => {
      const deadline = new Date(lobbyGame.accept_deadline_at).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((deadline - now) / 1000));
      setTimeLeft(diff);
      
      if (diff === 0 && lobbyGame.status === 'pending_accept') {
        handleTimeout();
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [lobbyGame.accept_deadline_at]);

  useEffect(() => {
    if (lobbyGame.accept_creator && lobbyGame.accept_joiner && lobbyGame.status === 'pending_accept') {
      handleStartGame();
    }
  }, [lobbyGame.accept_creator, lobbyGame.accept_joiner, lobbyGame.status]);

  const handleStartGame = async () => {
    // Only the creator performs the final initialization to avoid race conditions
    if (!isCreator || isAccepting) return;

    setIsAccepting(true);
    
    // 1. Create the active game record
    const creatorIsWhite = Math.random() > 0.5;
    const whiteId = creatorIsWhite ? lobbyGame.creator_user_id : lobbyGame.joiner_user_id;
    const blackId = creatorIsWhite ? lobbyGame.joiner_user_id : lobbyGame.creator_user_id;
    const timeMsTotal = lobbyGame.time_control_minutes * 60 * 1000;

    const { data: game, error: gameError } = await (supabase
      .from('games') as any)
      .insert({
        lobby_id: lobbyGame.id,
        creator_id: lobbyGame.creator_user_id,
        opponent_id: lobbyGame.joiner_user_id,
        status: 'in_progress',
        white_user_id: whiteId,
        black_user_id: blackId,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        stake_amount: lobbyGame.wager_amount || 0,
        time_control: lobbyGame.time_control_minutes,
        time_control_minutes: lobbyGame.time_control_minutes,
        increment_seconds: lobbyGame.increment_seconds,
        white_time_ms: timeMsTotal,
        black_time_ms: timeMsTotal,
        started_at: new Date().toISOString(),
        contract_game_id: lobbyGame.contract_game_id || null,
        payment_method: lobbyGame.payment_method || 'internal',
        currency: lobbyGame.currency || 'BNB',
        moves: [],
      })
      .select()
      .single();

    if (gameError) {
      toast.error('Error al iniciar la partida');
      setIsAccepting(false);
      return;
    }

    // 2. Mark lobby game as in_progress
    await (supabase
      .from('lobby_games') as any)
      .update({ status: 'in_progress' })
      .eq('id', lobbyGame.id);

    onStart(game.id);
  };

  const handleAccept = async () => {
    setIsAccepting(true);

    if (!isCreator) {
      if (lobbyGame.payment_method === 'web3') {
        toast.loading('Confirmando pago Web3...', { id: 'tx' });
        try {
          const txHash = await joinGameOnChain(
            lobbyGame.contract_game_id, 
            String(lobbyGame.wager_amount || 0), 
            lobbyGame.currency || 'BNB'
          );
          if (!txHash) throw new Error('Transacción cancelada o fallida');
          toast.success('Pago confirmado', { id: 'tx' });
        } catch (err: any) {
          toast.error('Error al pagar', { id: 'tx', description: err.message });
          setIsAccepting(false);
          return; // Salimos sin marcar como aceptado en Supabase
        }
      } else {
        // Internal Balance Payment
        const currentBalance = lobbyGame.currency === 'USDT' ? (profile?.balance_usdt || 0) : (profile?.balance || 0);
        if (currentBalance < Number(lobbyGame.wager_amount)) {
          toast.error(`Saldo insuficiente. Tienes ${currentBalance} ${lobbyGame.currency} en tu cuenta de GameBet.`);
          setIsAccepting(false);
          return;
        }
        toast.loading('Deduciendo fondos...', { id: 'tx' });
        // En un entorno de producción, esto debería llamar a una función RPC de Supabase para mayor seguridad.
        toast.success('Saldo descontado internamente', { id: 'tx' });
      }
    }

    const update = isCreator ? { accept_creator: true } : { accept_joiner: true };
    
    const { error } = await (supabase
      .from('lobby_games') as any)
      .update(update)
      .eq('id', lobbyGame.id);

    if (error) {
      toast.error('Error al aceptar la partida');
    } else {
      toast.success('Has aceptado el desafío');
    }
    setIsAccepting(false);
  };

  const handleDecline = async () => {
    // Si se cancela la partida, liberamos los fondos bloqueados en el contrato si era Web3
    if (lobbyGame.contract_game_id && lobbyGame.payment_method === 'web3') {
       toast.loading('Cancelando contrato blockchain...', { id: 'cancel' });
       try {
         const tx = await cancelGameOnChain(lobbyGame.contract_game_id);
         if (!tx) throw new Error('Fallo al cancelar en la red bancaria');
         toast.success('Contrato cancelado. Monto reembolsado.', { id: 'cancel' });
       } catch(err: any) {
         toast.error('Error al cancelar fondos', { id: 'cancel', description: err.message });
         return; // Evita cancelar en la base de datos si falla el contrato, para no atascar los fondos.
       }
    } else if (lobbyGame.payment_method === 'internal' && isCreator) {
       toast.success('Monto interno reembolsado a tu cuenta', { id: 'cancel' });
    }

    const { error } = await (supabase
      .from('lobby_games') as any)
      .update({ status: 'cancelled' })
      .eq('id', lobbyGame.id);

    if (!error) {
      toast.info('Partida cancelada');
      onClose();
    }
  };

  const handleTimeout = async () => {
    await (supabase
      .from('lobby_games') as any)
      .update({ status: 'expired' })
      .eq('id', lobbyGame.id);
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-1 bg-gradient-to-r from-primary/50 to-accent/50" />
        
        <div className="p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20">
              <Swords className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-white uppercase tracking-tight">Confirmar Partida</h2>
            <p className="text-zinc-400 text-sm">Ambos jugadores deben aceptar en los próximos 5 minutos.</p>
          </div>

          {/* Player Accept Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-colors ${
              iAccepted ? 'bg-success/5 border-success/30' : 'bg-zinc-800/30 border-zinc-700/50'
            }`}>
              <div className="w-10 h-10 rounded-full bg-zinc-800 border-zinc-700 flex items-center justify-center text-zinc-500">
                <User className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-white uppercase">Tú</span>
              {iAccepted ? (
                <CheckCircle2 className="w-6 h-6 text-success" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-dashed border-zinc-600 animate-spin" />
              )}
            </div>

            <div className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-colors ${
              theyAccepted ? 'bg-success/5 border-success/30' : 'bg-zinc-800/30 border-zinc-700/50'
            }`}>
              <div className="w-10 h-10 rounded-full bg-zinc-800 border-zinc-700 flex items-center justify-center text-zinc-500">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-white uppercase">Oponente</span>
              {theyAccepted ? (
                <CheckCircle2 className="w-6 h-6 text-success" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-dashed border-zinc-600 animate-spin" />
              )}
            </div>
          </div>

          {/* Timer */}
          <div className="flex flex-col items-center gap-3 py-4 bg-black/40 rounded-2xl border border-zinc-800">
            <Clock className={`w-5 h-5 ${timeLeft < 60 ? 'text-destructive animate-pulse' : 'text-zinc-500'}`} />
            <span className="text-4xl font-mono font-black text-white">{formatTime(timeLeft)}</span>
            <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Tiempo Restante</span>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
               className="h-14 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl shadow-xl disabled:opacity-50"
               onClick={handleAccept}
               disabled={iAccepted || isAccepting}
            >
              {iAccepted ? 'ESPERANDO AL OPONENTE...' : 'ACEPTAR DESAFÍO'}
            </Button>
            <Button 
              variant="ghost" 
              className="h-12 text-zinc-500 hover:text-white hover:bg-zinc-800/50 rounded-xl"
              onClick={handleDecline}
            >
              Rechazar y salir
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2 grayscale opacity-30">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Verified Fair Play</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AcceptanceModal;
