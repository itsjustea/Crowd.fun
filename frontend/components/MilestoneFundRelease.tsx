// components/MilestoneFundRelease.tsx
import { useState, useEffect } from 'react';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { formatEther, Address, Abi } from 'viem';

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

interface MilestoneFundReleaseProps {
  campaignAddress: Address;
  campaignAbi: Abi;
  isCreator: boolean;
  isSuccessful: boolean;
  isFinalized: boolean;
  governanceEnabled: boolean;
}

export default function MilestoneFundRelease({
  campaignAddress,
  campaignAbi,
  isCreator,
  isSuccessful,
  isFinalized,
  governanceEnabled
}: MilestoneFundReleaseProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [voteStatuses, setVoteStatuses] = useState<Record<number, VoteStatus>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [releasingFunds, setReleasingFunds] = useState<Record<number, boolean>>({});

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  useEffect(() => {
    fetchMilestones();
  }, [campaignAddress]);

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

      // Fetch vote status for each milestone if governance is enabled
      if (governanceEnabled) {
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
    } catch (error) {
      console.error('Error fetching milestones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseFunds = async (milestoneId: number): Promise<void> => {
    if (!publicClient || !walletClient || !address) {
      alert('Please connect your wallet');
      return;
    }

    setReleasingFunds(prev => ({ ...prev, [milestoneId]: true }));
    try {
      const { request } = await publicClient.simulateContract({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'releaseMilestoneFunds',
        args: [BigInt(milestoneId)],
        account: address,
      });

      const hash = await walletClient.writeContract(request);

      await publicClient.waitForTransactionReceipt({ hash });

      alert(`✅ Funds released for Milestone ${milestoneId + 1}!`);

      // Refresh milestones
      await fetchMilestones();
    } catch (error) {
      console.error('Error releasing funds:', error);

      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;

        if (errorMessage.includes('user rejected')) {
          errorMessage = 'Transaction was rejected';
        } else if (errorMessage.includes('not completed')) {
          errorMessage = 'Milestone not completed yet';
        } else if (errorMessage.includes('not approved')) {
          errorMessage = 'Milestone not approved by contributors';
        } else if (errorMessage.includes('already released')) {
          errorMessage = 'Funds already released for this milestone';
        }
      }

      alert('Failed to release funds: ' + errorMessage);
    } finally {
      setReleasingFunds(prev => ({ ...prev, [milestoneId]: false }));
    }
  };

  const canReleaseFunds = (milestone: Milestone, index: number): boolean => {
    if (!isCreator || !isSuccessful || !isFinalized) return false;
    if (milestone.fundsReleased) return false;

    if (governanceEnabled) {
      const voteStatus = voteStatuses[index];
      return voteStatus?.resolved && voteStatus?.approved;
    } else {
      return milestone.completed;
    }
  };

  const getMilestoneStatus = (milestone: Milestone, index: number): string => {
    if (milestone.fundsReleased) return 'Funds Released';
    if (!milestone.completed) return 'Not Completed';

    if (governanceEnabled) {
      const voteStatus = voteStatuses[index];
      if (!voteStatus) return 'No Vote Data';
      if (!voteStatus.resolved) return 'Voting in Progress';
      if (voteStatus.approved) return 'Approved - Ready to Release';
      return 'Rejected by Contributors';
    }

    return 'Completed - Ready to Release';
  };

  const getStatusColor = (milestone: Milestone, index: number): string => {
    if (milestone.fundsReleased) return 'bg-green-900/50 text-green-300 border-green-700';
    if (!milestone.completed) return 'bg-gray-900/50 text-gray-400 border-gray-700';

    if (governanceEnabled) {
      const voteStatus = voteStatuses[index];
      if (!voteStatus?.resolved) return 'bg-blue-900/50 text-blue-300 border-blue-700';
      if (voteStatus.approved) return 'bg-yellow-900/50 text-yellow-300 border-yellow-700';
      return 'bg-red-900/50 text-red-300 border-red-700';
    }

    return 'bg-yellow-900/50 text-yellow-300 border-yellow-700';
  };

  if (!isCreator) {
    return null; // Only show to creator
  }

  if (!isFinalized || !isSuccessful) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">💰 Milestone Funds</h2>
        <p className="text-gray-400">
          Fund release will be available after the campaign is finalized and successful.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">💰 Milestone Funds</h2>
        <p className="text-gray-400">Loading milestones...</p>
      </div>
    );
  }

  if (milestones.length === 0) {
    return (
      <div className="mt-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">💰 Milestone Funds</h2>
        <p className="text-gray-400">No milestones defined for this campaign.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">💰 Milestone Fund Release</h2>
        <p className="text-gray-400 text-sm">
          Release funds to the beneficiary for completed and approved milestones.
        </p>
      </div>

      <div className="space-y-4">
        {milestones.map((milestone, index) => (
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
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(milestone, index)}`}>
                  {getMilestoneStatus(milestone, index)}
                </span>
              </div>
            </div>

            {/* Governance Info */}
            {governanceEnabled && voteStatuses[index] && (
              <div className="mb-4 bg-gray-900/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">Voting Results:</div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">
                    For: {(voteStatuses[index].votesFor)}
                  </span>
                  <span className="text-gray-300">
                    Against: {(voteStatuses[index].votesAgainst)}
                  </span>
                </div>
              </div>
            )}

            {/* Release Button */}
            {canReleaseFunds(milestone, index) ? (
              <button
                onClick={() => handleReleaseFunds(index)}
                disabled={releasingFunds[index]}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {releasingFunds[index] ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Releasing Funds...
                  </>
                ) : (
                  <>
                    💸 Release {formatEther(milestone.amount)} ETH
                  </>
                )}
              </button>
            ) : milestone.fundsReleased ? (
              <div className="w-full px-6 py-3 bg-green-900/30 border border-green-700 text-green-300 font-semibold rounded-lg text-center">
                ✓ Funds Released
              </div>
            ) : !milestone.completed ? (
              <div className="w-full px-6 py-3 bg-gray-700 text-gray-400 font-semibold rounded-lg text-center">
                Complete milestone to release funds
              </div>
            ) : governanceEnabled && voteStatuses[index] && !voteStatuses[index].resolved ? (
              <div className="w-full px-6 py-3 bg-blue-900/30 border border-blue-700 text-blue-300 font-semibold rounded-lg text-center">
                Waiting for vote resolution
              </div>
            ) : governanceEnabled && voteStatuses[index] && !voteStatuses[index].approved ? (
              <div className="w-full px-6 py-3 bg-red-900/30 border border-red-700 text-red-300 font-semibold rounded-lg text-center">
                Milestone rejected - funds cannot be released
              </div>
            ) : (
              <div className="w-full px-6 py-3 bg-gray-700 text-gray-400 font-semibold rounded-lg text-center">
                Cannot release funds yet
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <div className="text-blue-300 font-semibold mb-2">📋 Release Summary</div>
        <div className="text-sm text-blue-200 space-y-1">
          <div>Total Milestones: {milestones.length}</div>
          <div>Funds Released: {milestones.filter(m => m.fundsReleased).length}</div>
          <div>
            Ready to Release: {milestones.filter((m, i) => canReleaseFunds(m, i)).length}
          </div>
          <div>
            Total Released: {formatEther(
              milestones
                .filter(m => m.fundsReleased)
                .reduce((sum, m) => sum + m.amount, BigInt(0))
            )} ETH
          </div>
        </div>
      </div>
    </div>
  );
}