// components/CampaignUpdates.tsx
import { useState, useEffect } from 'react';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { Address, Abi } from 'viem';
import { uploadUpdateToIPFS, uploadImageToIPFS, fetchUpdateFromIPFS, CampaignUpdate } from '../lib/ipfs';
import { toast } from 'sonner';

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
  
  const [selectedImages, setSelectedImages] = useState<File[]>([]); // For image uploads
  const [uploadedImageHashes, setUploadedImageHashes] = useState<string[]>([]); // Store IPFS hashes of uploaded images
  const [updateContents, setUpdateContents] = useState<Record<number, CampaignUpdate>>({}); // Cache for fetched update content

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

  useEffect(() => {
    const fetchAllUpdateContents = async () => {
      for (const update of updates) {
        try {
          const content = await fetchUpdateFromIPFS(update.ipfsHash);
          setUpdateContents(prev => ({
            ...prev,
            [update.id]: content
          }));
        } catch (error) {
          console.error('Failed to fetch update content:', error);
        }
      }
    };

    if (updates.length > 0) {
      fetchAllUpdateContents();
    }
  }, [updates]);

  const fetchUpdates = async (): Promise<void> => {
    try {
      setLoading(true);
      
      if (!publicClient) return;

      // ✅ Fetch UpdatePosted events instead of reading storage
      const logs = await publicClient.getLogs({
        address: campaignAddress,
        event: {
          type: 'event',
          name: 'UpdatePosted',
          inputs: [
            { indexed: true, name: 'milestoneId', type: 'uint256' },
            { indexed: false, name: 'title', type: 'string' },
            { indexed: false, name: 'ipfsHash', type: 'string' },
            { indexed: false, name: 'timestamp', type: 'uint256' }
          ]
        },
        fromBlock: BigInt(0),
        toBlock: 'latest'
      });

      // Parse events into updates
      const formattedUpdates: Update[] = logs.map((log, index) => {
        const { milestoneId, title, ipfsHash, timestamp } = log.args as any;
        
        return {
          id: index,
          title,
          ipfsHash,
          timestamp: Number(timestamp),
          milestoneId: milestoneId.toString() === '115792089237316195423570985008687907853269984665640564039457584007913129639935' 
            ? null 
            : Number(milestoneId),
        };
      });

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Limit to 3 images
    if (files.length > 3) {
      toast.error('Maximum 3 images allowed');
      return;
    }

    // Check file sizes (max 5MB each)
    const oversized = files.find(f => f.size > 5 * 1024 * 1024);
    if (oversized) {
      toast.error('Images must be under 5MB each');
      return;
    }

    setSelectedImages(files);
  };

  const uploadToIPFS = async (): Promise<void> => {
    if (!title || !content) {
      toast.error('Please provide title and content');
      return;
    }

    setIsUploading(true);
    const uploadToast = toast.loading('Uploading to IPFS...');

    try {
      // Upload images first if any
      const imageHashes: string[] = [];
      if (selectedImages.length > 0) {
        toast.loading(`Uploading ${selectedImages.length} image(s)...`, { id: uploadToast });
        
        for (let i = 0; i < selectedImages.length; i++) {
          const hash = await uploadImageToIPFS(selectedImages[i]);
          imageHashes.push(hash);
        }
        
        setUploadedImageHashes(imageHashes);
      }

      // Upload update content
      toast.loading('Uploading update content...', { id: uploadToast });
      
      const updateData = {
        title,
        content,
        images: imageHashes,
        timestamp: Math.floor(Date.now() / 1000),
        author: address || '',
      };

      const hash = await uploadUpdateToIPFS(updateData);
      setIpfsHash(hash);

      toast.success('✅ Uploaded to IPFS successfully!', { id: uploadToast });
    } catch (error) {
      console.error('IPFS upload error:', error);
      toast.error('Failed to upload to IPFS', { id: uploadToast });
    } finally {
      setIsUploading(false);
    }
  };

  const postUpdate = async (): Promise<void> => {
    if (!title || !ipfsHash) {
      toast.error('Please upload content to IPFS first');
      return;
    }

    if (!publicClient || !walletClient || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsPosting(true);
    try {
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
      
      await toast.promise(
        publicClient.waitForTransactionReceipt({ hash }),
        {
          loading: 'Posting update on-chain...',
          success: '✅ Update posted successfully!',
          error: 'Failed to post update',
        }
      );
      
      // Reset form
      setTitle('');
      setContent('');
      setIpfsHash('');
      setSelectedImages([]);
      setUploadedImageHashes([]);
      setSelectedMilestone('none');
      setShowPostForm(false);
      
      await fetchUpdates();
    } catch (error) {
      console.error('Error posting update:', error);
      toast.error('Failed to post update');
    } finally {
      setIsPosting(false);
    }
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
                placeholder="Write your update here... Include progress details, next steps, or any relevant information."
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 h-32"
              />
            </div>

            {/* ✅ Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Images (Optional, max 3)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
              {selectedImages.length > 0 && (
                <div className="mt-2 text-sm text-gray-400">
                  {selectedImages.length} image(s) selected
                </div>
              )}
            </div>

            {/* Upload to IPFS Button */}
            <div>
              <button
                onClick={uploadToIPFS}
                disabled={!content || !title || isUploading}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
              >
                {isUploading ? 'Uploading to IPFS...' : '📤 Upload to IPFS'}
              </button>
              {ipfsHash && (
                <div className="mt-2 p-3 bg-green-900/30 border border-green-700 rounded-lg">
                  <p className="text-sm text-green-400">
                    ✓ Uploaded to IPFS
                  </p>
                  <p className="text-xs text-gray-400 mt-1 font-mono break-all">
                    {ipfsHash}
                  </p>
                </div>
              )}
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
              disabled={!ipfsHash || isPosting}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
            >
              {isPosting ? 'Posting...' : '📝 Post Update On-Chain'}
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
          {updates.map((update) => {
            const content = updateContents[update.id]; // ✅ Get fetched content
            
            return (
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

                {/* ✅ Update Content */}
                {content ? (
                  <div className="mb-4">
                    <p className="text-gray-300 text-sm whitespace-pre-wrap mb-4">
                      {content.content}
                    </p>

                    {/* ✅ Display Images from IPFS */}
                    {content.images && content.images.length > 0 && (
                      <div className={`grid gap-3 mb-4 ${
                        content.images.length === 1 ? 'grid-cols-1' :
                        content.images.length === 2 ? 'grid-cols-2' :
                        'grid-cols-3'
                      }`}>
                        {content.images.map((imageHash: string, idx: number) => (
                          <a
                            key={idx}
                            href={`https://gateway.pinata.cloud/ipfs/${imageHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative block"
                          >
                            <img
                              src={`https://gateway.pinata.cloud/ipfs/${imageHash}`}
                              alt={`Update image ${idx + 1}`}
                              className="w-full h-48 object-cover rounded-lg border border-gray-700 group-hover:border-gray-500 transition-colors"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-lg flex items-center justify-center">
                              <span className="text-white opacity-0 group-hover:opacity-100 font-semibold text-sm">
                                View Full Size ↗
                              </span>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Author */}
                    <div className="text-xs text-gray-500">
                      Posted by {content.author.slice(0, 6)}...{content.author.slice(-4)}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm mb-4">
                    Loading content...
                  </div>
                )}

                {/* IPFS Link */}
                <div className="text-gray-400 text-xs">
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${update.ipfsHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    View raw data on IPFS →
                  </a>
                </div>

                {/* Update ID */}
                <div className="mt-2 text-xs text-gray-500">
                  Update #{update.id + 1}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
);
}