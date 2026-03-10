'use client';

import { useState, useEffect } from 'react';
import CampaignCard from '@/components/CampaignCard';
import { useCrowdfundFactory } from '@/hooks/UseCrowdfundFactory';
import { useAccount } from 'wagmi';

export default function ExplorePage() {
  const { campaigns, loading, refreshCampaigns } = useCrowdfundFactory();
  const { address } = useAccount();
  const [filter, setFilter] = useState<'all' | 'active' | 'successful' | 'ended'>('all');

  useEffect(() => {
    refreshCampaigns();
  }, []);

  // Filter campaigns based on selected filter
  const filteredCampaigns = campaigns.filter(campaign => {
    const now = Date.now();
    const deadline = Number(campaign.deadline) * 1000;
    
    if (filter === 'all') return true;
    if (filter === 'active') return !campaign.finalized && now < deadline;
    if (filter === 'successful') return campaign.finalized && campaign.isSuccessful;
    if (filter === 'ended') return now > deadline || campaign.finalized;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 relative overflow-x-hidden">
      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.05)_0%,transparent_50%),radial-gradient(circle_at_80%_70%,rgba(168,85,247,0.05)_0%,transparent_50%)]" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Explore
            <span className="block bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              All Campaigns
            </span>
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Discover and support innovative projects on the blockchain
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8 justify-center">
          {(['all', 'active', 'successful', 'ended'] as const).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`
                px-6 py-2.5 rounded-xl font-semibold transition-all duration-200
                ${filter === filterType
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
                }
              `}
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats Bar */}
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">
            {filter === 'all' ? 'All Campaigns' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Campaigns`}
          </h2>
          <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-white/70 text-sm font-semibold">
            {filteredCampaigns.length} {filteredCampaigns.length === 1 ? 'Campaign' : 'Campaigns'}
          </div>
        </div>

        {/* Campaigns Grid */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/50">Loading campaigns...</p>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-16 px-8 bg-white/[0.02] border-2 border-dashed border-white/10 rounded-3xl">
            <div className="text-6xl mb-4 opacity-50">
              {filter === 'all' ? '📦' : '🔍'}
            </div>
            <h3 className="text-2xl font-semibold text-white/90 mb-2">
              No {filter !== 'all' && filter} campaigns found
            </h3>
            <p className="text-white/50">
              {filter === 'all' 
                ? 'Be the first to create a campaign!' 
                : `No ${filter} campaigns at the moment`
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.address}
                campaign={campaign}
                account={address || null}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}