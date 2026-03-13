'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CreateCampaignModal from '@/components/CreateCampaignModal';
import { useCrowdfundFactory } from '@/hooks/UseCrowdfundFactory';
import { useAccount } from 'wagmi';
import { Address } from 'viem';
import Link from 'next/link';
import { toast } from 'sonner';

export default function CreatePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { createCampaign } = useCrowdfundFactory();
  const { address, isConnected } = useAccount();
  const router = useRouter();

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
      // Redirect to explore or dashboard after creation
      router.push('/explore');
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign. Check console for details.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 relative overflow-x-hidden">
      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.05)_0%,transparent_50%),radial-gradient(circle_at_80%_70%,rgba(168,85,247,0.05)_0%,transparent_50%)]" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16 relative">
          {/* Grid Background */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[linear-gradient(rgba(99,102,241,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.1)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(circle,rgba(0,0,0,0.3)_0%,transparent_70%)] pointer-events-none" />

          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Launch Your
            <span className="block bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Campaign
            </span>
          </h1>

          <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
            Create a crowdfunding campaign with milestones and transparent fund management.
            <br />
            No trust required. Everything on-chain.
          </p>

          {isConnected ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg rounded-2xl shadow-[0_10px_40px_rgba(99,102,241,0.3),inset_0_-2px_10px_rgba(0,0,0,0.2)] hover:shadow-[0_15px_50px_rgba(99,102,241,0.4)] hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300"
            >
              <span className="text-2xl font-light">+</span>
              Create Campaign
            </button>
          ) : (
            <div className="inline-flex flex-col items-center gap-4 p-8 bg-white/5 border border-white/10 rounded-2xl">
              <div className="text-4xl mb-2">🔐</div>
              <p className="text-white/70 mb-4">Connect your wallet to create a campaign</p>
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          {/* Feature 1 */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 hover:bg-white/[0.05] transition-all">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-4">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Milestone-Based</h3>
            <p className="text-white/60 leading-relaxed">
              Set clear milestones and release funds progressively as you achieve goals.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 hover:bg-white/[0.05] transition-all">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
              <span className="text-2xl">🗳️</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Governance</h3>
            <p className="text-white/60 leading-relaxed">
              Optional contributor voting for milestone completion with one-person-one-vote.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 hover:bg-white/[0.05] transition-all">
            <h3 className="text-xl font-bold text-white mb-3">NFT Rewards</h3>
            <p className="text-white/60 leading-relaxed">
              Issue Proof of Contribution NFTs to all supporters automatically when campaign succeeds.
            </p>
          </div>
        </div>

        {/* How it Works */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold text-white mb-12">How It Works</h2>
          
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                1
              </div>
              <h3 className="text-white font-semibold mb-2">Create Campaign</h3>
              <p className="text-white/60 text-sm">Set your goal, duration, and milestones</p>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                2
              </div>
              <h3 className="text-white font-semibold mb-2">Receive Funds</h3>
              <p className="text-white/60 text-sm">Contributors back your campaign</p>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                3
              </div>
              <h3 className="text-white font-semibold mb-2">Complete Milestones</h3>
              <p className="text-white/60 text-sm">Achieve goals and get approval</p>
            </div>

            {/* Step 4 */}
            <div className="relative">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                4
              </div>
              <h3 className="text-white font-semibold mb-2">Release Funds</h3>
              <p className="text-white/60 text-sm">Access funds as you progress</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-3xl p-12">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-white/60 mb-8 max-w-xl mx-auto">
            Join the transparent crowdfunding revolution. Create your campaign in minutes.
          </p>
          {isConnected ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              <span className="text-xl">+</span>
              Create Your Campaign
            </button>
          ) : (
            <p className="text-white/50">Connect your wallet to begin</p>
          )}
        </div>
      </main>

      <CreateCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateCampaign}
      />
    </div>
  );
}