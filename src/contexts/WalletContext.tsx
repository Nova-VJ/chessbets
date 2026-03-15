import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { BrowserProvider, formatEther } from 'ethers';
import { BSC_MAINNET, BSC_TESTNET } from '@/lib/contract';
import {
  WalletType,
  getProviderForWallet,
  isWalletInstalled,
  discoverProviders,
  refreshEIP6963,
  getAnyProvider,
} from '@/lib/walletProviders';

interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  balance: string | null;
  chainId: number | null;
  error: string | null;
  isBSC: boolean;
  activeWalletType: WalletType | null;
}

interface WalletContextValue extends WalletState {
  connect: (walletType?: WalletType) => Promise<boolean>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  switchToBSC: (testnet?: boolean) => Promise<boolean>;
  getNetworkName: (id: number | null) => string;
  getCurrencySymbol: (id: number | null) => string;
  hasMetaMask: boolean;
  isWalletAvailable: (type: WalletType) => boolean;
  /** The raw EIP-1193 provider for the active wallet */
  activeProvider: any | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    isConnecting: false,
    address: null,
    balance: null,
    chainId: null,
    error: null,
    isBSC: false,
    activeWalletType: null,
  });

  const activeProviderRef = useRef<any>(null);

  const isBSCNetwork = (chainId: number | null): boolean => chainId === 56;

  const fetchBalance = useCallback(async (address: string, provider?: any) => {
    const p = provider || activeProviderRef.current || getAnyProvider();
    if (!p) return null;
    try {
      const ethersProvider = new BrowserProvider(p);
      const balance = await ethersProvider.getBalance(address);
      return formatEther(balance);
    } catch (err) {
      console.error('Error fetching balance:', err);
      return null;
    }
  }, []);

  const connect = useCallback(async (walletType?: WalletType): Promise<boolean> => {
    // If no type specified, try any provider
    const provider = walletType
      ? getProviderForWallet(walletType)
      : getAnyProvider();

    if (!provider) {
      setState(prev => ({ ...prev, error: `${walletType || 'Wallet'} no está instalada` }));
      return false;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const ethersProvider = new BrowserProvider(provider);
      const accounts = await ethersProvider.send('eth_requestAccounts', []);
      const address = accounts[0];
      const network = await ethersProvider.getNetwork();
      const chainId = Number(network.chainId);
      const balance = await fetchBalance(address, provider);

      activeProviderRef.current = provider;

      setState({
        isConnected: true,
        isConnecting: false,
        address,
        balance,
        chainId,
        error: null,
        isBSC: isBSCNetwork(chainId),
        activeWalletType: walletType || null,
      });

      return true;
    } catch (err: any) {
      console.error('Error connecting wallet:', err);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: err.message || 'Error al conectar wallet',
      }));
      return false;
    }
  }, [fetchBalance]);

  const disconnect = useCallback(() => {
    activeProviderRef.current = null;
    setState({
      isConnected: false,
      isConnecting: false,
      address: null,
      balance: null,
      chainId: null,
      error: null,
      isBSC: false,
      activeWalletType: null,
    });
  }, []);

  const refreshBalance = useCallback(async () => {
    if (state.address) {
      const balance = await fetchBalance(state.address);
      setState(prev => ({ ...prev, balance }));
    }
  }, [state.address, fetchBalance]);

  const switchToBSC = useCallback(async (testnet = false): Promise<boolean> => {
    const provider = activeProviderRef.current || getAnyProvider();
    if (!provider) return false;

    const network = testnet ? BSC_TESTNET : BSC_MAINNET;

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: network.chainId }],
      });
      return true;
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [network],
          });
          return true;
        } catch (addError) {
          console.error('Error adding BSC network:', addError);
          return false;
        }
      }
      console.error('Error switching network:', switchError);
      return false;
    }
  }, []);

  // Listen for account and chain changes on the active provider
  useEffect(() => {
    const provider = activeProviderRef.current;
    if (!provider) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== state.address) {
        const balance = await fetchBalance(accounts[0], provider);
        setState(prev => ({
          ...prev,
          address: accounts[0],
          balance,
        }));
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16);
      setState(prev => ({
        ...prev,
        chainId,
        isBSC: isBSCNetwork(chainId),
      }));
    };

    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('chainChanged', handleChainChanged);

    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [state.address, disconnect, fetchBalance]);

  // Check if already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      // Trigger EIP-6963 discovery
      refreshEIP6963();

      // Wait briefly for extensions to announce
      await new Promise(r => setTimeout(r, 300));

      const provider = getAnyProvider();
      if (!provider) return;

      try {
        const ethersProvider = new BrowserProvider(provider);
        const accounts = await ethersProvider.send('eth_accounts', []);
        if (accounts.length > 0) {
          const address = accounts[0];
          const network = await ethersProvider.getNetwork();
          const chainId = Number(network.chainId);
          const balance = await fetchBalance(address, provider);

          activeProviderRef.current = provider;

          // Try to identify the wallet type
          const all = discoverProviders();
          const match = all.find(p => p.provider === provider);

          setState({
            isConnected: true,
            isConnecting: false,
            address,
            balance,
            chainId,
            error: null,
            isBSC: isBSCNetwork(chainId),
            activeWalletType: match?.type || null,
          });
        }
      } catch (err) {
        console.error('Error checking connection:', err);
      }
    };

    checkConnection();
  }, [fetchBalance]);

  const getNetworkName = useCallback((id: number | null): string => {
    switch (id) {
      case 1: return 'Ethereum';
      case 56: return 'BSC';
      case 97: return 'BSC Testnet';
      case 137: return 'Polygon';
      case 42161: return 'Arbitrum';
      default: return `Chain ${id}`;
    }
  }, []);

  const getCurrencySymbol = useCallback((id: number | null): string => {
    switch (id) {
      case 56:
      case 97:
        return 'BNB';
      case 137:
        return 'MATIC';
      default:
        return 'ETH';
    }
  }, []);

  const value: WalletContextValue = {
    ...state,
    connect,
    disconnect,
    refreshBalance,
    switchToBSC,
    getNetworkName,
    getCurrencySymbol,
    hasMetaMask: isWalletInstalled('metamask'),
    isWalletAvailable: isWalletInstalled,
    activeProvider: activeProviderRef.current,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWalletContext = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWalletContext must be used within WalletProvider');
  return ctx;
};

/**
 * Returns the active EIP-1193 provider for on-chain operations.
 * Falls back to window.ethereum if no wallet context is available.
 */
export function getActiveProvider(): any {
  // This is a module-level getter for use in non-React code (contract.ts, tokens.ts)
  return _activeProviderGlobal || (window as any).ethereum;
}

// Module-level reference updated by the context
let _activeProviderGlobal: any = null;

export function setActiveProviderGlobal(provider: any) {
  _activeProviderGlobal = provider;
}
