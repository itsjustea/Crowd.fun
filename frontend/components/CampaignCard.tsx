'use client';

import { useState } from 'react';
import { parseEther } from 'viem';
import type { Address } from 'viem';
import Link from 'next/link';
import { useWalletClient, usePublicClient } from 'wagmi';

interface Campaign {
  address: Address;
  name: string;
  beneficiary: Address;
  fundingCap: BigInt;
  totalRaised: BigInt;
  deadline: number;
  finalized: boolean;
  isSuccessful: boolean;
  creator: Address;
}

interface CampaignCardProps {
  campaign: Campaign;
  account: Address | null | undefined;
}

const CROWDFUND_ABI = [
  {
    type: 'function',
    name: 'contribute',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
] as const;

type CampaignStatus = 'Active' | 'Fully-Funded' | 'Ended' | 'Finalized';

export default function CampaignCard({ campaign, account }: CampaignCardProps) {
  const [isContributing, setIsContributing] = useState(false);
  const [contributionAmount, setContributionAmount] = useState('');

  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // const raised = parseFloat(parseFloat(campaign.totalRaised) / 1e18 + '');
  // const goal = parseFloat(parseFloat(campaign.fundingCap) / 1e18 + '');
  const raised = Number(campaign.totalRaised) / 1e18;
  const goal = Number(campaign.fundingCap) / 1e18;


  const progress = (raised / goal) * 100;
  const campaignAddress = campaign.address as Address;
  
  // Calculate time remaining
  const now = Math.ceil(Date.now() / 1000);
  const deadlineTimestamp = campaign.deadline;
  const isExpired = now > deadlineTimestamp;
  const timeRemaining = deadlineTimestamp * 1000 - Date.now();
  
  // Calculate time remaining in milliseconds (more accurate)
  const timeRemainingMs = Math.max(0, timeRemaining);

  // Determine which unit to display BEFORE rounding
  let timeLeftDisplay: string;

  if (timeRemainingMs === 0 || isExpired) {
    timeLeftDisplay = 'Ended';
  } else if (timeRemainingMs >= 24 * 60 * 60 * 1000) {
    // >= 24 hours = show in days
    const daysLeft = Math.ceil(timeRemainingMs / (1000 * 60 * 60 * 24));
    timeLeftDisplay = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
  } else if (timeRemainingMs >= 60 * 60 * 1000) {
    // >= 1 hour but < 24 hours = show in hours
    const hoursLeft = Math.ceil(timeRemainingMs / (1000 * 60 * 60));
    timeLeftDisplay = `${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''} left`;
  } else if (timeRemainingMs >= 60 * 1000) {
    // >= 1 minute but < 1 hour = show in minutes
    const minutesLeft = Math.ceil(timeRemainingMs / (1000 * 60));
    timeLeftDisplay = `${minutesLeft} min${minutesLeft !== 1 ? 's' : ''} left`;
  } else {
    // < 1 minute = show in seconds
    const secondsLeft = Math.ceil(timeRemainingMs / 1000);
    timeLeftDisplay = `${secondsLeft} sec${secondsLeft !== 1 ? 's' : ''} left`;
  }

  const isFullyFunded = campaign.totalRaised >= campaign.fundingCap;

  let status: CampaignStatus;
  if (campaign.finalized) {
    status = 'Finalized';
  } else if (isExpired) {
    status = 'Ended';
  } else if (isFullyFunded) {
    status = 'Fully-Funded';
  
  } else {
    status = 'Active';
  }

  const canContribute = status === 'Active';
  
  const isActive = !campaign.finalized && timeRemaining > 0;
  const isCreator = account?.toLowerCase() === campaign.creator?.toLowerCase();

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

      console.log('💰 Contributing', contributionAmount, 'ETH to', campaignAddress);

      const hash = await walletClient.writeContract({
        address: campaignAddress,
        abi: CROWDFUND_ABI,
        functionName: 'contribute',
        value: parseEther(contributionAmount),
      });

      console.log('📝 Transaction hash:', hash);
      console.log('⏳ Waiting for confirmation...');

      await publicClient.waitForTransactionReceipt({ hash });

      console.log('✅ Contribution successful!');
      alert('Contribution successful!');
      setContributionAmount('');
      
      // Reload page to refresh campaign data
      window.location.reload();
    } catch (error: any) {
      console.error('❌ Contribution error:', error);
      alert(error.message || 'Failed to contribute');
    } finally {
      setIsContributing(false);
    }
  };

  // Status badge configuration
  const statusConfig = {
    'Active': {
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      label: timeLeftDisplay,
    },
    'Fully-Funded': {
      bg: 'bg-green-500/15',
      border: 'border-green-500/30',
      text: 'text-green-400',
      label: 'Fully Funded',
    },
    'Ended': {
      bg: 'bg-red-500/15',
      border: 'border-red-500/30',
      text: 'text-red-400',
      label: 'Ended',
    },
    'Finalized': {
      bg: 'bg-purple-500/15',
      border: 'border-purple-500/30',
      text: 'text-purple-400',
      label: 'Finalized',
    },
  };

  const currentStatus = statusConfig[status];
  
  return (
    <div className="group relative bg-white/[0.03] border border-white/10 rounded-3xl p-7 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-[0_10px_40px_rgba(99,102,241,0.15)] overflow-hidden">
      {/* Top Border Gradient */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className={`px-3.5 py-1.5 ${currentStatus.bg} border ${currentStatus.border} rounded-full ${currentStatus.text} text-xs font-semibold uppercase tracking-wide`}>
          {currentStatus.label}
        </div>

        {isCreator && (
          <div className="px-3.5 py-1.5 bg-indigo-500/15 border border-indigo-500/30 rounded-full text-indigo-300 text-xs font-semibold uppercase tracking-wide">
            You
          </div>
        )}
      </div>

      {/* Campaign Name */}
      <Link href={`/campaign/${campaignAddress}`} className="block mb-6 group/link">
        <h3 className="text-2xl font-bold text-white leading-tight tracking-tight group-hover/link:text-purple-400 transition-colors duration-200">
          {campaign.name}
        </h3>
      </Link>

      {/* Progress Section */}
      <div className="mb-6">
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-600"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-bold text-white font-mono">
              {raised.toFixed(2)} ETH
            </span>
            <span className="text-xs text-white/50 uppercase tracking-wide font-semibold">
              raised
            </span>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="text-2xl font-bold text-white font-mono">
              {progress.toFixed(0)}%
            </span>
            <span className="text-xs text-white/50 uppercase tracking-wide font-semibold">
              of {goal.toFixed(2)} ETH
            </span>
          </div>
        </div>
      </div>

      {/* Beneficiary */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl mb-5">
        <span className="text-xs text-white/50 uppercase tracking-wide font-semibold">
          Beneficiary
        </span>
        <span className="font-mono text-sm text-white/80 font-medium">
          {campaign.beneficiary.slice(0, 6)}...{campaign.beneficiary.slice(-4)}
        </span>
      </div>

      {/* Contribute Section */}
      {isActive && account && !isCreator && !isFullyFunded && (
        <div className="flex gap-3">
          <input
            type="number"
            step="0.01"
            placeholder="Amount (ETH)"
            value={contributionAmount}
            onChange={(e) => setContributionAmount(e.target.value)}
            disabled={isContributing}
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 font-mono focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 focus:ring-3 focus:ring-indigo-500/10 transition-all"
          />
          <button
            onClick={handleContribute}
            disabled={isContributing}
            className="
              shrink-0
              px-5 py-2.5
              text-sm font-semibold text-white
              bg-gradient-to-r from-indigo-600 to-purple-600
              rounded-xl whitespace-nowrap
              hover:-translate-y-0.5
              hover:shadow-[0_6px_20px_rgba(99,102,241,0.4)]
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {isContributing ? 'Contributing...' : 'Contribute'}
          </button>

        </div>
      )}

      {/* View Details Button */}
      {!isActive && (
        <Link
          href={`/campaign/${campaignAddress}`}
          className="block w-full px-4 py-3 text-center bg-white/5 border border-white/10 rounded-xl text-white/80 font-semibold hover:bg-white/8 hover:border-indigo-500/30 transition-all"
        >
          View Details
        </Link>
      )}
    </div>
  );
}