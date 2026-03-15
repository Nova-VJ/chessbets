/**
 * Unified wallet provider discovery layer.
 * Supports EIP-6963, legacy injections, and multi-provider arrays.
 */

export type WalletType = 'metamask' | 'binance' | 'trust' | 'unknown';

export interface DiscoveredProvider {
  type: WalletType;
  provider: any;
  name: string;
  rdns?: string;
}

// EIP-6963 provider store
let eip6963Providers: DiscoveredProvider[] = [];
let eip6963Listening = false;

function classifyProvider(provider: any, info?: { rdns?: string; name?: string }): WalletType {
  const rdns = info?.rdns?.toLowerCase() || '';
  const name = info?.name?.toLowerCase() || '';

  // Binance detection
  if (
    rdns.includes('binance') ||
    name.includes('binance') ||
    provider.isBinance ||
    provider.isBinanceW3W
  ) return 'binance';

  // Trust detection
  if (
    rdns.includes('trust') ||
    name.includes('trust') ||
    provider.isTrust ||
    provider.isTrustWallet
  ) return 'trust';

  // MetaMask detection
  if (
    rdns.includes('metamask') ||
    name.includes('metamask') ||
    provider.isMetaMask
  ) return 'metamask';

  return 'unknown';
}

function startEIP6963Listening() {
  if (eip6963Listening || typeof window === 'undefined') return;
  eip6963Listening = true;

  window.addEventListener('eip6963:announceProvider', ((event: CustomEvent) => {
    const { provider, info } = event.detail || {};
    if (!provider) return;

    const type = classifyProvider(provider, info);
    // Avoid duplicates
    if (!eip6963Providers.some(p => p.provider === provider)) {
      eip6963Providers.push({
        type,
        provider,
        name: info?.name || type,
        rdns: info?.rdns,
      });
    }
  }) as EventListener);

  // Request providers
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

// Start listening immediately on module load
startEIP6963Listening();

/**
 * Discover all available wallet providers across all injection methods.
 */
export function discoverProviders(): DiscoveredProvider[] {
  const found: DiscoveredProvider[] = [];
  const seen = new Set<any>();

  const add = (p: DiscoveredProvider) => {
    if (p.provider && !seen.has(p.provider)) {
      seen.add(p.provider);
      found.push(p);
    }
  };

  // 1. EIP-6963 providers (most modern)
  for (const p of eip6963Providers) {
    add(p);
  }

  // 2. Legacy Binance injection points
  const w = window as any;
  if (w.BinanceChain) {
    add({ type: 'binance', provider: w.BinanceChain, name: 'Binance Chain Wallet' });
  }
  if (w.binanceWallet) {
    add({ type: 'binance', provider: w.binanceWallet, name: 'Binance Wallet' });
  }
  if (w.binancew3w?.ethereum) {
    add({ type: 'binance', provider: w.binancew3w.ethereum, name: 'Binance W3W' });
  }

  // 3. Trust Wallet legacy
  if (w.trustwallet) {
    add({ type: 'trust', provider: w.trustwallet, name: 'Trust Wallet' });
  }

  // 4. window.ethereum.providers array (EIP-5749 / multi-wallet)
  if (Array.isArray(w.ethereum?.providers)) {
    for (const p of w.ethereum.providers) {
      const type = classifyProvider(p);
      add({ type, provider: p, name: type });
    }
  }

  // 5. window.ethereum itself (fallback)
  if (w.ethereum && !Array.isArray(w.ethereum)) {
    const type = classifyProvider(w.ethereum);
    add({ type, provider: w.ethereum, name: type });
  }

  return found;
}

/**
 * Get the best provider for a given wallet type.
 */
export function getProviderForWallet(walletType: WalletType): any | null {
  const all = discoverProviders();
  const match = all.find(p => p.type === walletType);
  return match?.provider || null;
}

/**
 * Check if a wallet type is installed/available.
 */
export function isWalletInstalled(walletType: WalletType): boolean {
  return !!getProviderForWallet(walletType);
}

/**
 * Get any available provider (for generic use like contract calls).
 * Prefers the specified type, falls back to any.
 */
export function getAnyProvider(): any | null {
  const all = discoverProviders();
  return all[0]?.provider || (window as any).ethereum || null;
}

/**
 * Re-trigger EIP-6963 discovery (useful after delayed extension load).
 */
export function refreshEIP6963() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }
}
