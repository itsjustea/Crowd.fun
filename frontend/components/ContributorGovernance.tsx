// components/ContributorGovernance.tsx
import { useState } from 'react';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { formatEther } from 'viem';
import type { Address, Abi } from 'viem';
import { useCampaignDetails } from '@/hooks/UseCampaignDetails';

interface ContributorGovernanceProps {
  campaignAddress: Address;
  campaignAbi: Abi;
  isCreator: boolean;
  hasContributed: boolean;
  userContribution?: bigint;
}

export default function ContributorGovernance({ 
  campaignAddress, 
  campaignAbi,
}: ContributorGovernanceProps) {
  const [votingInProgress, setVotingInProgress] = useState<Record<number, boolean>>({});
  
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  // Use the enhanced hook
  const {
    campaign,
    milestones,
    voteStatuses,
    loading,
    error,
    refetch,
    getVoteStatistics
  } = useCampaignDetails(campaignAddress, campaignAbi);

  const startVoting = async (milestoneId: number): Promise<void> => {
    if (!publicClient || !walletClient || !address) {
      alert('Please connect your wallet');
      return;
    }

    setVotingInProgress(prev => ({ ...prev, [milestoneId]: true }));
    try {
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
      await refetch();
    } catch (error) {
      console.error('Error starting vote:', error);
      alert('Failed to start voting: ' + (error as Error).message);
    } finally {
      setVotingInProgress(prev => ({ ...prev, [milestoneId]: false }));
    }
  };

  const castVote = async (milestoneId: number, support: boolean): Promise<void> => {
    if (!publicClient || !walletClient || !address) {
      alert('Please connect your wallet');
      return;
    }

    setVotingInProgress(prev => ({ ...prev, [milestoneId]: true }));
    try {
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
      await refetch();
    } catch (error) {
      console.error('Error casting vote:', error);
      alert('Failed to cast vote: ' + (error as Error).message);
    } finally {
      setVotingInProgress(prev => ({ ...prev, [milestoneId]: false }));
    }
  };

  const resolveVote = async (milestoneId: number): Promise<void> => {
    if (!publicClient || !walletClient || !address) {
      alert('Please connect your wallet');
      return;
    }

    setVotingInProgress(prev => ({ ...prev, [milestoneId]: true }));
    try {
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
      await refetch();
    } catch (error) {
      console.error('Error resolving vote:', error);
      alert('Failed to resolve vote: ' + (error as Error).message);
    } finally {
      setVotingInProgress(prev => ({ ...prev, [milestoneId]: false }));
    }
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

  const getVotingStatus = (milestoneId: number): 
    'not-started' | 'completed-no-vote' | 'approved' | 'rejected' | 'ended-pending' | 'active' => {
    const vote = voteStatuses[milestoneId];
    const milestone = milestones[milestoneId];
    
    if (!vote || !milestone) return 'not-started';
    if (milestone.completed && !campaign?.governanceEnabled) return 'completed-no-vote';
    if (vote.resolved && vote.approved) return 'approved';
    if (vote.resolved && !vote.approved) return 'rejected';
    if (vote.votingDeadline === 0) return 'not-started';
    
    const now = Math.floor(Date.now() / 1000);
    if (now > vote.votingDeadline) return 'ended-pending';
    
    return 'active';
  };

  if (loading) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="text-center text-gray-400 py-8">Loading governance data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="text-center text-red-400 py-8">Error: {error}</div>
      </div>
    );
  }

  if (!campaign?.governanceEnabled) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">Contributor Governance</h2>
        <p className="text-gray-400">
          Governance is not enabled for this campaign. Milestones are managed by the creator.
        </p>
      </div>
    );
  }

  if (!campaign.finalized || !campaign.successful) {
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
          One person, one vote. 60% approval required. Each contributor has equal voting power.
        </p>
        <div className="mt-2 bg-blue-900/20 border border-blue-700 rounded-lg p-3">
          <p className="text-blue-300 text-sm">
            📊 Total Contributors: <span className="font-semibold">{campaign.totalContributors}</span> voters
          </p>
          {campaign.hasContributed && (
            <p className="text-green-400 text-sm mt-1">
              ✓ You have voting rights (1 vote per milestone)
            </p>
          )}
          {!campaign.isCreator &&!campaign.hasContributed && (
            <p className="text-yellow-400 text-sm mt-1">
              ⚠️ You must contribute to participate in voting
            </p>
          )}
        </div>
      </div>

      {milestones.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          No milestones defined for this campaign.
        </div>
      ) : (
        <div className="space-y-4">
          {milestones.map((milestone, index) => {
            const status = getVotingStatus(index);
            const vote = voteStatuses[index];
            const voteStats = getVoteStatistics(index);
            const isProcessing = votingInProgress[index];

            return (
              <div
                key={index}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700"
              >
                {/* Milestone Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
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

                {/* Voting Section */}
                {status !== 'not-started' && status !== 'completed-no-vote' && vote && voteStats && (
                  <div className="mt-4">
                    {/* Vote Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">
                          For: {Number(vote.votesFor)} votes ({voteStats.percentageFor}%)
                        </span>
                        <span className="text-gray-400">
                          Against: {Number(vote.votesAgainst)} votes ({voteStats.percentageAgainst}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            voteStats.percentageFor >= 60 ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${voteStats.percentageFor}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>
                          Participation: {voteStats.participationRate}% 
                          ({voteStats.totalVotes}/{campaign.totalContributors} contributors)
                        </span>
                        <span>
                          {voteStats.hasReachedQuorum 
                            ? '✓ Quorum met (30% minimum)' 
                            : '⚠️ Need 30% participation'}
                        </span>
                      </div>
                    </div>

                    {/* Time Remaining */}
                    {status === 'active' && vote.votingDeadline > 0 && (
                      <p className="text-sm text-gray-400 mb-3">
                        ⏰ {getTimeRemaining(vote.votingDeadline)}
                      </p>
                    )}

                    {/* Voting Buttons */}
                    {status === 'active' && campaign.hasContributed && (
                      <div className="flex gap-3">
                        {vote.hasVoted ? (
                          <div className="w-full px-4 py-3 bg-gray-700 text-gray-300 rounded-lg text-center">
                            You voted: {vote.voteChoice ? '✓ FOR' : '✗ AGAINST'}
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => castVote(index, true)}
                              disabled={isProcessing}
                              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                            >
                              {isProcessing ? 'Processing...' : '✓ Vote FOR'}
                            </button>
                            <button
                              onClick={() => castVote(index, false)}
                              disabled={isProcessing}
                              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                            >
                              {isProcessing ? 'Processing...' : '✗ Vote AGAINST'}
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Non-contributor Message */}
                    {status === 'active' && !campaign.hasContributed && (
                      <div className="w-full px-4 py-3 bg-yellow-900/30 border border-yellow-700 text-yellow-300 rounded-lg text-center">
                        Only contributors can vote
                      </div>
                    )}

                    {/* Resolve Vote Button */}
                    {status === 'ended-pending' && voteStats.canResolve && (
                      <button
                        onClick={() => resolveVote(index)}
                        disabled={isProcessing}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        {isProcessing ? 'Resolving...' : 'Resolve Vote'}
                      </button>
                    )}

                    {/* Quorum Not Met Warning */}
                    {status === 'ended-pending' && !voteStats.hasReachedQuorum && (
                      <div className="w-full px-4 py-3 bg-red-900/30 border border-red-700 text-red-300 rounded-lg text-center text-sm">
                        ⚠️ Vote cannot be resolved - minimum 30% participation required
                      </div>
                    )}

                    {/* Vote Statistics Details */}
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Approval Required:</span>
                          <span className="text-white ml-2">60%</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Current Approval:</span>
                          <span className={`ml-2 ${voteStats.percentageFor >= 60 ? 'text-green-400' : 'text-white'}`}>
                            {voteStats.percentageFor}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Min Participation:</span>
                          <span className="text-white ml-2">30%</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Current Participation:</span>
                          <span className={`ml-2 ${voteStats.hasReachedQuorum ? 'text-green-400' : 'text-yellow-400'}`}>
                            {voteStats.participationRate}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Start Voting Button (Creator Only) */}
                {status === 'not-started' && campaign.isCreator && (
                  <button
                    onClick={() => startVoting(index)}
                    disabled={isProcessing}
                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors mt-4"
                  >
                    {isProcessing ? 'Starting Vote...' : 'Start Voting on Milestone Completion'}
                  </button>
                )}

                {/* Not Started Message (Non-Creator) */}
                {status === 'not-started' && !campaign.isCreator && (
                  <div className="mt-4 px-4 py-3 bg-gray-700 text-gray-400 rounded-lg text-center">
                    Waiting for creator to start voting on this milestone
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Governance Summary */}
      {milestones.length > 0 && (
        <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <div className="text-blue-300 font-semibold mb-2">📋 Governance Summary</div>
          <div className="text-sm text-blue-200 space-y-1">
            <div>Total Milestones: {milestones.length}</div>
            <div>
              Approved: {milestones.filter((_, i) => {
                const vote = voteStatuses[i];
                return vote?.resolved && vote?.approved;
              }).length}
            </div>
            <div>
              Active Votes: {milestones.filter((_, i) => getVotingStatus(i) === 'active').length}
            </div>
            <div>
              Pending Resolution: {milestones.filter((_, i) => getVotingStatus(i) === 'ended-pending').length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}