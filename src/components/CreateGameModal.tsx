import { useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Clock, Swords, AlertTriangle, ExternalLink, Wallet, CreditCard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useWallet } from '@/hooks/useWallet';
import { useContract } from '@/hooks/useContract';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CurrencyType } from '@/lib/tokens';

interface CreateGameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateGame?: (stake: number, currency: string, timeControl: string, gameId?: string) => void;
}

type PaymentMethod = 'balance' | 'wallet';

const CreateGameModal = ({ open, onOpenChange, onCreateGame }: CreateGameModalProps) => {
  const [stake, setStake] = useState('0.01');
  const [timeControl, setTimeControl] = useState('10+0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('balance');
  const [currency, setCurrency] = useState<CurrencyType>('BNB');
  const [isCreating, setIsCreating] = useState(false);
  
  const { isConnected: isWalletConnected, isBSC, switchToBSC, chainId } = useWallet();
  const { createGame, isLoading, isContractDeployed } = useContract();
  const { isAuthenticated, profile, user, refreshProfile } = useAuth();

  const isConnected = isWalletConnected || isAuthenticated;
  const currentBalance = currency === 'USDT' ? (profile?.balance_usdt || 0) : (profile?.balance || 0);
  const hasEnoughBalance = parseFloat(stake) <= currentBalance;

  const handleSwitchNetwork = async () => {
    const success = await switchToBSC(true);
    if (success) {
      toast.success('Cambiado a BSC Testnet');
    }
  };

  const getTimeControlSeconds = (tc: string): number => {
    const minutes = parseInt(tc.split('+')[0]);
    return minutes * 60;
  };

  const handleCreate = async () => {
    const stakeAmount = parseFloat(stake);
    if (isNaN(stakeAmount) || stakeAmount <= 0) {
      toast.error('Por favor ingresa una cantidad válida');
      return;
    }

    if (!isConnected) {
      toast.error('Conecta tu cuenta primero');
      return;
    }

    setIsCreating(true);

    try {
      if (paymentMethod === 'balance') {
        if (!user || !profile) {
          toast.error('Debes iniciar sesión');
          return;
        }

        if (stakeAmount > currentBalance) {
          toast.error('Balance insuficiente', {
            description: 'Recarga tu wallet desde tu perfil',
          });
          return;
        }

        const { data: game, error: gameError } = await supabase
          .from('games')
          .insert({
            creator_id: user.id,
            stake_amount: stakeAmount,
            time_control: getTimeControlSeconds(timeControl),
            status: 'waiting',
            is_smart_contract: false,
            creator_paid: true,
            currency: currency,
          })
          .select()
          .single();

        if (gameError) throw gameError;

        // Deduct from correct balance
        const balanceField = currency === 'USDT' ? 'balance_usdt' : 'balance';
        const newBalance = currentBalance - stakeAmount;
        const { error: balanceError } = await supabase
          .from('profiles')
          .update({ [balanceField]: newBalance })
          .eq('id', user.id);

        if (balanceError) throw balanceError;

        await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'game_stake',
          amount: stakeAmount,
          status: 'confirmed',
          currency: currency,
        });

        await refreshProfile();
        
        onCreateGame?.(stakeAmount, currency, timeControl, game.id);
        toast.success('¡Partida creada!', {
          description: 'Esperando oponente...',
        });
        onOpenChange(false);

      } else {
        if (!isWalletConnected) {
          toast.error('Conecta tu wallet MetaMask');
          return;
        }

        if (!isBSC) {
          const switched = await switchToBSC(true);
          if (!switched) {
            toast.error('Cambia a BSC primero');
            return;
          }
        }

        if (isContractDeployed) {
          const result = await createGame(stake, currency);
          if (result) {
            if (user) {
              await supabase.from('games').insert({
                creator_id: user.id,
                stake_amount: stakeAmount,
                time_control: getTimeControlSeconds(timeControl),
                status: 'waiting',
                is_smart_contract: true,
                contract_game_id: result.gameId,
                creator_paid: true,
                currency: currency,
              });
            }
            
            onCreateGame?.(stakeAmount, currency, timeControl, result.gameId);
            onOpenChange(false);
          }
        } else {
          toast.error('Smart contract en desarrollo', {
            description: 'Usa "Balance App" por ahora',
          });
        }
      }
    } catch (error: any) {
      console.error('Error creating game:', error);
      toast.error('Error al crear partida', {
        description: error.message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-serif">
            <Swords className="w-6 h-6 text-primary" />
            Crear Nueva Partida
          </DialogTitle>
          <DialogDescription>
            Configura los parámetros de tu partida y la apuesta
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 py-4"
        >
          {/* Currency Selection */}
          <div className="space-y-2">
            <Label>Moneda</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={currency === 'BNB' ? 'default' : 'outline'}
                className="h-auto py-3 flex flex-col items-center gap-1"
                onClick={() => setCurrency('BNB')}
              >
                <span className="text-lg font-bold">BNB</span>
                <span className="text-[10px] text-muted-foreground">
                  Nativo BSC
                </span>
              </Button>
              <Button
                type="button"
                variant={currency === 'USDT' ? 'default' : 'outline'}
                className="h-auto py-3 flex flex-col items-center gap-1"
                onClick={() => setCurrency('USDT')}
              >
                <span className="text-lg font-bold">USDT</span>
                <span className="text-[10px] text-muted-foreground">
                  Tether BEP-20
                </span>
              </Button>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Método de pago</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={paymentMethod === 'balance' ? 'default' : 'outline'}
                className="h-auto py-3 flex flex-col items-center gap-1"
                onClick={() => setPaymentMethod('balance')}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-xs">Balance App</span>
                <span className="text-[10px] text-muted-foreground">
                  {currentBalance.toFixed(4)} {currency}
                </span>
              </Button>
              <Button
                type="button"
                variant={paymentMethod === 'wallet' ? 'default' : 'outline'}
                className="h-auto py-3 flex flex-col items-center gap-1"
                onClick={() => setPaymentMethod('wallet')}
                disabled={!isWalletConnected}
              >
                <Wallet className="w-5 h-5" />
                <span className="text-xs">Wallet Crypto</span>
                <span className="text-[10px] text-muted-foreground">
                  {isWalletConnected ? 'Smart Contract' : 'No conectada'}
                </span>
              </Button>
            </div>
          </div>

          {/* Network Warning */}
          {paymentMethod === 'wallet' && isWalletConnected && !isBSC && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-warning">Red incorrecta</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Cambia a BSC para usar el smart contract
                </p>
                <Button size="sm" variant="outline" onClick={handleSwitchNetwork}>
                  Cambiar a BSC
                </Button>
              </div>
            </div>
          )}

          {/* Balance warning */}
          {paymentMethod === 'balance' && !hasEnoughBalance && parseFloat(stake) > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Balance insuficiente</p>
                <p className="text-xs text-muted-foreground">
                  Tienes {currentBalance.toFixed(4)} {currency}. Recarga desde tu perfil.
                </p>
              </div>
            </div>
          )}

          {/* Contract Status */}
          {paymentMethod === 'wallet' && isWalletConnected && isBSC && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              isContractDeployed 
                ? 'bg-success/10 text-success border border-success/30' 
                : 'bg-warning/10 text-warning border border-warning/30'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isContractDeployed ? 'bg-success' : 'bg-warning'} animate-pulse`} />
              <div className="flex-1">
                {isContractDeployed 
                  ? 'Smart Contract listo - Apuestas P2P seguras' 
                  : 'Contrato en desarrollo - Próximamente disponible'
                }
              </div>
            </div>
          )}

          {/* Stake Amount */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary" />
              Cantidad a apostar
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                placeholder="0.01"
                step={currency === 'USDT' ? '1' : '0.001'}
                min="0"
                className="flex-1 bg-secondary border-border"
              />
              <div className="flex items-center justify-center px-4 bg-secondary border border-border rounded-md text-sm font-medium">
                {currency}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              El ganador recibe el 97.5% del total (2.5% fee). Comisión BSC: ~$0.01
            </p>
          </div>

          {/* Time Control */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Control de tiempo
            </Label>
            <Select value={timeControl} onValueChange={setTimeControl}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1+0">Bullet 1 min</SelectItem>
                <SelectItem value="3+0">Blitz 3 min</SelectItem>
                <SelectItem value="5+0">Blitz 5 min</SelectItem>
                <SelectItem value="10+0">Rápida 10 min</SelectItem>
                <SelectItem value="15+10">Rápida 15+10</SelectItem>
                <SelectItem value="30+0">Clásica 30 min</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          <div className="glass-card p-4 space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Resumen</h4>
            <div className="flex justify-between text-sm">
              <span>Tu apuesta:</span>
              <span className="font-semibold text-primary">
                {stake} {currency}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Posible ganancia:</span>
              <span className="font-semibold text-success">
                {(parseFloat(stake || '0') * 1.95).toFixed(4)} {currency}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Método:</span>
              <span className="font-mono">
                {paymentMethod === 'balance' ? 'Balance App' : 'Smart Contract'}
              </span>
            </div>
          </div>

          <Button 
            onClick={handleCreate} 
            className="w-full btn-primary-glow bg-primary"
            disabled={
              isLoading || 
              isCreating || 
              !isConnected || 
              (paymentMethod === 'balance' && !hasEnoughBalance) ||
              (paymentMethod === 'wallet' && (!isWalletConnected || !isBSC || !isContractDeployed))
            }
          >
            {isLoading || isCreating ? 'Procesando...' : `Crear Partida (${currency})`}
          </Button>

          {paymentMethod === 'wallet' && isBSC && isContractDeployed && (
            <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
              <ExternalLink className="w-3 h-3" />
              La transacción se ejecutará en BSC
            </p>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGameModal;
