// hooks/usePostUpdate.ts
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CROWDFUND_ABI } from '@/constants/abi';
import { Address } from 'viem';

export function usePostUpdate(campaignAddress: Address) {
  const { 
    writeContract, 
    data: hash, 
    isPending 
  } = useWriteContract();

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ 
    hash 
  });

  const postUpdate = async (
    title: string, 
    ipfsHash: string, 
    milestoneId: bigint
  ) => {
    writeContract({
      address: campaignAddress,
      abi: CROWDFUND_ABI,
      functionName: 'postUpdate',
      args: [title, ipfsHash, milestoneId],
    });
  };

  return {
    postUpdate,
    isPending: isPending || isConfirming,
    hash,
  };
}