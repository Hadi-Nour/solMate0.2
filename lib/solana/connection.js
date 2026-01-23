import { Connection, clusterApiUrl } from '@solana/web3.js';
import { SOLANA_CONFIG } from './config';

let connection = null;

export const getConnection = () => {
  if (!connection) {
    const endpoint = SOLANA_CONFIG.rpcUrl || clusterApiUrl(SOLANA_CONFIG.cluster);
    connection = new Connection(endpoint, 'confirmed');
  }
  return connection;
};

export const getCluster = () => SOLANA_CONFIG.cluster;
export const getRpcUrl = () => SOLANA_CONFIG.rpcUrl;
