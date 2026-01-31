'use client';

import { useState, useCallback, useEffect } from 'react';
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
  CHECKING_BALANCE: 'checking_balance',
  AWAITING_SIGNATURE: 'awaiting_signature',
  SENDING: 'sending',
  CONFIRMING: 'confirming',
  VERIFYING: 'verifying',
  SUCCESS: 'success',
  ERROR: 'error'
};

// Human-readable status messages
export const PAYMENT_STATUS_MESSAGES = {
  [PAYMENT_STATES.IDLE]: '',
  [PAYMENT_STATES.PREPARING]: 'Preparing transaction...',
  [PAYMENT_STATES.CHECKING_BALANCE]: 'Checking USDC balance...',
  [PAYMENT_STATES.AWAITING_SIGNATURE]: 'Please approve the transaction in your wallet',
  [PAYMENT_STATES.SENDING]: 'Sending transaction to network...',
  [PAYMENT_STATES.CONFIRMING]: 'Waiting for blockchain confirmation...',
  [PAYMENT_STATES.VERIFYING]: 'Verifying payment with server...',
  [PAYMENT_STATES.SUCCESS]: 'Payment successful! VIP activated.',
  [PAYMENT_STATES.ERROR]: 'Payment failed'
};

// USDC Configuration
const USDC_DECIMALS = 6;

// Get configuration from environment - ALL values must come from env
const getConfig = () => {
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  const developerWallet = process.env.NEXT_PUBLIC_DEVELOPER_WALLET;
  const vipPriceUsdc = parseFloat(process.env.NEXT_PUBLIC_VIP_PRICE_USDC || '6.99');
  
  // Validate required config
  const missingConfig = [];
  if (!cluster) missingConfig.push('NEXT_PUBLIC_SOLANA_CLUSTER');
  if (!rpcUrl) missingConfig.push('NEXT_PUBLIC_RPC_URL');
  if (!developerWallet) missingConfig.push('NEXT_PUBLIC_DEVELOPER_WALLET');
  
  const usdcMint = cluster === 'mainnet-beta'
    ? process.env.NEXT_PUBLIC_USDC_MINT_MAINNET
    : process.env.NEXT_PUBLIC_USDC_MINT_DEVNET;
  
  if (!usdcMint) missingConfig.push(cluster === 'mainnet-beta' ? 'NEXT_PUBLIC_USDC_MINT_MAINNET' : 'NEXT_PUBLIC_USDC_MINT_DEVNET');
  
  return { 
    cluster, 
    rpcUrl, 
    developerWallet, 
    usdcMint, 
    vipPriceUsdc,
    vipPriceRaw: BigInt(Math.round(vipPriceUsdc * Math.pow(10, USDC_DECIMALS))),
    isConfigured: missingConfig.length === 0,
    missingConfig
  };
};

