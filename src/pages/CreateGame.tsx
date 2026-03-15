import { useState } from 'react';
import { motion } from 'framer-motion';
import ContractVersionBanner from '@/components/ContractVersionBanner';
import { useContractVersion } from '@/hooks/useContractVersion';
import { 
  Zap, 
  Timer, 
  Target, 
  Clock, 
  Plus,
  ArrowLeft,
  ChevronRight,
  Shield,
  Trophy,
  Coins,
  Wallet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { createGameOnChain, cancelGameOnChain } from '@/lib/contract';
import { CurrencyType } from '@/lib/tokens';

const PRESETS = [
  { label: '1 min', mins: 1, inc: 0, mode: 'bullet', icon: <Zap className="w-4 h-4" /> },
  { label: '3 min', mins: 3, inc: 0, mode: 'blitz', icon: <Timer className="w-4 h-4" /> },
  { label: '5 min', mins: 5, inc: 0, mode: 'blitz', icon: <Clock className="w-4 h-4" /> },
  { label: '10 min', mins: 10, inc: 0, mode: 'rapid', icon: <Target className="w-4 h-4" /> },
];

const CreateGame = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[1]);
  const [customMins, setCustomMins] = useState(5);
  const [customInc, setCustomInc] = useState(0);
  const [wager, setWager] = useState('0.00001');
  const [currency, setCurrency] = useState<CurrencyType>('BNB');
  const [paymentMethod, setPaymentMethod] = useState<'web3' | 'internal'>('web3');
  const [isCreating, setIsCreating] = useState(false);
  const { isV2, supportsUSDT } = useContractVersion();

  const handleCreate = async () => {
    if (!user) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('Debes iniciar sesión o conectar tu wallet');
        return;
      }
    }

    const minWager = paymentMethod === 'web3'
      ? (currency === 'USDT' ? 0.1 : 0.00001)
      : (currency === 'USDT' ? 0.01 : 0.00001);
    const maxWager = paymentMethod === 'web3'
      ? (currency === 'USDT' ? 10000 : 100)
      : 10000;

    if (!wager || isNaN(Number(wager)) || Number(wager) < minWager || Number(wager) > maxWager) {
      toast.error(`El monto debe estar entre ${minWager} y ${maxWager} ${currency} para ${paymentMethod === 'web3' ? 'Smart Contract' : 'saldo interno'}`);
      return;
    }

    const wagerAmount = Number(wager);

    if (paymentMethod === 'internal') {
      const currentBalance = currency === 'USDT' ? (profile?.balance_usdt || 0) : (profile?.balance || 0);
      if (currentBalance < wagerAmount) {
        toast.error(`Saldo insuficiente. Tienes ${currentBalance} ${currency} en tu cuenta de GameBet.`);
        return;
      }
    }

    setIsCreating(true);
    
    try {
      let contractGameId = null;

      if (paymentMethod === 'web3') {
        if (currency === 'USDT' && !supportsUSDT) {
          throw new Error('El contrato actual (V1) no soporta USDT. Despliega ChessBetV2 primero.');
        }
        // 1. Crear partida en la Blockchain (Bloquea los fondos)
        toast.loading('Confirmando transacción en la blockchain...', { id: 'create-tx' });
        const txResult = await createGameOnChain(wager, currency);
        
        if (!txResult) {
          throw new Error('La transacción fue rechazada o falló.');
        }
        
        contractGameId = txResult.gameId;
        toast.success('Transacción confirmada en la red', { id: 'create-tx' });
      } else {
         // Deduct balance internally via Supabase RPC or just update profile later.
         toast.loading('Deduciendo fondos...', { id: 'create-tx' });
         // Supabase logic for actual balance deduction should ideally happen on a secure RPC, 
         // but for now we trust the backend triggers or rely on the game resolution RPC.
      }

      // 2. Guardar en Supabase Lobby
      const { data, error } = await (supabase
        .from('lobby_games') as any)
        .insert({
          creator_user_id: user.id,
          status: 'waiting',
          time_control_minutes: selectedPreset ? selectedPreset.mins : customMins,
          increment_seconds: selectedPreset ? selectedPreset.inc : customInc,
          mode: selectedPreset ? selectedPreset.mode as any : 'custom',
          creator_rating_snapshot: profile?.rating_blitz || 1200,
          creator_games_played_snapshot: profile?.games_played || 0,
          wager_amount: wagerAmount,
          currency: currency,
          contract_game_id: contractGameId,
          payment_method: paymentMethod,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating lobby game:', error);

        if (paymentMethod === 'web3' && contractGameId) {
          toast.loading('Revirtiendo contrato on-chain por fallo de base de datos...', { id: 'rollback-tx' });
          const rollbackTx = await cancelGameOnChain(contractGameId);

          if (rollbackTx) {
            toast.warning('Se canceló la partida on-chain para proteger fondos', {
              id: 'rollback-tx',
              description: 'Tus fondos quedaron en balance del contrato. Puedes retirarlos desde tu perfil.'
            });
          } else {
            toast.error('No se pudo revertir on-chain automáticamente', {
              id: 'rollback-tx',
              description: 'Cancela manualmente o contacta soporte con tu hash de transacción.'
            });
          }
        }

        throw new Error(error.message);
      }

      toast.success('Partida publicada en el lobby de apuestas');
      navigate('/lobby');
    } catch (error: any) {
      console.error('Create error:', error);
      toast.error('Error al publicar', {
        id: 'create-tx',
        description: error.message
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300">
      <Header />
      <ContractVersionBanner />
      <main className="container mx-auto px-4 pt-24 pb-12 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl bg-zinc-900/30 border border-zinc-800/50 rounded-2xl overflow-hidden backdrop-blur-xl"
        >
          <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-zinc-500 hover:text-white"
                onClick={() => navigate('/lobby')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Lobby
              </Button>
              <h1 className="text-xl font-serif font-bold text-white uppercase tracking-widest">Nueva Partida</h1>
              <div className="w-20" /> {/* Spacer */}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Left Side: Presets */}
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-zinc-500 uppercase flex items-center gap-2">
                   <Clock className="w-4 h-4" /> Tiempo Rápido
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setSelectedPreset(preset)}
                      className={`p-4 rounded-xl border transition-all duration-200 text-left space-y-1 ${
                        selectedPreset?.label === preset.label 
                        ? 'bg-primary/20 border-primary text-white shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]' 
                        : 'bg-zinc-800/30 border-zinc-700/50 hover:bg-zinc-800/50 text-zinc-400'
                      }`}
                    >
                      <div className={`p-2 w-fit rounded-lg ${selectedPreset?.label === preset.label ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                        {preset.icon}
                      </div>
                      <div className="font-bold text-sm pt-1">{preset.label}</div>
                      <div className="text-[10px] opacity-60 uppercase">{preset.mode}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Side: Custom & Action */}
              <div className="space-y-6">
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-zinc-500 uppercase flex items-center gap-2">
                     <Plus className="w-4 h-4" /> Personalizado
                  </h2>
                  <div className="space-y-6 bg-black/30 p-5 rounded-xl border border-zinc-800/50">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-400">Minutos por jugador</span>
                        <span className="text-white font-mono">{customMins} min</span>
                      </div>
                      <Slider 
                        value={[customMins]} 
                        onValueChange={(val) => {
                          setCustomMins(val[0]);
                          setSelectedPreset(null as any);
                        }} 
                        max={60} 
                        step={1} 
                        className="py-4"
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-400">Incremento (segundos)</span>
                        <span className="text-white font-mono">{customInc}s</span>
                      </div>
                      <Slider 
                        value={[customInc]} 
                        onValueChange={(val) => {
                          setCustomInc(val[0]);
                          setSelectedPreset(null as any);
                        }} 
                        max={30} 
                        step={1} 
                        className="py-4"
                      />
                    </div>
                  </div>
                </div>

                {/* Apuesta (Wager) Section */}
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-zinc-500 uppercase flex items-center gap-2">
                     <Coins className="w-4 h-4 text-yellow-500" /> Monto de Apuesta
                  </h2>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <input 
                        type="number"
                        step={currency === 'USDT' ? '0.01' : '0.00001'}
                        min={paymentMethod === 'web3' ? (currency === 'USDT' ? '0.1' : '0.00001') : (currency === 'USDT' ? '0.01' : '0.00001')}
                        max={paymentMethod === 'web3' ? (currency === 'USDT' ? '10000' : '100') : '10000'}
                        value={wager}
                        onChange={(e) => setWager(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-xl font-mono text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                        placeholder={paymentMethod === 'web3' ? (currency === 'USDT' ? '0.10' : '0.00001') : (currency === 'USDT' ? '0.01' : '0.00001')}
                      />
                    </div>
                    <div className="flex flex-col gap-2 w-24">
                      <button 
                        onClick={() => {
                          setCurrency('BNB');
                          if (wager === '0.01') setWager('0.00001');
                        }}
                        className={`py-2 rounded-lg font-bold text-xs uppercase transition-all ${currency === 'BNB' ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                      >
                        BNB
                      </button>
                      <button 
                        onClick={() => {
                          setCurrency('USDT');
                          if (wager === '0.00001') setWager('0.01');
                        }}
                        className={`py-2 rounded-lg font-bold text-xs uppercase transition-all ${currency === 'USDT' ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                      >
                        USDT
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase">Método de Pago</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setPaymentMethod('web3')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-xs font-bold ${
                          paymentMethod === 'web3' 
                          ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]' 
                          : 'bg-zinc-800/30 border-zinc-700/50 hover:bg-zinc-800/50 text-zinc-400'
                        }`}
                      >
                        <Wallet className="w-4 h-4" /> Billetera Web3
                      </button>
                      <button
                         onClick={() => setPaymentMethod('internal')}
                         className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all text-xs font-bold ${
                           paymentMethod === 'internal' 
                           ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]' 
                           : 'bg-zinc-800/30 border-zinc-700/50 hover:bg-zinc-800/50 text-zinc-400'
                         }`}
                      >
                        <div className="flex items-center gap-2"><Trophy className="w-4 h-4" /> Saldo GameBet</div>
                        <span className="text-[10px] font-normal opacity-80 mt-1">
                          ({currency === 'USDT' ? (profile?.balance_usdt || 0) : (profile?.balance || 0)} {currency})
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                   <Button 
                    className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black text-lg gap-3 rounded-xl transition-all shadow-xl"
                    onClick={handleCreate}
                    disabled={isCreating}
                   >
                     {isCreating ? 'PUBLICANDO...' : 'PUBLICAR DESAFÍO'}
                     <ChevronRight className="w-5 h-5" />
                   </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-zinc-800/50">
              <div className="flex flex-col items-center gap-1">
                <Shield className="w-5 h-5 text-zinc-500" />
                <span className="text-[10px] text-zinc-500 uppercase text-center">Anti-Cheat<br/>Activo</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Trophy className="w-5 h-5 text-zinc-500" />
                <span className="text-[10px] text-zinc-500 uppercase text-center">Ranked<br/>Game</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Zap className="w-5 h-5 text-zinc-500" />
                <span className="text-[10px] text-zinc-500 uppercase text-center">Entrega Fast<br/>Accept</span>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default CreateGame;
