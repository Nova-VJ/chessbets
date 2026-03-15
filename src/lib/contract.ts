import { Contract, BrowserProvider, formatEther, parseEther, formatUnits, parseUnits, keccak256, toUtf8Bytes } from 'ethers';
import { CurrencyType, getTokenAddress, approveToken } from './tokens';
import { getActiveProvider } from '@/contexts/WalletContext';

// Contract ABI - matches ChessBetV2.sol
export const CHESS_BET_ABI = [
  "function createGame(bytes32 gameId) external payable",
  "function createGameToken(bytes32 gameId, uint256 amount) external",
  "function joinGame(bytes32 gameId) external payable",
  "function joinGameToken(bytes32 gameId) external",
  "function cancelGame(bytes32 gameId) external",
  "function finishGame(bytes32 gameId, address winner) external",
  "function finishGameDraw(bytes32 gameId) external",
  "function deposit() external payable",
  "function depositToken(uint256 amount) external",
  "function withdraw() external",
  "function withdrawToken() external",
  "function owner() external view returns (address)",
  "function getGame(bytes32 gameId) external view returns (address player1, address player2, uint256 stake, uint8 state, address winner, uint256 createdAt, bool isToken)",
  "function playerBalances(address player) external view returns (uint256)",
  "function playerTokenBalances(address player) external view returns (uint256)",
  "function platformFee() external view returns (uint256)",
  "function usdtToken() external view returns (address)",
  "event GameCreated(bytes32 indexed gameId, address indexed player1, uint256 stake, bool isToken)",
  "event GameJoined(bytes32 indexed gameId, address indexed player2)",
  "event GameFinished(bytes32 indexed gameId, address indexed winner, uint256 prize)",
  "event GameCancelled(bytes32 indexed gameId)",
  "event Withdrawal(address indexed player, uint256 amount, bool isToken)",
  "event Deposit(address indexed player, uint256 amount, bool isToken)"
];

// BSC Network configurations
export const BSC_MAINNET = {
  chainId: '0x38',
  chainName: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com/'],
};

export const BSC_TESTNET = {
  chainId: '0x61',
  chainName: 'BSC Testnet',
  nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
  blockExplorerUrls: ['https://testnet.bscscan.com/'],
};

// TODO: Replace with your deployed contract address
export const CONTRACT_ADDRESS = '0x143a1D7Fb52F2F1dDDA9Fd9594b0789fa7320A6d';

export enum GameState {
  Waiting = 0,
  Active = 1,
  Finished = 2,
  Cancelled = 3,
}

export interface ContractGame {
  player1: string;
  player2: string;
  stake: bigint;
  state: GameState;
  winner: string;
  createdAt: bigint;
  isToken: boolean;
}

export const generateGameId = (creator: string, timestamp: number): string => {
  return keccak256(toUtf8Bytes(`${creator}-${timestamp}-${Math.random()}`));
};

