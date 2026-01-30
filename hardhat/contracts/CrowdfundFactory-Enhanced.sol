// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Crowdfund-Enhanced.sol";

/**
 * @title CrowdfundFactory Enhanced
 * @dev Factory contract to create and manage crowdfunding campaigns
 *      Now supports governance and update features
 */
contract CrowdfundFactory {
    // Array to store all campaign addresses
    address[] public campaigns;
    
    // Mapping to check if an address is a valid campaign
    mapping(address => bool) public isCampaign;
    
    // Mapping from creator to their campaigns
    mapping(address => address[]) public creatorCampaigns;
    
    // NFT contract address (same for all campaigns)
    address public nftContract;
    
    // Owner of the factory
    address public owner;
    
    // Events
    event CampaignCreated(
        address indexed campaign,
        address indexed creator,
        string name,
        uint256 fundingCap,
        uint256 deadline,
        bool nftRewardsEnabled,
        bool governanceEnabled
    );
    
    event NFTContractUpdated(address indexed oldContract, address indexed newContract);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    constructor(address _nftContract) {
        owner = msg.sender;
        nftContract = _nftContract;
    }
    
    /**
     * @dev Create a new crowdfunding campaign with optional governance
     * @param _name Campaign name
     * @param _beneficiary Address to receive funds
     * @param _duration Campaign duration in seconds
     * @param _fundingCap Funding goal in wei
     * @param _milestones Array of milestones
     * @param _enableNFTRewards Whether to enable NFT rewards
     * @param _enableGovernance Whether to enable contributor governance
     */
    function createCampaign(
        string memory _name,
        address _beneficiary,
        uint256 _duration,
        uint256 _fundingCap,
        Crowdfund.MilestoneInput[] memory _milestones,
        bool _enableNFTRewards,
        bool _enableGovernance
    ) external returns (address) {
        // Determine NFT contract address
        address nftAddress = _enableNFTRewards ? nftContract : address(0);
        
        // Create new campaign contract
        Crowdfund campaign = new Crowdfund(
            _name,
            _beneficiary,
            _duration,
            _fundingCap,
            msg.sender,
            _milestones,
            nftAddress,
            _enableGovernance
        );
        
        address campaignAddress = address(campaign);
        
        // Register the campaign
        campaigns.push(campaignAddress);
        isCampaign[campaignAddress] = true;
        creatorCampaigns[msg.sender].push(campaignAddress);
        
        emit CampaignCreated(
            campaignAddress,
            msg.sender,
            _name,
            _fundingCap,
            block.timestamp + _duration,
            _enableNFTRewards,
            _enableGovernance
        );
        
        return campaignAddress;
    }
    
    /**
     * @dev Get all campaigns
     */
    function getAllCampaigns() external view returns (address[] memory) {
        return campaigns;
    }
    
    /**
     * @dev Get total number of campaigns
     */
    function getCampaignCount() external view returns (uint256) {
        return campaigns.length;
    }
    
    /**
     * @dev Get campaigns created by a specific address
     */
    function getCampaignsByCreator(address _creator) external view returns (address[] memory) {
        return creatorCampaigns[_creator];
    }
    
    /**
     * @dev Update NFT contract address (only owner)
     */
    function updateNFTContract(address _newNFTContract) external onlyOwner {
        require(_newNFTContract != address(0), "Invalid NFT contract address");
        address oldContract = nftContract;
        nftContract = _newNFTContract;
        emit NFTContractUpdated(oldContract, _newNFTContract);
    }
    
    /**
     * @dev Check if address is a valid campaign
     */
    function isValidCampaign(address _campaign) external view returns (bool) {
        return isCampaign[_campaign];
    }
}
