import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Copy, Check, Loader2, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { supabase } from '@/integrations/supabase/client';
import { parseEther, BrowserProvider } from 'ethers';
import { CurrencyType, getTokenAddress, approveToken, getTokenBalance } from '@/lib/tokens';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PLATFORM_WALLET = '0x742d35Cc6634C0532925a3b844Bc9e7595f1bA3c';

const DepositModal = ({ isOpen, onClose }: DepositModalProps) => {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>('BNB');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usdtBalance, setUsdtBalance] = useState<string>('0');
  
  const { user, profile, refreshProfile } = useAuth();
  const { isConnected, address, balance, isBSC, switchToBSC } = useWallet();

  // Load USDT balance when connected
  const loadUsdtBalance = async () => {
    if (address) {
      const tokenAddress = getTokenAddress(true);
      const bal = await getTokenBalance(tokenAddress, address);
      setUsdtBalance(bal);
    }
  };

  // Load on currency change
  useState(() => {
    if (currency === 'USDT' && address) {
      loadUsdtBalance();
    }
  });

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(PLATFORM_WALLET);
    setCopied(true);
    toast.success('Dirección copiada');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeposit = async () => {
    if (!isConnected || !address || !user) {
      toast.error('Conecta tu wallet primero');
      return;
    }

    if (!isBSC) {
      const switched = await switchToBSC(true);
      if (!switched) {
        toast.error('Debes estar en BSC para depositar');
        return;
      }
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }

    const walletBal = currency === 'USDT' ? parseFloat(usdtBalance) : parseFloat(balance || '0');
    if (walletBal < depositAmount) {
      toast.error(`Balance insuficiente de ${currency} en tu wallet`);
      return;
    }

    setIsLoading(true);

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      let txHash: string;

      if (currency === 'USDT') {
        // Approve and transfer USDT
        const tokenAddress = getTokenAddress(true);
        const approveTx = await approveToken(tokenAddress, PLATFORM_WALLET, amount, 18);
        if (!approveTx) throw new Error('Error al aprobar USDT');

        // For now, send to platform wallet (in production use contract.depositToken)
        const { Contract } = await import('ethers');
        const { ERC20_ABI } = await import('@/lib/tokens');
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);
        const { parseUnits } = await import('ethers');
        const tx = await tokenContract.transfer(PLATFORM_WALLET, parseUnits(amount, 18));
        toast.loading('Procesando depósito USDT...', { id: 'deposit' });
        await tx.wait();
        txHash = tx.hash;
      } else {
        const tx = await signer.sendTransaction({
          to: PLATFORM_WALLET,
          value: parseEther(amount),
        });
        toast.loading('Procesando depósito BNB...', { id: 'deposit' });
        await tx.wait();
        txHash = tx.hash;
      }

      // Record transaction
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'deposit',
        amount: depositAmount,
        tx_hash: txHash,
        wallet_address: address,
        status: 'confirmed',
        currency: currency,
      });

      if (txError) throw txError;

      // Update balance
      const balanceField = currency === 'USDT' ? 'balance_usdt' : 'balance';
      const currentBal = currency === 'USDT' ? (profile?.balance_usdt || 0) : (profile?.balance || 0);
      const newBalance = currentBal + depositAmount;
      
      const updateData: any = { [balanceField]: newBalance, wallet_address: address };
      if (currency === 'BNB') {
        updateData.total_deposited = (profile?.total_deposited || 0) + depositAmount;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (profileError) throw profileError;

      await refreshProfile();
      
      toast.success('¡Depósito exitoso!', { 
        id: 'deposit',
        description: `${depositAmount} ${currency} añadidos a tu cuenta`
      });
      
      setAmount('');
      onClose();
    } catch (error: any) {
      console.error('Deposit error:', error);
      toast.error('Error al depositar', { 
        id: 'deposit',
        description: error.message || 'Intenta nuevamente'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const quickAmountsBNB = [0.01, 0.05, 0.1, 0.5];
  const quickAmountsUSDT = [5, 10, 25, 50];
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-success to-emerald-600 flex items-center justify-center">
                <ArrowDown className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold">Depositar</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {!isConnected ? (
            <div className="text-center py-8">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Conecta tu wallet para depositar
              </p>
            </div>
          ) : (
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
                  onClick={() => { setCurrency('USDT'); loadUsdtBalance(); }}
                  className="h-auto py-2"
                >
                  <span className="font-bold">USDT</span>
                </Button>
              </div>

              {/* Balance info */}
              <div className="glass-card p-4 bg-primary/5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Balance en app:</span>
                  <span className="font-bold text-primary">
                    {currency === 'USDT' 
                      ? `${(profile?.balance_usdt || 0).toFixed(2)} USDT`
                      : `${(profile?.balance || 0).toFixed(4)} BNB`
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Balance en wallet:</span>
                  <span className="font-mono text-sm">
                    {currency === 'USDT'
                      ? `${parseFloat(usdtBalance).toFixed(2)} USDT`
                      : `${parseFloat(balance || '0').toFixed(4)} BNB`
                    }
                  </span>
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Monto a depositar</Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    step={currency === 'USDT' ? '1' : '0.001'}
                    min={currency === 'USDT' ? '1' : '0.001'}
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
                  >
                    {quickAmount}
                  </Button>
                ))}
              </div>

              {!isBSC && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-sm text-warning">
                    ⚠️ Debes cambiar a BSC para depositar
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => switchToBSC(true)}
                  >
                    Cambiar a BSC
                  </Button>
                </div>
              )}

              <Button
                className="w-full h-12"
                onClick={handleDeposit}
                disabled={isLoading || !amount || !isBSC}
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Depositar {amount || '0'} {currency}
              </Button>

              {currency === 'BNB' && (
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    O envía BNB manualmente a esta dirección:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-muted rounded text-xs truncate">
                      {PLATFORM_WALLET}
                    </code>
                    <Button variant="outline" size="icon" onClick={handleCopyAddress}>
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DepositModal;
