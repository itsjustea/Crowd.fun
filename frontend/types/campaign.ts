// types/campaign.ts

import { Address } from 'viem';

export interface Milestone {
  description: string;
  amount: bigint;
  completed: boolean;
  fundsReleased: boolean;
}

export interface Update {
  id: number;
  title: string;
  ipfsHash: string;
  timestamp: number;
  milestoneId: number | null;
}

export interface VoteStatus {
  votesFor: bigint;
  votesAgainst: bigint;
  votingDeadline: number;
  resolved: boolean;
  approved: boolean;
  hasVoted: boolean;
  voteChoice: boolean;
}

export interface CampaignData {
  name: string;
  beneficiary: Address;
  fundingCap: bigint;
  deadline: number;
  totalFundsRaised: bigint;
  finalized: boolean;
  successful: boolean;
  creator: Address;
  milestoneCount: number;
  governanceEnabled: boolean;
  updateCount: number;
  userContribution: bigint;
}

export type TabType = 'overview' | 'updates' | 'governance';

export type DurationUnit = 'minutes' | 'hours' | 'days';

export type VotingStatus = 
  | 'not-started' 
  | 'completed-no-vote' 
  | 'approved' 
  | 'rejected' 
  | 'ended-pending' 
  | 'active';