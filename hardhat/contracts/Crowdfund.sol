// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Interface for ProofOfContribution NFT contract
interface IProofOfContribution {
    function mintContribution(
        address contributor,
        uint256 amount,
        string memory campaignName,
        uint256 contributorNumber
    ) external returns (uint256);
    
    function hasNFT(address campaign, address contributor) external view returns (bool);
    function getTokenId(address campaign, address contributor) external view returns (uint256);
    function transferOwnership(address newOwner) external;
}

/**
 * @title Crowdfund - Streamlined for Size Optimization
 * @notice Campaign updates removed - use events + off-chain storage instead
 * @dev Each campaign has its own dedicated NFT contract
 */
contract Crowdfund is ReentrancyGuard, Ownable {
    // ========== STATE VARIABLES ==========
    
    string public name;
    address public beneficiary;
    address public creator;
    uint256 public fundingCap;
    uint256 public deadline;
    uint256 public totalFundsRaised;
    bool public finalized;
    bool public successful;
    bool public governanceEnabled;
    
    IERC721 public nftContract;
    bool public nftRewardsEnabled;
    
    mapping(address => uint256) public contributions;
    address[] public contributors;
    mapping(address => bool) public isContributor;
    
    // ========== MILESTONE STRUCTURES ==========
    
    struct Milestone {
        string description;
        uint256 amount;
        bool completed;
        bool fundsReleased;
    }
    
    Milestone[] public milestones;
    
    // ========== GOVERNANCE STRUCTURES ==========
    
    struct MilestoneVote {
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 votingDeadline;
        bool resolved;
        bool approved;
        mapping(address => bool) hasVoted;
        mapping(address => bool) voteChoice;
    }
    
    mapping(uint256 => MilestoneVote) public milestoneVotes;
    
    // Governance constants
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant APPROVAL_THRESHOLD = 60;
    uint256 public constant MIN_PARTICIPATION = 30;
    
    // NFT minting tracking
    mapping(address => bool) public nftMinted;
    bool public fundsWithdrawn;
    
    // ========== EVENTS ==========
    
    event ContributionReceived(address indexed contributor, uint256 amount);
    event CampaignFinalized(bool successful, uint256 totalRaised);
    event RefundClaimed(address indexed contributor, uint256 amount);
    event MilestoneFundsReleased(uint256 indexed milestoneId, uint256 amount);
    event NFTRewarded(address indexed contributor, uint256 tokenId);
    event NFTMintingFailed(address indexed contributor, string reason);
    event FundsWithdrawn(address indexed beneficiary, uint256 amount);
    
    event MilestoneVoteStarted(uint256 indexed milestoneId, uint256 votingDeadline);
    event VoteCast(uint256 indexed milestoneId, address indexed voter, bool support);
    event MilestoneVoteResolved(uint256 indexed milestoneId, bool approved);
    
    // Campaign update event (replaces on-chain storage)
    event UpdatePosted(
        uint256 indexed milestoneId,
        string title,
        string ipfsHash,
        uint256 timestamp
    );
    
    // ========== MODIFIERS ==========
    
    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator");
        _;
    }
    
    modifier onlyContributor() {
        require(contributions[msg.sender] > 0, "Only contributors");
        _;
    }
    
    modifier campaignActive() {
        require(!finalized, "Already finalized");
        require(block.timestamp < deadline, "Deadline passed");
        _;
    }
    
    // ========== CONSTRUCTOR ==========
    
    struct MilestoneInput {
        string description;
        uint256 amount;
    }
    
    constructor(
        string memory _name,
        address _beneficiary,
        uint256 _duration,
        uint256 _fundingCap,
        address _creator,
        MilestoneInput[] memory _milestones,
        address _nftContract,
        bool _enableGovernance
    ) Ownable(msg.sender) {
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(_fundingCap > 0, "Funding cap must be > 0");
        require(_duration > 0, "Duration must be > 0");
        
        name = _name;
        beneficiary = _beneficiary;
        creator = _creator;
        fundingCap = _fundingCap;
        deadline = block.timestamp + _duration;
        nftContract = IERC721(_nftContract);
        nftRewardsEnabled = _nftContract != address(0);
        governanceEnabled = _enableGovernance;
        
        for (uint256 i = 0; i < _milestones.length; i++) {
            milestones.push(Milestone({
                description: _milestones[i].description,
                amount: _milestones[i].amount,
                completed: false,
                fundsReleased: false
            }));
        }
    }
    
    // ========== CONTRIBUTION FUNCTIONS ==========
    
    function contribute() external payable campaignActive nonReentrant {
        require(msg.value > 0, "Must contribute > 0");
        require(totalFundsRaised + msg.value <= fundingCap, "Exceeds cap");
        
        if (contributions[msg.sender] == 0) {
            contributors.push(msg.sender);
            isContributor[msg.sender] = true;
        }
        
        contributions[msg.sender] += msg.value;
        totalFundsRaised += msg.value;
        
        emit ContributionReceived(msg.sender, msg.value);
    }
    
    function finalize() external nonReentrant {
        require(!finalized, "Already finalized");
        require(block.timestamp >= deadline, "Not ended yet");
        
        finalized = true;
        successful = totalFundsRaised >= fundingCap;
        
        emit CampaignFinalized(successful, totalFundsRaised);
        
        if (successful && nftRewardsEnabled) {
            _distributeNFTs();
        }
    }
    
    function claimRefund() external nonReentrant {
        require(finalized, "Not finalized");
        require(!successful, "Was successful");
        
        uint256 contribution = contributions[msg.sender];
        require(contribution > 0, "No contribution");
        
        contributions[msg.sender] = 0;
        payable(msg.sender).transfer(contribution);
        
        emit RefundClaimed(msg.sender, contribution);
    }
    
    // ========== NFT DISTRIBUTION ==========
    
    function _distributeNFTs() private {
        if (!nftRewardsEnabled || address(nftContract) == address(0)) return;
        
        IProofOfContribution nft = IProofOfContribution(address(nftContract));
        
        for (uint256 i = 0; i < contributors.length; i++) {
            address contributor = contributors[i];
            if (nftMinted[contributor]) continue;
            
            try nft.mintContribution(
                contributor,
                contributions[contributor],
                name,
                i + 1
            ) returns (uint256 tokenId) {
                nftMinted[contributor] = true;
                emit NFTRewarded(contributor, tokenId);
            } catch Error(string memory reason) {
                emit NFTMintingFailed(contributor, reason);
            } catch {
                emit NFTMintingFailed(contributor, "Unknown error");
            }
        }
    }
    
    function getNFTRewardInfo(address contributor) external view returns (
        bool eligible,
        bool minted,
        uint256 tokenId
    ) {
        eligible = nftRewardsEnabled && successful && contributions[contributor] > 0;
        minted = nftMinted[contributor];
        
        if (minted && address(nftContract) != address(0)) {
            IProofOfContribution nft = IProofOfContribution(address(nftContract));
            try nft.getTokenId(address(this), contributor) returns (uint256 id) {
                tokenId = id;
            } catch {
                tokenId = 0;
            }
        }
        
        return (eligible, minted, tokenId);
    }
    
    // ========== MILESTONE FUNCTIONS ==========
    
    function releaseMilestoneFunds(uint256 _milestoneId) external onlyCreator nonReentrant {
        require(finalized && successful, "Not successful");
        require(_milestoneId < milestones.length, "Invalid ID");
        
        Milestone storage milestone = milestones[_milestoneId];
        require(!milestone.fundsReleased, "Already released");
        
        if (governanceEnabled) {
            MilestoneVote storage vote = milestoneVotes[_milestoneId];
            require(vote.resolved, "Not resolved");
            require(vote.approved, "Not approved");
        } else {
            require(milestone.completed, "Not completed");
        }
        
        milestone.fundsReleased = true;
        payable(beneficiary).transfer(milestone.amount);
        
        emit MilestoneFundsReleased(_milestoneId, milestone.amount);
    }
    
    function withdrawFunds() external onlyCreator nonReentrant {
        require(finalized, "Not finalized");
        require(successful, "Not successful");
        require(milestones.length == 0, "Use releaseMilestoneFunds");
        require(!fundsWithdrawn, "Already withdrawn");

        fundsWithdrawn = true;
        uint256 amount = address(this).balance;
        require(amount > 0, "No funds");

        payable(beneficiary).transfer(amount);
        emit FundsWithdrawn(beneficiary, amount);
    }

    function getAllMilestones() external view returns (Milestone[] memory) {
        return milestones;
    }
    
    // ========== GOVERNANCE ==========
    
    function completeMilestone(uint256 _milestoneId) external onlyCreator {
        require(governanceEnabled, "Governance disabled");
        require(finalized && successful, "Not successful");
        require(_milestoneId < milestones.length, "Invalid ID");
        require(!milestones[_milestoneId].completed, "Already completed");
        
        MilestoneVote storage vote = milestoneVotes[_milestoneId];
        require(vote.votingDeadline == 0, "Voting started");
        
        vote.votingDeadline = block.timestamp + VOTING_PERIOD;
        emit MilestoneVoteStarted(_milestoneId, vote.votingDeadline);
    }
    
    function voteOnMilestone(uint256 _milestoneId, bool _support) external onlyContributor {
        require(governanceEnabled, "Governance disabled");
        require(_milestoneId < milestones.length, "Invalid ID");
        require(!milestones[_milestoneId].completed, "Already completed");
        require(!milestoneVotes[_milestoneId].resolved, "Already resolved");
        require(block.timestamp <= milestoneVotes[_milestoneId].votingDeadline, "Ended");
        require(!milestoneVotes[_milestoneId].hasVoted[msg.sender], "Already voted");
        
        if (_support) {
            milestoneVotes[_milestoneId].votesFor += 1;
        } else {
            milestoneVotes[_milestoneId].votesAgainst += 1;
        }
        
        milestoneVotes[_milestoneId].hasVoted[msg.sender] = true;
        milestoneVotes[_milestoneId].voteChoice[msg.sender] = _support;
        
        emit VoteCast(_milestoneId, msg.sender, _support);
        
        _tryAutoResolve(_milestoneId);
    }
    
    function resolveMilestoneVote(uint256 _milestoneId) external {
        require(governanceEnabled, "Governance disabled");
        require(_milestoneId < milestones.length, "Invalid ID");
        require(!milestoneVotes[_milestoneId].resolved, "Already resolved");
        
        MilestoneVote storage vote = milestoneVotes[_milestoneId];
        uint256 totalVotes = vote.votesFor + vote.votesAgainst;
        
        require(
            block.timestamp > vote.votingDeadline || totalVotes == contributors.length,
            "Still active"
        );
        
        _resolveVote(_milestoneId);
    }
    
    function _tryAutoResolve(uint256 _milestoneId) private {
        MilestoneVote storage vote = milestoneVotes[_milestoneId];
        uint256 totalVotes = vote.votesFor + vote.votesAgainst;
        
        if (totalVotes == contributors.length) {
            _resolveVote(_milestoneId);
        }
    }
    
    function _resolveVote(uint256 _milestoneId) private {
        MilestoneVote storage vote = milestoneVotes[_milestoneId];
        uint256 totalVotes = vote.votesFor + vote.votesAgainst;
        uint256 minVotes = (contributors.length * MIN_PARTICIPATION) / 100;
        
        require(totalVotes >= minVotes, "Insufficient participation");
        
        uint256 approvalPct = (vote.votesFor * 100) / totalVotes;
        vote.resolved = true;
        vote.approved = approvalPct >= APPROVAL_THRESHOLD;
        
        if (vote.approved) {
            milestones[_milestoneId].completed = true;
        }
        
        emit MilestoneVoteResolved(_milestoneId, vote.approved);
    }
    
    function getMilestoneVoteStatus(uint256 _milestoneId) external view returns (
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 votingDeadline,
        bool resolved,
        bool approved,
        bool hasVoted,
        bool voteChoice
    ) {
        MilestoneVote storage vote = milestoneVotes[_milestoneId];
        return (
            vote.votesFor,
            vote.votesAgainst,
            vote.votingDeadline,
            vote.resolved,
            vote.approved,
            vote.hasVoted[msg.sender],
            vote.voteChoice[msg.sender]
        );
    }
    
    function getTotalContributors() external view returns (uint256) {
        return contributors.length;
    }
    
    function toggleGovernance() external onlyCreator {
        require(!finalized, "Cannot change after finalization");
        governanceEnabled = !governanceEnabled;
    }
    
    // ========== CAMPAIGN UPDATES (EVENT-BASED) ==========
    
    /**
     * @dev Post a campaign update (emits event, no on-chain storage)
     * @notice Store full content in IPFS, emit hash here for indexing
     * @param _title Update title
     * @param _ipfsHash IPFS hash of full update content
     * @param _milestoneId Associated milestone (type(uint256).max for general updates)
     */
    function postUpdate(
        string memory _title,
        string memory _ipfsHash,
        uint256 _milestoneId
    ) external onlyCreator {
        emit UpdatePosted(_milestoneId, _title, _ipfsHash, block.timestamp);
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    function getCampaignDetails() external view returns (
        string memory _name,
        address _beneficiary,
        uint256 _fundingCap,
        uint256 _deadline,
        uint256 _totalFundsRaised,
        bool _finalized,
        bool _successful,
        address _creator,
        uint256 _milestoneCount,
        bool _governanceEnabled
    ) {
        return (
            name,
            beneficiary,
            fundingCap,
            deadline,
            totalFundsRaised,
            finalized,
            successful,
            creator,
            milestones.length,
            governanceEnabled
        );
    }
}
