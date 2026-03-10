// src/indexer/abis.ts - CORRECTED ABIs

export const FACTORY_ABI = [
  // CampaignCreated event - EXACT match to your contract
  "event CampaignCreated(address indexed campaign, address indexed creator, address indexed nftContract, string name, uint256 fundingCap, uint256 deadline, bool nftRewardsEnabled, bool governanceEnabled)",
  
  // Factory functions (add if you need them)
  "function getAllCampaigns() view returns (address[])",
  "function getCampaignCount() view returns (uint256)",
  "function getCampaignsByCreator(address creator) view returns (address[])",
  "function getNFTContractForCampaign(address campaign) view returns (address)",
];

export const CROWDFUND_ABI = [
  // Campaign events
  "event ContributionReceived(address indexed contributor, uint256 amount)",
  "event CampaignFinalized(bool successful, uint256 totalRaised)",
  "event VoteCast(uint256 indexed milestoneId, address indexed voter, bool support)",
  "event UpdatePosted(uint256 indexed milestoneId, string title, string ipfsHash, uint256 timestamp)",
  "event MilestoneCompleted(uint256 indexed milestoneId)",
  "event FundsWithdrawn(address indexed beneficiary, uint256 amount)",
  
  // Campaign functions
  "function getCampaignDetails() external view returns (string memory _name, address _beneficiary, uint256 _fundingCap, uint256 _deadline, uint256 _totalFundsRaised, bool _finalized, bool _successful, address _creator, uint256 _milestoneCount, bool _governanceEnabled)",
  "function getAllMilestones() view returns (tuple(string description, uint256 amount, bool completed, bool fundsReleased, uint256 votesFor, uint256 votesAgainst)[])",
  "function contribute() payable",
  "function finalize()",
  "function voteOnMilestone(uint256 milestoneId, bool support)",
  "function postUpdate(uint256 milestoneId, string title, string ipfsHash)",
];