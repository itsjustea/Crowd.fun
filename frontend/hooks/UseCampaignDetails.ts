// hooks/useCampaignDetails-enhanced.ts
import { useState, useEffect, useCallback } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { Address, formatEther } from 'viem';

// ========== TYPE DEFINITIONS ==========

export interface CampaignDetails {
  name: string;
  beneficiary: Address;
  fundingCap: bigint;
  deadline: number;
  totalFundsRaised: bigint;
  finalized: boolean;
  successful: boolean;
  creator: Address;
  milestoneCount: number;
  governanceEnabled: boolean;
  updateCount: number;
  userContribution: bigint;
  totalContributors: number;
  isCreator: boolean;
  hasContributed: boolean;
}

export interface Milestone {
  description: string;
  amount: bigint;
  completed: boolean;
  fundsReleased: boolean;
}

export interface VoteStatus {
  votesFor: bigint;
  votesAgainst: bigint;
  votingDeadline: number;
  resolved: boolean;
  approved: boolean;
  hasVoted: boolean;
  voteChoice: boolean;
}

export interface CampaignStats {
  fundingPercentage: number;
  timeRemaining: string;
  status: 'Active' | 'Ended' | 'Successful' | 'Failed' | 'Fully Funded';
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  isActive: boolean;
  canContribute: boolean;
  canFinalize: boolean;
}

export interface VoteStatistics {
  totalVotes: number;
  percentageFor: number;
  percentageAgainst: number;
  participationRate: number;
  votesNeededToPass: number;
  hasReachedQuorum: boolean;
  canResolve: boolean;
}

interface UseCampaignDetailsReturn {
  campaign: CampaignDetails | null;
  milestones: Milestone[];
  voteStatuses: Record<number, VoteStatus>;
  stats: CampaignStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getVoteStatistics: (milestoneId: number) => VoteStatistics | null;
}

// ========== HOOK ==========

