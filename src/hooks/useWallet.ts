/**
 * useWallet hook - thin wrapper around WalletContext for backward compatibility.
 * All consumers get the same global wallet state.
 */
import { useWalletContext } from '@/contexts/WalletContext';

export const useWallet = () => {
  return useWalletContext();
};

// Keep the global type declaration
declare global {
  interface Window {
    ethereum?: any;
  }
}
