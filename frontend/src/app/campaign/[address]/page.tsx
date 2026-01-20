'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import type { Address } from 'viem';
import Link from 'next/link';

const CROWDFUND_ABI = [
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'beneficiary',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'creator',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fundingCap',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'deadline',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalFundsRaised',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'finalized',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isSuccessful',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'contribute',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getMilestoneCount',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMilestone',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [
      { name: 'description', type: 'string' },
      { name: 'amount', type: 'uint256' },
      { name: 'completed', type: 'bool' },
      { name: 'fundsReleased', type: 'bool' }
    ],
    stateMutability: 'view',
  },
] as const;

interface Milestone {
  description: string;
  amount: bigint;
  completed: boolean;
  fundsReleased: boolean;
}

interface CampaignData {
  name: string;
  beneficiary: Address;
  creator: Address;
  fundingCap: bigint;
  deadline: bigint;
  totalFundsRaised: bigint;
  finalized: boolean;
  isSuccessful: boolean;
  milestones: Milestone[];
}

type CampaignStatus = 'active' | 'ended' | 'successful' | 'failed' | 'finalized';

export default function CampaignPage() {
  const params = useParams();
  const router = useRouter();
  const campaignAddress = params.address as Address;

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [contributionAmount, setContributionAmount] = useState('');
  const [isContributing, setIsContributing] = useState(false);

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: account } = useAccount();

  // Fetch campaign data
  useEffect(() => {
    if (!publicClient || !campaignAddress) return;

    const fetchCampaign = async () => {
      try {
        setLoading(true);
        console.log('📖 Loading campaign:', campaignAddress);

        const [name, beneficiary, creator, fundingCap, deadline, totalFundsRaised, finalized, isSuccessful, milestoneCount] = await Promise.all([
          publicClient.readContract({
            address: campaignAddress,
            abi: CROWDFUND_ABI,
            functionName: 'name',
          }),
          publicClient.readContract({
            address: campaignAddress,
            abi: CROWDFUND_ABI,
            functionName: 'beneficiary',
          }),
          publicClient.readContract({
            address: campaignAddress,
            abi: CROWDFUND_ABI,
            functionName: 'creator',
          }),
          publicClient.readContract({
            address: campaignAddress,
            abi: CROWDFUND_ABI,
            functionName: 'fundingCap',
          }),
          publicClient.readContract({
            address: campaignAddress,
            abi: CROWDFUND_ABI,
            functionName: 'deadline',
          }),
          publicClient.readContract({
            address: campaignAddress,
            abi: CROWDFUND_ABI,
            functionName: 'totalFundsRaised',
          }),
          publicClient.readContract({
            address: campaignAddress,
            abi: CROWDFUND_ABI,
            functionName: 'finalized',
          }),
          publicClient.readContract({
            address: campaignAddress,
            abi: CROWDFUND_ABI,
            functionName: 'isSuccessful',
          }),
          publicClient.readContract({
            address: campaignAddress,
            abi: CROWDFUND_ABI,
            functionName: 'getMilestoneCount',
          }),
        ]);

        // Fetch milestones if any
        const milestones: Milestone[] = [];
        const count = Number(milestoneCount);

        for (let i = 0; i < count; i++) {
          const milestone = await publicClient.readContract({
            address: campaignAddress,
            abi: CROWDFUND_ABI,
            functionName: 'getMilestone',
            args: [BigInt(i)],
          }) as [string, bigint, boolean, boolean];

          milestones.push({
            description: milestone[0],
            amount: milestone[1],
            completed: milestone[2],
            fundsReleased: milestone[3],
          });
        }

        setCampaign({
          name: name as string,
          beneficiary: beneficiary as Address,
          creator: creator as Address,
          fundingCap: fundingCap as bigint,
          deadline: deadline as bigint,
          totalFundsRaised: totalFundsRaised as bigint,
          finalized: finalized as boolean,
          isSuccessful: isSuccessful as boolean,
          milestones,
        });

        console.log('✅ Campaign loaded successfully');
      } catch (error) {
        console.error('❌ Error loading campaign:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignAddress, publicClient]);

  const handleContribute = async () => {
    if (!contributionAmount || parseFloat(contributionAmount) <= 0) {
      alert('Please enter a valid contribution amount');
      return;
    }

    if (!walletClient || !publicClient) {
      alert('Please connect your wallet');
      return;
    }

    try {
      setIsContributing(true);

      console.log('💰 Contributing', contributionAmount, 'ETH');

      const hash = await walletClient.writeContract({
        address: campaignAddress,
        abi: CROWDFUND_ABI,
        functionName: 'contribute',
        value: parseEther(contributionAmount),
      });

      console.log('📝 Transaction hash:', hash);
      await publicClient.waitForTransactionReceipt({ hash });

      console.log('✅ Contribution successful!');
      alert('Contribution successful!');
      setContributionAmount('');

      // Refresh campaign data
      window.location.reload();
    } catch (error: any) {
      console.error('❌ Contribution error:', error);
      alert(error.message || 'Failed to contribute');
    } finally {
      setIsContributing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50 text-lg">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Campaign not found</p>
          <Link href="/" className="text-indigo-400 hover:text-indigo-300">
            ← Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  // Calculate status
  const now = Math.floor(Date.now() / 1000);
  const deadlineTimestamp = Number(campaign.deadline);
  const isExpired = now > deadlineTimestamp;
  const isFullyFunded = campaign.totalFundsRaised >= campaign.fundingCap;
  
  let status: CampaignStatus;
  if (campaign.finalized) {
    status = 'finalized';
  } else if (campaign.isSuccessful || isFullyFunded) {
    status = 'successful';
  } else if (isExpired) {
    status = 'failed';
  } else {
    status = 'active';
  }

  const canContribute = status === 'active' && !isFullyFunded;
  const isCreator = account?.toLowerCase() === campaign.creator.toLowerCase();

  // Calculate progress
  const raised = parseFloat(formatEther(campaign.totalFundsRaised));
  const goal = parseFloat(formatEther(campaign.fundingCap));
  const progress = (raised / goal) * 100;

  // Calculate time remaining
  const timeRemaining = deadlineTimestamp * 1000 - Date.now();
  const daysLeft = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
  const hoursLeft = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60)));

  // Status badge configuration
  const statusConfig = {
    active: {
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      label: `${daysLeft} days left`,
      icon: '⏳',
    },
    successful: {
      bg: 'bg-green-500/15',
      border: 'border-green-500/30',
      text: 'text-green-400',
      label: 'Fully Funded',
      icon: '✅',
    },
    failed: {
      bg: 'bg-red-500/15',
      border: 'border-red-500/30',
      text: 'text-red-400',
      label: 'Campaign Ended',
      icon: '❌',
    },
    ended: {
      bg: 'bg-orange-500/15',
      border: 'border-orange-500/30',
      text: 'text-orange-400',
      label: 'Ended',
      icon: '⏸',
    },
    finalized: {
      bg: 'bg-purple-500/15',
      border: 'border-purple-500/30',
      text: 'text-purple-400',
      label: 'Finalized',
      icon: '🏁',
    },
  };

  const currentStatus = statusConfig[status];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.05)_0%,transparent_50%),radial-gradient(circle_at_80%_70%,rgba(168,85,247,0.05)_0%,transparent_50%)]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <span className="text-xl">←</span>
            <span>Back to campaigns</span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Campaign Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
              {campaign.name}
            </h1>
            
            <div className={`flex items-center gap-2 px-4 py-2 ${currentStatus.bg} border ${currentStatus.border} rounded-full`}>
              <span className="text-lg">{currentStatus.icon}</span>
              <span className={`font-semibold text-sm uppercase tracking-wide ${currentStatus.text}`}>
                {currentStatus.label}
              </span>
            </div>
          </div>

          {isCreator && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/15 border border-indigo-500/30 rounded-full text-indigo-300 text-sm font-semibold">
              <span>👤</span>
              <span>Your Campaign</span>
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Campaign Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Card */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md">
              <h2 className="text-xl font-bold text-white mb-4">Funding Progress</h2>
              
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all duration-500"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-3xl font-bold text-white font-mono">
                      {raised.toFixed(4)} ETH
                    </p>
                    <p className="text-sm text-white/50 mt-1">raised</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-white font-mono">
                      {progress.toFixed(1)}%
                    </p>
                    <p className="text-sm text-white/50 mt-1">of {goal.toFixed(4)} ETH</p>
                  </div>
                </div>
              </div>

              {/* Time Remaining */}
              {status === 'active' && (
                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <span className="text-2xl">⏰</span>
                  <div>
                    <p className="text-white font-semibold">
                      {daysLeft > 0 ? `${daysLeft} days` : `${hoursLeft} hours`} remaining
                    </p>
                    <p className="text-xs text-white/50">
                      Ends {new Date(deadlineTimestamp * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}

              {status === 'successful' && !campaign.finalized && (
                <div className="flex items-center gap-3 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <p className="text-white font-semibold">Campaign Successful!</p>
                    <p className="text-xs text-white/50">
                      Funding goal reached
                    </p>
                  </div>
                </div>
              )}

              {status === 'failed' && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <span className="text-2xl">⏱️</span>
                  <div>
                    <p className="text-white font-semibold">Campaign Ended</p>
                    <p className="text-xs text-white/50">
                      Did not reach funding goal
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Milestones */}
            {campaign.milestones.length > 0 && (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                <h2 className="text-xl font-bold text-white mb-4">Milestones</h2>
                
                <div className="space-y-4">
                  {campaign.milestones.map((milestone, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        milestone.fundsReleased
                          ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50'
                          : milestone.completed
                          ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50'
                          : 'bg-indigo-500/20 text-indigo-300 border-2 border-indigo-500/30'
                      }`}>
                        {milestone.fundsReleased ? '✓' : index + 1}
                      </div>
                      
                      <div className="flex-1">
                        <p className="text-white font-semibold mb-1">
                          {milestone.description}
                        </p>
                        <p className="text-sm text-white/50 font-mono">
                          {parseFloat(formatEther(milestone.amount)).toFixed(4)} ETH
                        </p>
                        {milestone.fundsReleased && (
                          <p className="text-xs text-green-400 mt-2">✓ Funds Released</p>
                        )}
                        {milestone.completed && !milestone.fundsReleased && (
                          <p className="text-xs text-blue-400 mt-2">✓ Completed</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Campaign Info */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md">
              <h2 className="text-xl font-bold text-white mb-4">Campaign Details</h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-white/50 mb-1">Creator</p>
                  <p className="text-white font-mono text-sm">
                    {campaign.creator}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-white/50 mb-1">Beneficiary</p>
                  <p className="text-white font-mono text-sm">
                    {campaign.beneficiary}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-white/50 mb-1">Contract Address</p>
                  <a
                    href={`https://sepolia.arbiscan.io/address/${campaignAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 font-mono text-sm flex items-center gap-2"
                  >
                    {campaignAddress}
                    <span className="text-xs">↗</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Contribute Card */}
          <div className="lg:col-span-1">
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md sticky top-24">
              <h2 className="text-xl font-bold text-white mb-4">Contribute</h2>
              
              {canContribute && account && !isCreator ? (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-white/70 mb-2">
                        Amount (ETH)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.1"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                        disabled={isContributing}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 font-mono text-lg focus:outline-none focus:border-indigo-500/50 focus:ring-3 focus:ring-indigo-500/10 transition-all"
                      />
                    </div>
                    
                    <button
                      onClick={handleContribute}
                      disabled={isContributing || !contributionAmount}
                      className="w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    >
                      {isContributing ? 'Contributing...' : 'Contribute Now'}
                    </button>
                  </div>
                  
                  <p className="text-xs text-white/40 mt-4 text-center">
                    Your contribution helps bring this campaign to life
                  </p>
                </>
              ) : !account ? (
                <div className="text-center py-8">
                  <p className="text-white/60 mb-4">Connect your wallet to contribute</p>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center text-3xl">
                    👛
                  </div>
                </div>
              ) : isCreator ? (
                <div className="text-center py-8">
                  <p className="text-white/60 mb-2">You created this campaign</p>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center text-3xl">
                    👤
                  </div>
                </div>
              ) : isFullyFunded ? (
                <div className="text-center py-8">
                  <p className="text-green-400 font-semibold mb-2">Campaign Fully Funded!</p>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center text-3xl">
                    ✅
                  </div>
                  <p className="text-sm text-white/50">
                    {goal.toFixed(4)} ETH raised
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-white/60 mb-2">Campaign has ended</p>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center text-3xl">
                    ⏱️
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}