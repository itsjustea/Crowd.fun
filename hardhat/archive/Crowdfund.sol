// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Crowdfund
 * @dev Individual crowdfunding campaign contract with milestone-based escrow
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
    
    // Events
    event ContributionReceived(address indexed contributor, uint256 amount);
    event CampaignFinalized(uint256 totalRaised, bool successful);
    event FundsWithdrawn(address indexed beneficiary, uint256 amount);
    event RefundIssued(address indexed contributor, uint256 amount);
    event MilestoneAdded(uint256 indexed milestoneId, string description, uint256 amount);
    event MilestoneCompleted(uint256 indexed milestoneId);
    event MilestoneFundsReleased(uint256 indexed milestoneId, uint256 amount);
    
    // Modifiers
    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator can call this");
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
     * @dev Constructor to initialize the crowdfund campaign
     * @param _name Name of the crowdfund campaign
     * @param _beneficiary Address that will receive funds if successful
     * @param _duration Duration in seconds from deployment
     * @param _fundingCap Maximum amount to raise (in wei)
     * @param _creator Address of the campaign creator
     */
    constructor(
        string memory _name,
        address _beneficiary,
        uint256 _duration,
        uint256 _fundingCap,
        address _creator,
        Milestone[] memory _milestones
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

        // initialise milestones if any
        if (_milestones.length > 0) {
            for (uint256 i = 0; i < _milestones.length; i++) {
                milestones.push(Milestone({
                    description: _milestones[i].description,
                    amount: _milestones[i].amount,
                    completed: false,
                    fundsReleased: false
                }));
            }
        }
    }
    
    /**
     * @dev Add a milestone to the campaign (only creator, before deadline)
     * @param _description Description of the milestone
     * @param _amount Amount to be released when milestone is completed
     */
    // function addMilestone(string memory _description, uint256 _amount) external onlyCreator beforeDeadline {
    //     require(_amount > 0, "Milestone amount must be greater than 0");
    //     require(totalMilestoneAmount + _amount <= fundingCap, "Total milestone amount exceeds funding cap");
        
    //     milestones.push(Milestone({
    //         description: _description,
    //         amount: _amount,
    //         completed: false,
    //         fundsReleased: false
    //     }));
        
    //     totalMilestoneAmount += _amount;
        
    //     emit MilestoneAdded(milestones.length - 1, _description, _amount);
    // }
    
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
    
    /**
     * @dev Finalize the campaign
     * If successful and no milestones: funds held in escrow until milestones are set or released
     * If successful with milestones: funds released per milestone completion
     * If unsuccessful: enable refunds for contributors
     */
    function finalize() external afterDeadline notFinalized {
        finalized = true;
        
        if (isSuccessful()) {
            // Campaign successful - funds held in escrow
            emit CampaignFinalized(totalFundsRaised, true);
            
            // If no milestones were set, allow direct withdrawal
            if (milestones.length == 0) {
                // Funds can be released directly
                emit FundsWithdrawn(beneficiary, 0); // Placeholder event
            }
        } else {
            // Campaign failed - enable refunds
            emit CampaignFinalized(totalFundsRaised, false);
        }
    }
    
    /**
     * @dev Mark a milestone as completed (only creator, only if campaign successful)
     * @param _milestoneId The index of the milestone to mark as completed
     */
    function completeMilestone(uint256 _milestoneId) external onlyCreator onlyWhenSuccessful {
        require(finalized, "Campaign must be finalized first");
        require(_milestoneId < milestones.length, "Invalid milestone ID");
        require(!milestones[_milestoneId].completed, "Milestone already completed");
        
        milestones[_milestoneId].completed = true;
        
        emit MilestoneCompleted(_milestoneId);
    }
    
    /**
     * @dev Release funds for a completed milestone
     * Can be called by anyone once milestone is marked complete
     * @param _milestoneId The index of the milestone to release funds for
     */
    function releaseMilestoneFunds(uint256 _milestoneId) external onlyWhenSuccessful {
        require(finalized, "Campaign must be finalized first");
        require(_milestoneId < milestones.length, "Invalid milestone ID");
        require(milestones[_milestoneId].completed, "Milestone not completed");
        require(!milestones[_milestoneId].fundsReleased, "Funds already released");
        
        Milestone storage milestone = milestones[_milestoneId];
        milestone.fundsReleased = true;
        
        uint256 amount = milestone.amount;
        releasedAmount += amount;
        
        (bool success, ) = beneficiary.call{value: amount}("");
        require(success, "Transfer to beneficiary failed");
        
        emit MilestoneFundsReleased(_milestoneId, amount);
    }
    
    /**
     * @dev Release all remaining funds if no milestones were set (only creator)
     * Can only be called if campaign was successful and no milestones exist
     */
    function releaseAllFunds() external onlyCreator onlyWhenSuccessful {
        require(finalized, "Campaign must be finalized first");
        require(milestones.length == 0, "Cannot release all funds when milestones exist");
        require(releasedAmount == 0, "Funds already released");
        
        uint256 amount = address(this).balance;
        releasedAmount = amount;
        
        (bool success, ) = beneficiary.call{value: amount}("");
        require(success, "Transfer to beneficiary failed");
        
        emit FundsWithdrawn(beneficiary, amount);
    }
    
    /**
     * @dev Claim refund if campaign failed to reach funding cap
     */
    function claimRefund() external afterDeadline {
        require(finalized, "Campaign not finalized yet");
        require(!isSuccessful(), "Campaign was successful, no refunds");
        require(contributions[msg.sender] > 0, "No contribution to refund");
        
        uint256 amount = contributions[msg.sender];
        contributions[msg.sender] = 0;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Refund transfer failed");
        
        emit RefundIssued(msg.sender, amount);
    }
    
    /**
     * @dev Get campaign information
     */
    function getCampaignInfo() external view returns (
        string memory _name,
        address _beneficiary,
        uint256 _fundingCap,
        uint256 _deadline,
        uint256 _totalFundsRaised,
        bool _finalized,
        bool _isSuccessful,
        uint256 _timeRemaining
    ) {
        uint256 timeRemaining = block.timestamp >= deadline ? 0 : deadline - block.timestamp;
        
        return (
            name,
            beneficiary,
            fundingCap,
            deadline,
            totalFundsRaised,
            finalized,
            isSuccessful(),
            timeRemaining
        );
    }
    
    /**
     * @dev Get milestone information
     * @param _milestoneId The index of the milestone
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
     * @dev Get total number of milestones
     */
    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }
    
    /**
     * @dev Get number of contributors
     */
    function getContributorCount() external view returns (uint256) {
        return contributors.length;
    }
    
    /**
     * @dev Get contributor address by index
     */
    function getContributor(uint256 index) external view returns (address) {
        require(index < contributors.length, "Index out of bounds");
        return contributors[index];
    }
    
    /**
     * @dev Get escrow balance (remaining funds not yet released)
     */
    function getEscrowBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Receive function to accept direct transfers
     */
    receive() external payable beforeDeadline {
        require(msg.value > 0, "Contribution must be greater than 0");
        require(totalFundsRaised + msg.value <= fundingCap, "Contribution exceeds funding cap");
        
        if (contributions[msg.sender] == 0) {
            contributors.push(msg.sender);
        }
        
        contributions[msg.sender] += msg.value;
        totalFundsRaised += msg.value;
        
        emit ContributionReceived(msg.sender, msg.value);
    }
}
