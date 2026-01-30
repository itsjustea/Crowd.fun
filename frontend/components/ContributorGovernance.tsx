// components/ContributorGovernance.tsx
import { useState, useEffect } from 'react';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { formatEther } from 'viem';
import type { Address, Abi } from 'viem';

interface Milestone {
  description: string;
  amount: bigint;
  completed: boolean;
  fundsReleased: boolean;
}

interface VoteStatus {
  votesFor: bigint;
  votesAgainst: bigint;
  votingDeadline: number;
  resolved: boolean;
  approved: boolean;
  hasVoted: boolean;
  voteChoice: boolean;
}

interface ContributorGovernanceProps {
  campaignAddress: Address;
  campaignAbi: Abi;
  isCreator: boolean;
  hasContributed: boolean;
  userContribution: bigint;
}

type VotingStatus = 'not-started' | 'completed-no-vote' | 'approved' | 'rejected' | 'ended-pending' | 'active';

export default function ContributorGovernance({ 
  campaignAddress, 
  campaignAbi, 
  isCreator,
  hasContributed,
  userContribution 
}: ContributorGovernanceProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [voteStatuses, setVoteStatuses] = useState<Record<number, VoteStatus>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [governanceEnabled, setGovernanceEnabled] = useState<boolean>(false);
  const [isFinalized, setIsFinalized] = useState<boolean>(false);
  const [isSuccessful, setIsSuccessful] = useState<boolean>(false);
  const [totalRaised, setTotalRaised] = useState<bigint>(BigInt(0));
  
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  useEffect(() => {
    fetchMilestones();
    fetchCampaignStatus();
  }, [campaignAddress]);

  const fetchCampaignStatus = async (): Promise<void> => {
    try {
      if (!publicClient) return;

      const details = await publicClient.readContract({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'getCampaignDetails',
      }) as readonly [string, Address, bigint, bigint, bigint, boolean, boolean, Address, bigint, boolean, bigint];
      
      setIsFinalized(details[5]); // finalized
      setIsSuccessful(details[6]); // successful
      setGovernanceEnabled(details[9]); // governanceEnabled
      setTotalRaised(details[4]); // totalFundsRaised
    } catch (error) {
      console.error('Error fetching campaign status:', error);
    }
  };

  const fetchMilestones = async (): Promise<void> => {
    setLoading(true);
    try {
      if (!publicClient) return;

      const milestonesData = await publicClient.readContract({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'getAllMilestones',
      }) as Milestone[];
      
      setMilestones(milestonesData);
      
      // Fetch vote status for each milestone
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
    } catch (error) {
      console.error('Error fetching milestones:', error);
    } finally {
      setLoading(false);
    }
  };

  const startVoting = async (milestoneId: number): Promise<void> => {
    try {
      if (!publicClient || !walletClient || !address) return;

      const { request } = await publicClient.simulateContract({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'completeMilestone',
        args: [BigInt(milestoneId)],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
      
      alert('✅ Voting started for milestone!');
      await fetchMilestones();
    } catch (error) {
      console.error('Error starting vote:', error);
      alert('Failed to start voting: ' + (error as Error).message);
    }
  };

  const castVote = async (milestoneId: number, support: boolean): Promise<void> => {
    try {
      if (!publicClient || !walletClient || !address) return;

      const { request } = await publicClient.simulateContract({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'voteOnMilestone',
        args: [BigInt(milestoneId), support],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
      
      alert(`✅ Vote cast ${support ? 'FOR' : 'AGAINST'} milestone!`);
      await fetchMilestones();
    } catch (error) {
      console.error('Error casting vote:', error);
      alert('Failed to cast vote: ' + (error as Error).message);
    }
  };

  const resolveVote = async (milestoneId: number): Promise<void> => {
    try {
      if (!publicClient || !walletClient || !address) return;

      const { request } = await publicClient.simulateContract({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'resolveMilestoneVote',
        args: [BigInt(milestoneId)],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
      
      alert('✅ Vote resolved!');
      await fetchMilestones();
    } catch (error) {
      console.error('Error resolving vote:', error);
      alert('Failed to resolve vote: ' + (error as Error).message);
    }
  };

  const calculateVotePercentage = (votesFor: bigint, votesAgainst: bigint): number => {
    const total = votesFor + votesAgainst;
    if (total === BigInt(0)) return 0;
    return Number((votesFor * BigInt(100)) / total);
  };

  const getTimeRemaining = (deadline: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = deadline - now;
    
    if (remaining <= 0) return 'Voting ended';
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const getVotingStatus = (milestoneId: number): VotingStatus => {
    const vote = voteStatuses[milestoneId];
    const milestone = milestones[milestoneId];
    
    if (!vote) return 'not-started';
    if (milestone.completed && !governanceEnabled) return 'completed-no-vote';
    if (vote.resolved && vote.approved) return 'approved';
    if (vote.resolved && !vote.approved) return 'rejected';
    if (vote.votingDeadline === 0) return 'not-started';
    
    const now = Math.floor(Date.now() / 1000);
    if (now > vote.votingDeadline) return 'ended-pending';
    
    return 'active';
  };

  if (!governanceEnabled) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">Contributor Governance</h2>
        <p className="text-gray-400">
          Governance is not enabled for this campaign. Milestones are managed by the creator.
        </p>
      </div>
    );
  }

  if (!isFinalized || !isSuccessful) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">Contributor Governance</h2>
        <p className="text-gray-400">
          Governance will be available after the campaign is finalized and successful.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Contributor Governance</h2>
        <p className="text-gray-400 text-sm">
          Contributors vote on milestone completion. 60% approval required. Vote weight based on contribution amount.
        </p>
        {hasContributed && (
          <p className="text-blue-400 text-sm mt-2">
            Your voting power: {formatEther(userContribution)} ETH
          </p>
        )}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading milestones...</div>
      ) : milestones.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          No milestones defined for this campaign.
        </div>
      ) : (
        <div className="space-y-4">
          {milestones.map((milestone, index) => {
            const status = getVotingStatus(index);
            const vote = voteStatuses[index] || {} as VoteStatus;
            const percentFor = calculateVotePercentage(vote.votesFor || BigInt(0), vote.votesAgainst || BigInt(0));
            const totalVotes = (vote.votesFor || BigInt(0)) + (vote.votesAgainst || BigInt(0));
            const participation = totalRaised > BigInt(0) 
              ? Number((totalVotes * BigInt(100)) / totalRaised)
              : 0;

            return (
              <div
                key={index}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700"
              >
                {/* Milestone Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Milestone {index + 1}
                    </h3>
                    <p className="text-gray-300 mt-1">{milestone.description}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Amount: {formatEther(milestone.amount)} ETH
                    </p>
                  </div>
                  
                  {/* Status Badge */}
                  <div>
                    {status === 'approved' && (
                      <span className="px-3 py-1 bg-green-900/50 text-green-300 text-sm rounded-full border border-green-700">
                        ✓ Approved
                      </span>
                    )}
                    {status === 'rejected' && (
                      <span className="px-3 py-1 bg-red-900/50 text-red-300 text-sm rounded-full border border-red-700">
                        ✗ Rejected
                      </span>
                    )}
                    {status === 'active' && (
                      <span className="px-3 py-1 bg-blue-900/50 text-blue-300 text-sm rounded-full border border-blue-700">
                        🗳️ Voting Active
                      </span>
                    )}
                    {status === 'ended-pending' && (
                      <span className="px-3 py-1 bg-yellow-900/50 text-yellow-300 text-sm rounded-full border border-yellow-700">
                        ⏰ Pending Resolution
                      </span>
                    )}
                  </div>
                </div>

                {/* Voting Status */}
                {status !== 'not-started' && status !== 'completed-no-vote' && (
                  <div className="mt-4">
                    {/* Vote Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">
                          For: {formatEther(vote.votesFor || BigInt(0))} ETH ({percentFor}%)
                        </span>
                        <span className="text-gray-400">
                          Against: {formatEther(vote.votesAgainst || BigInt(0))} ETH ({100 - percentFor}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            percentFor >= 60 ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${percentFor}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Participation: {participation.toFixed(1)}%</span>
                        <span>Required: 60%</span>
                      </div>
                    </div>

                    {/* Time Remaining */}
                    {status === 'active' && (
                      <p className="text-sm text-gray-400 mb-3">
                        ⏰ {getTimeRemaining(vote.votingDeadline)}
                      </p>
                    )}

                    {/* Voting Buttons */}
                    {status === 'active' && hasContributed && (
                      <div className="flex gap-3">
                        {vote.hasVoted ? (
                          <div className="w-full px-4 py-2 bg-gray-700 text-gray-400 rounded-lg text-center">
                            You voted: {vote.voteChoice ? '✓ FOR' : '✗ AGAINST'}
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => castVote(index, true)}
                              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                            >
                              ✓ Vote FOR
                            </button>
                            <button
                              onClick={() => castVote(index, false)}
                              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                            >
                              ✗ Vote AGAINST
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Resolve Button */}
                    {status === 'ended-pending' && (
                      <button
                        onClick={() => resolveVote(index)}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        Resolve Vote
                      </button>
                    )}
                  </div>
                )}

                {/* Start Voting Button (Creator Only) */}
                {status === 'not-started' && isCreator && (
                  <button
                    onClick={() => startVoting(index)}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors mt-4"
                  >
                    Start Voting on Milestone Completion
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}