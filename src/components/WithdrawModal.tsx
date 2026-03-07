import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUp, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CurrencyType } from '@/lib/tokens';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WithdrawModal = ({ isOpen, onClose }: WithdrawModalProps) => {
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>('BNB');
  const [isLoading, setIsLoading] = useState(false);
  
  const { user, profile, refreshProfile } = useAuth();

  const currentBalance = currency === 'USDT' ? (profile?.balance_usdt || 0) : (profile?.balance || 0);

  const handleWithdraw = async () => {
    if (!user || !profile) return;

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }

    if (withdrawAmount > currentBalance) {
      toast.error('Balance insuficiente');
      return;
    }

    if (!walletAddress || !walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      toast.error('Ingresa una dirección de wallet válida');
      return;
    }

    setIsLoading(true);

    try {
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'withdrawal',
        amount: withdrawAmount,
        wallet_address: walletAddress,
        status: 'pending',
        currency: currency,
      });

      if (txError) throw txError;

      const balanceField = currency === 'USDT' ? 'balance_usdt' : 'balance';
      const newBalance = currentBalance - withdrawAmount;
      
      const updateData: any = { [balanceField]: newBalance };
      if (currency === 'BNB') {
        updateData.total_withdrawn = (profile.total_withdrawn || 0) + withdrawAmount;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (profileError) throw profileError;

      await refreshProfile();
      
      toast.success('Retiro solicitado', { 
        description: `Tu retiro de ${withdrawAmount} ${currency} será procesado en 24 horas`
      });
      
      setAmount('');
      setWalletAddress('');
      onClose();
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      toast.error('Error al procesar retiro', { 
        description: error.message || 'Intenta nuevamente'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const quickAmountsBNB = [0.01, 0.05, 0.1];
  const quickAmountsUSDT = [5, 10, 25];
  const quickAmounts = currency === 'USDT' ? quickAmountsUSDT : quickAmountsBNB;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="glass-card w-full max-w-md p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-destructive to-red-600 flex items-center justify-center">
                <ArrowUp className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold">Retirar</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="space-y-6">
            {/* Currency selector */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={currency === 'BNB' ? 'default' : 'outline'}
                onClick={() => setCurrency('BNB')}
                className="h-auto py-2"
              >
                <span className="font-bold">BNB</span>
              </Button>
              <Button
                variant={currency === 'USDT' ? 'default' : 'outline'}
                onClick={() => setCurrency('USDT')}
                className="h-auto py-2"
              >
                <span className="font-bold">USDT</span>
              </Button>
            </div>

            {/* Balance */}
            <div className="glass-card p-4 bg-primary/5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Balance disponible:</span>
                <span className="font-bold text-primary">
                  {currentBalance.toFixed(currency === 'USDT' ? 2 : 4)} {currency}
                </span>
              </div>
            </div>

            {/* Wallet address */}
            <div className="space-y-2">
              <Label htmlFor="wallet">Dirección de wallet (BSC)</Label>
              <Input
                id="wallet"
                type="text"
                placeholder="0x..."
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Monto a retirar</Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  step={currency === 'USDT' ? '1' : '0.001'}
                  min={currency === 'USDT' ? '1' : '0.001'}
                  max={currentBalance}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-16 text-lg"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {currency}
                </span>
              </div>
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2">
              {quickAmounts.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setAmount(quickAmount.toString())}
                  disabled={quickAmount > currentBalance}
                >
                  {quickAmount}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setAmount(currentBalance.toString())}
              >
                Max
              </Button>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
              <p className="text-xs text-warning">
                Los retiros se procesan manualmente en 24 horas. Verifica que la dirección sea correcta.
              </p>
            </div>

            <Button
              className="w-full h-12"
              variant="destructive"
              onClick={handleWithdraw}
              disabled={isLoading || !amount || !walletAddress || parseFloat(amount) > currentBalance}
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Solicitar Retiro de {amount || '0'} {currency}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WithdrawModal;
