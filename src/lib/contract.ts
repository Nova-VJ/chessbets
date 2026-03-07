import { Contract, BrowserProvider, formatEther, parseEther, formatUnits, parseUnits, keccak256, toUtf8Bytes } from 'ethers';
import { CurrencyType, getTokenAddress, approveToken } from './tokens';

// Contract ABI - matches ChessBetV2.sol
export const CHESS_BET_ABI = [
  "function createGame(bytes32 gameId) external payable",
  "function createGameToken(bytes32 gameId, uint256 amount) external",
  "function joinGame(bytes32 gameId) external payable",
  "function joinGameToken(bytes32 gameId) external",
  "function cancelGame(bytes32 gameId) external",
  "function deposit() external payable",
  "function depositToken(uint256 amount) external",
  "function withdraw() external",
  "function withdrawToken() external",
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
export const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';

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

export const switchToBSC = async (testnet = true): Promise<boolean> => {
  if (!window.ethereum) return false;

  const network = testnet ? BSC_TESTNET : BSC_MAINNET;

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: network.chainId }],
    });
    return true;
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
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
  if (!window.ethereum) return null;
  
  try {
    const provider = new BrowserProvider(window.ethereum);
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
    const contract = await getContract();
    if (!contract) throw new Error('Contract not available');

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    const gameId = generateGameId(address, Date.now());

    let tx;
    if (currency === 'USDT') {
      const tokenAddress = getTokenAddress(true);
      const amountWei = parseUnits(stakeAmount, 18);
      
      // Approve first
      await approveToken(tokenAddress, CONTRACT_ADDRESS, stakeAmount, 18);
      
      tx = await contract.createGameToken(gameId, amountWei);
    } else {
      const stakeWei = parseEther(stakeAmount);
      tx = await contract.createGame(gameId, { value: stakeWei });
    }

    console.log('Transaction sent:', tx.hash);
    await tx.wait();

    return { gameId, txHash: tx.hash };
  } catch (error) {
    console.error('Error creating game on chain:', error);
    return null;
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
      const tokenAddress = getTokenAddress(true);
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

export const depositToPlatform = async (amount: string, currency: CurrencyType = 'BNB'): Promise<string | null> => {
  try {
    const contract = await getContract();
    if (!contract) throw new Error('Contract not available');

    let tx;
    if (currency === 'USDT') {
      const tokenAddress = getTokenAddress(true);
      const amountWei = parseUnits(amount, 18);
      await approveToken(tokenAddress, CONTRACT_ADDRESS, amount, 18);
      tx = await contract.depositToken(amountWei);
    } else {
      const amountWei = parseEther(amount);
      tx = await contract.deposit({ value: amountWei });
    }

    await tx.wait();
    return tx.hash;
  } catch (error) {
    console.error('Error depositing:', error);
    return null;
  }
};
