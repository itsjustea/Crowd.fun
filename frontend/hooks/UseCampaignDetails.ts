// hooks/useCampaignDetails.ts
import { useReadContract } from 'wagmi';
import { Address } from 'viem';
import { CROWDFUND_ABI } from '@/constants/abi';
import type { CampaignData } from '@/types/campaign';

export function useCampaignDetails(campaignAddress: Address) {
  const { data, isLoading, error } = useReadContract({
    address: campaignAddress,
    abi: CROWDFUND_ABI,
    functionName: 'getCampaignDetails',
  });

  // Type assertion with proper handling
  const campaignData: CampaignData | undefined = data ? {
    name: data[0],
    beneficiary: data[1],
    fundingCap: data[2],
    deadline: Number(data[3]),
    totalFundsRaised: data[4],
    finalized: data[5],
    successful: data[6],
    creator: data[7],
    milestoneCount: Number(data[8]),
    governanceEnabled: data[9],
    updateCount: Number(data[10]),
    userContribution: BigInt(0), // Will be fetched separately
  } : undefined;

  return {
    campaign: campaignData,
    isLoading,
    error,
  };
}