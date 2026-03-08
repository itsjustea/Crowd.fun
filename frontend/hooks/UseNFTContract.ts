// hooks/useNFTContract.ts
'use client';

import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { Address } from 'viem';

/**
 * Hook to fetch the NFT contract address for a specific campaign
 * Since each campaign has its own NFT contract in the new architecture
 */
export function useNFTContract(
  factoryAddress: Address | undefined,
  campaignAddress: Address | undefined,
  factoryAbi: any
) {
  const [nftAddress, setNftAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const publicClient = usePublicClient();

  useEffect(() => {
    const fetchNFTAddress = async () => {
      if (!factoryAddress || !campaignAddress || !publicClient) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const address = await publicClient.readContract({
          address: factoryAddress,
          abi: factoryAbi,
          functionName: 'getNFTContractForCampaign',
          args: [campaignAddress],
        }) as Address;

        // Check if the campaign has NFTs enabled (address won't be 0x0)
        if (address === '0x0000000000000000000000000000000000000000') {
          setNftAddress(null);
        } else {
          setNftAddress(address);
        }
      } catch (err) {
        console.error('Error fetching NFT contract address:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch NFT address');
        setNftAddress(null);
      } finally {
        setLoading(false);
      }
    };

    fetchNFTAddress();
  }, [factoryAddress, campaignAddress, publicClient]);

  return { nftAddress, loading, error };
}