// Timeout helper with AbortController
const withTimeout = (promise, ms, message = 'Operation timed out') => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export function useVipPayment({ wallet, signTransaction, signAndSendTransaction, authToken, onSuccess, onError }) {
  const [paymentState, setPaymentState] = useState(PAYMENT_STATES.IDLE);
  const [errorMessage, setErrorMessage] = useState(null);
  const [txSignature, setTxSignature] = useState(null);
  const [config] = useState(getConfig);

  const resetPayment = useCallback(() => {
    setPaymentState(PAYMENT_STATES.IDLE);
    setErrorMessage(null);
    setTxSignature(null);
  }, []);

  // Verify wallet is on correct network
  const verifyNetwork = useCallback(async (connection) => {
    try {
      const genesisHash = await connection.getGenesisHash();
      
      // Known genesis hashes
      const MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
      const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
      
      const expectedGenesis = config.cluster === 'mainnet-beta' ? MAINNET_GENESIS : DEVNET_GENESIS;
      const actualNetwork = genesisHash === MAINNET_GENESIS ? 'mainnet-beta' : 
                           genesisHash === DEVNET_GENESIS ? 'devnet' : 'unknown';
      
      if (genesisHash !== expectedGenesis) {
        throw new Error(
          `Wrong network! App is configured for ${config.cluster}, but your wallet is connected to ${actualNetwork}. ` +
          `Please switch your wallet to ${config.cluster === 'mainnet-beta' ? 'Mainnet' : 'Devnet'}.`
        );
      }
      
      return true;
    } catch (e) {
      if (e.message.includes('Wrong network')) throw e;
      console.warn('Could not verify network:', e.message);
      return true; // Continue if check fails (RPC might not support it)
    }
  }, [config.cluster]);

  const purchaseVip = useCallback(async () => {
    // Pre-flight checks
    if (!config.isConfigured) {
      setErrorMessage(`Payment system not configured. Missing: ${config.missingConfig.join(', ')}`);
      setPaymentState(PAYMENT_STATES.ERROR);
      return;
    }

    if (!wallet) {
      setErrorMessage('Please connect your wallet first');
      setPaymentState(PAYMENT_STATES.ERROR);
      return;
    }

    if (!signTransaction && !signAndSendTransaction) {
      setErrorMessage('Wallet does not support transaction signing');
      setPaymentState(PAYMENT_STATES.ERROR);
      return;
    }

    if (!authToken) {
      setErrorMessage('Please sign in before making a purchase');
      setPaymentState(PAYMENT_STATES.ERROR);
      return;
    }
      
      // Guard: prevent paying from the developer wallet (self-payment)
      try {
        const dev = (config.developerWallet || '').trim();
        const w = (wallet?.toString ? wallet.toString() : String(wallet || '')).trim();
        if (dev && w && dev === w) {
          setErrorMessage('You are connected with the developer wallet. Please switch to a different wallet to purchase VIP.');
          setPaymentState(PAYMENT_STATES.ERROR);
          return;
        }
      } catch (e) {}


    try {
      setPaymentState(PAYMENT_STATES.PREPARING);
      setErrorMessage(null);
      setTxSignature(null);

      // Create connection with timeout
      const connection = new Connection(config.rpcUrl, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000
      });

      // Verify network
      // TEMP DISABLED verifyNetwork
// // TEMP DISABLED verifyNetwork
// await verifyNetwork(connection);

      // Parse public keys
      console.log("[VIP] wallet raw:", wallet);
console.log("[VIP] wallet.toString():", (wallet?.toString?.()||""));
const payerPubkey = new PublicKey(wallet.toString());
      const developerPubkey = new PublicKey(config.developerWallet);
      const usdcMintPubkey = new PublicKey(config.usdcMint);


      setPaymentState(PAYMENT_STATES.CHECKING_BALANCE);

      // Get Associated Token Accounts
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

      // Check if payer's ATA exists and has sufficient balance
      let payerAtaExists = false;
      let payerBalance = BigInt(0);
      
      try {
        const payerAccount = await withTimeout(
          getAccount(connection, payerAta),
          10000,
          'Timeout checking USDC balance'
        );
        payerAtaExists = true;
        payerBalance = BigInt(payerAccount.amount.toString());
      } catch (e) {
     if (e.message.includes('Timeout')) throw e;

       // ⚠️ For debugging: if balance check fails, don't block wallet popup
       console.warn('[VIP] Could not fetch payer USDC ATA/balance, continuing without pre-check:', e?.message || e);
       payerAtaExists = true; // assume exists so we proceed to wallet prompt
       payerBalance = BigInt(0);
      }


  //    if (!payerAtaExists) {
  //      setErrorMessage('You do not have a USDC token account. Please add USDC to your wallet first.');
  //      setPaymentState(PAYMENT_STATES.ERROR);
  //      return;
  //    }

  //    if (payerBalance < config.vipPriceRaw) {
  //      const balanceUsdc = Number(payerBalance) / Math.pow(10, USDC_DECIMALS);
  //      setErrorMessage(
  //        `Insufficient USDC balance. You have ${balanceUsdc.toFixed(2)} USDC, ` +
  //        `but need ${config.vipPriceUsdc.toFixed(2)} USDC.`
  //      );
  //      setPaymentState(PAYMENT_STATES.ERROR);
  //      return;
  //    }

      // Build the transaction
      const transaction = new Transaction();

      // Check if developer's ATA exists, create if not
      let developerAtaExists = false;
      try {
        await withTimeout(
          getAccount(connection, developerAta),
          10000,
          'Timeout checking developer account'
        );
        developerAtaExists = true;
      } catch (e) {
        if (e.message.includes('Timeout')) throw e;
        // ATA doesn't exist, we'll create it
      }

      if (!developerAtaExists) {
        const createAtaIx = createAssociatedTokenAccountInstruction(
          payerPubkey,
          developerAta,
          developerPubkey,
          usdcMintPubkey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        transaction.add(createAtaIx);
      }

      // Add transfer instruction
      const transferIx = createTransferInstruction(
        payerAta,
        developerAta,
        payerPubkey,
        config.vipPriceRaw,
        [],
        TOKEN_PROGRAM_ID
      );
      transaction.add(transferIx);

      // Get recent blockhash with timeout
      const { blockhash, lastValidBlockHeight } = await withTimeout(
        connection.getLatestBlockhash('confirmed'),
        15000,
        'Timeout fetching blockhash. Please try again.'
      );
      
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = payerPubkey;

      // Request signature from wallet
      setPaymentState(PAYMENT_STATES.AWAITING_SIGNATURE);
      
      let signature;
      
      try {
        if (signAndSendTransaction) {
          // MWA or wallets with signAndSend support
          setPaymentState(PAYMENT_STATES.SENDING);
          signature = await withTimeout(
            signAndSendTransaction(transaction, {
              skipPreflight: false,
              preflightCommitment: 'confirmed'
            }),
            120000, // 2 min timeout for user to approve
            'Transaction approval timed out. Please try again.'
          );
        } else {
          // Traditional sign then send
          const signedTransaction = await withTimeout(
            signTransaction(transaction),
            120000,
            'Transaction approval timed out. Please try again.'
          );
          
          setPaymentState(PAYMENT_STATES.SENDING);
          signature = await withTimeout(
            connection.sendRawTransaction(signedTransaction.serialize(), {
              skipPreflight: false,
              preflightCommitment: 'confirmed'
            }),
            30000,
            'Failed to send transaction. Please try again.'
          );
        }
      } catch (e) {
        // Handle user rejection
        if (e.message.includes('User rejected') || 
            e.message.includes('rejected') ||
            e.message.includes('cancelled') ||
            e.message.includes('canceled')) {
          setErrorMessage('Transaction was cancelled');
          setPaymentState(PAYMENT_STATES.ERROR);
          return;
        }
        throw e;
      }

      setTxSignature(signature);
      console.log('[Payment] Transaction sent:', signature);

      // Wait for confirmation with timeout
      setPaymentState(PAYMENT_STATES.CONFIRMING);

        // Best-effort confirmation. Do NOT block VIP activation if RPC confirmation fails.
        try {
          const confirmation = await withTimeout(
            connection.confirmTransaction(
              { signature, blockhash, lastValidBlockHeight },
              'confirmed'
            ),
            45000,
            'Confirmation timed out'
          );

          if (confirmation?.value?.err) {
            throw new Error('Transaction failed on-chain.');
          }
        } catch (e) {
          const msg = (e && e.message) ? e.message : String(e);
          console.warn('[VIP] confirmTransaction failed (will still verify on backend):', msg);
          // Common cases: TransactionExpiredBlockheightExceededError, websocket/subscribe issues, timeouts
          // Backend verification is the source of truth.
        }

        setPaymentState(PAYMENT_STATES.VERIFYING);
      
      const verifyResponse = await withTimeout(
        fetch('/api/payments/confirm-vip', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ signature })
        }),
        30000,
        'Server verification timed out. Please contact support with your transaction signature.'
      );

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || 'Server verification failed');
      }

      // Success!
      setPaymentState(PAYMENT_STATES.SUCCESS);
      
      if (onSuccess) {
        onSuccess({
          signature,
          amount: config.vipPriceUsdc,
          message: verifyData.message
        });
      }

    } catch (error) {
      console.error('[Payment] Error:', error);
      
      // Provide user-friendly error messages
      let friendlyMessage = error.message;
      
      if (error.message.includes('insufficient funds')) {
        friendlyMessage = 'Insufficient SOL for transaction fees. Please add some SOL to your wallet.';
      } else if (error.message.includes('blockhash')) {
        friendlyMessage = 'Transaction expired. Please try again.';
      } else if (error.message.includes('network')) {
        friendlyMessage = error.message; // Keep network errors as-is
      }
      
      setErrorMessage(friendlyMessage);
      setPaymentState(PAYMENT_STATES.ERROR);
      
      if (onError) {
        onError(error);
      }
    }
  }, [wallet, signTransaction, signAndSendTransaction, authToken, config, verifyNetwork, onSuccess, onError]);

  return {
    paymentState,
    statusMessage: PAYMENT_STATUS_MESSAGES[paymentState] || '',
    errorMessage,
    txSignature,
    purchaseVip,
    resetPayment,
    isProcessing: ![PAYMENT_STATES.IDLE, PAYMENT_STATES.SUCCESS, PAYMENT_STATES.ERROR].includes(paymentState),
    isConfigured: config.isConfigured,
    config: {
      cluster: config.cluster,
      vipPriceUsdc: config.vipPriceUsdc,
      developerWallet: config.developerWallet
    }
  };
}

export default useVipPayment;
