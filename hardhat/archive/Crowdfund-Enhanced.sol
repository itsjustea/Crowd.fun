// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
 * @title Crowdfund Enhanced
 * @dev Individual crowdfunding campaign contract with:
 *      - Milestone-based escrow and NFT rewards
 *      - Contributor governance (voting on milestones)
 *      - Campaign update system with IPFS links
 */
contract Crowdfund {
    // Campaign details
    string public name;
    address public beneficiary;
    uint256 public fundingCap;
    uint256 public deadline;
    uint256 public totalFundsRaised;
    bool public finalized;
    
    // Campaign creator
    address public creator;
    
    // NFT contract (optional)
    IProofOfContribution public nftContract;
    bool public nftRewardsEnabled;
    
    // Contributor tracking
    mapping(address => uint256) public contributions;
    address[] public contributors;
    
    // Milestone tracking
    struct Milestone {
        string description;
        uint256 amount;
        bool completed;
        bool fundsReleased;
    }
    
    struct MilestoneInput {
        string description;
        uint256 amount;
    }
    
    Milestone[] public milestones;
    uint256 public totalMilestoneAmount;
    uint256 public releasedAmount;
    
    // ======= NEW FEATURE 1: CAMPAIGN UPDATES =======
    struct Update {
        string title;
        string ipfsHash;        // IPFS link to detailed update content
        uint256 timestamp;
        uint256 milestoneId;    // Optional: link to milestone (use type(uint256).max for no milestone)
    }
    
    Update[] public updates;
    
    // ======= NEW FEATURE 2: CONTRIBUTOR GOVERNANCE =======
    struct MilestoneVote {
        uint256 votesFor;           // Weighted by contribution amount
        uint256 votesAgainst;       // Weighted by contribution amount
        uint256 votingDeadline;     // Voting period (7 days default)
        bool resolved;              // Has voting concluded?
        bool approved;              // Was milestone approved?
        mapping(address => bool) hasVoted;
        mapping(address => bool) voteChoice; // true = for, false = against
    }
    
    mapping(uint256 => MilestoneVote) public milestoneVotes;
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant APPROVAL_THRESHOLD = 60; // 60% approval needed
    bool public governanceEnabled;
    
    // Events
    event ContributionReceived(address indexed contributor, uint256 amount);
    event CampaignFinalized(uint256 totalRaised, bool successful);
    event FundsWithdrawn(address indexed beneficiary, uint256 amount);
    event RefundIssued(address indexed contributor, uint256 amount);
    event MilestoneAdded(uint256 indexed milestoneId, string description, uint256 amount);
    event MilestoneCompleted(uint256 indexed milestoneId);
    event MilestoneFundsReleased(uint256 indexed milestoneId, uint256 amount);
    event NFTMinted(address indexed contributor, uint256 tokenId);
    event NFTMintingFailed(address indexed contributor, string reason);
    
    // NEW: Campaign Update Events
    event UpdatePosted(uint256 indexed updateId, string title, uint256 timestamp);
    
    // NEW: Governance Events
    event MilestoneVoteStarted(uint256 indexed milestoneId, uint256 votingDeadline);
    event VoteCast(uint256 indexed milestoneId, address indexed voter, bool support, uint256 weight);
    event MilestoneVoteResolved(uint256 indexed milestoneId, bool approved, uint256 votesFor, uint256 votesAgainst);
    event GovernanceToggled(bool enabled);
    
    // Modifiers
    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator can call this");
        _;
    }
    
    modifier onlyContributor() {
        require(contributions[msg.sender] > 0, "Only contributors can call this");
        _;
    }
    
    modifier beforeDeadline() {
        require(block.timestamp < deadline, "Campaign has ended");
        _;
    }
    
    modifier afterDeadline() {
        require(block.timestamp >= deadline, "Campaign still active");
        _;
    }
    
    modifier notFinalized() {
        require(!finalized, "Campaign already finalized");
        _;
    }
    
    modifier onlyWhenSuccessful() {
        require(isSuccessful(), "Campaign was not successful");
        _;
    }
    
    /**
     * @dev Constructor to initialize the crowdfund campaign with optional milestones and governance
     */
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
        require(_beneficiary != address(0), "Invalid beneficiary address");
        require(_duration > 0, "Duration must be greater than 0");
        require(_fundingCap > 0, "Funding cap must be greater than 0");
        
        name = _name;
        beneficiary = _beneficiary;
        fundingCap = _fundingCap;
        deadline = block.timestamp + _duration;
        creator = _creator;
        finalized = false;
        totalFundsRaised = 0;
        releasedAmount = 0;
        governanceEnabled = _enableGovernance;
        
        // Set NFT contract if provided
        if (_nftContract != address(0)) {
            nftContract = IProofOfContribution(_nftContract);
            nftRewardsEnabled = true;
        }
        
        // Initialize milestones if provided
        if (_milestones.length > 0) {
            uint256 totalMilestones = 0;
            
            for (uint256 i = 0; i < _milestones.length; i++) {
                require(_milestones[i].amount > 0, "Milestone amount must be greater than 0");
                totalMilestones += _milestones[i].amount;
                
                milestones.push(Milestone({
                    description: _milestones[i].description,
                    amount: _milestones[i].amount,
                    completed: false,
                    fundsReleased: false
                }));
                
                emit MilestoneAdded(i, _milestones[i].description, _milestones[i].amount);
            }
            
            require(totalMilestones <= _fundingCap, "Total milestone amount exceeds funding cap");
            totalMilestoneAmount = totalMilestones;
        }
        
        emit GovernanceToggled(_enableGovernance);
    }
    
    /**
     * @dev Contribute to the crowdfund campaign
     */
    function contribute() external payable beforeDeadline {
        require(msg.value > 0, "Contribution must be greater than 0");
        require(totalFundsRaised + msg.value <= fundingCap, "Contribution exceeds funding cap");
        
        // Track new contributors
        if (contributions[msg.sender] == 0) {
            contributors.push(msg.sender);
        }
        
        contributions[msg.sender] += msg.value;
        totalFundsRaised += msg.value;
        
        emit ContributionReceived(msg.sender, msg.value);
    }
    
    /**
     * @dev Check if the campaign was successful (reached funding cap)
     */
    function isSuccessful() public view returns (bool) {
        return totalFundsRaised >= fundingCap;
    }
    
    // ======= NEW FEATURE 1: CAMPAIGN UPDATE FUNCTIONS =======
    
    /**
     * @dev Post a campaign update (creator only)
     * @param _title Title of the update
     * @param _ipfsHash IPFS hash containing detailed update content (text, images, videos)
     * @param _milestoneId Optional milestone ID this update relates to (use type(uint256).max for no milestone)
     */
    function postUpdate(
        string memory _title,
        string memory _ipfsHash,
        uint256 _milestoneId
    ) external onlyCreator {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");
        
        if (_milestoneId != type(uint256).max) {
            require(_milestoneId < milestones.length, "Invalid milestone ID");
        }
        
        updates.push(Update({
            title: _title,
            ipfsHash: _ipfsHash,
            timestamp: block.timestamp,
            milestoneId: _milestoneId
        }));
        
        emit UpdatePosted(updates.length - 1, _title, block.timestamp);
    }
    
    /**
     * @dev Get total number of updates
     */
    function getUpdateCount() external view returns (uint256) {
        return updates.length;
    }
    
    /**
     * @dev Get update by ID
     */
    function getUpdate(uint256 _updateId) external view returns (
        string memory title,
        string memory ipfsHash,
        uint256 timestamp,
        uint256 milestoneId
    ) {
        require(_updateId < updates.length, "Invalid update ID");
        Update memory update = updates[_updateId];
        return (update.title, update.ipfsHash, update.timestamp, update.milestoneId);
    }
    
    /**
     * @dev Get all updates for a specific milestone
     */
    function getMilestoneUpdates(uint256 _milestoneId) external view returns (uint256[] memory) {
        require(_milestoneId < milestones.length, "Invalid milestone ID");
        
        uint256 count = 0;
        for (uint256 i = 0; i < updates.length; i++) {
            if (updates[i].milestoneId == _milestoneId) {
                count++;
            }
        }
        
        uint256[] memory updateIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < updates.length; i++) {
            if (updates[i].milestoneId == _milestoneId) {
                updateIds[index] = i;
                index++;
            }
        }
        
        return updateIds;
    }
    
    // ======= NEW FEATURE 2: CONTRIBUTOR GOVERNANCE FUNCTIONS =======
    
    /**
     * @dev Creator proposes milestone completion and starts voting (if governance enabled)
     * If governance disabled, milestone is marked complete immediately (old behavior)
     */
    function completeMilestone(uint256 _milestoneId) external onlyCreator onlyWhenSuccessful {
        require(finalized, "Campaign must be finalized first");
        require(_milestoneId < milestones.length, "Invalid milestone ID");
        require(!milestones[_milestoneId].completed, "Milestone already completed");
        
        if (governanceEnabled) {
            // Start voting process
            require(!milestoneVotes[_milestoneId].resolved, "Voting already concluded");
            
            milestoneVotes[_milestoneId].votingDeadline = block.timestamp + VOTING_PERIOD;
            
            emit MilestoneVoteStarted(_milestoneId, milestoneVotes[_milestoneId].votingDeadline);
        } else {
            // Old behavior: mark as completed immediately
            milestones[_milestoneId].completed = true;
            emit MilestoneCompleted(_milestoneId);
        }
    }
    
    /**
     * @dev Contributors vote on milestone completion
     * @param _milestoneId The milestone being voted on
     * @param _support true to approve, false to reject
     */
    function voteOnMilestone(uint256 _milestoneId, bool _support) external onlyContributor {
        require(governanceEnabled, "Governance is not enabled");
        require(_milestoneId < milestones.length, "Invalid milestone ID");
        require(!milestones[_milestoneId].completed, "Milestone already completed");
        require(!milestoneVotes[_milestoneId].resolved, "Voting already concluded");
        require(block.timestamp <= milestoneVotes[_milestoneId].votingDeadline, "Voting period ended");
        require(!milestoneVotes[_milestoneId].hasVoted[msg.sender], "Already voted");
        
        uint256 weight = contributions[msg.sender];
        
        if (_support) {
            milestoneVotes[_milestoneId].votesFor += weight;
        } else {
            milestoneVotes[_milestoneId].votesAgainst += weight;
        }
        
        milestoneVotes[_milestoneId].hasVoted[msg.sender] = true;
        milestoneVotes[_milestoneId].voteChoice[msg.sender] = _support;
        
        emit VoteCast(_milestoneId, msg.sender, _support, weight);
        
        // Auto-resolve if threshold reached
        _tryResolveVote(_milestoneId);
    }
    
    /**
     * @dev Resolve milestone vote after voting period or if threshold reached
     */
    function resolveMilestoneVote(uint256 _milestoneId) external {
        require(governanceEnabled, "Governance is not enabled");
        require(_milestoneId < milestones.length, "Invalid milestone ID");
        require(!milestoneVotes[_milestoneId].resolved, "Already resolved");
        require(
            block.timestamp > milestoneVotes[_milestoneId].votingDeadline,
            "Voting period not ended"
        );
        
        _tryResolveVote(_milestoneId);
    }
    
    /**
     * @dev Internal function to resolve vote if conditions met
     */
    function _tryResolveVote(uint256 _milestoneId) internal {
        MilestoneVote storage vote = milestoneVotes[_milestoneId];
        
        uint256 totalVotes = vote.votesFor + vote.votesAgainst;
        
        // Need at least 30% participation
        if (totalVotes < (totalFundsRaised * 30) / 100) {
            // Not enough participation yet
            if (block.timestamp <= vote.votingDeadline) {
                return; // Wait for more votes
            }
        }
        
        // Calculate approval percentage
        uint256 approvalPercent = (vote.votesFor * 100) / totalVotes;
        bool approved = approvalPercent >= APPROVAL_THRESHOLD;
        
        vote.resolved = true;
        vote.approved = approved;
        
        if (approved) {
            milestones[_milestoneId].completed = true;
            emit MilestoneCompleted(_milestoneId);
        }
        
        emit MilestoneVoteResolved(_milestoneId, approved, vote.votesFor, vote.votesAgainst);
    }
    
    /**
     * @dev Get voting status for a milestone
     */
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
    
    /**
     * @dev Toggle governance on/off (creator only, before finalization)
     */
    function toggleGovernance() external onlyCreator {
        require(!finalized, "Cannot change governance after finalization");
        governanceEnabled = !governanceEnabled;
        emit GovernanceToggled(governanceEnabled);
    }
    
    // ======= EXISTING FUNCTIONS (UNCHANGED) =======
    
    /**
     * @dev Finalize the campaign and mint NFTs to contributors if successful
     */
    function finalize() external afterDeadline notFinalized {
        finalized = true;
        
        if (isSuccessful()) {
            // Campaign successful
            emit CampaignFinalized(totalFundsRaised, true);
            
            // Mint NFTs to all contributors if NFT rewards enabled
            if (nftRewardsEnabled && address(nftContract) != address(0)) {
                _mintNFTsToContributors();
            }
            
            if (milestones.length == 0) {
                emit FundsWithdrawn(beneficiary, 0);
            }
        } else {
            // Campaign failed - enable refunds
            emit CampaignFinalized(totalFundsRaised, false);
        }
    }
    
    /**
     * @dev Internal function to mint NFTs to all contributors
     */
    function _mintNFTsToContributors() internal {
        for (uint256 i = 0; i < contributors.length; i++) {
            address contributor = contributors[i];
            uint256 amount = contributions[contributor];
            
            // Skip if already has NFT
            try nftContract.hasNFT(address(this), contributor) returns (bool hasNFT) {
                if (hasNFT) {
                    continue;
                }
            } catch {
                // If check fails, try to mint anyway
            }
            
            // Try to mint NFT
            try nftContract.mintContribution(
                contributor,
                amount,
                name,
                i + 1 // Contributor number (1-indexed)
            ) returns (uint256 tokenId) {
                emit NFTMinted(contributor, tokenId);
            } catch Error(string memory reason) {
                emit NFTMintingFailed(contributor, reason);
            } catch {
                emit NFTMintingFailed(contributor, "Unknown error");
            }
        }
    }
    
    /**
     * @dev Manually mint NFTs (in case auto-minting failed during finalize)
     */
    function mintNFTsManually() external onlyCreator {
        require(finalized, "Campaign must be finalized first");
        require(isSuccessful(), "Campaign must be successful");
        require(nftRewardsEnabled && address(nftContract) != address(0), "NFT rewards not enabled");
        
        _mintNFTsToContributors();
    }
    
    /**
     * @dev Release funds for a completed milestone
     */
    function releaseMilestoneFunds(uint256 _milestoneId) external {
        require(finalized && isSuccessful(), "Campaign must be finalized and successful");
        require(_milestoneId < milestones.length, "Invalid milestone ID");
        require(milestones[_milestoneId].completed, "Milestone not completed");
        require(!milestones[_milestoneId].fundsReleased, "Funds already released");
        
        milestones[_milestoneId].fundsReleased = true;
        uint256 amount = milestones[_milestoneId].amount;
        releasedAmount += amount;
        
        (bool success, ) = beneficiary.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit MilestoneFundsReleased(_milestoneId, amount);
    }
    
    /**
     * @dev Release all funds (for campaigns without milestones)
     */
    function releaseAllFunds() external onlyCreator onlyWhenSuccessful {
        require(finalized, "Campaign must be finalized first");
        require(milestones.length == 0, "Cannot release all funds for campaigns with milestones");
        require(releasedAmount == 0, "Funds already released");
        
        uint256 amount = address(this).balance;
        releasedAmount = amount;
        
        (bool success, ) = beneficiary.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit FundsWithdrawn(beneficiary, amount);
    }
    
    /**
     * @dev Claim refund if campaign failed
     */
    function claimRefund() external {
        require(finalized, "Campaign must be finalized first");
        require(!isSuccessful(), "Campaign was successful, no refunds");
        
        uint256 amount = contributions[msg.sender];
        require(amount > 0, "No contribution to refund");
        
        contributions[msg.sender] = 0;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Refund transfer failed");
        
        emit RefundIssued(msg.sender, amount);
    }
    
    /**
     * @dev Get campaign details
     */
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
            isSuccessful(),
            creator,
            milestones.length,
            governanceEnabled,
            updates.length
        );
    }
    
    /**
     * @dev Get milestone details
     */
    function getMilestone(uint256 _milestoneId) external view returns (
        string memory description,
        uint256 amount,
        bool completed,
        bool fundsReleased
    ) {
        require(_milestoneId < milestones.length, "Invalid milestone ID");
        Milestone memory milestone = milestones[_milestoneId];
        return (milestone.description, milestone.amount, milestone.completed, milestone.fundsReleased);
    }
    
    /**
     * @dev Get all milestones
     */
    function getAllMilestones() external view returns (Milestone[] memory) {
        return milestones;
    }
    
    /**
     * @dev Get contributor count
     */
    function getContributorCount() external view returns (uint256) {
        return contributors.length;
    }
    
    /**
     * @dev Get contributor by index
     */
    function getContributor(uint256 index) external view returns (address) {
        require(index < contributors.length, "Invalid contributor index");
        return contributors[index];
    }
}
