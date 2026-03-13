// app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { formatEther, Address } from 'viem';
import Link from 'next/link';
import { CROWDFUND_ABI } from '@/constants/abi';
// import { FACTORY_ABI } from '@/constants/abi';

interface CampaignSummary {
  address: Address;
  name: string;
  fundingCap: bigint;
  totalFundsRaised: bigint;
  deadline: bigint;
  finalized: boolean;
  successful: boolean;
  creator: Address;
  nftContract: Address | null;
}

interface DashboardStats {
  totalCampaigns: number;
  totalRaised: bigint;
  activeCampaigns: number;
  successfulCampaigns: number;
}

export default function Dashboard() {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  
  const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as Address;
  
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCampaigns: 0,
    totalRaised: BigInt(0),
    activeCampaigns: 0,
    successfulCampaigns: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userAddress && publicClient) {
      fetchDashboardData();
    }
  }, [userAddress, publicClient]);

  const fetchDashboardData = async () => {
    if (!userAddress || !publicClient || !factoryAddress) return;

    setLoading(true);
    setError(null);

    try {
      // Get all campaigns created by this user
      const campaignAddresses = await publicClient.readContract({
        address: factoryAddress,
        abi: CROWDFUND_ABI,
        functionName: 'getCampaignsByCreator',
        args: [userAddress],
      }) as Address[];

      // Fetch details for each campaign
      const campaignPromises = campaignAddresses.map(async (campaignAddr) => {
        try {
          // Get campaign details
          const details = await publicClient.readContract({
            address: campaignAddr,
            abi: CROWDFUND_ABI,
            functionName: 'getCampaignDetails',
          }) as readonly [string, Address, bigint, bigint, bigint, boolean, boolean, Address, bigint, boolean];

          // Get NFT contract address
          let nftContract: Address | null = null;
          try {
            nftContract = await publicClient.readContract({
              address: factoryAddress,
              abi: CROWDFUND_ABI,
              functionName: 'getNFTContractForCampaign',
              args: [campaignAddr],
            }) as Address;
            
            if (nftContract === '0x0000000000000000000000000000000000000000') {
              nftContract = null;
            }
          } catch (err) {
            console.error('Error fetching NFT contract:', err);
          }

          return {
            address: campaignAddr,
            name: details[0],
            fundingCap: details[2],
            totalFundsRaised: details[4],
            deadline: details[3],
            finalized: details[5],
            successful: details[6],
            creator: details[7],
            nftContract,
          } as CampaignSummary;
        } catch (err) {
          console.error(`Error fetching campaign ${campaignAddr}:`, err);
          return null;
        }
      });

      const campaignData = (await Promise.all(campaignPromises)).filter(
        (c): c is CampaignSummary => c !== null
      );

      setCampaigns(campaignData);

      // Calculate stats
      const totalRaised = campaignData.reduce(
        (sum, c) => sum + c.totalFundsRaised,
        BigInt(0)
      );
      const activeCampaigns = campaignData.filter(
        (c) => !c.finalized && Number(c.deadline) * 1000 > Date.now()
      ).length;
      const successfulCampaigns = campaignData.filter((c) => c.successful).length;

      setStats({
        totalCampaigns: campaignData.length,
        totalRaised,
        activeCampaigns,
        successfulCampaigns,
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (campaign: CampaignSummary) => {
    const now = Date.now();
    const deadline = Number(campaign.deadline) * 1000;

    if (campaign.finalized) {
      return campaign.successful ? (
        <span className="px-3 py-1 bg-green-900/30 text-green-400 border border-green-700 rounded-full text-sm font-medium">
          ✅ Successful
        </span>
      ) : (
        <span className="px-3 py-1 bg-red-900/30 text-red-400 border border-red-700 rounded-full text-sm font-medium">
          ❌ Failed
        </span>
      );
    }

    if (now > deadline) {
      return (
        <span className="px-3 py-1 bg-yellow-900/30 text-yellow-400 border border-yellow-700 rounded-full text-sm font-medium">
          ⏰ Ended (Pending Finalization)
        </span>
      );
    }

    return (
      <span className="px-3 py-1 bg-blue-900/30 text-blue-400 border border-blue-700 rounded-full text-sm font-medium">
        🟢 Active
      </span>
    );
  };

  const formatDeadline = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getProgressPercentage = (raised: bigint, cap: bigint) => {
    if (cap === BigInt(0)) return 0;
    return Number((raised * BigInt(100)) / cap);
  };

  // Not connected
  if (!userAddress) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="text-6xl mb-6">🔐</div>
          <h1 className="text-3xl font-bold text-white mb-4">
            Connect Your Wallet
          </h1>
          <p className="text-gray-400 mb-8">
            Please connect your wallet to view your campaign dashboard
          </p>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="text-6xl mb-6">⏳</div>
          <h1 className="text-3xl font-bold text-white mb-4">
            Loading Dashboard...
          </h1>
          <p className="text-gray-400">Fetching your campaigns</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="text-6xl mb-6">❌</div>
          <h1 className="text-3xl font-bold text-white mb-4">Error</h1>
          <p className="text-red-400 mb-8">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          📊 My Campaign Dashboard
        </h1>
        <p className="text-gray-400">
          Manage and track all your crowdfunding campaigns
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Campaigns */}
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-blue-300 text-sm font-medium">Total Campaigns</h3>
            <span className="text-3xl">📋</span>
          </div>
          <p className="text-4xl font-bold text-white">{stats.totalCampaigns}</p>
        </div>

        {/* Total Raised */}
        <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-green-300 text-sm font-medium">Total Raised</h3>
            <span className="text-3xl">💰</span>
          </div>
          <p className="text-4xl font-bold text-white">
            {formatEther(stats.totalRaised).slice(0, 8)}
          </p>
          <p className="text-green-400 text-sm mt-1">ETH</p>
        </div>

        {/* Active Campaigns */}
        <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-purple-300 text-sm font-medium">Active Campaigns</h3>
            <span className="text-3xl">🟢</span>
          </div>
          <p className="text-4xl font-bold text-white">{stats.activeCampaigns}</p>
        </div>

        {/* Successful Campaigns */}
        <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 border border-yellow-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-yellow-300 text-sm font-medium">Successful</h3>
            <span className="text-3xl">✅</span>
          </div>
          <p className="text-4xl font-bold text-white">{stats.successfulCampaigns}</p>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Your Campaigns</h2>
            <Link
              href="/create-campaign"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              + Create New Campaign
            </Link>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No Campaigns Yet
            </h3>
            <p className="text-gray-400 mb-6">
              You haven't created any campaigns. Start your first one!
            </p>
            <Link
              href="/create-campaign"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Create Your First Campaign
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {campaigns.map((campaign) => (
              <div key={campaign.address} className="p-6 hover:bg-gray-750 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Campaign Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-white">
                        {campaign.name}
                      </h3>
                      {getStatusBadge(campaign)}
                      {campaign.nftContract && (
                        <span className="px-2 py-1 bg-indigo-900/30 text-indigo-400 border border-indigo-700 rounded text-xs">
                          NFT
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                      <span>📅 Deadline: {formatDeadline(campaign.deadline)}</span>
                      <span>
                        🎯 Goal: {formatEther(campaign.fundingCap)} ETH
                      </span>
                      <span className="text-gray-500 font-mono text-xs">
                        {campaign.address.slice(0, 6)}...{campaign.address.slice(-4)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Progress</span>
                        <span className="text-white font-semibold">
                          {formatEther(campaign.totalFundsRaised)} / {formatEther(campaign.fundingCap)} ETH
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            campaign.successful
                              ? 'bg-green-500'
                              : getProgressPercentage(campaign.totalFundsRaised, campaign.fundingCap) >= 100
                              ? 'bg-green-500'
                              : 'bg-blue-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              getProgressPercentage(campaign.totalFundsRaised, campaign.fundingCap),
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {getProgressPercentage(campaign.totalFundsRaised, campaign.fundingCap).toFixed(1)}% funded
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/campaign/${campaign.address}`}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}