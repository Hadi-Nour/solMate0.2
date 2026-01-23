'use client';

import { useState, useCallback } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { 
  createTransferInstruction, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';

// Payment states for UI
export const PAYMENT_STATES = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  AWAITING_SIGNATURE: 'awaiting_signature',
  SENDING: 'sending',
  VERIFYING: 'verifying',
  SUCCESS: 'success',
  ERROR: 'error'
};

// VIP Price in USDC
const VIP_PRICE_USDC = 6.99;
const USDC_DECIMALS = 6;
const VIP_PRICE_RAW = BigInt(Math.round(VIP_PRICE_USDC * Math.pow(10, USDC_DECIMALS))); // 6990000

// Get configuration from environment
const getConfig = () => {
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
  const developerWallet = process.env.NEXT_PUBLIC_DEVELOPER_WALLET || 'BNWbb1GJcTMJLn12yMh8deB2AmrAmT1VyMJJpaTNVefJ';
  
  const usdcMint = cluster === 'mainnet-beta'
    ? (process.env.NEXT_PUBLIC_USDC_MINT_MAINNET || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    : (process.env.NEXT_PUBLIC_USDC_MINT_DEVNET || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
  
  return { cluster, rpcUrl, developerWallet, usdcMint };
};

export function useVipPayment({ wallet, signTransaction, signAndSendTransaction, authToken, onSuccess, onError }) {
  const [paymentState, setPaymentState] = useState(PAYMENT_STATES.IDLE);
  const [errorMessage, setErrorMessage] = useState(null);
  const [txSignature, setTxSignature] = useState(null);

  const resetPayment = useCallback(() => {
    setPaymentState(PAYMENT_STATES.IDLE);
    setErrorMessage(null);
    setTxSignature(null);
  }, []);

  const purchaseVip = useCallback(async () => {
    if (!wallet || (!signTransaction && !signAndSendTransaction) || !authToken) {
      setErrorMessage('Wallet not connected or not authenticated');
      setPaymentState(PAYMENT_STATES.ERROR);
      return;
    }

    const config = getConfig();
    
    try {
      setPaymentState(PAYMENT_STATES.PREPARING);
      setErrorMessage(null);
      setTxSignature(null);

      // Create connection
      const connection = new Connection(config.rpcUrl, 'confirmed');
      
      // Parse public keys
      const payerPubkey = new PublicKey(wallet.toString());
      const developerPubkey = new PublicKey(config.developerWallet);
      const usdcMintPubkey = new PublicKey(config.usdcMint);

      // Get or create Associated Token Accounts
      const payerAta = await getAssociatedTokenAddress(
        usdcMintPubkey,
        payerPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const developerAta = await getAssociatedTokenAddress(
        usdcMintPubkey,
        developerPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Build the transaction
      const transaction = new Transaction();

      // Check if payer's ATA exists
      let payerAtaExists = false;
      try {
        await getAccount(connection, payerAta);
        payerAtaExists = true;
      } catch (e) {
        // ATA doesn't exist
      }

      if (!payerAtaExists) {
        setErrorMessage('You do not have a USDC token account. Please add USDC to your wallet first.');
        setPaymentState(PAYMENT_STATES.ERROR);
        return;
      }

      // Check if payer has sufficient balance
      try {
        const payerAccount = await getAccount(connection, payerAta);
        const balance = BigInt(payerAccount.amount.toString());
        
        if (balance < VIP_PRICE_RAW) {
          const balanceUsdc = Number(balance) / Math.pow(10, USDC_DECIMALS);
          setErrorMessage(`Insufficient USDC balance. You have ${balanceUsdc.toFixed(2)} USDC, but need ${VIP_PRICE_USDC} USDC.`);
          setPaymentState(PAYMENT_STATES.ERROR);
          return;
        }
      } catch (e) {
        setErrorMessage('Failed to check USDC balance. Please ensure you have USDC in your wallet.');
        setPaymentState(PAYMENT_STATES.ERROR);
        return;
      }

      // Check if developer's ATA exists, create if not
      let developerAtaExists = false;
      try {
        await getAccount(connection, developerAta);
        developerAtaExists = true;
      } catch (e) {
        // ATA doesn't exist, we'll create it
      }

      if (!developerAtaExists) {
        // Add instruction to create developer's ATA (payer pays for it)
        const createAtaIx = createAssociatedTokenAccountInstruction(
          payerPubkey,           // payer
          developerAta,          // ata
          developerPubkey,       // owner
          usdcMintPubkey,        // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        transaction.add(createAtaIx);
      }

      // Add transfer instruction
      const transferIx = createTransferInstruction(
        payerAta,            // source
        developerAta,        // destination
        payerPubkey,         // owner of source
        VIP_PRICE_RAW,       // amount in raw units (6.99 USDC = 6990000)
        [],                  // multiSigners
        TOKEN_PROGRAM_ID
      );
      transaction.add(transferIx);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = payerPubkey;

      // Request signature from wallet
      setPaymentState(PAYMENT_STATES.AWAITING_SIGNATURE);
      
      const signedTransaction = await signTransaction(transaction);

      // Send transaction
      setPaymentState(PAYMENT_STATES.SENDING);
      
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });

      setTxSignature(signature);
      console.log('Transaction sent:', signature);

      // Wait for confirmation
      setPaymentState(PAYMENT_STATES.VERIFYING);
      
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction failed on-chain');
      }

      // Verify with backend
      const verifyResponse = await fetch('/api/payments/confirm-vip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ signature })
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || 'Backend verification failed');
      }

      // Success!
      setPaymentState(PAYMENT_STATES.SUCCESS);
      
      if (onSuccess) {
        onSuccess({
          signature,
          amount: VIP_PRICE_USDC,
          message: verifyData.message
        });
      }

    } catch (error) {
      console.error('VIP payment error:', error);
      setErrorMessage(error.message || 'Payment failed');
      setPaymentState(PAYMENT_STATES.ERROR);
      
      if (onError) {
        onError(error);
      }
    }
  }, [wallet, signTransaction, authToken, onSuccess, onError]);

  return {
    paymentState,
    errorMessage,
    txSignature,
    purchaseVip,
    resetPayment,
    isProcessing: ![PAYMENT_STATES.IDLE, PAYMENT_STATES.SUCCESS, PAYMENT_STATES.ERROR].includes(paymentState),
    config: getConfig()
  };
}

export default useVipPayment;
