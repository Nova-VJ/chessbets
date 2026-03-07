import { Contract, BrowserProvider, formatUnits, parseUnits } from 'ethers';

// USDT BEP-20 addresses
export const USDT_BSC_MAINNET = '0x55d398326f99059fF775485246999027B3197955';
export const USDT_BSC_TESTNET = '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'; // Mock USDT on testnet

// Minimal ERC-20 ABI
export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

export type CurrencyType = 'BNB' | 'USDT';

export const getTokenAddress = (testnet = true): string => {
  return testnet ? USDT_BSC_TESTNET : USDT_BSC_MAINNET;
};

export const getTokenContract = async (tokenAddress: string): Promise<Contract | null> => {
  if (!window.ethereum) return null;
  try {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(tokenAddress, ERC20_ABI, signer);
  } catch (error) {
    console.error('Error getting token contract:', error);
    return null;
  }
};

export const approveToken = async (
  tokenAddress: string,
  spenderAddress: string,
  amount: string,
  decimals = 18
): Promise<string | null> => {
  try {
    const contract = await getTokenContract(tokenAddress);
    if (!contract) throw new Error('Token contract not available');

    const amountWei = parseUnits(amount, decimals);
    const tx = await contract.approve(spenderAddress, amountWei);
    await tx.wait();
    return tx.hash;
  } catch (error) {
    console.error('Error approving token:', error);
    return null;
  }
};

export const getTokenBalance = async (
  tokenAddress: string,
  walletAddress: string
): Promise<string> => {
  try {
    const contract = await getTokenContract(tokenAddress);
    if (!contract) return '0';

    const balance = await contract.balanceOf(walletAddress);
    const decimals = await contract.decimals();
    return formatUnits(balance, decimals);
  } catch (error) {
    console.error('Error getting token balance:', error);
    return '0';
  }
};

export const getTokenAllowance = async (
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<string> => {
  try {
    const contract = await getTokenContract(tokenAddress);
    if (!contract) return '0';

    const allowance = await contract.allowance(ownerAddress, spenderAddress);
    const decimals = await contract.decimals();
    return formatUnits(allowance, decimals);
  } catch (error) {
    console.error('Error getting allowance:', error);
    return '0';
  }
};
