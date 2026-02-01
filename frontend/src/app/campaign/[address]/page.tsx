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
import { NFT_CONTRACT_ABI } from '@/constants/nft-abi';
import NFTReward from '@/components/NFTReward';

// ---------------------------------------------------------------------------
// WithdrawFunds — inline component for no-milestone successful campaigns
// ---------------------------------------------------------------------------

interface WithdrawFundsProps {
  campaignAddress: Address;
  beneficiary: Address;
  totalFundsRaised: bigint;
  onSuccess: () => Promise<void>;
}

function WithdrawFunds({
  campaignAddress,
  beneficiary,
  totalFundsRaised,
  onSuccess,
}: WithdrawFundsProps) {
  const [withdrawn, setWithdrawn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: userAddress } = useAccount();

  // On mount, check whether funds have already been withdrawn
  useEffect(() => {
    const check = async () => {
      if (!publicClient) return;
      try {
        const already = (await publicClient.readContract({
          address: campaignAddress,
          abi: CROWDFUND_ABI,
          functionName: 'fundsWithdrawn',
        })) as boolean;
        setWithdrawn(already);
      } catch {
        // If the read fails the flag defaults to false — safe fallback
      } finally {
        setIsLoading(false);
      }
    };
    check();
  }, [campaignAddress, publicClient]);

  const handleWithdraw = async () => {
    if (!publicClient || !walletClient || !userAddress) {
      alert('Please connect your wallet');
      return;
    }

    setIsWithdrawing(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: campaignAddress,
        abi: CROWDFUND_ABI,
        functionName: 'withdrawFunds',
        account: userAddress,
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });

      setWithdrawn(true);
      alert('✅ Funds withdrawn to beneficiary successfully!');
      await onSuccess(); // re-fetch parent campaign data
    } catch (error) {
      let msg = 'Unknown error';
      if (error instanceof Error) {
        msg = error.message;
        if (msg.includes('user rejected')) msg = 'Transaction rejected by wallet.';
        if (msg.includes('Funds already withdrawn')) msg = 'Funds have already been withdrawn.';
      }
      alert('Failed to withdraw funds: ' + msg);
    } finally {
      setIsWithdrawing(false);
    }
  };

  // --- loading skeleton ---
  if (isLoading) {
    return (
      <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
        <div className="text-gray-400">Checking withdrawal status…</div>
      </div>
    );
  }

  // --- already withdrawn ---
  if (withdrawn) {
    return (
      <div className="bg-green-900/30 border border-green-700 rounded-xl p-6">
        <p className="text-green-300 font-semibold mb-1">✅ Funds Withdrawn</p>
        <p className="text-green-200 text-sm">
          All funds have been sent to the beneficiary address.
        </p>
        <p className="text-green-200/60 font-mono text-xs mt-3 break-all">
          {beneficiary}
        </p>
      </div>
    );
  }

  // --- ready to withdraw ---
  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-gray-400 text-sm">Total funds to withdraw</p>
            <p className="text-white text-3xl font-bold mt-1">
              {formatEther(totalFundsRaised)}{' '}
              <span className="text-lg text-gray-400 font-normal">ETH</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Beneficiary</p>
            <p className="text-indigo-400 font-mono text-xs mt-1 break-all max-w-[200px] text-right">
              {beneficiary.slice(0, 8)}…{beneficiary.slice(-6)}
            </p>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4">
        <p className="text-yellow-300 text-sm">
          ⚠️ This action is permanent. All escrowed funds will be transferred to the beneficiary address in a single transaction.
        </p>
      </div>

      {/* Withdraw button */}
      <button
        onClick={handleWithdraw}
        disabled={isWithdrawing}
        className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {isWithdrawing ? (
          <>
            <span className="animate-spin">⏳</span>
            Withdrawing…
          </>
        ) : (
          <>💰 Withdraw Funds</>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CampaignDetails page
// ---------------------------------------------------------------------------

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

type TabType = 'overview' | 'updates' | 'governance' | 'milestone-funds' | 'funds' | 'nft-rewards';

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
  const canClaimRefund = campaign?.finalized && !campaign.successful && campaign.userContribution < campaign.fundingCap && campaign.userContribution > BigInt(0);
  console.log('campaign contribution:', campaign?.userContribution) ;

  useEffect(() => {
    if (campaignAddress) {
      fetchCampaignData();
    }
  }, [campaignAddress, userAddress]);

  const fetchCampaignData = async (): Promise<void> => {
    try {
      setLoading(true);
      if (!publicClient) return;

      const details = (await publicClient.readContract({
        address: campaignAddress,
        abi: CROWDFUND_ABI,
        functionName: 'getCampaignDetails',
      })) as readonly [
        string,
        Address,
        bigint,
        bigint,
        bigint,
        boolean,
        boolean,
        Address,
        bigint,
        boolean,
        bigint,
      ];

      let userContribution = BigInt(0);
      if (userAddress) {
        userContribution = (await publicClient.readContract({
          address: campaignAddress,
          abi: CROWDFUND_ABI,
          functionName: 'contributions',
          args: [userAddress],
        })) as bigint;
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
        functionName: 'finalize',
        account: userAddress,
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });

      alert('✅ Campaign finalized successfully!');
      await fetchCampaignData();
    } catch (error) {
      console.error('Error finalizing campaign:', error);

      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes('user rejected')) errorMessage = 'Transaction was rejected';
        else if (errorMessage.includes('Campaign not ended'))
          errorMessage = 'Campaign has not ended yet';
        else if (errorMessage.includes('Already finalized'))
          errorMessage = 'Campaign already finalized';
      }

      alert('Failed to finalize campaign: ' + errorMessage);
    } finally {
      setIsFinalizing(false);
    }
  };

  const getStatus = (): string => {
    if (!campaign) return '';
    if (campaign.finalized) return campaign.successful ? 'Successful' : 'Failed';

    const now = Math.floor(Date.now() / 1000);
    if (now >= campaign.deadline) return 'Ended';
    if (campaign.totalFundsRaised >= campaign.fundingCap) return 'Fully Funded';
    return 'Active';
  };

  const getTimeRemaining = (): string => {
    if (!campaign) return '';

    const now = Math.floor(Date.now() / 1000);
    const remaining = campaign.deadline - now;
    if (remaining <= 0) return 'Campaign Ended';

    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.ceil((remaining % 3600) / 60);

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

  const canFinalize =
    campaign && !campaign.finalized && Math.floor(Date.now() / 1000) >= campaign.deadline;

    

  // -----------------------------------------------------------------------
  // Loading / not-found
  // -----------------------------------------------------------------------

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


  const handleClaimRefund = async () => {
    if (!walletClient || !publicClient || !campaign || !userAddress) return;

    try {
      setLoading(true);

      console.log('═══════════════════════════════════════');
      console.log('💰 CLAIMING REFUND');
      console.log('═══════════════════════════════════════');
      console.log('Campaign:', campaignAddress);
      console.log('Your address:', userAddress);
      
      // Simulate first
      try {
        const { request } = await publicClient.simulateContract({
          address: campaignAddress,
          abi: CROWDFUND_ABI,
          functionName: 'claimRefund',
          account: userAddress,
        });
        console.log('✅ Simulation successful');

        const hash = await walletClient.writeContract(request);
        await publicClient.waitForTransactionReceipt({ hash });
        console.log('✅ Refund claimed successfully!');
      } catch (simError: any) {
        console.error('❌ Simulation failed:', simError);

        let errorMsg = 'Cannot claim refund:\n\n';
        if (simError.message?.includes('Campaign not finalized yet')) {
          errorMsg += 'Campaign has not been finalized. Ask the creator to finalize it first.';
        } else if (simError.message?.includes('Campaign was successful')) {
          errorMsg += 'Campaign was successful. No refunds are available.';
        } else if (simError.message?.includes('No contribution to refund')) {
          errorMsg += 'You have no contribution to refund. You may have already claimed it.';
        } else {
          errorMsg += simError.shortMessage || simError.message || 'Unknown error';
        }

        alert(errorMsg);
        return;
      }

    } catch (error: any) {
      console.error('❌ Claim refund error:', error);
      console.log('Error details:', {
        message: error.message,
        shortMessage: error.shortMessage,
        cause: error.cause,
      });

      let errorMsg = 'Failed to claim refund:\n\n';

      if (error.message?.includes('Campaign not finalized')) {
        errorMsg += 'Campaign has not been finalized yet.';
      } else if (error.message?.includes('Campaign was successful')) {
        errorMsg += 'Campaign was successful. No refunds available.';
      } else if (error.message?.includes('No contribution to refund')) {
        errorMsg += 'You have no contribution to refund. You may have already claimed it.';
      } else if (error.message?.includes('user rejected') || error.message?.includes('User rejected')) {
        errorMsg = 'Transaction cancelled.';
      } else if (error.message?.includes('insufficient funds')) {
        errorMsg += 'Insufficient ETH for gas fees.';
      } else if (error.message?.includes('Refund transfer failed')) {
        errorMsg += 'The refund transfer failed. This might be a contract or network issue. Please try again.';
      } else {
        errorMsg += error.shortMessage || error.message || 'Unknown error';
      }

      alert(errorMsg);
    } finally {
      setLoading(false);
      console.log('═══════════════════════════════════════');
    }
  };



  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Back Button */}
        <a href="/" className="inline-block mb-6 text-blue-400 hover:text-blue-300 transition-colors">
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
              <div
                className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${
                  getStatus() === 'Active'
                    ? 'bg-green-900/50 text-green-300 border border-green-700'
                    : getStatus() === 'Fully Funded'
                    ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                    : getStatus() === 'Successful'
                    ? 'bg-green-900/50 text-green-300 border border-green-700'
                    : getStatus() === 'Failed'
                    ? 'bg-red-900/50 text-red-300 border border-red-700'
                    : 'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
                }`}
              >
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
              <div className="text-white font-semibold mt-1">{campaign.milestoneCount}</div>
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

          {/* Finalization Button */}
          {isCreator && canFinalize && (
            <div className="mt-6 ">
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-4">
                <div className="text-yellow-300 text-sm font-semibold mb-2">
                  ⚠️ Campaign Has Ended
                </div>
                <p className="text-yellow-200 text-sm">
                  This campaign needs to be finalized to determine success/failure and enable fund
                  distribution or refunds.
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
                  <>🏁 Finalize Campaign</>
                )}
              </button>
            </div>
          )}

          {canClaimRefund &&  (
            <div className="mt-6 ">
              <div className="mb-6 p-6 bg-red-500/10 border border-red-500/30 rounded-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-red-400 mb-2">Claim Your Refund</h3>
                    <p className="text-white/70">
                      This campaign did not reach its funding goal. You can claim a refund of your {parseFloat(formatEther(campaign.userContribution)).toFixed(4)} ETH contribution.
                    </p>
                  </div>
                  <button
                    onClick={handleClaimRefund}
                    disabled={loading}
                    className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold rounded-xl hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {loading ? 'Claiming...' : 'Claim Refund'}
                  </button>
                </div>
              </div>
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

          {/* Funds tab: milestone-based path for creator */}
          {isCreator && campaign.milestoneCount > 0 && (
            <button
              onClick={() => setActiveTab('milestone-funds')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                activeTab === 'milestone-funds'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              💰 Funds
            </button>
          )}

          {/* Funds tab: no-milestone path for creator */}
          {isCreator && campaign.milestoneCount === 0 && (
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

          {campaign.successful && (
            <button
              onClick={() => setActiveTab('nft-rewards')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                activeTab === 'nft-rewards'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              🎨 NFT Rewards
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-700">
          {/* ---- Overview ---- */}
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Campaign Overview</h2>
              <div className="space-y-4">
                <div>
                  <div className="text-gray-400 text-sm">Beneficiary Address</div>
                  <a
                    href={`https://sepolia.arbiscan.io/address/${campaign.beneficiary}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 font-mono text-sm flex items-center gap-2 break-all"
                  >
                    {campaign.beneficiary}
                    <span className="text-xs flex-shrink-0">↗</span>
                  </a>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Creator Address</div>
                  <a
                    href={`https://sepolia.arbiscan.io/address/${campaign.creator}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 font-mono text-sm flex items-center gap-2 break-all"
                  >
                    {campaign.creator}
                    <span className="text-xs flex-shrink-0">↗</span>
                  </a>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Escrow Address</div>
                  <a
                    href={`https://sepolia.arbiscan.io/address/${campaignAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 font-mono text-sm flex items-center gap-2 break-all"
                  >
                    {campaignAddress}
                    <span className="text-xs flex-shrink-0">↗</span>
                  </a>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Campaign Status</div>
                  <div className="text-white mt-1">
                    {campaign.finalized
                      ? campaign.successful
                        ? '✅ Campaign succeeded - Funds in escrow'
                        : '❌ Campaign failed - Refunds available'
                      : '🔄 Campaign active - Accepting contributions'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---- Updates ---- */}
          {activeTab === 'updates' && (
            <CampaignUpdates
              campaignAddress={campaignAddress}
              campaignAbi={CROWDFUND_ABI as Abi}
              isCreator={isCreator}
            />
          )}

          {/* ---- Governance ---- */}
          {activeTab === 'governance' && (
            <ContributorGovernance
              campaignAddress={campaignAddress}
              campaignAbi={CROWDFUND_ABI as Abi}
              isCreator={isCreator}
              hasContributed={hasContributed}
              userContribution={campaign.userContribution}
            />
          )}

          {/* ---- Milestone-based fund release ---- */}
          {activeTab === 'milestone-funds' && (
            <MilestoneFundRelease
              campaignAddress={campaignAddress}
              campaignAbi={CROWDFUND_ABI as Abi}
              isCreator={isCreator}
              isSuccessful={campaign.successful}
              isFinalized={campaign.finalized}
              governanceEnabled={campaign.governanceEnabled}
            />
          )}

          {/* ---- No-milestone fund withdrawal ---- */}
          {activeTab === 'funds' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Funds Management</h2>

              {/* Not yet finalized */}
              {!campaign.finalized && (
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-6">
                  <p className="text-yellow-300 font-semibold mb-1">⏳ Campaign Not Finalized</p>
                  <p className="text-yellow-200 text-sm">
                    Finalize the campaign first before funds can be withdrawn.
                  </p>
                </div>
              )}

              {/* Finalized but failed */}
              {campaign.finalized && !campaign.successful && (
                <div className="bg-red-900/30 border border-red-700 rounded-xl p-6">
                  <p className="text-red-300 font-semibold mb-1">❌ Campaign Failed</p>
                  <p className="text-red-200 text-sm">
                    The funding goal was not reached. Contributors can claim refunds — there are no
                    funds for you to withdraw.
                  </p>
                </div>
              )}

              {/* Successful — show the withdraw UI */}
              {campaign.finalized && campaign.successful && (
                <WithdrawFunds
                  campaignAddress={campaignAddress}
                  beneficiary={campaign.beneficiary}
                  totalFundsRaised={campaign.totalFundsRaised}
                  onSuccess={fetchCampaignData}
                />
              )}
            </div>
          )}

          {/* ---- NFT Rewards ---- */}
          {activeTab === 'nft-rewards' && (
            <NFTReward
              campaignAddress={campaignAddress}
              campaignAbi={CROWDFUND_ABI as Abi}
              nftContractAddress={
                process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as Address
              }
              nftContractAbi={NFT_CONTRACT_ABI as Abi}
              campaignName={campaign.name}
              isSuccessful={campaign.successful}
              isFinalized={campaign.finalized}
              nftRewardsEnabled={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}