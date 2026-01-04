import { Contract, BrowserProvider, formatEther, parseEther, keccak256, toUtf8Bytes } from 'ethers';

// Contract ABI - matches ChessBet.sol
export const CHESS_BET_ABI = [
  "function createGame(bytes32 gameId) external payable",
  "function joinGame(bytes32 gameId) external payable",
  "function cancelGame(bytes32 gameId) external",
  "function deposit() external payable",
  "function withdraw() external",
  "function getGame(bytes32 gameId) external view returns (address player1, address player2, uint256 stake, uint8 state, address winner, uint256 createdAt)",
  "function playerBalances(address player) external view returns (uint256)",
  "function platformFee() external view returns (uint256)",
  "event GameCreated(bytes32 indexed gameId, address indexed player1, uint256 stake)",
  "event GameJoined(bytes32 indexed gameId, address indexed player2)",
  "event GameFinished(bytes32 indexed gameId, address indexed winner, uint256 prize)",
  "event GameCancelled(bytes32 indexed gameId)",
  "event Withdrawal(address indexed player, uint256 amount)",
  "event Deposit(address indexed player, uint256 amount)"
];

// BSC Network configurations
export const BSC_MAINNET = {
  chainId: '0x38', // 56
  chainName: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com/'],
};

export const BSC_TESTNET = {
  chainId: '0x61', // 97
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
    // Chain not added, try to add it
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

export const createGameOnChain = async (stakeInBNB: string): Promise<{ gameId: string; txHash: string } | null> => {
  try {
    const contract = await getContract();
    if (!contract) throw new Error('Contract not available');

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    const gameId = generateGameId(address, Date.now());
    const stakeWei = parseEther(stakeInBNB);

    console.log('Creating game:', { gameId, stake: stakeInBNB });
    
    const tx = await contract.createGame(gameId, { value: stakeWei });
    console.log('Transaction sent:', tx.hash);
    
    await tx.wait();
    console.log('Transaction confirmed');

    return { gameId, txHash: tx.hash };
  } catch (error) {
    console.error('Error creating game on chain:', error);
    return null;
  }
};

export const joinGameOnChain = async (gameId: string, stakeInBNB: string): Promise<string | null> => {
  try {
    const contract = await getContract();
    if (!contract) throw new Error('Contract not available');

    const stakeWei = parseEther(stakeInBNB);

    console.log('Joining game:', { gameId, stake: stakeInBNB });
    
    const tx = await contract.joinGame(gameId, { value: stakeWei });
    console.log('Transaction sent:', tx.hash);
    
    await tx.wait();
    console.log('Transaction confirmed');

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

    console.log('Cancelling game:', gameId);
    
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
    };
  } catch (error) {
    console.error('Error getting game from chain:', error);
    return null;
  }
};

export const getPlayerBalance = async (address: string): Promise<string> => {
  try {
    const contract = await getContract();
    if (!contract) return '0';

    const balance = await contract.playerBalances(address);
    return formatEther(balance);
  } catch (error) {
    console.error('Error getting player balance:', error);
    return '0';
  }
};

export const withdrawBalance = async (): Promise<string | null> => {
  try {
    const contract = await getContract();
    if (!contract) throw new Error('Contract not available');

    const tx = await contract.withdraw();
    await tx.wait();

    return tx.hash;
  } catch (error) {
    console.error('Error withdrawing balance:', error);
    return null;
  }
};

export const depositToPlatform = async (amountInBNB: string): Promise<string | null> => {
  try {
    const contract = await getContract();
    if (!contract) throw new Error('Contract not available');

    const amountWei = parseEther(amountInBNB);
    const tx = await contract.deposit({ value: amountWei });
    await tx.wait();

    return tx.hash;
  } catch (error) {
    console.error('Error depositing:', error);
    return null;
  }
};
