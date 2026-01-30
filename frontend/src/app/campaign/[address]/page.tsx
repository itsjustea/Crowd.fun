// app/campaign/[address]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { formatEther } from 'viem';
import type { Address, Abi } from 'viem';
import CampaignUpdates from '@/components/CampaignUpdates';
import ContributorGovernance from '@/components/ContributorGovernance';
import MilestoneFundRelease from '@/components/MilestoneFundRelease';
import { CROWDFUND_ABI } from '@/constants/abi';

interface CampaignData {
  name: string;
  beneficiary: Address;
  fundingCap: bigint;
  deadline: number;
  totalFundsRaised: bigint;
  finalized: boolean;
  successful: boolean;
  creator: Address;
  milestoneCount: number;
  governanceEnabled: boolean;
  updateCount: number;
  userContribution: bigint;
}

type TabType = 'overview' | 'updates' | 'governance' | 'funds';

export default function CampaignDetails() {
  const params = useParams();
  const campaignAddress = params.address as Address;
  
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: userAddress } = useAccount();

  useEffect(() => {
    if (campaignAddress) {
      fetchCampaignData();
    }
  }, [campaignAddress, userAddress]);

  const fetchCampaignData = async (): Promise<void> => {
    try {
      setLoading(true);
      
      if (!publicClient) return;

      const details = await publicClient.readContract({
        address: campaignAddress,
        abi: CROWDFUND_ABI,
        functionName: 'getCampaignDetails',
      }) as readonly [string, Address, bigint, bigint, bigint, boolean, boolean, Address, bigint, boolean, bigint];
      
      // Get user's contribution if connected
      let userContribution = BigInt(0);
      if (userAddress) {
        userContribution = await publicClient.readContract({
          address: campaignAddress,
          abi: CROWDFUND_ABI,
          functionName: 'contributions',
          args: [userAddress],
        }) as bigint;
      }
      
      setCampaign({
        name: details[0],
        beneficiary: details[1],
        fundingCap: details[2],
        deadline: Number(details[3]),
        totalFundsRaised: details[4],
        finalized: details[5],
        successful: details[6],
        creator: details[7],
        milestoneCount: Number(details[8]),
        governanceEnabled: details[9],
        updateCount: Number(details[10]),
        userContribution,
      });
    } catch (error) {
      console.error('Error fetching campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async (): Promise<void> => {
    if (!publicClient || !walletClient || !userAddress) {
      alert('Please connect your wallet');
      return;
    }

    setIsFinalizing(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: campaignAddress,
        abi: CROWDFUND_ABI,
        functionName: 'finalize',  // ← Fixed: was 'finalizeCampaign'
        account: userAddress,
      });

      const hash = await walletClient.writeContract(request);
      
      await publicClient.waitForTransactionReceipt({ hash });
      
      alert('✅ Campaign finalized successfully!');
      
      // Refresh campaign data
      await fetchCampaignData();
    } catch (error) {
      console.error('Error finalizing campaign:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (errorMessage.includes('user rejected')) {
          errorMessage = 'Transaction was rejected';
        } else if (errorMessage.includes('Campaign not ended')) {
          errorMessage = 'Campaign has not ended yet';
        } else if (errorMessage.includes('Already finalized')) {
          errorMessage = 'Campaign already finalized';
        }
      }
      
      alert('Failed to finalize campaign: ' + errorMessage);
    } finally {
      setIsFinalizing(false);
    }
  };

  const getStatus = (): string => {
    if (!campaign) return '';
    
    if (campaign.finalized) {
      return campaign.successful ? 'Successful' : 'Failed';
    }
    
    const now = Math.floor(Date.now() / 1000);
    if (now >= campaign.deadline) {
      return 'Ended';
    }
    
    if (campaign.totalFundsRaised >= campaign.fundingCap) {
      return 'Fully Funded';
    }
    
    return 'Active';
  };

  const getTimeRemaining = (): string => {
    if (!campaign) return '';
    
    const now = Math.floor(Date.now() / 1000);
    const remaining = campaign.deadline - now;
    
    if (remaining <= 0) return 'Campaign ended';
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const fundingPercentage = campaign 
    ? Math.min(100, Number((campaign.totalFundsRaised * BigInt(100)) / campaign.fundingCap))
    : 0;

  const isCreator = campaign && userAddress 
    ? campaign.creator.toLowerCase() === userAddress.toLowerCase()
    : false;

  const hasContributed: boolean = !!(campaign && campaign.userContribution > BigInt(0));
  
  // Check if campaign can be finalized
  const canFinalize = campaign && !campaign.finalized && Math.floor(Date.now() / 1000) >= campaign.deadline;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading campaign...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-white text-xl">Campaign not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Back Button */}
        <a
          href="/"
          className="inline-block mb-6 text-blue-400 hover:text-blue-300 transition-colors"
        >
          ← Back to Campaigns
        </a>

        {/* Campaign Header */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-700 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{campaign.name}</h1>
              {isCreator && (
                <span className="inline-block px-3 py-1 bg-purple-900/50 text-purple-300 text-sm rounded-full border border-purple-700">
                  👑 Your Campaign
                </span>
              )}
            </div>
            <div className="text-right">
              <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${
                getStatus() === 'Active' ? 'bg-green-900/50 text-green-300 border border-green-700' :
                getStatus() === 'Fully Funded' ? 'bg-blue-900/50 text-blue-300 border border-blue-700' :
                getStatus() === 'Successful' ? 'bg-green-900/50 text-green-300 border border-green-700' :
                getStatus() === 'Failed' ? 'bg-red-900/50 text-red-300 border border-red-700' :
                'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
              }`}>
                {getStatus()}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-300 mb-2">
              <span>{formatEther(campaign.totalFundsRaised)} ETH raised</span>
              <span>{formatEther(campaign.fundingCap)} ETH goal</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all"
                style={{ width: `${fundingPercentage}%` }}
              />
            </div>
            <div className="text-center mt-2 text-2xl font-bold text-white">
              {fundingPercentage}%
            </div>
          </div>

          {/* Campaign Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Time Remaining</div>
              <div className="text-white font-semibold mt-1">{getTimeRemaining()}</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Milestones</div>
              <div className="text-white font-semibold mt-1">{campaign.milestoneCount} phases</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Governance</div>
              <div className="text-white font-semibold mt-1">
                {campaign.governanceEnabled ? '🗳️ Enabled' : '❌ Disabled'}
              </div>
            </div>
          </div>

          {/* User Contribution */}
          {hasContributed && (
            <div className="mt-6 bg-blue-900/30 border border-blue-700 rounded-lg p-4">
              <div className="text-blue-300 text-sm">Your Contribution</div>
              <div className="text-white font-bold text-xl mt-1">
                {formatEther(campaign.userContribution)} ETH
              </div>
            </div>
          )}

          {/* Finalization Button - NEW! */}
          {canFinalize && (
            <div className="mt-6">
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-4">
                <div className="text-yellow-300 text-sm font-semibold mb-2">
                  ⚠️ Campaign Has Ended
                </div>
                <p className="text-yellow-200 text-sm">
                  This campaign needs to be finalized to determine success/failure and enable fund distribution or refunds.
                </p>
              </div>
              <button
                onClick={handleFinalize}
                disabled={isFinalizing}
                className="w-full px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isFinalizing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Finalizing...
                  </>
                ) : (
                  <>
                    🏁 Finalize Campaign
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('updates')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'updates'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Updates
            {campaign.updateCount > 0 && (
              <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {campaign.updateCount}
              </span>
            )}
          </button>
          {campaign.governanceEnabled && (
            <button
              onClick={() => setActiveTab('governance')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                activeTab === 'governance'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              🗳️ Governance
            </button>
          )}
          {isCreator && campaign.milestoneCount > 0 && (
            <button
              onClick={() => setActiveTab('funds')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                activeTab === 'funds'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              💰 Funds
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-700">
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Campaign Overview</h2>
              <div className="space-y-4">
                <div>
                  <div className="text-gray-400 text-sm">Beneficiary Address</div>
                  <div className="text-white font-mono text-sm mt-1">
                    {campaign.beneficiary}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Creator Address</div>
                  <div className="text-white font-mono text-sm mt-1">
                    {campaign.creator}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Campaign Status</div>
                  <div className="text-white mt-1">
                    {campaign.finalized 
                      ? campaign.successful 
                        ? '✅ Campaign succeeded - Funds in escrow'
                        : '❌ Campaign failed - Refunds available'
                      : '🔄 Campaign active - Accepting contributions'
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'updates' && (
            <CampaignUpdates
              campaignAddress={campaignAddress}
              campaignAbi={CROWDFUND_ABI as Abi}
              isCreator={isCreator}
            />
          )}

          {activeTab === 'governance' && (
            <ContributorGovernance
              campaignAddress={campaignAddress}
              campaignAbi={CROWDFUND_ABI as Abi}
              isCreator={isCreator}
              hasContributed={hasContributed}
              userContribution={campaign.userContribution}
            />
          )}

          {activeTab === 'funds' && (
            <MilestoneFundRelease
              campaignAddress={campaignAddress}
              campaignAbi={CROWDFUND_ABI as Abi}
              isCreator={isCreator}
              isSuccessful={campaign.successful}
              isFinalized={campaign.finalized}
              governanceEnabled={campaign.governanceEnabled}
            />
          )}
        </div>
      </div>
    </div>
  );
}