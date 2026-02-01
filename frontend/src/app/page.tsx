'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import CampaignCard from '@/components/CampaignCard';
import CreateCampaignModal from '@/components/CreateCampaignModal';
import { useCrowdfundFactory } from '@/hooks/UseCrowdfundFactory';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Address } from 'viem';

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { campaigns, loading, createCampaign, refreshCampaigns } = useCrowdfundFactory();
  const { address, isConnected } = useAccount();

  const handleCreateCampaign = async (data: {
    name: string;
    beneficiary: Address;
    duration: number;
    fundingCap: string;
    milestones?: Array<{ description: string; amount: string }>;
  }) => {
    try {
      await createCampaign(data);
      setIsModalOpen(false);
      await refreshCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Failed to create campaign. Check console for details.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 relative overflow-x-hidden">
      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.05)_0%,transparent_50%),radial-gradient(circle_at_80%_70%,rgba(168,85,247,0.05)_0%,transparent_50%)]" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pb-16">
        {/* Hero Section */}
        <div className="text-center pt-20 pb-16 relative">
          {/* Grid Background */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[linear-gradient(rgba(99,102,241,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.1)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(circle,rgba(0,0,0,0.3)_0%,transparent_70%)] pointer-events-none" />

          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight animate-fade-in-up">
            Create Crowdfunds
            <span className="block bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              With Milestones
            </span>
          </h2>

          <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up animation-delay-100">
            Launch campaigns, set milestones, and release funds progressively.
            <br />
            Full transparency. Zero trust required.
          </p>

          {isConnected && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg rounded-2xl shadow-[0_10px_40px_rgba(99,102,241,0.3),inset_0_-2px_10px_rgba(0,0,0,0.2)] hover:shadow-[0_15px_50px_rgba(99,102,241,0.4)] hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 animate-fade-in-up animation-delay-200"
            >
              <span className="text-2xl font-light">+</span>
              Launch Campaign
            </button>
          )}
        </div>

        {/* Campaigns Section */}
        <section className="mt-16">
          <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
            <h3 className="text-3xl font-bold text-white tracking-tight">
              Active Campaigns
            </h3>
            <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-white/70 text-sm font-semibold">
              {campaigns.length} {campaigns.length === 1 ? 'Campaign' : 'Campaigns'}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/50">Loading campaigns...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16 px-8 bg-white/[0.02] border-2 border-dashed border-white/10 rounded-3xl">
              <div className="text-6xl mb-4 opacity-50">📦</div>
              <h4 className="text-2xl font-semibold text-white/90 mb-2">
                No campaigns yet
              </h4>
              <p className="text-white/50">
                {isConnected
                  ? "Be the first to launch a campaign!"
                  : "Connect your wallet to get started"
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.address}
                  campaign={campaign}
                  account={address || null}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <CreateCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateCampaign}
      />
    </div>
  );
}