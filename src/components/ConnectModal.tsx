import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { switchToBSC } from '@/lib/contract';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
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

const ConnectModal = ({ isOpen, onClose }: ConnectModalProps) => {
  const [mode, setMode] = useState<'options' | 'email-login' | 'email-signup'>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { signUp, signIn } = useAuth();
  const { connect, hasMetaMask } = useWallet();

  const checkBinanceWallet = () => {
    return !!(window as any).BinanceChain;
  };

  const checkTrustWallet = () => {
    return !!(window as any).trustwallet || !!(window as any).ethereum?.isTrust;
  };

  const connectBinanceWallet = async (): Promise<boolean> => {
    const binance = (window as any).BinanceChain;
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
      // Auto-switch to BSC for low fees
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
      icon: '💛',
      color: 'from-yellow-500 to-yellow-600',
      checkInstalled: checkBinanceWallet,
      connect: connectBinanceWallet,
    },
    {
      id: 'trust',
      name: 'Trust Wallet',
      icon: '🔵',
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
        const { error } = await signUp(email, password, displayName);
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
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error('Error al iniciar sesión', {
            description: 'Verifica tu correo y contraseña',
          });
        } else {
          toast.success('¡Bienvenido de vuelta!');
          onClose();
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto pt-8"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="glass-card w-full max-w-md p-6 my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">
              {mode === 'options' && 'Conectar'}
              {mode === 'email-login' && 'Iniciar Sesión'}
              {mode === 'email-signup' && 'Crear Cuenta'}
            </h2>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {mode === 'options' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Conecta tu wallet para jugar con BNB en Binance Smart Chain (comisiones bajas ~$0.01)
              </p>

              {/* Wallet Options */}
              <div className="space-y-2">
                {walletOptions.map((wallet) => (
                  <Button
                    key={wallet.id}
                    variant="outline"
                    className="w-full justify-start h-14 text-left"
                    onClick={() => handleWalletConnect(wallet)}
                    disabled={isLoading}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${wallet.color} flex items-center justify-center mr-3 text-xl`}>
                      {wallet.icon}
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

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">o continuar con</span>
                </div>
              </div>

              {/* Email Options */}
              <Button
                variant="outline"
                className="w-full justify-start h-14"
                onClick={() => setMode('email-login')}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mr-3">
                  <Mail className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Correo Electrónico</p>
                  <p className="text-xs text-muted-foreground">Inicia sesión o crea cuenta</p>
                </div>
              </Button>
            </div>
          )}

          {(mode === 'email-login' || mode === 'email-signup') && (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {mode === 'email-signup' && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Nombre de usuario</Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Tu nombre de jugador"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
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

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
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

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === 'email-login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </Button>

              <div className="text-center text-sm">
                {mode === 'email-login' ? (
                  <p>
                    ¿No tienes cuenta?{' '}
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => setMode('email-signup')}
                    >
                      Regístrate
                    </button>
                  </p>
                ) : (
                  <p>
                    ¿Ya tienes cuenta?{' '}
                    <button
                      type="button"
                      className="text-primary hover:underline"
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
                className="w-full"
                onClick={() => setMode('options')}
              >
                ← Volver a opciones
              </Button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConnectModal;
