import { useState, useEffect } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { parseEther, decodeEventLog, formatEther } from 'viem';
import type { Address } from 'viem';

// Contract address from environment
const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '') as Address;

// Factory ABI
const FACTORY_ABI = [
  {
    type: 'function',
    name: 'createCampaign',
    inputs: [
      { name: '_name', type: 'string' },
      { name: '_beneficiary', type: 'address' },
      { name: '_duration', type: 'uint256' },
      { name: '_fundingCap', type: 'uint256' }
    ],
    outputs: [{ type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAllCampaigns',
    inputs: [],
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCampaignCount',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'CampaignCreated',
    inputs: [
      { indexed: true, name: 'campaignAddress', type: 'address' },
      { indexed: true, name: 'creator', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'beneficiary', type: 'address' },
      { name: 'fundingCap', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ],
  },
] as const;

// Crowdfund ABI
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
    name: 'creator',
    inputs: [],
    outputs: [{ type: 'address' }],
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
    name: 'addMilestone',
    inputs: [
      { name: '_description', type: 'string' },
      { name: '_amount', type: 'uint256' }
    ],
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
] as const;

// Updated Campaign interface with proper Address type
export interface Campaign {
  address: Address;
  name: string;
  beneficiary: Address;
  fundingCap: string;
  totalRaised: string;
  deadline: number;
  finalized: boolean;
  isSuccessful: boolean;
  creator: Address;
}

export function useCrowdfundFactory() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use Wagmi hooks
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const fetchCampaigns = async () => {
    if (!FACTORY_ADDRESS) {
      console.error('❌ Factory address not configured');
      console.log('📝 Please set NEXT_PUBLIC_FACTORY_ADDRESS in your .env.local file');
      setError('Factory address not configured');
      setLoading(false);
      return;
    }

    if (!publicClient) {
      console.error('❌ Public client not available');
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Fetching campaigns from factory:', FACTORY_ADDRESS);
      setLoading(true);
      setError(null);

      // Get all campaign addresses
      const campaignAddresses = await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'getAllCampaigns',
      }) as Address[];

      console.log('📊 Found', campaignAddresses.length, 'campaigns');

      if (campaignAddresses.length === 0) {
        console.log('📦 No campaigns created yet');
        setCampaigns([]);
        setLoading(false);
        return;
      }

      // Fetch details for each campaign
      const campaignData = await Promise.all(
        campaignAddresses.map(async (address) => {
          try {
            console.log('📖 Reading campaign:', address);

            const [name, beneficiary, fundingCap, deadline, totalRaised, finalized, creator, isSuccessful] = await Promise.all([
              publicClient.readContract({
                address,
                abi: CROWDFUND_ABI,
                functionName: 'name',
              }),
              publicClient.readContract({
                address,
                abi: CROWDFUND_ABI,
                functionName: 'beneficiary',
              }),
              publicClient.readContract({
                address,
                abi: CROWDFUND_ABI,
                functionName: 'fundingCap',
              }),
              publicClient.readContract({
                address,
                abi: CROWDFUND_ABI,
                functionName: 'deadline',
              }),
              publicClient.readContract({
                address,
                abi: CROWDFUND_ABI,
                functionName: 'totalFundsRaised',
              }),
              publicClient.readContract({
                address,
                abi: CROWDFUND_ABI,
                functionName: 'finalized',
              }),
              publicClient.readContract({
                address,
                abi: CROWDFUND_ABI,
                functionName: 'creator',
              }),
              publicClient.readContract({
                address,
                abi: CROWDFUND_ABI,
                functionName: 'isSuccessful',
              }),
            ]);

            return {
              address,
              name: name as string,
              beneficiary: beneficiary as Address,
              fundingCap: (fundingCap as bigint).toString(),
              totalRaised: (totalRaised as bigint).toString(),
              deadline: Number(deadline as bigint),
              finalized: finalized as boolean,
              isSuccessful: isSuccessful as boolean,
              creator: creator as Address,
            };
          } catch (err) {
            console.error('❌ Error fetching campaign', address, err);
            return null;
          }
        })
      );

      // Filter out any failed fetches
      const validCampaigns = campaignData.filter((c): c is Campaign => c !== null);
      console.log('✅ Successfully loaded', validCampaigns.length, 'campaigns');
      setCampaigns(validCampaigns);
    } catch (error: any) {
      console.error('❌ Error fetching campaigns:', error);
      setError(error.message || 'Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async (data: {
    name: string;
    beneficiary: string;
    duration: number;
    fundingCap: string;
    milestones?: Array<{ description: string; amount: string }>;
  }) => {
    if (!FACTORY_ADDRESS) {
      throw new Error('Factory address not configured');
    }

    if (!walletClient) {
      throw new Error('Please connect your wallet');
    }

    if (!publicClient) {
      throw new Error('Public client not available');
    }

    console.log('🚀 Creating campaign with data:', data);

    // IMPORTANT: Add buffer time for milestones
    // If milestones exist, add 5 minutes to duration to allow time for milestone transactions
    let adjustedDuration = data.duration;
    if (data.milestones && data.milestones.length > 0) {
      const bufferTime = 300; // 5 minutes in seconds
      adjustedDuration = data.duration + bufferTime;
      console.log('⏰ Adding 5 minute buffer for milestone transactions');
      console.log('   Original duration:', data.duration, 'seconds');
      console.log('   Adjusted duration:', adjustedDuration, 'seconds');
    }

    // Validate milestone amounts
    if (data.milestones && data.milestones.length > 0) {
      const totalMilestoneAmount = data.milestones.reduce((sum, m) => sum + parseFloat(m.amount), 0);
      const fundingCapFloat = parseFloat(data.fundingCap);
      
      console.log('📊 Milestone validation:');
      console.log('  - Total milestones:', totalMilestoneAmount, 'ETH');
      console.log('  - Funding cap:', fundingCapFloat, 'ETH');
      
      if (totalMilestoneAmount > fundingCapFloat) {
        throw new Error(`Total milestone amount (${totalMilestoneAmount} ETH) exceeds funding cap (${fundingCapFloat} ETH)`);
      }
    }

    try {
      // Step 1: Create the campaign
      console.log('📝 Step 1: Creating campaign...');
      console.log('  - Name:', data.name);
      console.log('  - Beneficiary:', data.beneficiary);
      console.log('  - Duration:', adjustedDuration, 'seconds');
      console.log('  - Funding Cap:', data.fundingCap, 'ETH');

      const fundingCapWei = parseEther(data.fundingCap);

      const hash = await walletClient.writeContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'createCampaign',
        args: [
          data.name,
          data.beneficiary as Address,
          BigInt(adjustedDuration),
          fundingCapWei,
        ],
      });

      console.log('📝 Transaction hash:', hash);
      console.log('⏳ Waiting for confirmation...');

      // Wait for transaction to be mined
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('✅ Campaign creation confirmed!');

      // Get campaign address from event logs
      let campaignAddress: Address | undefined;

      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: FACTORY_ABI,
            data: log.data,
            topics: log.topics,
          });

          if (decoded.eventName === 'CampaignCreated') {
            campaignAddress = (decoded.args as any).campaignAddress;
            console.log('📍 Campaign created at:', campaignAddress);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!campaignAddress) {
        console.log('⚠️  Could not parse event, fetching from contract...');
        const allCampaigns = await publicClient.readContract({
          address: FACTORY_ADDRESS,
          abi: FACTORY_ABI,
          functionName: 'getAllCampaigns',
        }) as Address[];

        if (allCampaigns.length > 0) {
          campaignAddress = allCampaigns[allCampaigns.length - 1];
          console.log('📍 Campaign address from contract:', campaignAddress);
        } else {
          throw new Error('Campaign created but address not found');
        }
      }

      // Step 2: Add milestones if specified
      if (data.milestones && data.milestones.length > 0) {
        console.log('🎯 Step 2: Adding', data.milestones.length, 'milestones...');
        console.log('⚡ Adding milestones immediately to avoid deadline issues');

        for (let i = 0; i < data.milestones.length; i++) {
          const milestone = data.milestones[i];
          const milestoneAmountWei = parseEther(milestone.amount);
          
          console.log(`📌 Milestone ${i + 1}/${data.milestones.length}:`);
          console.log(`   Description: ${milestone.description}`);
          console.log(`   Amount: ${milestone.amount} ETH`);

          try {
            const milestoneHash = await walletClient.writeContract({
              address: campaignAddress,
              abi: CROWDFUND_ABI,
              functionName: 'addMilestone',
              args: [milestone.description, milestoneAmountWei],
            });

            console.log(`   Transaction: ${milestoneHash}`);
            
            const milestoneReceipt = await publicClient.waitForTransactionReceipt({ 
              hash: milestoneHash,
              timeout: 60_000, // 60 second timeout
            });
            
            console.log(`   ✅ Milestone ${i + 1} added successfully`);
          } catch (milestoneError: any) {
            console.error(`   ❌ Error adding milestone ${i + 1}:`, milestoneError);
            
            // Check if it's a deadline error
            if (milestoneError.message?.includes('Campaign has ended') || 
                milestoneError.message?.includes('beforeDeadline')) {
              throw new Error(`Milestone ${i + 1} failed: Campaign deadline passed. Try creating campaign with longer duration or fewer milestones.`);
            }
            
            throw new Error(`Failed to add milestone ${i + 1}: ${milestoneError.shortMessage || milestoneError.message}`);
          }
        }

        console.log('✅ All milestones added successfully!');
      }

      console.log('🎉 Campaign creation complete!');
      return campaignAddress;
      
    } catch (error: any) {
      console.error('❌ Error in createCampaign:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Failed to create campaign';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      if (error.shortMessage) {
        errorMessage = error.shortMessage;
      }
      
      // Check for common errors
      if (errorMessage.includes('user rejected') || errorMessage.includes('User rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas fees';
      } else if (errorMessage.includes('Campaign has ended') || errorMessage.includes('beforeDeadline')) {
        errorMessage = 'Campaign deadline passed while adding milestones. Please use a longer duration (recommended: at least 1 hour for campaigns with milestones).';
      }
      
      console.error('📛 Final error:', errorMessage);
      throw new Error(errorMessage);
    }
  };

  const refreshCampaigns = async () => {
    console.log('🔄 Refreshing campaigns...');
    await fetchCampaigns();
  };

  // Fetch campaigns when public client is available
  useEffect(() => {
    if (publicClient) {
      fetchCampaigns();
    }
  }, [publicClient]);

  return {
    campaigns,
    loading,
    error,
    createCampaign,
    refreshCampaigns,
  };
}