// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Crowdfund.sol";
import "./ProofOfContribution.sol";

/**
 * @title CrowdfundFactory - Per-Campaign NFT Architecture
 * @dev Each campaign gets its own dedicated ProofOfContribution NFT contract
 */
contract CrowdfundFactory {
    address[] public campaigns;
    mapping(address => bool) public isCampaign;
    mapping(address => address[]) public creatorCampaigns;
    mapping(address => address) public campaignNFTContract;
    address public owner;
    
    event CampaignCreated(
        address indexed campaign,
        address indexed creator,
        address indexed nftContract,
        string name,
        uint256 fundingCap,
        uint256 deadline,
        bool nftRewardsEnabled,
        bool governanceEnabled
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function createCampaign(
        string memory _name,
        address _beneficiary,
        uint256 _duration,
        uint256 _fundingCap,
        Crowdfund.MilestoneInput[] memory _milestones,
        bool _enableNFTRewards,
        bool _enableGovernance
    ) external returns (address campaignAddress, address nftAddress) {
        
        // Deploy NFT contract if requested
        if (_enableNFTRewards) {
            ProofOfContribution nft = new ProofOfContribution();
            nftAddress = address(nft);
        } else {
            nftAddress = address(0);
        }
        
        // Deploy campaign contract
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
        
        campaignAddress = address(campaign);
        
        // Transfer NFT ownership to campaign
        if (_enableNFTRewards) {
            ProofOfContribution(nftAddress).transferOwnership(campaignAddress);
        }
        
        // Register campaign
        campaigns.push(campaignAddress);
        isCampaign[campaignAddress] = true;
        creatorCampaigns[msg.sender].push(campaignAddress);
        
        if (_enableNFTRewards) {
            campaignNFTContract[campaignAddress] = nftAddress;
        }
        
        emit CampaignCreated(
            campaignAddress,
            msg.sender,
            nftAddress,
            _name,
            _fundingCap,
            block.timestamp + _duration,
            _enableNFTRewards,
            _enableGovernance
        );
        
        return (campaignAddress, nftAddress);
    }
    
    function getAllCampaigns() external view returns (address[] memory) {
        return campaigns;
    }
    
    function getCampaignCount() external view returns (uint256) {
        return campaigns.length;
    }
    
    function getCampaignsByCreator(address _creator) external view returns (address[] memory) {
        return creatorCampaigns[_creator];
    }
    
    function getNFTContractForCampaign(address _campaign) external view returns (address) {
        return campaignNFTContract[_campaign];
    }
    
    function isValidCampaign(address _campaign) external view returns (bool) {
        return isCampaign[_campaign];
    }
}
