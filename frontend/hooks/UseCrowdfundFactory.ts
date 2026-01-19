import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Import your contract ABIs
const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '';

const FACTORY_ABI = [
  'function createCampaign(string memory _name, address _beneficiary, uint256 _duration, uint256 _fundingCap) external returns (address)',
  'function getAllCampaigns() external view returns (address[] memory)',
  'function getCampaignsByCreator(address creator) external view returns (address[] memory)',
  'function getCampaignCount() external view returns (uint256)',
  'function isValidCampaign(address) external view returns (bool)',
  'event CampaignCreated(address indexed campaignAddress, address indexed creator, string name, address beneficiary, uint256 fundingCap, uint256 deadline)',
];

const CROWDFUND_ABI = [
  'function name() external view returns (string memory)',
  'function beneficiary() external view returns (address)',
  'function fundingCap() external view returns (uint256)',
  'function deadline() external view returns (uint256)',
  'function totalFundsRaised() external view returns (uint256)',
  'function finalized() external view returns (bool)',
  'function creator() external view returns (address)',
  'function isSuccessful() external view returns (bool)',
  'function contribute() external payable',
  'function addMilestone(string memory _description, uint256 _amount) external',
  'function getMilestoneCount() external view returns (uint256)',
];

interface Campaign {
  address: string;
  name: string;
  beneficiary: string;
  fundingCap: string;
  totalRaised: string;
  deadline: number;
  finalized: boolean;
  isSuccessful: boolean;
  creator: string;
}

export function useCrowdfundFactory() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    if (!FACTORY_ADDRESS) {
      console.error('Factory address not configured');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

      const campaignAddresses = await factory.getAllCampaigns();
      
      const campaignData = await Promise.all(
        campaignAddresses.map(async (address: string) => {
          const crowdfund = new ethers.Contract(address, CROWDFUND_ABI, provider);
          
          const [name, beneficiary, fundingCap, deadline, totalRaised, finalized, creator, isSuccessful] = await Promise.all([
            crowdfund.name(),
            crowdfund.beneficiary(),
            crowdfund.fundingCap(),
            crowdfund.deadline(),
            crowdfund.totalFundsRaised(),
            crowdfund.finalized(),
            crowdfund.creator(),
            crowdfund.isSuccessful(),
          ]);

          return {
            address,
            name,
            beneficiary,
            fundingCap: fundingCap.toString(),
            totalRaised: totalRaised.toString(),
            deadline: Number(deadline),
            finalized,
            isSuccessful,
            creator,
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

    if (typeof window.ethereum === 'undefined') {
      throw new Error('Please install MetaMask');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);

    // Create the campaign
    const tx = await factory.createCampaign(
      data.name,
      data.beneficiary,
      data.duration,
      ethers.parseEther(data.fundingCap)
    );

    const receipt = await tx.wait();
    
    // Get the campaign address from the event
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = factory.interface.parseLog(log);
        return parsed?.name === 'CampaignCreated';
      } catch {
        return false;
      }
    });

    if (!event) {
      throw new Error('Campaign created but address not found in events');
    }

    const parsed = factory.interface.parseLog(event);
    const campaignAddress = parsed?.args.campaignAddress;

    // If milestones are specified, add them
    if (data.milestones && data.milestones.length > 0 && campaignAddress) {
      const crowdfund = new ethers.Contract(campaignAddress, CROWDFUND_ABI, signer);
      
      for (const milestone of data.milestones) {
        const milestoneTx = await crowdfund.addMilestone(
          milestone.description,
          ethers.parseEther(milestone.amount)
        );
        await milestoneTx.wait();
      }
    }

    return campaignAddress;
  };

  const refreshCampaigns = async () => {
    await fetchCampaigns();
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      fetchCampaigns();
    }
  }, []);

  return {
    campaigns,
    loading,
    createCampaign,
    refreshCampaigns,
  };
}