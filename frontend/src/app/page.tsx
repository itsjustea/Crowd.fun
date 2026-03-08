'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useCrowdfundFactory } from '@/hooks/UseCrowdfundFactory';
import CampaignCard from '@/components/CampaignCard';

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const { campaigns, loading } = useCrowdfundFactory();

  // Show only first 3 campaigns as featured
  const featuredCampaigns = campaigns.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 relative overflow-x-hidden">
      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.05)_0%,transparent_50%),radial-gradient(circle_at_80%_70%,rgba(168,85,247,0.05)_0%,transparent_50%)]" />
      </div>

      <main className="relative z-10">
        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
          <div className="relative">
            {/* Grid Background */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[linear-gradient(rgba(99,102,241,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.1)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(circle,rgba(0,0,0,0.3)_0%,transparent_70%)] pointer-events-none" />

            <h1 className="text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-white mb-8 leading-tight">
              Crowdfunding
              <span className="block bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Reimagined
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-white/70 mb-12 max-w-3xl mx-auto leading-relaxed">
              Transparent, milestone-based crowdfunding on the blockchain.
              <br />
              Launch campaigns. Set milestones. Release funds progressively.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/create"
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg rounded-2xl shadow-[0_10px_40px_rgba(99,102,241,0.3)] hover:shadow-[0_15px_50px_rgba(99,102,241,0.4)] hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300"
              >
                <span className="text-2xl">+</span>
                Start a Campaign!
              </Link>

              <Link
                href="/explore"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/20 text-white font-semibold text-lg rounded-2xl hover:bg-white/10 hover:border-white/30 transition-all duration-300"
              >
                <span className="text-xl">🔍</span>
                Explore Campaigns
              </Link>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="text-4xl font-bold text-white text-center mb-16">
            Why Choose Crowd.Fun?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group bg-white/[0.02] border border-white/10 rounded-3xl p-8 hover:bg-white/[0.05] hover:border-white/20 transition-all">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-4xl">🎯</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Milestone-Based</h3>
              <p className="text-white/60 leading-relaxed">
                Set clear goals and release funds progressively. Contributors see exactly how their money is used.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group bg-white/[0.02] border border-white/10 rounded-3xl p-8 hover:bg-white/[0.05] hover:border-white/20 transition-all">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-4xl">🗳️</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Contributor Governance</h3>
              <p className="text-white/60 leading-relaxed">
                One-person-one-vote system. Contributors approve milestone completion. Full transparency.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group bg-white/[0.02] border border-white/10 rounded-3xl p-8 hover:bg-white/[0.05] hover:border-white/20 transition-all">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-4xl">🎨</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">NFT Rewards</h3>
              <p className="text-white/60 leading-relaxed">
                Proof of Contribution NFTs for all supporters. On-chain recognition of your impact.
              </p>
            </div>
          </div>
        </div>

        {/* Featured Campaigns */}
        {!loading && featuredCampaigns.length > 0 && (
          <div className="max-w-7xl mx-auto px-6 py-20">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-4xl font-bold text-white">Featured Campaigns</h2>
              <Link
                href="/explore"
                className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-2 transition-colors"
              >
                View All
                <span>→</span>
              </Link>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {featuredCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.address}
                  campaign={campaign}
                  account={address || null}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stats Section */}
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-3xl p-12">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-5xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                  {campaigns.length}
                </div>
                <div className="text-white/60 text-lg">Total Campaigns</div>
              </div>
              <div>
                <div className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                  100%
                </div>
                <div className="text-white/60 text-lg">Transparent</div>
              </div>
              <div>
                <div className="text-5xl font-bold bg-gradient-to-r from-pink-400 to-indigo-400 bg-clip-text text-transparent mb-2">
                  0%
                </div>
                <div className="text-white/60 text-lg">Platform Fees</div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Launch?
          </h2>
          <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto">
            Join the future of crowdfunding. Create your campaign in minutes.
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xl rounded-2xl shadow-[0_20px_60px_rgba(99,102,241,0.4)] hover:shadow-[0_25px_70px_rgba(99,102,241,0.5)] hover:-translate-y-1 transition-all duration-300"
          >
            <span className="text-2xl">🚀</span>
            Get Started Now
          </Link>
        </div>
      </main>
    </div>
  );
}