export function useCampaignDetails(
  campaignAddress: Address | undefined,
  campaignAbi: any
): UseCampaignDetailsReturn {
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [voteStatuses, setVoteStatuses] = useState<Record<number, VoteStatus>>({});
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const publicClient = usePublicClient();
  const { address: userAddress } = useAccount();

  // ========== CAMPAIGN STATS CALCULATOR ==========
  const calculateStats = useCallback((campaignData: CampaignDetails): CampaignStats => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = campaignData.deadline - now;
    
    // Calculate funding percentage
    const fundingPercentage = campaignData.fundingCap > BigInt(0)
      ? Math.min(100, Number((campaignData.totalFundsRaised * BigInt(100)) / campaignData.fundingCap))
      : 0;

    // Calculate time remaining
    const daysRemaining = Math.max(0, Math.floor(remaining / 86400));
    const hoursRemaining = Math.max(0, Math.floor((remaining % 86400) / 3600));
    const minutesRemaining = Math.max(0, Math.floor((remaining % 3600) / 60));

    let timeRemaining = 'Campaign Ended';
    if (remaining > 0) {
      if (daysRemaining > 0) {
        timeRemaining = `${daysRemaining}d ${hoursRemaining}h remaining`;
      } else if (hoursRemaining > 0) {
        timeRemaining = `${hoursRemaining}h ${minutesRemaining}m remaining`;
      } else if (minutesRemaining > 0) {
        timeRemaining = `${minutesRemaining}m remaining`;
      } else {
        timeRemaining = 'Less than 1m remaining';
      }
    }

    // Determine status
    let status: CampaignStats['status'] = 'Active';
    if (campaignData.finalized) {
      status = campaignData.successful ? 'Successful' : 'Failed';
    } else if (now >= campaignData.deadline) {
      status = 'Ended';
    } else if (campaignData.totalFundsRaised >= campaignData.fundingCap) {
      status = 'Fully Funded';
    }

    // Determine action availability
    const isActive = !campaignData.finalized && now < campaignData.deadline;
    const canContribute = isActive && campaignData.totalFundsRaised < campaignData.fundingCap;
    const canFinalize = !campaignData.finalized && now >= campaignData.deadline;

    return {
      fundingPercentage,
      timeRemaining,
      status,
      daysRemaining,
      hoursRemaining,
      minutesRemaining,
      isActive,
      canContribute,
      canFinalize,
    };
  }, []);

  // ========== VOTE STATISTICS CALCULATOR ==========
  const getVoteStatistics = useCallback((milestoneId: number): VoteStatistics | null => {
    const voteStatus = voteStatuses[milestoneId];
    if (!voteStatus || !campaign) return null;

    const totalVotes = Number(voteStatus.votesFor + voteStatus.votesAgainst);
    const percentageFor = totalVotes > 0
      ? Math.round((Number(voteStatus.votesFor) / totalVotes) * 100)
      : 0;
    const percentageAgainst = 100 - percentageFor;

    const participationRate = campaign.totalContributors > 0
      ? Math.round((totalVotes / campaign.totalContributors) * 100)
      : 0;

    // Calculate votes needed to pass (60% of total votes)
    const votesNeededToPass = Math.ceil(totalVotes * 0.6);
    
    // Check if minimum participation reached (30% of contributors)
    const minParticipation = Math.ceil(campaign.totalContributors * 0.3);
    const hasReachedQuorum = totalVotes >= minParticipation;

    // Can resolve if voting ended or threshold reached
    const now = Math.floor(Date.now() / 1000);
    const votingEnded = now > voteStatus.votingDeadline;
    const canResolve = !voteStatus.resolved && (votingEnded || hasReachedQuorum);

    return {
      totalVotes,
      percentageFor,
      percentageAgainst,
      participationRate,
      votesNeededToPass,
      hasReachedQuorum,
      canResolve,
    };
  }, [voteStatuses, campaign]);

  // ========== FETCH CAMPAIGN DETAILS ==========
  const fetchCampaignDetails = useCallback(async (): Promise<void> => {
    if (!campaignAddress || !publicClient) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch main campaign details
      const details = await publicClient.readContract({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'getCampaignDetails',
      }) as readonly [string, Address, bigint, bigint, bigint, boolean, boolean, Address, bigint, boolean, bigint];

      // Fetch user's contribution
      let userContribution = BigInt(0);
      if (userAddress) {
        try {
          userContribution = await publicClient.readContract({
            address: campaignAddress,
            abi: campaignAbi,
            functionName: 'contributions',
            args: [userAddress],
          }) as bigint;
        } catch (e) {
          console.warn('Failed to fetch user contribution:', e);
        }
      }

      // Fetch total contributors (for one-person-one-vote)
      let totalContributors = 0;
      try {
        const contributors = await publicClient.readContract({
          address: campaignAddress,
          abi: campaignAbi,
          functionName: 'getTotalContributors',
        }) as bigint;
        totalContributors = Number(contributors);
        console.log('Total contributors:', totalContributors);
      } catch (e) {
        console.warn('getTotalContributors not available (old contract?):', e);
      }

      // Build campaign data
      const campaignData: CampaignDetails = {
        name: details[0],
        beneficiary: details[1],
        fundingCap: details[2],
        deadline: Number(details[3]),
        totalFundsRaised: details[4],
        finalized: details[5],
        successful: details[6],
        creator: details[7],
        milestoneCount: Number(details[8]),
        governanceEnabled: details[9],
        updateCount: Number(details[10]),
        userContribution,
        totalContributors,
        isCreator: userAddress ? details[7].toLowerCase() === userAddress.toLowerCase() : false,
        hasContributed: userContribution > BigInt(0),
      };

      setCampaign(campaignData);
      setStats(calculateStats(campaignData));

      // Fetch milestones if they exist
      if (Number(details[8]) > 0) {
        await fetchMilestones(campaignData.governanceEnabled);
      }
    } catch (err) {
      console.error('Error fetching campaign details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch campaign details');
    } finally {
      setLoading(false);
    }
  }, [campaignAddress, userAddress, publicClient, campaignAbi, calculateStats]);

  // ========== FETCH MILESTONES ==========
  const fetchMilestones = async (governanceEnabled: boolean): Promise<void> => {
    if (!campaignAddress || !publicClient) return;

    try {
      // Fetch all milestones
      const milestonesData = await publicClient.readContract({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'getAllMilestones',
      }) as Milestone[];

      setMilestones(milestonesData);

      // If governance enabled, fetch vote statuses
      if (governanceEnabled && milestonesData.length > 0) {
        const votePromises = milestonesData.map((_, index) =>
          publicClient.readContract({
            address: campaignAddress,
            abi: campaignAbi,
            functionName: 'getMilestoneVoteStatus',
            args: [BigInt(index)],
          }) as Promise<readonly [bigint, bigint, bigint, boolean, boolean, boolean, boolean]>
        );

        const voteData = await Promise.all(votePromises);

        const statuses: Record<number, VoteStatus> = {};
        voteData.forEach((vote, index) => {
          statuses[index] = {
            votesFor: vote[0],
            votesAgainst: vote[1],
            votingDeadline: Number(vote[2]),
            resolved: vote[3],
            approved: vote[4],
            hasVoted: vote[5],
            voteChoice: vote[6],
          };
        });

        setVoteStatuses(statuses);
      }
    } catch (err) {
      console.error('Error fetching milestones:', err);
    }
  };

  // ========== REFETCH ==========
  const refetch = useCallback(async (): Promise<void> => {
    await fetchCampaignDetails();
  }, [fetchCampaignDetails]);

  // ========== INITIAL FETCH ==========
  useEffect(() => {
    fetchCampaignDetails();
  }, [fetchCampaignDetails]);

  return {
    campaign,
    milestones,
    voteStatuses,
    stats,
    loading,
    error,
    refetch,
    getVoteStatistics,
  };
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Format campaign status for display
 */
export function formatCampaignStatus(status: CampaignStats['status']): {
  text: string;
  color: string;
  emoji: string;
} {
  const statusMap = {
    'Active': { text: 'Active', color: 'green', emoji: '🟢' },
    'Ended': { text: 'Ended', color: 'yellow', emoji: '🟡' },
    'Successful': { text: 'Successful', color: 'green', emoji: '✅' },
    'Failed': { text: 'Failed', color: 'red', emoji: '❌' },
    'Fully Funded': { text: 'Fully Funded', color: 'blue', emoji: '🎉' },
  };

  return statusMap[status] || { text: status, color: 'gray', emoji: '⚪' };
}

/**
 * Format ETH amount for display
 */
export function formatEthAmount(amount: bigint): string {
  return formatEther(amount);
}

/**
 * Check if user can vote on milestone
 */
export function canVoteOnMilestone(
  campaign: CampaignDetails | null,
  voteStatus: VoteStatus | undefined,
  milestoneId: number
): boolean {
  if (!campaign || !voteStatus) return false;
  
  const now = Math.floor(Date.now() / 1000);
  
  return (
    campaign.hasContributed &&
    campaign.governanceEnabled &&
    !voteStatus.resolved &&
    !voteStatus.hasVoted &&
    now <= voteStatus.votingDeadline &&
    voteStatus.votingDeadline > 0
  );
}