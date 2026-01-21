import { useState, useEffect } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { parseEther, decodeEventLog, formatEther } from 'viem';
import type { Address } from 'viem';

// Contract address from environment
const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '') as Address;

// Factory ABI - UPDATED to include milestones parameter
const FACTORY_ABI = [
  {
    type: 'function',
    name: 'createCampaign',
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
      }
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

// Crowdfund ABI (unchanged)
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
    name: 'getMilestoneCount',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

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

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const fetchCampaigns = async () => {
    if (!FACTORY_ADDRESS) {
      console.error('❌ Factory address not configured');
      setError('Factory address not configured');
      setLoading(false);
      return;
    }

    if (!publicClient) {
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Fetching campaigns from factory:', FACTORY_ADDRESS);
      setLoading(true);
      setError(null);

      const campaignAddresses = await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'getAllCampaigns',
      }) as Address[];

      console.log('📊 Found', campaignAddresses.length, 'campaigns');

      if (campaignAddresses.length === 0) {
        setCampaigns([]);
        setLoading(false);
        return;
      }

      const campaignData = await Promise.all(
        campaignAddresses.map(async (address) => {
          try {
            const [name, beneficiary, fundingCap, deadline, totalRaised, finalized, creator, isSuccessful] = await Promise.all([
              publicClient.readContract({ address, abi: CROWDFUND_ABI, functionName: 'name' }),
              publicClient.readContract({ address, abi: CROWDFUND_ABI, functionName: 'beneficiary' }),
              publicClient.readContract({ address, abi: CROWDFUND_ABI, functionName: 'fundingCap' }),
              publicClient.readContract({ address, abi: CROWDFUND_ABI, functionName: 'deadline' }),
              publicClient.readContract({ address, abi: CROWDFUND_ABI, functionName: 'totalFundsRaised' }),
              publicClient.readContract({ address, abi: CROWDFUND_ABI, functionName: 'finalized' }),
              publicClient.readContract({ address, abi: CROWDFUND_ABI, functionName: 'creator' }),
              publicClient.readContract({ address, abi: CROWDFUND_ABI, functionName: 'isSuccessful' }),
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

    console.log('═══════════════════════════════════════');
    console.log('🚀 CREATING CAMPAIGN (SINGLE TRANSACTION)');
    console.log('═══════════════════════════════════════');
    console.log('📝 Campaign Details:');
    console.log('   Name:', data.name);
    console.log('   Beneficiary:', data.beneficiary);
    console.log('   Duration:', data.duration, 'seconds');
    console.log('   Funding Cap:', data.fundingCap, 'ETH');
    
    // Calculate human-readable duration
    const hours = Math.floor(data.duration / 3600);
    const minutes = Math.floor((data.duration % 3600) / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      console.log('   Duration (human):', days, 'days', hours % 24, 'hours');
    } else if (hours > 0) {
      console.log('   Duration (human):', hours, 'hours', minutes, 'minutes');
    } else {
      console.log('   Duration (human):', minutes, 'minutes');
    }


    const fundingCapWei = parseEther(data.fundingCap);
    
    // Prepare milestones array
    const milestonesArray = data.milestones && data.milestones.length > 0
      ? data.milestones.map(m => ({
          description: m.description,
          amount: parseEther(m.amount),
        }))
      : [];

    if (milestonesArray.length > 0) {
      console.log('🎯 Milestones (will be added in same transaction):');
      milestonesArray.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.description} - ${formatEther(m.amount)} ETH`);
      });
      
      // Validate total milestone amount
      const totalMilestoneAmount = milestonesArray.reduce((sum, m) => sum + m.amount, BigInt(0));
      if (totalMilestoneAmount > fundingCapWei) {
        throw new Error(`Total milestone amount (${formatEther(totalMilestoneAmount)} ETH) exceeds funding cap (${data.fundingCap} ETH)`);
      }
    }

    try {
      // STEP 1: SIMULATE THE TRANSACTION
      console.log('\n🧪 Simulating transaction...');
      try {
        await publicClient.simulateContract({
          address: FACTORY_ADDRESS,
          abi: FACTORY_ABI,
          functionName: 'createCampaign',
          args: [
            data.name,
            data.beneficiary as Address,
            BigInt(data.duration),
            fundingCapWei,
            milestonesArray,
          ],
          account: walletClient.account,
        });
        
        console.log('✅ Simulation successful!');
      } catch (simError: any) {
        console.error('❌ SIMULATION FAILED:', simError);
        throw new Error(`Transaction will fail: ${simError.shortMessage || simError.message}`);
      }

      // STEP 2: SEND THE TRANSACTION (everything in one transaction!)
      console.log('\n📤 Sending transaction...');
      console.log('   ✨ Campaign + Milestones in SINGLE transaction!');
      
      const hash = await walletClient.writeContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'createCampaign',
        args: [
          data.name,
          data.beneficiary as Address,
          BigInt(data.duration),
          fundingCapWei,
          milestonesArray,
        ],
      });

      console.log('✅ Transaction sent:', hash);
      console.log('⏳ Waiting for confirmation...');

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      console.log('✅ Transaction confirmed!');
      console.log('   Block:', receipt.blockNumber);
      console.log('   Gas used:', receipt.gasUsed.toString());

      // STEP 3: GET CAMPAIGN ADDRESS
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
        const allCampaigns = await publicClient.readContract({
          address: FACTORY_ADDRESS,
          abi: FACTORY_ABI,
          functionName: 'getAllCampaigns',
        }) as Address[];

        campaignAddress = allCampaigns[allCampaigns.length - 1];
        console.log('📍 Campaign address (from getAllCampaigns):', campaignAddress);
      }

      console.log('\n═══════════════════════════════════════');
      console.log('🎉 CAMPAIGN CREATED SUCCESSFULLY!');
      console.log('═══════════════════════════════════════');
      if (milestonesArray.length > 0) {
        console.log('✨ All milestones added in single transaction!');
      }
      
      return campaignAddress;
      
    } catch (error: any) {
      console.error('\n═══════════════════════════════════════');
      console.error('❌ CAMPAIGN CREATION FAILED');
      console.error('═══════════════════════════════════════');
      console.error('Error:', error);
      
      let errorMessage = error.message || 'Failed to create campaign';
      
      if (errorMessage.includes('user rejected') || errorMessage.includes('User rejected')) {
        errorMessage = 'You cancelled the transaction';
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds to pay for gas fees';
      }
      
      throw new Error(errorMessage);
    }
  };

  const refreshCampaigns = async () => {
    console.log('🔄 Refreshing campaigns...');
    await fetchCampaigns();
  };

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