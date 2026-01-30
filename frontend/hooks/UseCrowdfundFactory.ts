// hooks/useCrowdfundFactory.ts
import { useState, useEffect } from 'react';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { parseEther, Address } from 'viem';

// Factory contract address - update this after deployment
const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '') as Address;

// UPDATED: Enhanced Factory ABI with governance support
export const FACTORY_ABI = [
  {
    inputs: [
      { name: '_name', type: 'string' },
      { name: '_beneficiary', type: 'address' },
      { name: '_duration', type: 'uint256' },
      { name: '_fundingCap', type: 'uint256' },
      { 
        name: '_milestones', 
        type: 'tuple[]',
        components: [
          { name: 'description', type: 'string' },
          { name: 'amount', type: 'uint256' }
        ]
      },
      { name: '_enableNFTRewards', type: 'bool' },
      { name: '_enableGovernance', type: 'bool' }
    ],
    name: 'createCampaign',
    outputs: [{ type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getAllCampaigns',
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: '_creator', type: 'address' }],
    name: 'getCampaignsByCreator',
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getCampaignCount',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'isValidCampaign',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'campaign', type: 'address' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'name', type: 'string' },
      { indexed: false, name: 'fundingCap', type: 'uint256' },
      { indexed: false, name: 'deadline', type: 'uint256' },
      { indexed: false, name: 'nftRewardsEnabled', type: 'bool' },
      { indexed: false, name: 'governanceEnabled', type: 'bool' }
    ],
    name: 'CampaignCreated',
    type: 'event'
  }
] as const;

// UPDATED: Enhanced Crowdfund ABI
export const CROWDFUND_ABI = [
  {
    inputs: [],
    name: 'getCampaignDetails',
    outputs: [
      { type: 'string' },
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'bool' },
      { type: 'bool' },
      { type: 'address' },
      { type: 'uint256' },
      { type: 'bool' },
      { type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'beneficiary',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'fundingCap',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'deadline',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalFundsRaised',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'finalized',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'creator',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'isSuccessful',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'governanceEnabled',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getAllMilestones',
    outputs: [{
      type: 'tuple[]',
      components: [
        { name: 'description', type: 'string' },
        { name: 'amount', type: 'uint256' },
        { name: 'completed', type: 'bool' },
        { name: 'fundsReleased', type: 'bool' }
      ]
    }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'contribute',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

interface Campaign {
  address: Address;
  name: string;
  beneficiary: Address;
  fundingCap: bigint;
  totalRaised: bigint;
  deadline: number;
  finalized: boolean;
  isSuccessful: boolean;
  creator: Address;
  governanceEnabled: boolean;
  milestoneCount: number;
  updateCount: number;
}

interface CreateCampaignParams {
  name: string;
  beneficiary: Address;
  duration: number;
  fundingCap: string;
  milestones?: Array<{ description: string; amount: string }>;
  enableNFT?: boolean;
  enableGovernance?: boolean;
}

export function useCrowdfundFactory() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: userAddress } = useAccount();

  const fetchCampaigns = async () => {
    if (!FACTORY_ADDRESS) {
      console.error('Factory address not configured');
      setLoading(false);
      return;
    }

    if (!publicClient) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const campaignAddresses = await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'getAllCampaigns',
      }) as Address[];

      const campaignData = await Promise.all(
        campaignAddresses.map(async (address) => {
          const details = await publicClient.readContract({
            address,
            abi: CROWDFUND_ABI,
            functionName: 'getCampaignDetails',
          }) as readonly [string, Address, bigint, bigint, bigint, boolean, boolean, Address, bigint, boolean, bigint];

          return {
            address,
            name: details[0],
            beneficiary: details[1],
            fundingCap: details[2],
            totalRaised: details[4],
            deadline: Number(details[3]),
            finalized: details[5],
            isSuccessful: details[6],
            creator: details[7],
            milestoneCount: Number(details[8]),
            governanceEnabled: details[9],
            updateCount: Number(details[10]),
          };
        })
      );

      setCampaigns(campaignData);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async (params: CreateCampaignParams): Promise<Address> => {
    if (!FACTORY_ADDRESS) {
      throw new Error('Factory address not configured');
    }

    if (!publicClient || !walletClient || !userAddress) {
      throw new Error('Wallet not connected');
    }

    // Prepare milestone data
    const milestoneData = (params.milestones || [])
      .filter(m => m.description && m.amount && !isNaN(Number(m.amount)) && Number(m.amount) > 0)
      .map(m => ({
        description: m.description.trim(),
        amount: parseEther(m.amount),
      }));

    const beneficiaryAddress = params.beneficiary || userAddress;

    // Simulate the contract call first
    const { request } = await publicClient.simulateContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'createCampaign',
      args: [
        params.name,
        beneficiaryAddress,
        BigInt(params.duration),
        parseEther(params.fundingCap),
        milestoneData,
        params.enableNFT ?? true,
        params.enableGovernance ?? false
      ],
      account: userAddress,
    });

    // Execute the transaction
    const hash = await walletClient.writeContract(request);
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Extract campaign address from events
    let campaignAddress: Address | undefined;

    // if (receipt.logs) {
    //   for (const log of receipt.logs) {
    //     try {
    //       // Match the log topics to the CampaignCreated event
    //       if (log.topics[0] === '0x...') { // Event signature hash
    //         campaignAddress = `0x${log.topics[1].slice(26)}` as Address;
    //         break;
    //       }
    //     } catch (e) {
    //       continue;
    //     }
    //   }
    // }

    if (!campaignAddress) {
      throw new Error('Campaign created but address not found in events');
    }

    // Refresh campaigns list
    await fetchCampaigns();

    return campaignAddress;
  };

  const refreshCampaigns = async () => {
    await fetchCampaigns();
  };

  useEffect(() => {
    if (publicClient && FACTORY_ADDRESS) {
      fetchCampaigns();
    }
  }, [publicClient, FACTORY_ADDRESS]);

  return {
    campaigns,
    loading,
    createCampaign,
    refreshCampaigns,
    factoryAddress: FACTORY_ADDRESS,
    factoryAbi: FACTORY_ABI,
    crowdfundAbi: CROWDFUND_ABI,
  };
}