// lib/gas.ts
import { PublicClient } from 'viem';

export async function getGasParameters(publicClient: PublicClient | undefined) {
  if (!publicClient) {
    return {};
  }

  try {
    const gasPrice = await publicClient.getGasPrice();
    
    // Add 20% buffer to avoid "max fee per gas less than block base fee" errors
    const maxFeePerGas = (gasPrice * BigInt(120)) / BigInt(100);
    const maxPriorityFeePerGas = (gasPrice * BigInt(20)) / BigInt(100);
    
    return {
      maxFeePerGas,
      maxPriorityFeePerGas,
    };
  } catch (error) {
    console.error('Failed to fetch gas parameters:', error);
    return {};
  }
}