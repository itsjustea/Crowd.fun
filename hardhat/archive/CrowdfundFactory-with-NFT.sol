// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Crowdfund.sol";

/**
 * @title CrowdfundFactory
 * @dev Factory contract to create and manage multiple crowdfunding campaigns with NFT rewards
 */
contract CrowdfundFactory {
    // Array to store all created campaign addresses
    address[] public campaigns;
    
    // Mapping to check if an address is a valid campaign
    mapping(address => bool) public isValidCampaign;
    
    // Mapping to track campaigns created by each address
    mapping(address => address[]) public campaignsByCreator;
    
    // NFT contract address
    address public nftContract;
    
    // Events
    event CampaignCreated(
        address indexed campaignAddress,
        address indexed creator,
        string name,
        address beneficiary,
        uint256 fundingCap,
        uint256 deadline,
        bool nftRewardsEnabled
    );
    
    event NFTContractUpdated(address indexed oldContract, address indexed newContract);
    
    /**
     * @dev Constructor
     */
    constructor(address _nftContract) {
        nftContract = _nftContract;
    }
    
    /**
     * @dev Update NFT contract address (owner only in production)
     */
    function updateNFTContract(address _nftContract) external {
        require(_nftContract != address(0), "Invalid NFT contract");
        address oldContract = nftContract;
        nftContract = _nftContract;
        emit NFTContractUpdated(oldContract, _nftContract);
    }
    
    /**
     * @dev Create a new crowdfunding campaign with optional NFT rewards
     */
    function createCampaign(
        string memory _name,
        address _beneficiary,
        uint256 _duration,
        uint256 _fundingCap,
        Crowdfund.MilestoneInput[] memory _milestones,
        bool _enableNFTRewards
    ) external returns (address) {
        // Create new Crowdfund contract
        Crowdfund newCampaign = new Crowdfund(
            _name,
            _beneficiary,
            _duration,
            _fundingCap,
            msg.sender,
            _milestones,
            _enableNFTRewards ? nftContract : address(0)
        );
        
        address campaignAddress = address(newCampaign);
        
        // Store campaign address
        campaigns.push(campaignAddress);
        isValidCampaign[campaignAddress] = true;
        campaignsByCreator[msg.sender].push(campaignAddress);
        
        // Emit event
        emit CampaignCreated(
            campaignAddress,
            msg.sender,
            _name,
            _beneficiary,
            _fundingCap,
            block.timestamp + _duration,
            _enableNFTRewards
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
     * @dev Get campaigns by creator
     */
    function getCampaignsByCreator(address creator) external view returns (address[] memory) {
        return campaignsByCreator[creator];
    }
    
    /**
     * @dev Get campaign count
     */
    function getCampaignCount() external view returns (uint256) {
        return campaigns.length;
    }
    
    /**
     * @dev Get campaign by index
     */
    function getCampaign(uint256 index) external view returns (address) {
        require(index < campaigns.length, "Index out of bounds");
        return campaigns[index];
    }
}
