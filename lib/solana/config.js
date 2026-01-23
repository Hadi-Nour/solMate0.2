// Solana Configuration
export const SOLANA_CONFIG = {
  cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet',
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com',
  developerWallet: process.env.NEXT_PUBLIC_DEVELOPER_WALLET || 'YOUR_WALLET_HERE',
};

export const USDC_MINT = {
  devnet: process.env.NEXT_PUBLIC_USDC_MINT_DEVNET || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  mainnet: process.env.NEXT_PUBLIC_USDC_MINT_MAINNET || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

export const getUsdcMint = () => {
  return SOLANA_CONFIG.cluster === 'mainnet' ? USDC_MINT.mainnet : USDC_MINT.devnet;
};

export const VIP_PRICE_USDC = parseFloat(process.env.VIP_PRICE_USDC || '6.99');

// USDC has 6 decimals
export const USDC_DECIMALS = 6;
