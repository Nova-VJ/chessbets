import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { CurrencyType } from '@/lib/tokens';
import {
  createGameOnChain,
  joinGameOnChain,
  cancelGameOnChain,
  getGameFromChain,
  getPlayerBalance,
  withdrawBalance,
  depositToPlatform,
  switchToBSC,
  ContractGame,
  CONTRACT_ADDRESS,
} from '@/lib/contract';

export const useContract = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isContractDeployed = (CONTRACT_ADDRESS as string) !== '0x0000000000000000000000000000000000000000';

  const ensureBSCNetwork = useCallback(async (): Promise<boolean> => {
    const success = await switchToBSC(true);
    if (!success) {
      toast.error('Por favor, cambia a la red BSC');
      return false;
    }
    return true;
  }, []);

  const createGame = useCallback(async (stakeInAmount: string, currency: CurrencyType = 'BNB') => {
    if (!isContractDeployed) {
      toast.error('El contrato no está desplegado todavía');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const networkOk = await ensureBSCNetwork();
      if (!networkOk) return null;

      toast.loading(`Creando partida con ${currency}...`, { id: 'create-game' });
      
      const result = await createGameOnChain(stakeInAmount, currency);
      
      if (result) {
        toast.success('¡Partida creada en blockchain!', { id: 'create-game' });
        return result;
      } else {
        toast.error('Error al crear la partida', { id: 'create-game' });
        return null;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Error al crear partida', { id: 'create-game' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [ensureBSCNetwork, isContractDeployed]);

  const joinGame = useCallback(async (gameId: string, stakeInAmount: string, currency: CurrencyType = 'BNB') => {
    if (!isContractDeployed) {
      toast.error('El contrato no está desplegado todavía');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const networkOk = await ensureBSCNetwork();
      if (!networkOk) return null;

      toast.loading('Uniéndote a la partida...', { id: 'join-game' });
      
      const txHash = await joinGameOnChain(gameId, stakeInAmount, currency);
      
      if (txHash) {
        toast.success('¡Te has unido a la partida!', { id: 'join-game' });
        return txHash;
      } else {
        toast.error('Error al unirse a la partida', { id: 'join-game' });
        return null;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Error al unirse', { id: 'join-game' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [ensureBSCNetwork, isContractDeployed]);

  const cancelGame = useCallback(async (gameId: string) => {
    if (!isContractDeployed) {
      toast.error('El contrato no está desplegado todavía');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      toast.loading('Cancelando partida...', { id: 'cancel-game' });
      const txHash = await cancelGameOnChain(gameId);
      
      if (txHash) {
        toast.success('Partida cancelada', { id: 'cancel-game' });
        return txHash;
      } else {
        toast.error('Error al cancelar', { id: 'cancel-game' });
        return null;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Error al cancelar', { id: 'cancel-game' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isContractDeployed]);

  const getGame = useCallback(async (gameId: string): Promise<ContractGame | null> => {
    if (!isContractDeployed) return null;
    return getGameFromChain(gameId);
  }, [isContractDeployed]);

  const getBalance = useCallback(async (address: string, currency: CurrencyType = 'BNB'): Promise<string> => {
    if (!isContractDeployed) return '0';
    return getPlayerBalance(address, currency);
  }, [isContractDeployed]);

  const withdraw = useCallback(async (currency: CurrencyType = 'BNB') => {
    if (!isContractDeployed) {
      toast.error('El contrato no está desplegado todavía');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      toast.loading(`Retirando ${currency}...`, { id: 'withdraw' });
      const txHash = await withdrawBalance(currency);
      
      if (txHash) {
        toast.success('¡Fondos retirados!', { id: 'withdraw' });
        return txHash;
      } else {
        toast.error('Error al retirar', { id: 'withdraw' });
        return null;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Error al retirar', { id: 'withdraw' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isContractDeployed]);

  const deposit = useCallback(async (amount: string, currency: CurrencyType = 'BNB') => {
    if (!isContractDeployed) {
      toast.error('El contrato no está desplegado todavía');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const networkOk = await ensureBSCNetwork();
      if (!networkOk) return null;

      toast.loading(`Depositando ${currency}...`, { id: 'deposit' });
      const txHash = await depositToPlatform(amount, currency);
      
      if (txHash) {
        toast.success('¡Fondos depositados!', { id: 'deposit' });
        return txHash;
      } else {
        toast.error('Error al depositar', { id: 'deposit' });
        return null;
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Error al depositar', { id: 'deposit' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [ensureBSCNetwork, isContractDeployed]);

  return {
    isLoading,
    error,
    isContractDeployed,
    createGame,
    joinGame,
    cancelGame,
    getGame,
    getBalance,
    withdraw,
    deposit,
    ensureBSCNetwork,
  };
};