export const switchToBSC = async (testnet = false): Promise<boolean> => {
  const activeProvider = getActiveProvider();
  if (!activeProvider) return false;

  const network = testnet ? BSC_TESTNET : BSC_MAINNET;

  try {
    await activeProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: network.chainId }],
    });
    return true;
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      try {
        await activeProvider.request({
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
};

export const getContract = async (signer?: any): Promise<Contract | null> => {
  const activeProvider = getActiveProvider();
  if (!activeProvider) return null;
  
  try {
    const provider = new BrowserProvider(activeProvider);
    const signerOrProvider = signer || await provider.getSigner();
    return new Contract(CONTRACT_ADDRESS, CHESS_BET_ABI, signerOrProvider);
  } catch (error) {
    console.error('Error getting contract:', error);
    return null;
  }
};

export const createGameOnChain = async (
  stakeAmount: string,
  currency: CurrencyType = 'BNB'
): Promise<{ gameId: string; txHash: string } | null> => {
  try {
    const amountNumber = Number(stakeAmount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      throw new Error('Monto inválido');
    }

    if (currency === 'USDT' && amountNumber < 0.1) {
      throw new Error('La apuesta mínima en USDT on-chain es 0.1 USDT');
    }

    if (currency === 'USDT' && amountNumber > 10000) {
      throw new Error('La apuesta máxima en USDT on-chain es 10000 USDT');
    }

    const contract = await getContract();
    if (!contract) throw new Error('Contract not available');

    const provider = new BrowserProvider(getActiveProvider());
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    const gameId = generateGameId(address, Date.now());

    let tx;
    if (currency === 'USDT') {
      const tokenAddress = getTokenAddress(false);
      const amountWei = parseUnits(stakeAmount, 18);

      // Approve first
      const approvalTxHash = await approveToken(tokenAddress, CONTRACT_ADDRESS, stakeAmount, 18);
      if (!approvalTxHash) {
        throw new Error('No se pudo aprobar USDT para el contrato');
      }

      tx = await contract.createGameToken(gameId, amountWei);
    } else {
      const stakeWei = parseEther(stakeAmount);
      tx = await contract.createGame(gameId, { value: stakeWei });
    }

    console.log('Transaction sent:', tx.hash);
    await tx.wait();

    return { gameId, txHash: tx.hash };
  } catch (error: any) {
    console.error('Error creating game on chain:', error);
    if (error.data) console.error('Error data:', error.data);
    if (error.reason) console.error('Error reason:', error.reason);

    // Check for user rejection explicitly
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('Transacción rechazada por el usuario');
    }

    if (error.message && error.message.includes('insufficient funds')) {
      throw new Error('Fondos insuficientes para esta transacción');
    }

    throw new Error(error.reason || error.message || 'Error en la transacción blockchain');
  }
};

export const joinGameOnChain = async (
  gameId: string,
  stakeAmount: string,
  currency: CurrencyType = 'BNB'
): Promise<string | null> => {
  try {
    const contract = await getContract();
    if (!contract) throw new Error('Contract not available');

    let tx;
    if (currency === 'USDT') {
      const tokenAddress = getTokenAddress(false);
      await approveToken(tokenAddress, CONTRACT_ADDRESS, stakeAmount, 18);
      tx = await contract.joinGameToken(gameId);
    } else {
      const stakeWei = parseEther(stakeAmount);
      tx = await contract.joinGame(gameId, { value: stakeWei });
    }

    await tx.wait();
    return tx.hash;
  } catch (error) {
    console.error('Error joining game on chain:', error);
    return null;
  }
};

export const cancelGameOnChain = async (gameId: string): Promise<string | null> => {
  try {
    const contract = await getContract();
    if (!contract) throw new Error('Contract not available');

    const tx = await contract.cancelGame(gameId);
    await tx.wait();

    return tx.hash;
  } catch (error) {
    console.error('Error cancelling game:', error);
    return null;
  }
};

export const getGameFromChain = async (gameId: string): Promise<ContractGame | null> => {
  try {
    const contract = await getContract();
    if (!contract) throw new Error('Contract not available');

    const game = await contract.getGame(gameId);
    
    return {
      player1: game[0],
      player2: game[1],
      stake: game[2],
      state: Number(game[3]) as GameState,
      winner: game[4],
      createdAt: game[5],
      isToken: game[6],
    };
  } catch (error) {
    console.error('Error getting game from chain:', error);
    return null;
  }
};

export const getPlayerBalance = async (address: string, currency: CurrencyType = 'BNB'): Promise<string> => {
  try {
    const contract = await getContract();
    if (!contract) return '0';

    if (currency === 'USDT') {
      const balance = await contract.playerTokenBalances(address);
      return formatUnits(balance, 18);
    } else {
      const balance = await contract.playerBalances(address);
      return formatEther(balance);
    }
  } catch (error) {
    console.error('Error getting player balance:', error);
    return '0';
  }
};

export const withdrawBalance = async (currency: CurrencyType = 'BNB'): Promise<string | null> => {
  try {
    const contract = await getContract();
    if (!contract) throw new Error('Contract not available');

    const tx = currency === 'USDT' ? await contract.withdrawToken() : await contract.withdraw();
    await tx.wait();

    return tx.hash;
  } catch (error) {
    console.error('Error withdrawing balance:', error);
    return null;
  }
};

export type SettleGameResult = {
  status: 'settled' | 'skipped' | 'error';
  txHash?: string;
  reason?: string;
};

export const settleGameOnChain = async (
  gameId: string,
  winnerAddress: string | null,
  isDraw = false
): Promise<SettleGameResult> => {
  try {
    const contract = await getContract();
    if (!contract) return { status: 'error', reason: 'Contract not available' };

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();

    const ownerAddress: string = await contract.owner();
    if (ownerAddress.toLowerCase() !== signerAddress.toLowerCase()) {
      return { status: 'skipped', reason: 'Solo la wallet del owner puede liquidar partidas on-chain' };
    }

    if (!isDraw && !winnerAddress) {
      return { status: 'error', reason: 'Winner address is required for non-draw games' };
    }

    const tx = isDraw
      ? await contract.finishGameDraw(gameId)
      : await contract.finishGame(gameId, winnerAddress);

    await tx.wait();
    return { status: 'settled', txHash: tx.hash };
  } catch (error: any) {
    console.error('Error settling game on chain:', error);

    if (error.code === 'ACTION_REJECTED') {
      return { status: 'error', reason: 'Transacción rechazada por el usuario' };
    }

    return { status: 'error', reason: error?.reason || error?.message || 'Error al liquidar partida' };
  }
};

export const getGameCreatedEvents = async (playerAddress: string): Promise<string[]> => {
  try {
    const contract = await getContract();
    if (!contract) return [];

    // Filter for GameCreated(bytes32 indexed gameId, address indexed player1, ...)
    const filter = contract.filters.GameCreated(null, playerAddress);
    
    // Query last 10,000 blocks (reasonable range for BSC)
    const logs = await contract.queryFilter(filter, -10000, 'latest');
    
    // Map logs to gameIds (Topic 1)
    return logs.map((log: any) => log.args[0]);
  } catch (error) {
    console.error('Error querying events:', error);
    return [];
  }
};

export const getContractAddress = () => CONTRACT_ADDRESS;

export type ContractVersion = 'v1' | 'v2' | 'unknown';

/**
 * Detects if the deployed contract is V1 (BNB only) or V2 (BNB + USDT)
 * by checking if the `usdtToken` view function exists.
 */
export const detectContractVersion = async (): Promise<ContractVersion> => {
  if (!window.ethereum) return 'unknown';
  try {
    const contract = await getContract();
    if (!contract) return 'unknown';

    // V2 has usdtToken() — V1 does not
    await contract.usdtToken();
    return 'v2';
  } catch {
    // If usdtToken() reverts or doesn't exist, it's V1
    return 'v1';
  }
};

export const depositToPlatform = async (amount: string, currency: CurrencyType = 'BNB'): Promise<string | null> => {
  try {
    const contract = await getContract();
    if (!contract) throw new Error('Contract not available');

    let tx;
    if (currency === 'USDT') {
      const tokenAddress = getTokenAddress(false);
      const amountWei = parseUnits(amount, 18);
      await approveToken(tokenAddress, CONTRACT_ADDRESS, amount, 18);
      tx = await contract.depositToken(amountWei);
    } else {
      const amountWei = parseEther(amount);
      tx = await contract.deposit({ value: amountWei });
    }

    await tx.wait();
    return tx.hash;
  } catch (error: any) {
    console.error('Error depositing to platform:', error);
    if (error.data) console.error('Error data:', error.data);
    if (error.reason) console.error('Error reason:', error.reason);
    return null;
  }
};
