'use client';

import { useState, useEffect } from 'react';
import { formatEther } from 'viem';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PlatformStats {
  totalCampaigns: number;
  activeCampaigns: number;
  successfulCampaigns: number;
  totalRaised: string;
  totalContributors: number;
  totalContributions: number;
  avgContribution: string;
  successRate: number;
}

interface TopCampaign {
  address: string;
  name: string;
  creator: string;
  totalFundsRaised: string;
  fundingCap: string;
  contributorCount: number;
  successful: boolean;
}

interface TopContributor {
  address: string;
  totalContributed: string;
  campaignsSupported: number;
}

interface CategoryStats {
  governance: { count: number; totalRaised: string };
  nft: { count: number; totalRaised: string };
  regular: { count: number; totalRaised: string };
}

export default function AnalyticsPage() {
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [topCampaigns, setTopCampaigns] = useState<TopCampaign[]>([]);
  const [topContributors, setTopContributors] = useState<TopContributor[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'raised' | 'contributors' | 'recent'>('raised');

  useEffect(() => {
    fetchAnalytics();
  }, [filter]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [platformRes, campaignsRes, contributorsRes, categoriesRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/platform`),
        fetch(`${API_URL}/api/analytics/top-campaigns?limit=10&filter=${filter}`),
        fetch(`${API_URL}/api/analytics/top-contributors?limit=10`),
        fetch(`${API_URL}/api/analytics/categories`),
      ]);

      const [platform, campaigns, contributors, categories] = await Promise.all([
        platformRes.json(),
        campaignsRes.json(),
        contributorsRes.json(),
        categoriesRes.json(),
      ]);

      setPlatformStats(platform);
      setTopCampaigns(campaigns.campaigns || []);
      setTopContributors(contributors.contributors || []);
      setCategoryStats(categories);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !platformStats) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="fixed inset-0 bg-gradient-to-br from-violet-950/20 via-fuchsia-950/20 to-cyan-950/20 animate-pulse" />
        
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-20 h-20 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-6" />
            <p className="text-2xl font-light text-white/60 tracking-[0.2em] uppercase">Loading Analytics</p>
          </div>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden">
      {/* Dramatic background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Noise texture overlay */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      <div className="relative z-10 max-w-[1600px] mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-16">
          <div className="flex items-baseline gap-4 mb-4">
            <h1 className="text-7xl font-light tracking-tight">
              Platform
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 font-extralight">
                Analytics
              </span>
            </h1>
          </div>
          <p className="text-xl text-white/40 font-light tracking-wide">
            Real-time insights across the crowdfunding ecosystem
          </p>
        </div>

        {/* Hero Stats Grid - Large Impact Numbers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {/* Total Raised - Hero Stat */}
          <div className="md:col-span-2 lg:col-span-2 bg-gradient-to-br from-violet-950/40 to-fuchsia-950/40 border border-violet-500/20 rounded-3xl p-10 backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <div className="text-sm font-medium tracking-[0.15em] uppercase text-violet-300/60 mb-3">Total Raised</div>
              <div className="text-7xl font-extralight tabular-nums tracking-tight text-white mb-2">
                {parseFloat(formatEther(BigInt(platformStats.totalRaised))).toFixed(2)}
              </div>
              <div className="text-2xl text-violet-300 font-light">ETH</div>
              <div className="mt-4 text-sm text-white/40">
                Across {platformStats.totalCampaigns} campaigns
              </div>
            </div>
          </div>

          {/* Success Rate */}
          <div className="bg-gradient-to-br from-emerald-950/40 to-teal-950/40 border border-emerald-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <div className="text-xs font-medium tracking-[0.15em] uppercase text-emerald-300/60 mb-3">Success Rate</div>
              <div className="text-5xl font-extralight tabular-nums tracking-tight text-white mb-1">
                {platformStats.successRate.toFixed(1)}%
              </div>
              <div className="text-sm text-white/40 mt-2">
                {platformStats.successfulCampaigns} successful
              </div>
            </div>
          </div>

          {/* Contributors */}
          <div className="bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border border-cyan-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <div className="text-xs font-medium tracking-[0.15em] uppercase text-cyan-300/60 mb-3">Contributors</div>
              <div className="text-5xl font-extralight tabular-nums tracking-tight text-white mb-1">
                {formatNumber(platformStats.totalContributors)}
              </div>
              <div className="text-sm text-white/40 mt-2">
                {formatNumber(platformStats.totalContributions)} contributions
              </div>
            </div>
          </div>

          {/* Active Campaigns */}
          <div className="bg-gradient-to-br from-amber-950/40 to-orange-950/40 border border-amber-500/20 rounded-3xl p-8 backdrop-blur-xl">
            <div className="text-xs font-medium tracking-[0.15em] uppercase text-amber-300/60 mb-3">Active Now</div>
            <div className="text-5xl font-extralight tabular-nums tracking-tight text-white mb-1">
              {platformStats.activeCampaigns}
            </div>
            <div className="text-sm text-white/40 mt-2">
              Live campaigns
            </div>
          </div>

          {/* Avg Contribution */}
          <div className="bg-gradient-to-br from-pink-950/40 to-rose-950/40 border border-pink-500/20 rounded-3xl p-8 backdrop-blur-xl">
            <div className="text-xs font-medium tracking-[0.15em] uppercase text-pink-300/60 mb-3">Avg Contribution</div>
            <div className="text-4xl font-extralight tabular-nums tracking-tight text-white mb-1">
              {parseFloat(formatEther(BigInt(platformStats.avgContribution))).toFixed(3)}
            </div>
            <div className="text-sm text-pink-300">ETH</div>
          </div>

          {/* Category Stats - Compact Cards */}
          {categoryStats && (
            <>
              <div className="bg-gradient-to-br from-purple-950/30 to-indigo-950/30 border border-purple-500/20 rounded-3xl p-6 backdrop-blur-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-2xl">🗳️</div>
                  <div className="text-xs font-medium tracking-[0.15em] uppercase text-purple-300/60">Governance</div>
                </div>
                <div className="text-3xl font-extralight tracking-tight text-white mb-1">
                  {categoryStats.governance.count}
                </div>
                <div className="text-xs text-white/40">
                  {parseFloat(formatEther(BigInt(categoryStats.governance.totalRaised))).toFixed(2)} ETH
                </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-950/30 to-violet-950/30 border border-indigo-500/20 rounded-3xl p-6 backdrop-blur-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-2xl">🎨</div>
                  <div className="text-xs font-medium tracking-[0.15em] uppercase text-indigo-300/60">NFT Rewards</div>
                </div>
                <div className="text-3xl font-extralight tracking-tight text-white mb-1">
                  {categoryStats.nft.count}
                </div>
                <div className="text-xs text-white/40">
                  {parseFloat(formatEther(BigInt(categoryStats.nft.totalRaised))).toFixed(2)} ETH
                </div>
              </div>
            </>
          )}
        </div>

        {/* Top Campaigns Section */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-4xl font-light tracking-tight">
              Top <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">Campaigns</span>
            </h2>
            
            {/* Filter Tabs */}
            <div className="flex gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl">
              {(['raised', 'contributors', 'recent'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-medium tracking-wide transition-all ${
                    filter === f
                      ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/25'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f === 'raised' ? '💰 Highest Raised' : f === 'contributors' ? '👥 Most Contributors' : '🆕 Recent'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {topCampaigns.map((campaign, index) => (
              <Link
                key={campaign.address}
                href={`/campaign/${campaign.address}`}
                className="block group"
              >
                <div className="bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/10 rounded-2xl p-6 backdrop-blur-xl hover:border-violet-500/30 hover:bg-white/[0.05] transition-all duration-300">
                  <div className="flex items-center gap-6">
                    {/* Rank */}
                    <div className={`text-5xl font-extralight tabular-nums w-16 text-center ${
                      index === 0 ? 'text-amber-400' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-orange-600' : 'text-white/30'
                    }`}>
                      {index + 1}
                    </div>

                    {/* Campaign Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-medium text-white mb-2 truncate group-hover:text-violet-300 transition-colors">
                        {campaign.name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-white/40">
                        <span className="font-mono">{campaign.address.slice(0, 6)}...{campaign.address.slice(-4)}</span>
                        <span>👥 {campaign.contributorCount} contributors</span>
                      </div>
                    </div>

                    {/* Amount Raised */}
                    <div className="text-right">
                      <div className="text-3xl font-light tabular-nums text-white mb-1">
                        {parseFloat(formatEther(BigInt(campaign.totalFundsRaised))).toFixed(2)}
                      </div>
                      <div className="text-sm text-violet-300">ETH</div>
                      <div className="text-xs text-white/30 mt-1">
                        {((Number(formatEther(BigInt(campaign.totalFundsRaised))) / Number(formatEther(BigInt(campaign.fundingCap)))) * 100).toFixed(0)}% of goal
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top Contributors Section */}
        <div>
          <h2 className="text-4xl font-light tracking-tight mb-8">
            Top <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">Contributors</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topContributors.map((contributor, index) => (
              <div
                key={contributor.address}
                className="bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/10 rounded-2xl p-6 backdrop-blur-xl hover:border-cyan-500/30 hover:bg-white/[0.05] transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  {/* Rank Badge */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-light ${
                    index === 0 ? 'bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30 text-amber-300' :
                    index === 1 ? 'bg-gradient-to-br from-gray-500/20 to-slate-500/20 border border-gray-500/30 text-gray-300' :
                    index === 2 ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 text-orange-300' :
                    'bg-white/5 border border-white/10 text-white/40'
                  }`}>
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-white/90 mb-1">
                      {contributor.address.slice(0, 8)}...{contributor.address.slice(-6)}
                    </div>
                    <div className="text-xs text-white/40">
                      Supported {contributor.campaignsSupported} campaign{contributor.campaignsSupported !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-light tabular-nums text-white">
                      {parseFloat(formatEther(BigInt(contributor.totalContributed))).toFixed(2)}
                    </div>
                    <div className="text-xs text-cyan-300">ETH</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}