// components/CampaignUpdates.tsx
import { useState, useEffect } from 'react';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { Address, Abi } from 'viem';

interface Update {
  id: number;
  title: string;
  ipfsHash: string;
  timestamp: number;
  milestoneId: number | null;
}

interface Milestone {
  description: string;
  amount: bigint;
  completed: boolean;
  fundsReleased: boolean;
}

interface CampaignUpdatesProps {
  campaignAddress: Address;
  campaignAbi: Abi;
  isCreator: boolean;
}

export default function CampaignUpdates({ 
  campaignAddress, 
  campaignAbi, 
  isCreator 
}: CampaignUpdatesProps) {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showPostForm, setShowPostForm] = useState<boolean>(false);
  
  // Form state
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [selectedMilestone, setSelectedMilestone] = useState<string>('none');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [ipfsHash, setIpfsHash] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  // Fetch updates
  useEffect(() => {
    fetchUpdates();
    fetchMilestones();
  }, [campaignAddress]);

  const fetchUpdates = async (): Promise<void> => {
    try {
      setLoading(true);
      
      if (!publicClient) return;

      // Get update count
      const count = await publicClient.readContract({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'getUpdateCount',
      }) as bigint;

      // Fetch all updates
      const updatesPromises: Promise<readonly [string, string, bigint, bigint]>[] = [];
      for (let i = 0; i < Number(count); i++) {
        updatesPromises.push(
          publicClient.readContract({
            address: campaignAddress,
            abi: campaignAbi,
            functionName: 'getUpdate',
            args: [BigInt(i)],
          }) as Promise<readonly [string, string, bigint, bigint]>
        );
      }

      const updatesData = await Promise.all(updatesPromises);
      
      // Format updates
      const formattedUpdates: Update[] = updatesData.map((update, index) => ({
        id: index,
        title: update[0],
        ipfsHash: update[1],
        timestamp: Number(update[2]),
        milestoneId: update[3].toString() === '115792089237316195423570985008687907853269984665640564039457584007913129639935' 
          ? null 
          : Number(update[3]),
      }));

      setUpdates(formattedUpdates.reverse()); // Show newest first
    } catch (error) {
      console.error('Error fetching updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMilestones = async (): Promise<void> => {
    try {
      if (!publicClient) return;

      const milestonesData = await publicClient.readContract({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'getAllMilestones',
      }) as Milestone[];
      
      setMilestones(milestonesData);
    } catch (error) {
      console.error('Error fetching milestones:', error);
    }
  };

  // Simple IPFS upload (you'll need to implement actual IPFS upload)
  const uploadToIPFS = async (): Promise<void> => {
    setIsUploading(true);
    try {
      // TODO: Implement actual IPFS upload
      // For now, create a mock hash from content
      const mockHash = `Qm${btoa(content).substring(0, 44)}`;
      setIpfsHash(mockHash);
      
      // In production, use services like:
      // - Web3.Storage
      // - Pinata
      // - Infura IPFS
      
      alert('Content uploaded to IPFS (mock). Hash: ' + mockHash);
    } catch (error) {
      console.error('IPFS upload error:', error);
      alert('Failed to upload to IPFS');
    } finally {
      setIsUploading(false);
    }
  };

  const postUpdate = async (): Promise<void> => {
    if (!title || !ipfsHash) {
      alert('Please provide a title and upload content to IPFS');
      return;
    }

    if (!publicClient || !walletClient || !address) {
      alert('Please connect your wallet');
      return;
    }

    setIsPosting(true);
    try {
      // Determine milestone ID (use max uint256 for no milestone)
      const milestoneId = selectedMilestone === 'none' 
        ? BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
        : BigInt(selectedMilestone);

      const { request } = await publicClient.simulateContract({
        address: campaignAddress,
        abi: campaignAbi,
        functionName: 'postUpdate',
        args: [title, ipfsHash, milestoneId],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      
      // Wait for transaction
      await publicClient.waitForTransactionReceipt({ hash });
      
      alert('✅ Update posted successfully!');
      
      // Reset form
      setTitle('');
      setContent('');
      setIpfsHash('');
      setSelectedMilestone('none');
      setShowPostForm(false);
      
      // Refresh updates
      await fetchUpdates();
    } catch (error) {
      console.error('Error posting update:', error);
      alert('Failed to post update: ' + (error as Error).message);
    } finally {
      setIsPosting(false);
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMilestoneName = (milestoneId: number | null): string | null => {
    if (milestoneId === null) return null;
    if (milestoneId >= milestones.length) return null;
    return milestones[milestoneId].description;
  };

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Campaign Updates</h2>
        {isCreator && (
          <button
            onClick={() => setShowPostForm(!showPostForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {showPostForm ? 'Cancel' : '+ Post Update'}
          </button>
        )}
      </div>

      {/* Post Update Form */}
      {showPostForm && (
        <div className="mb-6 bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-4">Post New Update</h3>
          
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Update Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Milestone 1 Completed - Design Phase Done"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                maxLength={100}
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Update Content *
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your update here... Include progress details, images, or links."
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 h-32"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={uploadToIPFS}
                  disabled={!content || isUploading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white rounded-lg text-sm transition-colors"
                >
                  {isUploading ? 'Uploading...' : 'Upload to IPFS'}
                </button>
                {ipfsHash && (
                  <span className="text-sm text-green-400">
                    ✓ Uploaded: {ipfsHash.substring(0, 10)}...
                  </span>
                )}
              </div>
            </div>

            {/* Milestone Link */}
            {milestones.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Related Milestone (Optional)
                </label>
                <select
                  value={selectedMilestone}
                  onChange={(e) => setSelectedMilestone(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="none">No specific milestone</option>
                  {milestones.map((milestone, index) => (
                    <option key={index} value={index}>
                      Milestone {index + 1}: {milestone.description}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Post Button */}
            <button
              onClick={postUpdate}
              disabled={!title || !ipfsHash || isPosting}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
            >
              {isPosting ? 'Posting...' : 'Post Update'}
            </button>
          </div>
        </div>
      )}

      {/* Updates List */}
      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading updates...</div>
      ) : updates.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          <p>No updates yet.</p>
          {isCreator && (
            <p className="text-sm mt-2">Be the first to post a campaign update!</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {updates.map((update) => (
            <div
              key={update.id}
              className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              {/* Update Header */}
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-white">{update.title}</h3>
                <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                  {formatTimestamp(update.timestamp)}
                </span>
              </div>

              {/* Milestone Badge */}
              {getMilestoneName(update.milestoneId) && (
                <div className="mb-3">
                  <span className="inline-block px-3 py-1 bg-purple-900/50 text-purple-300 text-xs rounded-full border border-purple-700">
                    📍 {getMilestoneName(update.milestoneId)}
                  </span>
                </div>
              )}

              {/* IPFS Content Link */}
              <div className="text-gray-300 text-sm">
                <a
                  href={`https://ipfs.io/ipfs/${update.ipfsHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  View full update on IPFS →
                </a>
              </div>

              {/* Update ID */}
              <div className="mt-3 text-xs text-gray-500">
                Update #{update.id+1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}