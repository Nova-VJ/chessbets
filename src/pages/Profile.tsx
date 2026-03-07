import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Trophy, Coins, TrendingUp, History, Settings, LogOut, Wallet, ArrowDown, ArrowUp, Loader2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import ConnectModal from '@/components/ConnectModal';
import DepositModal from '@/components/DepositModal';
import WithdrawModal from '@/components/WithdrawModal';
import { supabase } from '@/integrations/supabase/client';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
  currency?: string;
}

const Profile = () => {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);

  const { isAuthenticated, profile, signOut, refreshProfile, user } = useAuth();
  const { isConnected: isWalletConnected, address, disconnect: disconnectWallet } = useWallet();

  const isConnected = isAuthenticated || isWalletConnected;

  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user]);

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

      <main className="container mx-auto px-4 py-4">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 mb-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <User className="w-8 h-8 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">
                {profile?.display_name || profile?.email?.split('@')[0] || 'Usuario'}
              </p>
              {profile?.wallet_address && (
                <p className="font-mono text-xs text-muted-foreground">
                  {profile.wallet_address.slice(0, 6)}...{profile.wallet_address.slice(-4)}
                </p>
              )}
              {/* Dual balances */}
              <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-1">
                  <Coins className="w-4 h-4 text-primary" />
                  <span className="text-lg font-bold text-primary">
                    {profile?.balance?.toFixed(4) || '0.0000'}
                  </span>
                  <span className="text-xs text-muted-foreground">BNB</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-success" />
                  <span className="text-lg font-bold text-success">
                    {(profile?.balance_usdt || 0).toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground">USDT</span>
                </div>
              </div>
            </div>
          </div>

          {/* Deposit/Withdraw buttons */}
          <div className="flex gap-2 mt-4">
            <Button 
              className="flex-1 bg-success hover:bg-success/90"
              onClick={() => setShowDepositModal(true)}
            >
              <ArrowDown className="w-4 h-4 mr-2" />
              Depositar
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setShowWithdrawModal(true)}
              disabled={!hasAnyBalance}
            >
              <ArrowUp className="w-4 h-4 mr-2" />
              Retirar
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3 mb-4"
        >
          {[
            { label: 'Partidas', value: profile?.games_played?.toString() || '0', icon: History },
            { label: 'Victorias', value: profile?.games_won?.toString() || '0', icon: Trophy },
            { label: 'Rating', value: profile?.rating?.toString() || '1200', icon: TrendingUp },
            { label: 'Depositado', value: `${(profile?.total_deposited || 0).toFixed(2)}`, icon: Coins },
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
        </motion.div>

        {/* Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card overflow-hidden mb-4"
        >
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Transacciones</h2>
            <Button variant="ghost" size="sm" onClick={loadTransactions} disabled={isLoadingTx}>
              {isLoadingTx ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualizar'}
            </Button>
          </div>
          <div className="divide-y divide-border">
            {transactions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No hay transacciones aún
              </div>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.type === 'deposit' || tx.type === 'game_win' || tx.type === 'game_refund'
                        ? 'bg-success/10 text-success'
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {tx.type === 'deposit' || tx.type === 'game_win' || tx.type === 'game_refund' 
                        ? <ArrowDown className="w-4 h-4" />
                        : <ArrowUp className="w-4 h-4" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium">{getTransactionLabel(tx.type)}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(tx.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${
                      tx.type === 'deposit' || tx.type === 'game_win' || tx.type === 'game_refund'
                        ? 'text-success'
                        : 'text-destructive'
                    }`}>
                      {tx.type === 'deposit' || tx.type === 'game_win' || tx.type === 'game_refund' ? '+' : '-'}
                      {tx.amount} {tx.currency || 'BNB'}
                    </p>
                    <p className={`text-[10px] ${
                      tx.status === 'confirmed' ? 'text-success' : 
                      tx.status === 'pending' ? 'text-warning' : 'text-destructive'
                    }`}>
                      {tx.status === 'confirmed' ? 'Confirmado' : 
                       tx.status === 'pending' ? 'Pendiente' : 'Fallido'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

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

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <Button variant="outline" className="w-full justify-start">
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
      </main>

      <BottomNav />
      <ConnectModal isOpen={showConnectModal} onClose={() => setShowConnectModal(false)} />
      <DepositModal isOpen={showDepositModal} onClose={() => setShowDepositModal(false)} />
      <WithdrawModal isOpen={showWithdrawModal} onClose={() => setShowWithdrawModal(false)} />
    </div>
  );
};

export default Profile;
