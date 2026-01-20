import { useState, useEffect } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { parseEther } from 'viem';
import type { Address } from 'viem';
import { decodeEventLog } from 'viem';

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
] as const;

// Updated Campaign interface with proper Address type
export interface Campaign {
  address: Address;  // Changed from string to Address
  name: string;
  beneficiary: Address;  // Changed from string to Address
  fundingCap: string;
  totalRaised: string;
  deadline: number;
  finalized: boolean;
  isSuccessful: boolean;
  creator: Address;  // Changed from string to Address
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

    console.log('🚀 Creating campaign:', data);

    // Create the campaign
    const hash = await walletClient.writeContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'createCampaign',
      args: [
        data.name,
        data.beneficiary as Address,
        BigInt(data.duration),
        parseEther(data.fundingCap),
      ],
    });

    console.log('📝 Transaction hash:', hash);
    console.log('⏳ Waiting for confirmation...');

    // Wait for transaction to be mined
    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
    console.log('✅ Transaction confirmed!');

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
            campaignAddress = decoded.args.campaignAddress;
            break;
        }
      } catch {
        // Not the event we're looking for
        continue;
      }
    }

    if (!campaignAddress) {
      throw new Error('Campaign created but address not found in events');
    }

    // Add milestones if specified
    if (data.milestones && data.milestones.length > 0) {
      console.log('🎯 Adding', data.milestones.length, 'milestones...');

      for (let i = 0; i < data.milestones.length; i++) {
        const milestone = data.milestones[i];
        console.log(`  ${i + 1}. ${milestone.description} - ${milestone.amount} ETH`);

        const milestoneHash = await walletClient.writeContract({
          address: campaignAddress,
          abi: CROWDFUND_ABI,
          functionName: 'addMilestone',
          args: [milestone.description, parseEther(milestone.amount)],
        });

        await publicClient!.waitForTransactionReceipt({ hash: milestoneHash });
        console.log(`  ✅ Milestone ${i + 1} added`);
      }
    }

    return campaignAddress;
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