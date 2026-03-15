import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Mail, Eye, EyeOff, Loader2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { switchToBSC } from '@/lib/contract';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import BinanceDeposit from './BinanceDeposit';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'options' | 'email-login' | 'email-signup' | 'forgot-password' | 'binance-qr';
  initialEmail?: string;
}

type WalletType = 'metamask' | 'binance' | 'trust';

interface WalletOption {
  id: WalletType;
  name: string;
  icon: string;
  color: string;
  checkInstalled: () => boolean;
  connect: () => Promise<boolean>;
}

const ConnectModal = ({ isOpen, onClose, initialMode = 'options', initialEmail = '' }: ConnectModalProps) => {
  const [mode, setMode] = useState<'options' | 'email-login' | 'email-signup' | 'forgot-password' | 'binance-qr'>(initialMode);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('👤');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Update state when modal opens with new props
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      if (initialEmail) setEmail(initialEmail);
    }
  }, [isOpen, initialMode, initialEmail]);
  
  const { signUp, signIn, resetPassword } = useAuth();
  const { connect, hasMetaMask } = useWallet();

  const getBinanceProvider = () => {
    // Legacy Binance Chain Wallet
    if ((window as any).BinanceChain) return (window as any).BinanceChain;
    // Binance Web3 Wallet via dedicated namespace
    if ((window as any).binanceWallet) return (window as any).binanceWallet;
    // Check ethereum.providers array (EIP-5749 multi-wallet)
    const providers = (window as any).ethereum?.providers;
    if (Array.isArray(providers)) {
      const binanceProvider = providers.find((p: any) => p.isBinance);
      if (binanceProvider) return binanceProvider;
    }
    // Check if ethereum itself is Binance
    if ((window as any).ethereum?.isBinance) return (window as any).ethereum;
    return null;
  };

  const checkBinanceWallet = () => {
    return !!getBinanceProvider();
  };

  const checkTrustWallet = () => {
    return !!(window as any).trustwallet || !!(window as any).ethereum?.isTrust;
  };

  const connectBinanceWallet = async (): Promise<boolean> => {
    const binance = (window as any).BinanceChain || (window as any).binanceWallet || ((window as any).ethereum?.isBinance ? (window as any).ethereum : null);
    if (!binance) {
      toast.error('Binance Wallet no está instalada', {
        description: 'Instala la extensión de Binance Wallet',
        action: {
          label: 'Instalar',
          onClick: () => window.open('https://www.binance.com/en/web3wallet', '_blank'),
        },
      });
      return false;
    }
    
    try {
      await binance.request({ method: 'eth_requestAccounts' });
      toast.success('Binance Wallet conectada');
      onClose();
      return true;
    } catch (error) {
      toast.error('Error al conectar Binance Wallet');
      return false;
    }
  };

  const connectTrustWallet = async (): Promise<boolean> => {
    const trust = (window as any).trustwallet || ((window as any).ethereum?.isTrust ? window.ethereum : null);
    if (!trust) {
      toast.error('Trust Wallet no está instalada', {
        description: 'Instala Trust Wallet o usa la app móvil',
        action: {
          label: 'Instalar',
          onClick: () => window.open('https://trustwallet.com/download', '_blank'),
        },
      });
      return false;
    }
    
    try {
      await trust.request({ method: 'eth_requestAccounts' });
      toast.success('Trust Wallet conectada');
      onClose();
      return true;
    } catch (error) {
      toast.error('Error al conectar Trust Wallet');
      return false;
    }
  };

  const connectMetaMask = async (): Promise<boolean> => {
    if (!hasMetaMask) {
      toast.error('MetaMask no está instalado', {
        description: 'Instala MetaMask para continuar',
        action: {
          label: 'Instalar',
          onClick: () => window.open('https://metamask.io/download/', '_blank'),
        },
      });
      return false;
    }
    
    const success = await connect();
    if (success) {
      toast.info("Vinculando Perfil...", {
        description: "Se está creando tu cuenta automáticamente vinculada a tu wallet."
      });
      try {
        await switchToBSC(false);
        toast.success('MetaMask conectada a BNB Smart Chain', {
          description: 'Red configurada para comisiones bajas',
        });
      } catch {
        toast.success('MetaMask conectada', {
          description: 'Recuerda cambiar a BNB Smart Chain para jugar',
        });
      }
      onClose();
    }
    return success;
  };

  const walletOptions: WalletOption[] = [
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: '🦊',
      color: 'from-orange-500 to-orange-600',
      checkInstalled: () => hasMetaMask,
      connect: connectMetaMask,
    },
    {
      id: 'binance',
      name: 'Binance Wallet',
      icon: '',
      color: 'from-yellow-500 to-yellow-600',
      checkInstalled: checkBinanceWallet,
      connect: connectBinanceWallet,
    },
    {
      id: 'trust',
      name: 'Trust Wallet',
      icon: '',
      color: 'from-blue-500 to-blue-600',
      checkInstalled: checkTrustWallet,
      connect: connectTrustWallet,
    },
  ];

  const handleWalletConnect = async (wallet: WalletOption) => {
    setIsLoading(true);
    await wallet.connect();
    setIsLoading(false);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'email-signup') {
        if (!displayName) {
          toast.error("Por favor elige un nombre de usuario");
          setIsLoading(false);
          return;
        }
        const { error } = await signUp(email, password, displayName, avatarUrl);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('Este correo ya está registrado', {
              description: 'Intenta iniciar sesión',
            });
          } else {
            toast.error('Error al crear cuenta', { description: error.message });
          }
        } else {
          toast.success('¡Cuenta creada!', {
            description: 'Ya puedes empezar a jugar',
          });
          onClose();
        }
      } else if (mode === 'email-login') {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error('Error al iniciar sesión', {
            description: 'Verifica tu correo y contraseña',
          });
        } else {
          toast.success('¡Bienvenido de vuelta!');
          onClose();
        }
      } else if (mode === 'forgot-password') {
        const { error } = await resetPassword(email);
        if (error) {
          toast.error('Error al enviar correo', { description: error.message });
        } else {
          toast.success('Correo enviado', {
            description: 'Revisa tu bandeja de entrada para restablecer tu contraseña',
          });
          setMode('email-login');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setMode('options');
    setEmail('');
    setPassword('');
    setDisplayName('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const renderWalletIcon = (wallet: WalletOption) => {
    if (wallet.id === 'metamask') {
      return <span className="text-2xl">🦊</span>;
    }
    if (wallet.id === 'binance') {
      return (
        <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
          <path d="M16 2L19.09 5.09L10.18 14L7.09 10.91L16 2Z" fill="#F3BA2F"/>
          <path d="M21.82 7.82L24.91 10.91L16 19.82L7.09 10.91L10.18 7.82L16 13.64L21.82 7.82Z" fill="#F3BA2F"/>
          <path d="M4.27 13.64L7.36 10.55L10.45 13.64L7.36 16.73L4.27 13.64Z" fill="#F3BA2F"/>
          <path d="M7.09 19.45L16 28.36L24.91 19.45L28 22.55L16 34.55L4 22.55L7.09 19.45Z" fill="#F3BA2F"/>
          <path d="M21.55 13.64L24.64 10.55L27.73 13.64L24.64 16.73L21.55 13.64Z" fill="#F3BA2F"/>
          <path d="M19.09 16L16 19.09L12.91 16L16 12.91L19.09 16Z" fill="#F3BA2F"/>
        </svg>
      );
    }
    if (wallet.id === 'trust') {
      return (
        <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
          <path d="M16 3C16 3 26 7 26 16C26 25 16 29 16 29C16 29 6 25 6 16C6 7 16 3 16 3Z" fill="#3375BB" stroke="#3375BB" strokeWidth="1"/>
          <path d="M12 15.5L15 18.5L21 12.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border p-6 shadow-2xl flex flex-col gap-0 overflow-hidden max-h-[90vh] z-[100]">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-bold">
            {mode === 'options' && 'Conectar'}
            {mode === 'email-login' && 'Iniciar Sesión'}
            {mode === 'email-signup' && 'Crear Cuenta'}
            {mode === 'forgot-password' && 'Recuperar Contraseña'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-2">
          {mode === 'options' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-3">
                Conecta tu wallet para jugar con BNB o USDT en BNB Smart Chain
              </p>

              {/* Wallet Options */}
              <div className="space-y-2">
                {walletOptions.map((wallet) => (
                  <Button
                    key={wallet.id}
                    variant="outline"
                    className="w-full justify-start h-14 text-left group hover:border-primary/50 transition-all font-sans"
                    onClick={() => handleWalletConnect(wallet)}
                    disabled={isLoading}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${wallet.color} flex items-center justify-center mr-3 group-hover:scale-105 transition-transform`}>
                      {renderWalletIcon(wallet)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{wallet.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {wallet.checkInstalled() ? 'Instalada' : 'No instalada'}
                      </p>
                    </div>
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  </Button>
                ))}
              </div>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground uppercase tracking-wider font-semibold">o continuar con</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full justify-start h-14 group hover:border-primary/50 transition-all mb-2 font-sans"
                onClick={() => setMode('binance-qr')}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center mr-3 group-hover:scale-105 transition-transform">
                  <QrCode className="w-5 h-5 text-black" />
                </div>
                <div className="text-left font-sans">
                  <p className="font-medium text-yellow-500">Depósito Binance (QR)</p>
                  <p className="text-xs text-muted-foreground">Sin extensión • Ideal móvil</p>
                </div>
              </Button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground uppercase tracking-wider font-semibold">o</span>
                </div>
              </div>

              {/* Email Options */}
              <Button
                variant="outline"
                className="w-full justify-start h-14 group hover:border-primary/50 transition-all mb-2 font-sans"
                onClick={() => setMode('email-login')}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mr-3 group-hover:scale-105 transition-transform">
                  <Mail className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="text-left font-sans">
                  <p className="font-medium">Correo Electrónico</p>
                  <p className="text-xs text-muted-foreground">Inicia sesión o crea cuenta</p>
                </div>
              </Button>
            </div>
          )}

          {mode === 'binance-qr' && (
            <BinanceDeposit onBack={() => setMode('options')} />
          )}

          {(mode === 'email-login' || mode === 'email-signup' || mode === 'forgot-password') && (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {mode === 'email-signup' && (
                <>
                  <div className="space-y-2">
                    <Label>Elige tu Avatar</Label>
                    <div className="flex flex-wrap gap-2 justify-center py-2">
                      {['👤', '🦁', '🦅', '🐺', '🦊', '🐲', '⚔️', '🛡️', '👑', '💎'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setAvatarUrl(emoji)}
                          className={`w-10 h-10 flex items-center justify-center rounded-xl text-xl transition-all ${
                            avatarUrl === emoji ? 'bg-primary border-2 border-white/20 scale-110' : 'bg-white/5 border border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Nickname</Label>
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="Tu nombre"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {mode !== 'forgot-password' && (
                <div className="space-y-2 border-t border-white/5 pt-4">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password">Contraseña</Label>
                    {mode === 'email-login' && (
                      <button 
                        type="button" 
                        onClick={() => setMode('forgot-password')}
                        className="text-[10px] text-zinc-500 hover:text-primary uppercase font-bold tracking-widest"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full btn-primary-glow font-sans h-12" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === 'email-login' && 'Iniciar Sesión'}
                {mode === 'email-signup' && 'Crear Cuenta'}
                {mode === 'forgot-password' && 'Enviar Link de Recuperación'}
              </Button>

              <div className="text-center text-sm font-sans pt-2">
                {mode === 'email-login' ? (
                  <p className="text-zinc-500">
                    ¿No tienes cuenta?{' '}
                    <button
                      type="button"
                      className="text-primary hover:underline font-bold"
                      onClick={() => setMode('email-signup')}
                    >
                      Regístrate
                    </button>
                  </p>
                ) : (
                  <p className="text-zinc-500">
                    ¿Ya tienes cuenta?{' '}
                    <button
                      type="button"
                      className="text-primary hover:underline font-bold"
                      onClick={() => setMode('email-login')}
                    >
                      Inicia sesión
                    </button>
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                className="w-full font-sans text-xs text-zinc-600 hover:text-white"
                onClick={() => setMode('options')}
              >
                ← Volver a opciones de conexión
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectModal;
