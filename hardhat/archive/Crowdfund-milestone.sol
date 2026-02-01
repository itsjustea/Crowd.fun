// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Interface for ProofOfContribution NFT contract
interface IProofOfContribution {
    function mintContribution(
        address contributor,
        uint256 amount,
        string memory campaignName,
        uint256 contributorNumber
    ) external returns (uint256);
    
    function hasNFT(address campaign, address contributor) external view returns (bool);
}

/**
 * @title Crowdfund - One-Person-One-Vote with Fixed Resolution
 * @notice FIXED: Votes only resolve when ALL have voted OR deadline passes
 * @dev No premature auto-resolution - fair voting for everyone
 */
contract Crowdfund is ReentrancyGuard {
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
    
    IProofOfContribution public nftContract;
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
    uint256 public constant APPROVAL_THRESHOLD = 60; // 60% approval required
    uint256 public constant MIN_PARTICIPATION = 30;  // 30% participation required
    
    // ========== CAMPAIGN UPDATES ==========
    
    struct Update {
        string title;
        string ipfsHash;
        uint256 timestamp;
        uint256 milestoneId;
    }
    
    Update[] public updates;
    mapping(uint256 => uint256[]) public milestoneUpdates;
    
    // ========== EVENTS ==========
    
    event ContributionReceived(address indexed contributor, uint256 amount);
    event CampaignFinalized(bool successful, uint256 totalRaised);
    event RefundClaimed(address indexed contributor, uint256 amount);
    event MilestoneFundsReleased(uint256 indexed milestoneId, uint256 amount);
    event NFTRewarded(address indexed contributor, uint256 tokenId);
    event NFTMintingFailed(address indexed contributor, string reason);
    
    event UpdatePosted(uint256 indexed updateId, string title, uint256 timestamp);
    event MilestoneVoteStarted(uint256 indexed milestoneId, uint256 votingDeadline);
    event VoteCast(uint256 indexed milestoneId, address indexed voter, bool support);
    event MilestoneVoteResolved(uint256 indexed milestoneId, bool approved);
    
    // ========== MODIFIERS ==========
    
    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator can call this");
        _;
    }
    
    modifier onlyContributor() {
        require(contributions[msg.sender] > 0, "Only contributors can call this");
        _;
    }
    
    modifier campaignActive() {
        require(!finalized, "Campaign already finalized");
        require(block.timestamp < deadline, "Campaign deadline passed");
        _;
    }
    
    // ========== CONSTRUCTOR ==========
    
    constructor(
        string memory _name,
        address _beneficiary,
        uint256 _duration,
        uint256 _fundingCap,
        address _creator,
        MilestoneInput[] memory _milestones,
        address _nftContract,
        bool _enableGovernance
    ) {
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(_fundingCap > 0, "Funding cap must be greater than 0");
        require(_duration > 0, "Duration must be greater than 0");
        
        name = _name;
        beneficiary = _beneficiary;
        creator = _creator;
        fundingCap = _fundingCap;
        deadline = block.timestamp + _duration;
        nftRewardsEnabled = _nftContract != address(0);
        governanceEnabled = _enableGovernance;
        
        // Set NFT contract if provided
        if (_nftContract != address(0)) {
            nftContract = IProofOfContribution(_nftContract);
            nftRewardsEnabled = true;
        }

        for (uint256 i = 0; i < _milestones.length; i++) {
            milestones.push(Milestone({
                description: _milestones[i].description,
                amount: _milestones[i].amount,
                completed: false,
                fundsReleased: false
            }));
        }
    }
    
    struct MilestoneInput {
        string description;
        uint256 amount;
    }
    
    // ========== CONTRIBUTION FUNCTIONS ==========
    
    function contribute() external payable campaignActive nonReentrant {
        require(msg.value > 0, "Contribution must be greater than 0");
        require(totalFundsRaised + msg.value <= fundingCap, "Exceeds funding cap");
        
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
        require(block.timestamp >= deadline, "Campaign not ended yet");
        
        finalized = true;
        successful = totalFundsRaised >= fundingCap;
        
        emit CampaignFinalized(successful, totalFundsRaised);
        
        if (successful && nftRewardsEnabled) {
            _distributeNFTs();
        }
        
    }
    
    function claimRefund() external nonReentrant {
        require(finalized, "Campaign not finalized");
        require(!successful, "Campaign was successful");
        
        uint256 contribution = contributions[msg.sender];
        require(contribution > 0, "No contribution to refund");
        
        contributions[msg.sender] = 0;
        payable(msg.sender).transfer(contribution);
        
        emit RefundClaimed(msg.sender, contribution);
    }
    
    // ========== NFT DISTRIBUTION ==========
    
    function _distributeNFTs() private {
        // Implementation would go here
        for (uint i = 0; i < contributors.length; i++) {
            address contributor = contributors[i];
            uint256 amount = contributions[contributor];
            try nftContract.hasNFT(address(this), contributor) returns (bool hasNFT) {
                if (hasNFT) {
                    continue; // Skip if already owns NFT
                }
            } catch {
                // Assume does not own NFT if call fails
            }

            try nftContract.mintContribution(
                contributor,
                amount,
                name,
                i+1
            ) returns (uint256 tokenId) {
                emit NFTRewarded(contributor, tokenId);
            } catch Error(string memory reason) {
                emit NFTMintingFailed(contributor, reason);
            } catch {
                emit NFTMintingFailed(contributor, "Unknown error during minting");
            }
            // Mint or transfer NFT to contributor
            // uint256 tokenId = nftContract.mint(contributor);
            // emit NFTRewarded(contributor, tokenId);
        }
    }
    
    // ========== MILESTONE FUNCTIONS ==========
    
    function releaseMilestoneFunds(uint256 _milestoneId) external onlyCreator nonReentrant {
        require(finalized && successful, "Campaign not successful");
        require(_milestoneId < milestones.length, "Invalid milestone ID");
        
        Milestone storage milestone = milestones[_milestoneId];
        require(!milestone.fundsReleased, "Funds already released");
        
        if (governanceEnabled) {
            MilestoneVote storage vote = milestoneVotes[_milestoneId];
            require(vote.resolved, "Vote not resolved");
            require(vote.approved, "Milestone not approved");
        } else {
            require(milestone.completed, "Milestone not completed");
        }
        
        milestone.fundsReleased = true;
        payable(beneficiary).transfer(milestone.amount);
        
        emit MilestoneFundsReleased(_milestoneId, milestone.amount);
    }
    
    function getAllMilestones() external view returns (Milestone[] memory) {
        return milestones;
    }
    
    // ========== GOVERNANCE FUNCTIONS - FIXED ==========
    
    function completeMilestone(uint256 _milestoneId) external onlyCreator {
        require(governanceEnabled, "Governance is not enabled");
        require(finalized && successful, "Campaign not successful");
        require(_milestoneId < milestones.length, "Invalid milestone ID");
        require(!milestones[_milestoneId].completed, "Milestone already completed");
        
        MilestoneVote storage vote = milestoneVotes[_milestoneId];
        require(vote.votingDeadline == 0, "Voting already started");
        
        vote.votingDeadline = block.timestamp + VOTING_PERIOD;
        
        emit MilestoneVoteStarted(_milestoneId, vote.votingDeadline);
    }
    
    /**
     * @dev Vote on milestone completion (ONE PERSON = ONE VOTE)
     * @dev FIXED: No auto-resolution - waits for manual resolve
     */
    function voteOnMilestone(uint256 _milestoneId, bool _support) external onlyContributor {
        require(governanceEnabled, "Governance is not enabled");
        require(_milestoneId < milestones.length, "Invalid milestone ID");
        require(!milestones[_milestoneId].completed, "Milestone already completed");
        require(!milestoneVotes[_milestoneId].resolved, "Voting already concluded");
        require(block.timestamp <= milestoneVotes[_milestoneId].votingDeadline, "Voting period ended");
        require(!milestoneVotes[_milestoneId].hasVoted[msg.sender], "Already voted");
        
        // Each person gets exactly 1 vote
        if (_support) {
            milestoneVotes[_milestoneId].votesFor += 1;
        } else {
            milestoneVotes[_milestoneId].votesAgainst += 1;
        }
        
        milestoneVotes[_milestoneId].hasVoted[msg.sender] = true;
        milestoneVotes[_milestoneId].voteChoice[msg.sender] = _support;
        
        emit VoteCast(_milestoneId, msg.sender, _support);
        
        // FIXED: Only auto-resolve if ALL contributors have voted
        _tryAutoResolve(_milestoneId);
    }
    
    /**
     * @dev Resolve milestone vote
     * @dev Can be called by anyone after voting deadline OR when all have voted
     */
    function resolveMilestoneVote(uint256 _milestoneId) external {
        require(governanceEnabled, "Governance is not enabled");
        require(_milestoneId < milestones.length, "Invalid milestone ID");
        require(!milestoneVotes[_milestoneId].resolved, "Already resolved");
        
        MilestoneVote storage vote = milestoneVotes[_milestoneId];
        uint256 totalVotes = vote.votesFor + vote.votesAgainst;
        uint256 totalContributors = contributors.length;
        
        // Can resolve if:
        // 1. Voting deadline has passed, OR
        // 2. All contributors have voted
        require(
            block.timestamp > vote.votingDeadline || totalVotes == totalContributors,
            "Voting still active - not all have voted and deadline not passed"
        );
        
        _resolveVote(_milestoneId);
    }
    
    /**
     * @dev FIXED: Only auto-resolve when ALL contributors have voted
     * @dev This prevents premature resolution when just 1 or 2 people vote
     */
    function _tryAutoResolve(uint256 _milestoneId) private {
        MilestoneVote storage vote = milestoneVotes[_milestoneId];
        
        uint256 totalVotes = vote.votesFor + vote.votesAgainst;
        uint256 totalContributors = contributors.length;
        
        // ONLY auto-resolve if ALL contributors have voted
        // This ensures fair voting - everyone gets a chance
        if (totalVotes == totalContributors) {
            _resolveVote(_milestoneId);
        }
        
        // Otherwise, voting continues until deadline
        // Then anyone can call resolveMilestoneVote()
    }
    
    /**
     * @dev Internal function to resolve vote
     */
    function _resolveVote(uint256 _milestoneId) private {
        MilestoneVote storage vote = milestoneVotes[_milestoneId];
        
        uint256 totalVotes = vote.votesFor + vote.votesAgainst;
        uint256 totalContributors = contributors.length;
        
        // Check minimum participation (30% of contributors)
        uint256 minVotes = (totalContributors * MIN_PARTICIPATION) / 100;
        require(totalVotes >= minVotes, "Insufficient participation - need 30% of contributors");
        
        // Calculate approval percentage based on votes cast
        uint256 approvalPercentage = (vote.votesFor * 100) / totalVotes;
        
        vote.resolved = true;
        vote.approved = approvalPercentage >= APPROVAL_THRESHOLD;
        
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
    
    // ========== CAMPAIGN UPDATES ==========
    
    function postUpdate(
        string memory _title,
        string memory _ipfsHash,
        uint256 _milestoneId
    ) external onlyCreator {
        uint256 updateId = updates.length;
        
        updates.push(Update({
            title: _title,
            ipfsHash: _ipfsHash,
            timestamp: block.timestamp,
            milestoneId: _milestoneId
        }));
        
        if (_milestoneId != type(uint256).max) {
            milestoneUpdates[_milestoneId].push(updateId);
        }
        
        emit UpdatePosted(updateId, _title, block.timestamp);
    }
    
    function getUpdateCount() external view returns (uint256) {
        return updates.length;
    }
    
    function getUpdate(uint256 _updateId) external view returns (
        string memory title,
        string memory ipfsHash,
        uint256 timestamp,
        uint256 milestoneId
    ) {
        require(_updateId < updates.length, "Invalid update ID");
        Update storage update = updates[_updateId];
        return (update.title, update.ipfsHash, update.timestamp, update.milestoneId);
    }
    
    function getMilestoneUpdates(uint256 _milestoneId) external view returns (uint256[] memory) {
        return milestoneUpdates[_milestoneId];
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
        bool _governanceEnabled,
        uint256 _updateCount
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
            governanceEnabled,
            updates.length
        );
    }
}
