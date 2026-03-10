// app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { formatEther, Address } from 'viem';
import Link from 'next/link';

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Campaign {
  address: string;
  name: string;
  creator: string;
  beneficiary: string;
  fundingCap: string;
  totalFundsRaised: string;
  deadline: string;
  finalized: boolean;
  successful: boolean;
  governanceEnabled: boolean;
  nftRewardsEnabled: boolean;
  nftContractAddress: string | null;
  contributorCount: number;
}

interface DashboardStats {
  totalCampaigns: number;
  totalRaised: bigint;
  activeCampaigns: number;
  successfulCampaigns: number;
}

export default function Dashboard() {
  const { address: userAddress } = useAccount();
  
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCampaigns: 0,
    totalRaised: BigInt(0),
    activeCampaigns: 0,
    successfulCampaigns: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userAddress) {
      fetchDashboardData();
    }
  }, [userAddress]);

  const fetchDashboardData = async () => {
    if (!userAddress) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch campaigns created by this user from API
      const response = await fetch(`${API_URL}/api/users/${userAddress}/campaigns`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }

      const data = await response.json();
      const campaignData = data.campaigns || data;

      setCampaigns(campaignData);

      // Calculate stats
      const totalRaised = campaignData.reduce(
        (sum: bigint, c: Campaign) => sum + BigInt(c.totalFundsRaised),
        BigInt(0)
      );
      
      const now = Date.now();
      const activeCampaigns = campaignData.filter(
        (c: Campaign) => !c.finalized && new Date(c.deadline).getTime() > now
      ).length;
      
      const successfulCampaigns = campaignData.filter((c: Campaign) => c.successful).length;

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

  const getStatusBadge = (campaign: Campaign) => {
    const now = Date.now();
    const deadline = new Date(campaign.deadline).getTime();

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

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getProgressPercentage = (raised: string, cap: string) => {
    const raisedBig = BigInt(raised);
    const capBig = BigInt(cap);
    if (capBig === BigInt(0)) return 0;
    return Number((raisedBig * BigInt(100)) / capBig);
  };

  // Not connected
  if (!userAddress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
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
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="w-12 h-12 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-white mb-4">
              Loading Dashboard...
            </h1>
            <p className="text-gray-400">Fetching your campaigns</p>
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
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
          <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-700 rounded-xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-blue-300 text-sm font-medium">Total Campaigns</h3>
              <span className="text-3xl">📋</span>
            </div>
            <p className="text-4xl font-bold text-white">{stats.totalCampaigns}</p>
          </div>

          {/* Total Raised */}
          <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-700 rounded-xl p-6 backdrop-blur-sm">
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
          <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-700 rounded-xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-purple-300 text-sm font-medium">Active Campaigns</h3>
              <span className="text-3xl">🟢</span>
            </div>
            <p className="text-4xl font-bold text-white">{stats.activeCampaigns}</p>
          </div>

          {/* Successful Campaigns */}
          <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 border border-yellow-700 rounded-xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-yellow-300 text-sm font-medium">Successful</h3>
              <span className="text-3xl">✅</span>
            </div>
            <p className="text-4xl font-bold text-white">{stats.successfulCampaigns}</p>
          </div>
        </div>

        {/* Campaigns List */}
        <div className="bg-white/[0.03] rounded-xl border border-white/10 backdrop-blur-md">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Your Campaigns</h2>
              <Link
                href="/create"
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/50 text-white rounded-lg transition-all"
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
                href="/create"
                className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/50 text-white rounded-lg transition-all"
              >
                Create Your First Campaign
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {campaigns.map((campaign) => (
                <div key={campaign.address} className="p-6 hover:bg-white/[0.02] transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Campaign Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-xl font-semibold text-white">
                          {campaign.name}
                        </h3>
                        {getStatusBadge(campaign)}
                        {campaign.nftRewardsEnabled && (
                          <span className="px-2 py-1 bg-indigo-900/30 text-indigo-400 border border-indigo-700 rounded text-xs">
                            🎨 NFT
                          </span>
                        )}
                        {campaign.governanceEnabled && (
                          <span className="px-2 py-1 bg-purple-900/30 text-purple-400 border border-purple-700 rounded text-xs">
                            🗳️ Governance
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <span>📅 Deadline: {formatDeadline(campaign.deadline)}</span>
                        <span>
                          🎯 Goal: {formatEther(BigInt(campaign.fundingCap))} ETH
                        </span>
                        <span>
                          👥 {campaign.contributorCount} contributor{campaign.contributorCount !== 1 ? 's' : ''}
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
                            {formatEther(BigInt(campaign.totalFundsRaised))} / {formatEther(BigInt(campaign.fundingCap))} ETH
                          </span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              campaign.successful
                                ? 'bg-green-500'
                                : getProgressPercentage(campaign.totalFundsRaised, campaign.fundingCap) >= 100
                                ? 'bg-green-500'
                                : 'bg-gradient-to-r from-indigo-500 to-purple-600'
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
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors"
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
    </div>
  );
}