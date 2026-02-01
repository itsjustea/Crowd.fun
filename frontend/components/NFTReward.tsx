// components/NFTRewards.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { formatEther, Address, Abi } from 'viem';
import Image from 'next/image';

interface NFTReward {
  eligible: boolean;
  minted: boolean;
  tokenId: bigint;
}

interface NFTMetadata {
  tokenId: number;
  campaignName: string;
  amount: bigint;
  contributorNumber: number;
  timestamp: number;
  imageData: string;
}

interface NFTRewardsProps {
  campaignAddress: Address;
  campaignAbi: Abi;
  nftContractAddress: Address;
  nftContractAbi: Abi;
  campaignName: string;
  isSuccessful: boolean;
  isFinalized: boolean;
  nftRewardsEnabled: boolean;
}

export default function NFTRewards({
  campaignAddress,
  campaignAbi,
  nftContractAddress,
  nftContractAbi,
  campaignName,
  isSuccessful,
  isFinalized,
  nftRewardsEnabled
}: NFTRewardsProps) {
  const [nftReward, setNFTReward] = useState<NFTReward | null>(null);
  const [nftMetadata, setNFTMetadata] = useState<NFTMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [imageLoading, setImageLoading] = useState<boolean>(true);

  const publicClient = usePublicClient();
  const { address: userAddress } = useAccount();

  useEffect(() => {
    fetchNFTReward();
  }, [campaignAddress, userAddress]);

  const fetchNFTReward = async (): Promise<void> => {
    if (!userAddress || !publicClient) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get NFT reward info from campaign
      const rewardInfo = await publicClient.readContract({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'getTokenId`',
        args: [userAddress],
      }) as readonly [boolean, boolean, bigint];

      const reward: NFTReward = {
        eligible: rewardInfo[0],
        minted: rewardInfo[1],
        tokenId: rewardInfo[2],
      };

      setNFTReward(reward);

      // If minted, fetch metadata
      if (reward.minted && reward.tokenId > BigInt(0)) {
        await fetchNFTMetadata(reward.tokenId);
      }
    } catch (error) {
      console.error('Error fetching NFT reward:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNFTMetadata = async (tokenId: bigint): Promise<void> => {
    if (!publicClient) return;

    try {
      // Get contribution data
      const contributionData = await publicClient.readContract({
        address: nftContractAddress,
        abi: nftContractAbi,
        functionName: 'getContributionData',
        args: [tokenId],
      }) as readonly [Address, Address, bigint, string, bigint, bigint];

      // Get token URI
      const tokenURI = await publicClient.readContract({
        address: nftContractAddress,
        abi: nftContractAbi,
        functionName: 'tokenURI',
        args: [tokenId],
      }) as string;

      // Parse metadata from data URI
      let imageData = '';
      if (tokenURI.startsWith('data:application/json;base64,')) {
        const base64Data = tokenURI.replace('data:application/json;base64,', '');
        const jsonStr = atob(base64Data);
        const metadata = JSON.parse(jsonStr);
        imageData = metadata.image || '';
      }

      setNFTMetadata({
        tokenId: Number(tokenId),
        campaignName: contributionData[3],
        amount: contributionData[2],
        contributorNumber: Number(contributionData[5]),
        timestamp: Number(contributionData[4]),
        imageData,
      });
    } catch (error) {
      console.error('Error fetching NFT metadata:', error);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!userAddress) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">🎨 NFT Rewards</h2>
        <p className="text-gray-400">Connect your wallet to view your NFT rewards.</p>
      </div>
    );
  }

  if (!nftRewardsEnabled) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">🎨 NFT Rewards</h2>
        <p className="text-gray-400">NFT rewards are not enabled for this campaign.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">🎨 NFT Rewards</h2>
        <div className="text-center text-gray-400 py-8">Loading NFT reward info...</div>
      </div>
    );
  }

  if (!nftReward) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">🎨 NFT Rewards</h2>
        <p className="text-gray-400">Unable to load NFT reward information.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">🎨 NFT Rewards</h2>
        <p className="text-gray-400 text-sm">
          Proof of Contribution NFTs are awarded to contributors of successful campaigns.
        </p>
      </div>

      {/* Not Eligible */}
      {!nftReward.eligible && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🎨</div>
            <h3 className="text-xl font-semibold text-white mb-2">No NFT Reward Yet</h3>
            <p className="text-gray-400 mb-4">
              {!isFinalized
                ? 'Campaign must be finalized first.'
                : !isSuccessful
                ? 'Campaign was not successful - NFTs are only awarded for successful campaigns.'
                : 'You need to contribute to this campaign to earn an NFT reward.'}
            </p>
          </div>
        </div>
      )}

      {/* Eligible but Not Minted */}
      {nftReward.eligible && !nftReward.minted && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-6">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">⏳</div>
            <h3 className="text-xl font-semibold text-yellow-300 mb-2">NFT Pending</h3>
            <p className="text-yellow-200 mb-4">
              Your Proof of Contribution NFT is being minted. This happens automatically when the campaign is finalized.
            </p>
            <button
              onClick={fetchNFTReward}
              className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
            >
              🔄 Refresh Status
            </button>
          </div>
        </div>
      )}

      {/* Minted NFT */}
      {nftReward.eligible && nftReward.minted && nftMetadata && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="grid md:grid-cols-2 gap-6 p-6">
            {/* NFT Image */}
            <div className="flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-8">
              {nftMetadata.imageData ? (
                <div className="relative w-full max-w-sm aspect-square">
                  {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-xl">
                      <div className="text-white">Loading image...</div>
                    </div>
                  )}
                  <img
                    src={nftMetadata.imageData}
                    alt={`NFT #${nftMetadata.tokenId}`}
                    className="w-full h-full rounded-xl shadow-2xl"
                    onLoad={() => setImageLoading(false)}
                  />
                </div>
              ) : (
                <div className="w-full max-w-sm aspect-square bg-gray-700 rounded-xl flex items-center justify-center">
                  <div className="text-8xl">🎨</div>
                </div>
              )}
            </div>

            {/* NFT Details */}
            <div className="flex flex-col justify-center">
              <div className="mb-6">
                <h3 className="text-3xl font-bold text-white mb-2">
                  Proof of Contribution #{nftMetadata.tokenId}
                </h3>
                <p className="text-gray-400">Your contribution has been immortalized on-chain</p>
              </div>

              <div className="space-y-4">
                {/* Campaign Name */}
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Campaign</div>
                  <div className="text-lg font-semibold text-white">{nftMetadata.campaignName}</div>
                </div>

                {/* Contribution Amount */}
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Your Contribution</div>
                  <div className="text-2xl font-bold text-white">
                    {formatEther(nftMetadata.amount)} ETH
                  </div>
                </div>

                {/* Contributor Number */}
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Contributor Number</div>
                  <div className="text-lg font-semibold text-white">
                    #{nftMetadata.contributorNumber}
                  </div>
                </div>

                {/* Timestamp */}
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Contributed On</div>
                  <div className="text-lg font-semibold text-white">
                    {formatDate(nftMetadata.timestamp)}
                  </div>
                </div>
              </div>

              {/* View on OpenSea */}
              <div className="mt-6 pt-6 border-t border-gray-700">
                <a
                  href={`https://testnets.opensea.io/assets/sepolia/${nftContractAddress}/${nftMetadata.tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  <span>🌊</span>
                  View on OpenSea
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="bg-blue-900/20 border-t border-blue-700 p-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">ℹ️</div>
              <div>
                <h4 className="text-blue-300 font-semibold mb-1">What is this NFT?</h4>
                <p className="text-blue-200 text-sm">
                  This Proof of Contribution NFT is a permanent, on-chain record of your support for this campaign. 
                  It's stored on the blockchain and can be viewed, traded, or kept as a collectible. 
                  The NFT includes your contribution amount, contributor number, and timestamp.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Minted but No Metadata */}
      {nftReward.eligible && nftReward.minted && !nftMetadata && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-semibold text-white mb-2">NFT Minted!</h3>
            <p className="text-gray-400 mb-4">
              Token ID: {nftReward.tokenId.toString()}
            </p>
            <p className="text-gray-500 text-sm">
              Loading metadata...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}