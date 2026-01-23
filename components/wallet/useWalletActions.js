'use client';

import { useCallback, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount
} from '@solana/spl-token';
import bs58 from 'bs58';

// USDC addresses by network
const USDC_MINT = {
  'mainnet-beta': new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  'devnet': new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'), // Circle devnet USDC
  'testnet': new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
};

export function useWalletActions() {
  const { connection } = useConnection();
  const { publicKey, signMessage, signTransaction, sendTransaction, connected, wallet } = useWallet();
  
  // Get current network
  const network = useMemo(() => {
    const env = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    return env || 'devnet';
  }, []);
  
  // Get USDC mint for current network
  const usdcMint = useMemo(() => {
    return USDC_MINT[network] || USDC_MINT['devnet'];
  }, [network]);
  
  /**
   * Sign a message for authentication (nonce signing)
   * @param {string} message - The message to sign
   * @returns {Promise<string>} - Base64 encoded signature
   */
  const signAuthMessage = useCallback(async (message) => {
    if (!publicKey || !signMessage) {
      throw new Error('Wallet not connected or does not support message signing');
    }
    
    const encodedMessage = new TextEncoder().encode(message);
    const signature = await signMessage(encodedMessage);
    
    // Return base64 encoded signature
    return btoa(String.fromCharCode(...signature));
  }, [publicKey, signMessage]);
  
  /**
   * Send SOL to a recipient
   * @param {string} recipientAddress - Recipient's wallet address
   * @param {number} amountSol - Amount of SOL to send
   * @returns {Promise<string>} - Transaction signature
   */
  const sendSol = useCallback(async (recipientAddress, amountSol) => {
    if (!publicKey || !sendTransaction) {
      throw new Error('Wallet not connected');
    }
    
    const recipientPubkey = new PublicKey(recipientAddress);
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: recipientPubkey,
        lamports,
      })
    );
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;
    
    // Send transaction
    const signature = await sendTransaction(transaction, connection);
    
    // Wait for confirmation
    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature,
    }, 'confirmed');
    
    return signature;
  }, [publicKey, sendTransaction, connection]);
  
  /**
   * Send USDC (SPL Token) to a recipient
   * @param {string} recipientAddress - Recipient's wallet address
   * @param {number} amountUsdc - Amount of USDC to send (in USDC, not micro)
   * @returns {Promise<string>} - Transaction signature
   */
  const sendUsdc = useCallback(async (recipientAddress, amountUsdc) => {
    if (!publicKey || !sendTransaction) {
      throw new Error('Wallet not connected');
    }
    
    const recipientPubkey = new PublicKey(recipientAddress);
    
    // USDC has 6 decimal places
    const amount = BigInt(Math.round(amountUsdc * 1_000_000));
    
    // Get sender's USDC token account
    const senderAta = await getAssociatedTokenAddress(
      usdcMint,
      publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Get recipient's USDC token account
    const recipientAta = await getAssociatedTokenAddress(
      usdcMint,
      recipientPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    const transaction = new Transaction();
    
    // Check if recipient ATA exists, if not create it
    try {
      await getAccount(connection, recipientAta);
    } catch (error) {
      // Account doesn't exist, create it
      transaction.add(
        createAssociatedTokenAccountInstruction(
          publicKey, // payer
          recipientAta, // associated token account
          recipientPubkey, // owner
          usdcMint, // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
    
    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        senderAta, // source
        recipientAta, // destination
        publicKey, // owner
        amount, // amount
        [], // multi-signers
        TOKEN_PROGRAM_ID
      )
    );
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;
    
    // Send transaction
    const signature = await sendTransaction(transaction, connection);
    
    // Wait for confirmation
    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature,
    }, 'confirmed');
    
    return signature;
  }, [publicKey, sendTransaction, connection, usdcMint]);
  
  /**
   * Get SOL balance
   * @returns {Promise<number>} - Balance in SOL
   */
  const getSolBalance = useCallback(async () => {
    if (!publicKey) return 0;
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  }, [publicKey, connection]);
  
  /**
   * Get USDC balance
   * @returns {Promise<number>} - Balance in USDC
   */
  const getUsdcBalance = useCallback(async () => {
    if (!publicKey) return 0;
    
    try {
      const ata = await getAssociatedTokenAddress(
        usdcMint,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      
      const account = await getAccount(connection, ata);
      return Number(account.amount) / 1_000_000;
    } catch (error) {
      // Account doesn't exist
      return 0;
    }
  }, [publicKey, connection, usdcMint]);
  
  /**
   * Get current SOL price in USD (from API)
   * @returns {Promise<number>} - SOL price
   */
  const getSolPrice = useCallback(async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const data = await response.json();
      return data.solana.usd;
    } catch (error) {
      console.error('Failed to fetch SOL price:', error);
      // Fallback price
      return 150;
    }
  }, []);
  
  return {
    publicKey,
    connected,
    wallet,
    network,
    signAuthMessage,
    sendSol,
    sendUsdc,
    getSolBalance,
    getUsdcBalance,
    getSolPrice,
  };
}

export default useWalletActions;
