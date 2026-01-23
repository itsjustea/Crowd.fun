'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import type { Address } from 'viem';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';

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
    name: 'finalize',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'releaseAllFunds',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'completeMilestone',
    inputs: [{ name: '_milestoneId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'releaseMilestoneFunds',
    inputs: [{ name: '_milestoneId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimRefund',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
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
  {
    type: 'function',
    name: 'contributions',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
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
  userContribution: bigint;
}

type CampaignStatus = 'active' | 'ended' | 'successful' | 'failed' | 'finalized';

export default function CampaignPage() {
  const params = useParams();
  const campaignAddress = params.address as Address;

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [contributionAmount, setContributionAmount] = useState('');
  const [isContributing, setIsContributing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: account } = useAccount();

  // Fetch campaign data
  const fetchCampaign = async () => {
    if (!publicClient || !campaignAddress) return;

    try {
      setLoading(true);
      console.log('📖 Loading campaign:', campaignAddress);

      const [name, beneficiary, creator, fundingCap, deadline, totalFundsRaised, finalized, isSuccessful, milestoneCount] = await Promise.all([
        publicClient.readContract({ address: campaignAddress, abi: CROWDFUND_ABI, functionName: 'name' }),
        publicClient.readContract({ address: campaignAddress, abi: CROWDFUND_ABI, functionName: 'beneficiary' }),
        publicClient.readContract({ address: campaignAddress, abi: CROWDFUND_ABI, functionName: 'creator' }),
        publicClient.readContract({ address: campaignAddress, abi: CROWDFUND_ABI, functionName: 'fundingCap' }),
        publicClient.readContract({ address: campaignAddress, abi: CROWDFUND_ABI, functionName: 'deadline' }),
        publicClient.readContract({ address: campaignAddress, abi: CROWDFUND_ABI, functionName: 'totalFundsRaised' }),
        publicClient.readContract({ address: campaignAddress, abi: CROWDFUND_ABI, functionName: 'finalized' }),
        publicClient.readContract({ address: campaignAddress, abi: CROWDFUND_ABI, functionName: 'isSuccessful' }),
        publicClient.readContract({ address: campaignAddress, abi: CROWDFUND_ABI, functionName: 'getMilestoneCount' }),
      ]);

      // Fetch user's contribution if connected
      let userContribution = BigInt(0);
      if (account) {
        userContribution = await publicClient.readContract({
          address: campaignAddress,
          abi: CROWDFUND_ABI,
          functionName: 'contributions',
          args: [account],
        }) as bigint;
      }

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
        userContribution,
      });

      console.log('✅ Campaign loaded successfully');
    } catch (error) {
      console.error('❌ Error loading campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaign();
  }, [campaignAddress, publicClient, account]);

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
      const hash = await walletClient.writeContract({
        address: campaignAddress,
        abi: CROWDFUND_ABI,
        functionName: 'contribute',
        value: parseEther(contributionAmount),
      });

      await publicClient.waitForTransactionReceipt({ hash });
      alert('Contribution successful!');
      setContributionAmount('');
      await fetchCampaign();
    } catch (error: any) {
      console.error('❌ Contribution error:', error);
      alert(error.shortMessage || 'Failed to contribute');
    } finally {
      setIsContributing(false);
    }
  };

  const handleFinalize = async () => {
    if (!walletClient || !publicClient || !campaign) return;

    try {
      setIsProcessing(true);
      
      console.log('🔍 Attempting to finalize campaign...');
      
      // Check current status
      const now = Math.floor(Date.now() / 1000);
      const deadlineTimestamp = Number(campaign.deadline);
      const raised = parseFloat(formatEther(BigInt(campaign.totalFundsRaised)));
      const goal = parseFloat(formatEther(BigInt(campaign.fundingCap)));
      
      console.log('📊 Campaign State:');
      console.log('   Deadline passed:', now >= deadlineTimestamp);
      console.log('   Is finalized:', campaign.finalized);
      console.log('   Funds raised:', raised, 'ETH');
      console.log('   Funding goal:', goal, 'ETH');
      console.log('   Is successful:', raised >= goal);
      console.log('   Is empty:', raised === 0);
      
      if (now < deadlineTimestamp) {
        alert('Cannot finalize: Campaign is still active!');
        return;
      }
      
      if (campaign.finalized) {
        alert('Campaign is already finalized!');
        return;
      }
      
      // Special handling for empty campaigns
      if (raised === 0) {
        const confirmEmpty = confirm(
          'This campaign has no contributions.\n\n' +
          'Finalizing an empty campaign will mark it as failed.\n\n' +
          'Continue?'
        );
        
        if (!confirmEmpty) return;
      }
      
      // Warn about refunds if campaign failed
      if (raised > 0 && raised < goal) {
        const confirmFailed = confirm(
          `Campaign did not reach its goal.\n\n` +
          `Raised: ${raised.toFixed(4)} ETH\n` +
          `Goal: ${goal.toFixed(4)} ETH\n\n` +
          `After finalization, contributors will need to manually claim refunds.\n\n` +
          `Continue?`
        );
        
        if (!confirmFailed) return;
      }
      
      console.log('📤 Sending finalize transaction...');
      
      try {
        // Use explicit gas for empty campaigns
        const gasLimit = raised === 0 ? BigInt(100000) : BigInt(300000);
        
        const hash = await walletClient.writeContract({
          address: campaignAddress,
          abi: CROWDFUND_ABI,
          functionName: 'finalize',
          gas: gasLimit,
        });

        console.log('📝 Transaction hash:', hash);
        console.log('⏳ Waiting for confirmation...');
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'success') {
          console.log('✅ Campaign finalized!');
          
          let message = 'Campaign finalized successfully! 🎉\n\n';
          
          if (raised >= goal) {
            message += 'Campaign was successful! Funds are now in escrow.';
            if (campaign.milestones && campaign.milestones.length > 0) {
              message += '\n\nYou can now mark milestones as complete to release funds.';
            } else {
              message += '\n\nYou can now release all funds to the beneficiary.';
            }
          } else if (raised > 0) {
            message += `Campaign did not reach its goal.\n\n`;
            message += `Contributors can now claim refunds.`;
          } else {
            message += 'Campaign ended with no contributions.';
          }
          
          alert(message);
          await fetchCampaign();
        } else {
          alert('Transaction failed. Please try again.');
        }
        
      } catch (txError: any) {
        console.error('Transaction error:', txError);
        
        // Check if already finalized
        const currentState = await publicClient.readContract({
          address: campaignAddress,
          abi: CROWDFUND_ABI,
          functionName: 'finalized',
        });
        
        if (currentState) {
          alert('Campaign was already finalized. Refreshing...');
          await fetchCampaign();
          return;
        }
        
        throw txError;
      }
      
    } catch (error: any) {
      console.error('❌ Finalize error:', error);
      
      let errorMsg = 'Failed to finalize campaign:\n\n';
      
      if (error.message?.includes('Campaign still active')) {
        errorMsg += 'The deadline has not passed yet.';
      } else if (error.message?.includes('Campaign already finalized')) {
        errorMsg += 'Campaign is already finalized.';
      } else if (error.message?.includes('user rejected')) {
        errorMsg = 'Transaction cancelled.';
      } else if (error.message?.includes('insufficient funds')) {
        errorMsg += 'Insufficient ETH for gas fees.';
      } else {
        errorMsg += error.shortMessage || error.message || 'Unknown error';
        errorMsg += '\n\nTry increasing gas limit in MetaMask.';
      }
      
      alert(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReleaseAllFunds = async () => {
    if (!walletClient || !publicClient) return;

    try {
      setIsProcessing(true);
      const hash = await walletClient.writeContract({
        address: campaignAddress,
        abi: CROWDFUND_ABI,
        functionName: 'releaseAllFunds',
      });

      await publicClient.waitForTransactionReceipt({ hash });
      alert('All funds released to beneficiary!');
      await fetchCampaign();
    } catch (error: any) {
      console.error('❌ Release funds error:', error);
      alert(error.shortMessage || 'Failed to release funds');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteMilestone = async (milestoneId: number) => {
    if (!walletClient || !publicClient) return;

    try {
      setIsProcessing(true);
      const hash = await walletClient.writeContract({
        address: campaignAddress,
        abi: CROWDFUND_ABI,
        functionName: 'completeMilestone',
        args: [BigInt(milestoneId)],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      alert(`Milestone ${milestoneId + 1} marked as completed!`);
      await fetchCampaign();
    } catch (error: any) {
      console.error('❌ Complete milestone error:', error);
      alert(error.shortMessage || 'Failed to complete milestone');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReleaseMilestoneFunds = async (milestoneId: number) => {
    if (!walletClient || !publicClient) return;

    try {
      setIsProcessing(true);
      const hash = await walletClient.writeContract({
        address: campaignAddress,
        abi: CROWDFUND_ABI,
        functionName: 'releaseMilestoneFunds',
        args: [BigInt(milestoneId)],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      alert(`Milestone ${milestoneId + 1} funds released to beneficiary!`);
      await fetchCampaign();
    } catch (error: any) {
      console.error('❌ Release milestone funds error:', error);
      alert(error.shortMessage || 'Failed to release milestone funds');
    } finally {
      setIsProcessing(false);
    }
  };

  // const handleClaimRefund = async () => {
  //   if (!walletClient || !publicClient) return;

  //   try {
  //     setIsProcessing(true);
  //     const hash = await walletClient.writeContract({
  //       address: campaignAddress,
  //       abi: CROWDFUND_ABI,
  //       functionName: 'claimRefund',
  //     });

  //     await publicClient.waitForTransactionReceipt({ hash });
  //     alert('Refund claimed successfully!');
  //     await fetchCampaign();
  //   } catch (error: any) {
  //     console.error('❌ Claim refund error:', error);
  //     alert(error.shortMessage || 'Failed to claim refund');
  //   } finally {
  //     setIsProcessing(false);
  //   }
  // };
  const handleClaimRefund = async () => {
    if (!walletClient || !publicClient || !campaign || !account) return;

    try {
      setIsProcessing(true);
      
      console.log('═══════════════════════════════════════');
      console.log('💰 CLAIMING REFUND');
      console.log('═══════════════════════════════════════');
      console.log('Campaign:', campaignAddress);
      console.log('Your address:', account);
      
      // Get fresh data from contract
      console.log('🔍 Checking current state...');
      
      const [currentFinalized, currentIsSuccessful, yourContribution] = await Promise.all([
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
          functionName: 'contributions',
          args: [account],
        }),
      ]);
      
      console.log('📊 Current State:');
      console.log('   Campaign finalized:', currentFinalized);
      console.log('   Campaign successful:', currentIsSuccessful);
      console.log('   Your contribution:', formatEther(yourContribution as bigint), 'ETH');
      
      // Validation checks
      if (!currentFinalized) {
        alert('Cannot claim refund: Campaign has not been finalized yet.\n\nThe creator must finalize the campaign first.');
        return;
      }
      
      if (currentIsSuccessful) {
        alert('Cannot claim refund: Campaign was successful!\n\nNo refunds are available for successful campaigns.');
        return;
      }
      
      if (yourContribution === BigInt(0)) {
        alert('Cannot claim refund: You have no contribution to refund.\n\nYou either:\n• Never contributed to this campaign\n• Already claimed your refund');
        return;
      }
      
      const refundAmount = formatEther(yourContribution as bigint);
      console.log('✅ Eligible for refund:', refundAmount, 'ETH');
      
      // Confirm with user
      const confirmRefund = confirm(
        `Claim your refund?\n\n` +
        `Amount: ${refundAmount} ETH\n\n` +
        `This will be sent back to your wallet.`
      );
      
      if (!confirmRefund) {
        console.log('❌ User cancelled');
        return;
      }
      
      // Simulate first
      console.log('🧪 Simulating refund claim...');
      try {
        await publicClient.simulateContract({
          address: campaignAddress,
          abi: CROWDFUND_ABI,
          functionName: 'claimRefund',
          account: account,
        });
        console.log('✅ Simulation successful');
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
      
      console.log('📤 Sending refund claim transaction...');
      
      const hash = await walletClient.writeContract({
        address: campaignAddress,
        abi: CROWDFUND_ABI,
        functionName: 'claimRefund',
        gas: undefined, // Explicit gas limit
      });

      console.log('📝 Transaction hash:', hash);
      console.log('⏳ Waiting for confirmation...');

      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        timeout: 60_000,
      });

      console.log('✅ Transaction confirmed!');
      console.log('   Status:', receipt.status);
      console.log('   Gas used:', receipt.gasUsed.toString());
      
      if (receipt.status === 'success') {
        console.log('✅ Refund claimed successfully!');
        alert(`Refund claimed successfully! 🎉\n\n${refundAmount} ETH has been sent back to your wallet.`);
        
        // Refresh campaign data
        await fetchCampaign();
      } else {
        console.error('❌ Transaction failed');
        alert('Transaction was mined but failed. Please check the transaction on Etherscan.');
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
      setIsProcessing(false);
      console.log('═══════════════════════════════════════');
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
  const canFinalize = isExpired && !campaign.finalized;
  const canReleaseAllFunds = campaign.finalized && campaign.isSuccessful && campaign.milestones.length === 0 && isCreator;
  const canClaimRefund = campaign.finalized && !campaign.isSuccessful && campaign.userContribution > BigInt(0);

  // Calculate progress
  const raised = parseFloat(formatEther(campaign.totalFundsRaised));
  const goal = parseFloat(formatEther(campaign.fundingCap));
  const progress = (raised / goal) * 100;

  
  // Calculate time remaining
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

  // Status badge configuration
  const statusConfig = {
    active: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', label: timeLeftDisplay, icon: '⏳' },
    successful: { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400', label: 'Fully Funded', icon: '✅' },
    failed: { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', label: 'Campaign Ended', icon: '❌' },
    ended: { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', label: 'Ended', icon: '⏸' },
    finalized: { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400', label: 'Finalized', icon: '🏁' },
  };

  const currentStatus = statusConfig[status];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.05)_0%,transparent_50%),radial-gradient(circle_at_80%_70%,rgba(168,85,247,0.05)_0%,transparent_50%)]" />
      </div> 
      <header className="sticky top-22 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
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
          <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
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

          <div className="flex gap-2 flex-wrap">
            {isCreator && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/15 border border-indigo-500/30 rounded-full text-indigo-300 text-sm font-semibold">
                <span>👤</span>
                <span>Your Campaign</span>
              </div>
            )}
            
            {campaign.userContribution > BigInt(0) && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/15 border border-blue-500/30 rounded-full text-blue-300 text-sm font-semibold">
                <span>💰</span>
                <span>You contributed {parseFloat(formatEther(campaign.userContribution)).toFixed(4)} ETH</span>
              </div>
            )}
          </div>
        </div>

        {/* Creator Controls - Finalize Button */}
        {isCreator && canFinalize && (
          <div className="mb-6 p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-yellow-400 mb-2">Campaign Ended - Action Required</h3>
                <p className="text-white/70">
                  {campaign.isSuccessful 
                    ? 'The campaign was successful! Finalize it to enable fund distribution.'
                    : 'The campaign did not reach its goal. Finalize it to enable refunds for contributors.'
                  }
                </p>
              </div>
              <button
                onClick={handleFinalize}
                disabled={isProcessing}
                className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 text-white font-bold rounded-xl hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {isProcessing ? 'Finalizing...' : 'Finalize Campaign'}
              </button>
            </div>
          </div>
        )}

        {/* Refund Notice */}
        {canClaimRefund && (
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
                disabled={isProcessing}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold rounded-xl hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {isProcessing ? 'Claiming...' : 'Claim Refund'}
              </button>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Card */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md">
              <h2 className="text-xl font-bold text-white mb-4">Funding Progress</h2>
              
              <div className="mb-6">
                <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all duration-500"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-3xl font-bold text-white font-mono">{raised.toFixed(4)} ETH</p>
                    <p className="text-sm text-white/50 mt-1">raised</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-white font-mono">{progress.toFixed(1)}%</p>
                    <p className="text-sm text-white/50 mt-1">of {goal.toFixed(4)} ETH</p>
                  </div>
                </div>
              </div>

              {status === 'active' && (
                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <span className="text-2xl">⏰</span>
                  <div>
                    <div className={`px-3.5 py-1.5 ${currentStatus.bg} border ${currentStatus.border} rounded-full ${currentStatus.text} text-xs font-semibold uppercase tracking-wide`}>
                      {currentStatus.label}
                    </div>
                    <p className="text-xs text-white/50">Ends {new Date(deadlineTimestamp * 1000).toLocaleDateString()}</p>
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
                        <p className="text-white font-semibold mb-1">{milestone.description}</p>
                        <p className="text-sm text-white/50 font-mono mb-2">
                          {parseFloat(formatEther(milestone.amount)).toFixed(4)} ETH
                        </p>
                        
                        {milestone.fundsReleased ? (
                          <p className="text-xs text-green-400">✓ Funds Released</p>
                        ) : milestone.completed ? (
                          <div className="flex gap-2">
                            <p className="text-xs text-blue-400">✓ Completed</p>
                            <button
                              onClick={() => handleReleaseMilestoneFunds(index)}
                              disabled={isProcessing}
                              className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                            >
                              Release Funds
                            </button>
                          </div>
                        ) : isCreator && campaign.finalized && campaign.isSuccessful ? (
                          <button
                            onClick={() => handleCompleteMilestone(index)}
                            disabled={isProcessing}
                            className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                          >
                            Mark as Complete
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Release All Funds Button (for campaigns without milestones) */}
            {canReleaseAllFunds && (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                <h2 className="text-xl font-bold text-white mb-4">Release Funds</h2>
                <p className="text-white/70 mb-4">
                  The campaign was successful and has no milestones. Release all funds to the beneficiary.
                </p>
                <button
                  onClick={handleReleaseAllFunds}
                  disabled={isProcessing}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-lg rounded-xl hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {isProcessing ? 'Releasing...' : 'Release All Funds to Beneficiary'}
                </button>
              </div>
            )}

            {/* Campaign Info */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md">
              <h2 className="text-xl font-bold text-white mb-4">Campaign Details</h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-white/50 mb-1">Creator</p>
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
                  <p className="text-sm text-white/50 mb-1">Beneficiary</p>
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
                  <p className="text-sm text-white/50 mb-1">Contract Address</p>
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
              </div>
            </div>
          </div>

          {/* Right Column - Action Card */}
          <div className="lg:col-span-1">
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md sticky top-24">
              <h2 className="text-xl font-bold text-white mb-4">
                {canContribute ? 'Contribute' : 'Campaign Status'}
              </h2>
              
              {canContribute && account && !isCreator ? (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-white/70 mb-2">Amount (ETH)</label>
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
              ) : (
                <div className="flex flex-col items-center py-8">
                  {!account ? (
                    <>
                      <p className="text-white/60 mb-4">Connect your wallet to contribute</p>
                      <ConnectButton />
                    </>
                  ) : isCreator ? (
                    <>
                      <p className="text-white/60 mb-2">You created this campaign</p>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center text-3xl">👤</div>
                    </>
                  ) : isFullyFunded ? (
                    <>
                      <p className="text-green-400 font-semibold mb-2">Campaign Fully Funded!</p>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center text-3xl">✅</div>
                      <p className="text-sm text-white/50">{goal.toFixed(4)} ETH raised</p>
                    </>
                  ) : (
                    <>
                      <p className="text-white/60 mb-2">Campaign has ended</p>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center text-3xl">⏱️</div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}