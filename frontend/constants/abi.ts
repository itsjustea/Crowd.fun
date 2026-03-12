// constants/abi.ts
export const CROWDFUND_ABI = [
  // ========== VIEW FUNCTIONS ==========
  {
    type: 'function',
    name: 'getCampaignsByCreator',
    inputs: [{ name: '_creator', type: 'address' }],
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCampaignDetails',
    inputs: [],
    outputs: [
      { type: 'string', name: '_name' },               // name
      { type: 'address', name: '_beneficiary' },       // beneficiary
      { type: 'uint256', name: '_fundingCap' },        // fundingCap
      { type: 'uint256', name: '_deadline' },          // deadline
      { type: 'uint256', name: '_totalFundsRaised' },  // totalFundsRaised
      { type: 'bool', name: '_finalized' },           // finalized
      { type: 'bool', name: '_successful' },          // successful
      { type: 'address', name: '_creator' },          // creator
      { type: 'uint256', name: '_milestoneCount' },   // milestoneCount
      { type: 'bool', name: '_governanceEnabled' },   // governanceEnabled
      { type: 'bool', name: '_nftRewardsEnabled' },   // nftRewardsEnabled
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'contributions',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
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
  },
  {
    type: 'function',
    name: 'getUpdateCount',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUpdate',
    inputs: [{ name: '_updateId', type: 'uint256' }],
    outputs: [
      { type: 'string' },   // title
      { type: 'string' },   // ipfsHash
      { type: 'uint256' },  // timestamp
      { type: 'uint256' }   // milestoneId
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMilestoneVoteStatus',
    inputs: [{ name: '_milestoneId', type: 'uint256' }],
    outputs: [
      { type: 'uint256' },  // votesFor
      { type: 'uint256' },  // votesAgainst
      { type: 'uint256' },  // votingDeadline
      { type: 'bool' },     // resolved
      { type: 'bool' },     // approved
      { type: 'bool' },     // hasVoted
      { type: 'bool' }      // voteChoice
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'governanceEnabled',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getNFTRewardInfo',
    inputs: [{ name: 'contributor', type: 'address' }],
    outputs: [
      { name: 'eligible', type: 'bool' },
      { name: 'minted', type: 'bool' },
      { name: 'tokenId', type: 'uint256' }
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTotalContributors',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  { type: 'function',
    name: 'getNFTContractForCampaign',
    inputs: [{ name: '_campaign', type: 'address' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nftcontract',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },

  // ========== STATE-CHANGING FUNCTIONS ==========
  {
    type: 'function',
    name: 'contribute',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'finalize',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimRefund',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'postUpdate',
    inputs: [
      { name: '_title', type: 'string' },
      { name: '_ipfsHash', type: 'string' },
      { name: '_milestoneId', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'completeMilestone',
    inputs: [{ name: '_milestoneId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'voteOnMilestone',
    inputs: [
      { name: '_milestoneId', type: 'uint256' },
      { name: '_support', type: 'bool' }
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveMilestoneVote',
    inputs: [{ name: '_milestoneId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'releaseMilestoneFunds',
    inputs: [{ name: '_milestoneId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawFunds',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fundsWithdrawn',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claimNFT',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  
  // ========== EVENTS ==========
  {
    type: 'event',
    name: 'ContributionReceived',
    inputs: [
      { indexed: true, name: 'contributor', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' }
    ],
  },
  {
    type: 'event',
    name: 'CampaignFinalized',
    inputs: [
      { indexed: false, name: 'successful', type: 'bool' },
      { indexed: false, name: 'totalRaised', type: 'uint256' }
    ],
  },
  {
    type: 'event',
    name: 'UpdatePosted',
    inputs: [
      { indexed: false, name: 'updateId', type: 'uint256' },
      { indexed: false, name: 'title', type: 'string' },
      { indexed: false, name: 'timestamp', type: 'uint256' }
    ],
  },
  {
    type: 'event',
    name: 'MilestoneVoteStarted',
    inputs: [
      { indexed: false, name: 'milestoneId', type: 'uint256' },
      { indexed: false, name: 'votingDeadline', type: 'uint256' }
    ],
  },
  {
    type: 'event',
    name: 'VoteCast',
    inputs: [
      { indexed: true, name: 'voter', type: 'address' },
      { indexed: false, name: 'milestoneId', type: 'uint256' },
      { indexed: false, name: 'support', type: 'bool' },
      { indexed: false, name: 'weight', type: 'uint256' }
    ],
  },
  {
    type: 'event',
    name: 'MilestoneVoteResolved',
    inputs: [
      { indexed: false, name: 'milestoneId', type: 'uint256' },
      { indexed: false, name: 'approved', type: 'bool' }
    ],
  },
  {
    type: 'event',
    name: 'FundsWithdrawn',
    inputs: [
      { indexed: true, name: 'beneficiary', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' }
    ],
  }
] as const;