// components/NFTReward.tsx - UPDATED with claimNFT support
'use client';

import { useState, useEffect } from 'react';
import { usePublicClient, useAccount, useWalletClient } from 'wagmi';
import { formatEther, Address, Abi } from 'viem';
import { CROWDFUND_ABI } from '@/constants/abi';
import { NFT_CONTRACT_ABI } from '@/constants/nft-abi';
import { toast } from 'sonner';

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
  nftContractAddress: Address | null;
  nftContractAbi: Abi;
  campaignName: string;
  isSuccessful: boolean;
  isFinalized: boolean;
  nftRewardsEnabled: boolean;
  isCreator: boolean; 
}

export default function NFTRewards({
  campaignAddress,
  campaignAbi,
  nftContractAddress,
  nftContractAbi,
  campaignName,
  isSuccessful,
  isFinalized,
  nftRewardsEnabled,
  isCreator,
}: NFTRewardsProps) {
  const [nftReward, setNFTReward] = useState<NFTReward | null>(null);
  const [nftMetadata, setNFTMetadata] = useState<NFTMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [imageLoading, setImageLoading] = useState<boolean>(true);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  const publicClient = usePublicClient();
  const { address: userAddress } = useAccount();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    fetchNFTReward();
  }, [campaignAddress, userAddress, publicClient]);

  useEffect(() => {
    if (nftMetadata) {
      setImageLoading(true);
    }
  }, [nftMetadata]);

  const fetchNFTReward = async (): Promise<void> => {
    if (!userAddress || !publicClient) {
      setLoading(false);
      return;
    }

    if (!nftContractAddress || nftContractAddress === '0x0000000000000000000000000000000000000000') {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rewardInfo = await publicClient.readContract({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'getNFTRewardInfo',
        args: [userAddress],
      }) as readonly [boolean, boolean, bigint];

      const reward: NFTReward = {
        eligible: rewardInfo[0],
        minted: rewardInfo[1],
        tokenId: rewardInfo[2],
      };

      setNFTReward(reward);

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
    if (!publicClient || !nftContractAddress) return;

    try {
      const contributionData = await publicClient.readContract({
        address: nftContractAddress,
        abi: nftContractAbi,
        functionName: 'getContributionData',
        args: [tokenId],
      }) as readonly [Address, Address, bigint, string, bigint, bigint];

      const tokenURI = await publicClient.readContract({
        address: nftContractAddress,
        abi: nftContractAbi,
        functionName: 'tokenURI',
        args: [tokenId],
      }) as string;

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

    const handleClaimNFT = async (): Promise<void> => {
    if (!walletClient || !publicClient || !userAddress) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsClaiming(true);
    try {
      console.log('Claiming NFT...');
      console.log('Campaign:', campaignAddress);
      console.log('User:', userAddress);

      try {
        const { request } = await publicClient.simulateContract({
          address: campaignAddress,
          abi: CROWDFUND_ABI,
          functionName: 'claimNFT',
          account: userAddress,
        });

        console.log('Simulation passed, sending transaction...');

        const hash = await walletClient.writeContract(request);
        console.log('Transaction hash:', hash);

        await toast.promise(publicClient.waitForTransactionReceipt({ hash }), {
          loading: 'Claiming NFT...',
          success: 'NFT claimed successfully!',
          error: 'Failed to claim NFT',
        });
        console.log(' NFT claimed successfully!');

        await fetchNFTReward();
      } catch (simError: any) {
        console.error('❌ Simulation failed:', simError);
        
        // Extract the revert reason
        let errorMsg = 'Failed to claim NFT:\n\n';
        
        if (simError.message?.includes('Campaign not authorized')) {
          errorMsg += 'Campaign not authorized in NFT contract.\n\n';
          errorMsg += 'The campaign needs to be authorized. Contact support.';
        } else if (simError.message?.includes('already has NFT')) {
          errorMsg += 'You have already claimed your NFT for this campaign!';
        } else if (simError.message?.includes('Not a contributor')) {
          errorMsg += 'You must contribute to this campaign first.';
        } else if (simError.message?.includes('Campaign not finalized')) {
          errorMsg += 'Campaign must be finalized first.';
        } else if (simError.message?.includes('Campaign not successful')) {
          errorMsg += 'Campaign was not successful. NFTs are only for successful campaigns.';
        } else {
          errorMsg += simError.shortMessage || simError.message || 'Unknown error';
        }
        
        toast.error(errorMsg);
        throw simError;
      }
    } catch (error: any) {
      console.error('❌ Full error object:', error);
    } finally {
      setIsClaiming(false);
    }
  };
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Not connected
  if (!userAddress) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">NFT Rewards</h2>
        <p className="text-gray-400">Connect your wallet to view your NFT rewards.</p>
      </div>
    );
  }
  console.log('Checking NFT enabled condition:', {
    nftRewardsEnabled,
    nftRewardsEnabledType: typeof nftRewardsEnabled,
    nftContractAddress,
    nftContractAddressType: typeof nftContractAddress,
    isZeroAddress: nftContractAddress === '0x0000000000000000000000000000000000000000',
    willReturn: !nftRewardsEnabled || !nftContractAddress || nftContractAddress === '0x0000000000000000000000000000000000000000'
  });
  // NFTs not enabled
  if (!nftRewardsEnabled || !nftContractAddress || nftContractAddress === '0x0000000000000000000000000000000000000000') {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">NFT Rewards</h2>
        <p className="text-gray-400">NFT rewards are not enabled for this campaign.</p>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">NFT Rewards</h2>
        <div className="text-center text-gray-400 py-8">Loading NFT reward info...</div>
      </div>
    );
  }

  // Error state
  if (!nftReward) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">NFT Rewards</h2>
        <p className="text-gray-400">Unable to load NFT reward information.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">NFT Rewards</h2>
        <p className="text-gray-400 text-sm">
          Proof of Contribution NFTs are awarded to contributors of successful campaigns.
        </p>
      </div>

      {!nftReward.eligible && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="text-center py-8">
            <h3 className="text-xl font-semibold text-white mb-2">No NFT Reward</h3>
            <p className="text-gray-400 mb-4">
              {!isFinalized
                ? 'Campaign must be finalized first.'
                : !isSuccessful
                ? 'Campaign was not successful - NFTs are only awarded for successful campaigns.'
                : isCreator
                ? 'As the campaign creator, NFTs are awarded to contributors only.'
                : 'You need to contribute to this campaign to earn an NFT reward.'}
            </p>
          </div>
        </div>
      )}

      {/* ✅ UPDATED: Eligible but Not Minted - Show Claim Button */}
      {nftReward.eligible && !nftReward.minted && (
        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl p-8 backdrop-blur-sm">
          <div className="text-center py-8">
            <div className="text-8xl mb-6">🎁</div>
            <h3 className="text-3xl font-semibold text-green-300 mb-3">NFT Ready to Claim!</h3>
            <p className="text-green-200 text-lg mb-6 max-w-md mx-auto">
              Your Proof of Contribution NFT is ready. Click below to mint it to your wallet permanently on-chain.
            </p>
            <button
              onClick={handleClaimNFT}
              disabled={isClaiming}
              className="px-10 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold text-lg rounded-xl transition-all shadow-lg hover:shadow-green-500/50 transform hover:-translate-y-0.5 disabled:cursor-not-allowed"
            >
              {isClaiming ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Claiming NFT...
                </>
              ) : (
                <>
                   Claim My NFT
                </>
              )}
            </button>
            {isClaiming && (
              <p className="text-green-300 text-sm mt-4">
                Please confirm the transaction in your wallet...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Minted NFT with Full Metadata */}
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
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Campaign</div>
                  <div className="text-lg font-semibold text-white">{nftMetadata.campaignName}</div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Your Contribution</div>
                  <div className="text-2xl font-bold text-white">
                    {formatEther(nftMetadata.amount)} ETH
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Contributor Number</div>
                  <div className="text-lg font-semibold text-white">
                    #{nftMetadata.contributorNumber}
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Contributed On</div>
                  <div className="text-lg font-semibold text-white">
                    {formatDate(nftMetadata.timestamp)}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-700">
                <a
                  href={`https://sepolia.arbiscan.io/nft/${nftContractAddress}/${nftMetadata.tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  <span>🔍</span>
                  View on Arbiscan
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>

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

      {/* Minted but Metadata Loading Failed */}
      {nftReward.eligible && nftReward.minted && !nftMetadata && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-semibold text-white mb-2">NFT Minted!</h3>
            <p className="text-gray-400 mb-4">
              Token ID: {nftReward.tokenId.toString()}
            </p>
            <p className="text-gray-500 text-sm mb-4">
              Metadata is loading...
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={fetchNFTReward}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                🔄 Retry
              </button>
              <a
                href={`https://sepolia.arbiscan.io/nft/${nftContractAddress}/${nftReward.tokenId.toString()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <span>🔍</span>
                View on Arbiscan
                <span>↗</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}