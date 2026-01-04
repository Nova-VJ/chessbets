import { useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Clock, Swords, AlertTriangle, ExternalLink } from 'lucide-react';
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

interface CreateGameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateGame?: (stake: number, currency: string, timeControl: string, gameId?: string) => void;
}

const CreateGameModal = ({ open, onOpenChange, onCreateGame }: CreateGameModalProps) => {
  const [stake, setStake] = useState('0.01');
  const [timeControl, setTimeControl] = useState('10+0');
  const { isConnected, isBSC, switchToBSC, chainId, getCurrencySymbol } = useWallet();
  const { createGame, isLoading, isContractDeployed } = useContract();

  const currency = getCurrencySymbol(chainId);

  const handleSwitchNetwork = async () => {
    const success = await switchToBSC(true);
    if (success) {
      toast.success('Cambiado a BSC Testnet');
    }
  };

  const handleCreate = async () => {
    const stakeAmount = parseFloat(stake);
    if (isNaN(stakeAmount) || stakeAmount <= 0) {
      toast.error('Por favor ingresa una cantidad válida');
      return;
    }

    if (!isConnected) {
      toast.error('Conecta tu wallet primero');
      return;
    }

    if (isContractDeployed && isBSC) {
      // Create game on blockchain
      const result = await createGame(stake);
      if (result) {
        onCreateGame?.(stakeAmount, 'BNB', timeControl, result.gameId);
        onOpenChange(false);
      }
    } else {
      // Fallback to mock for demo
      onCreateGame?.(stakeAmount, currency, timeControl);
      toast.success('Partida creada (modo demo)');
      onOpenChange(false);
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
          {/* Network Warning */}
          {isConnected && !isBSC && (
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

          {/* Contract Status */}
          {isConnected && isBSC && (
            <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
              isContractDeployed 
                ? 'bg-success/10 text-success' 
                : 'bg-muted text-muted-foreground'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isContractDeployed ? 'bg-success' : 'bg-muted-foreground'}`} />
              {isContractDeployed 
                ? 'Smart Contract conectado' 
                : 'Modo demo (contrato no desplegado)'
              }
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
                step="0.001"
                min="0"
                className="flex-1 bg-secondary border-border"
              />
              <div className="flex items-center justify-center px-4 bg-secondary border border-border rounded-md text-sm font-medium">
                {isBSC ? 'BNB' : currency}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              El ganador recibirá el 97.5% del total (2.5% fee del protocolo)
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
                {stake} {isBSC ? 'BNB' : currency}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Posible ganancia:</span>
              <span className="font-semibold text-success">
                {(parseFloat(stake || '0') * 1.95).toFixed(4)} {isBSC ? 'BNB' : currency}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Red:</span>
              <span className="font-mono">
                {isBSC ? 'BSC' : 'Demo'}
              </span>
            </div>
          </div>

          <Button 
            onClick={handleCreate} 
            className="w-full btn-primary-glow bg-primary"
            disabled={isLoading || !isConnected}
          >
            {isLoading ? 'Procesando...' : 'Crear Partida'}
          </Button>

          {isBSC && isContractDeployed && (
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
