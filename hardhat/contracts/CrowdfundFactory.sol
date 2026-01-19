// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Crowdfund.sol";

/**
 * @title CrowdfundFactory
 * @dev Factory contract to deploy and manage crowdfunding campaigns
 */
contract CrowdfundFactory {
    // Array to store all deployed crowdfund campaigns
    address[] public deployedCampaigns;
    
    // Mapping from creator to their campaigns
    mapping(address => address[]) public creatorCampaigns;
    
    // Mapping to check if an address is a valid campaign
    mapping(address => bool) public isValidCampaign;
    
    // Events
    event CampaignCreated(
        address indexed campaignAddress,
        address indexed creator,
        string name,
        address beneficiary,
        uint256 fundingCap,
        uint256 deadline
    );
    
    /**
     * @dev Create a new crowdfunding campaign
     * @param _name Name of the crowdfund campaign
     * @param _beneficiary Address that will receive funds if successful
     * @param _duration Duration in seconds
     * @param _fundingCap Maximum amount to raise (in wei)
     * @return Address of the newly deployed campaign
     */
    function createCampaign(
        string memory _name,
        address _beneficiary,
        uint256 _duration,
        uint256 _fundingCap
    ) external returns (address) {
        // Deploy new Crowdfund contract
        Crowdfund newCampaign = new Crowdfund(
            _name,
            _beneficiary,
            _duration,
            _fundingCap,
            msg.sender
        );
        
        address campaignAddress = address(newCampaign);
        
        // Store campaign address
        deployedCampaigns.push(campaignAddress);
        creatorCampaigns[msg.sender].push(campaignAddress);
        isValidCampaign[campaignAddress] = true;
        
        // Calculate deadline for event
        uint256 deadline = block.timestamp + _duration;
        
        emit CampaignCreated(
            campaignAddress,
            msg.sender,
            _name,
            _beneficiary,
            _fundingCap,
            deadline
        );
        
        return campaignAddress;
    }
    
    /**
     * @dev Get all deployed campaigns
     */
    function getAllCampaigns() external view returns (address[] memory) {
        return deployedCampaigns;
    }
    
    /**
     * @dev Get campaigns created by a specific address
     */
    function getCampaignsByCreator(address creator) external view returns (address[] memory) {
        return creatorCampaigns[creator];
    }
    
    /**
     * @dev Get total number of campaigns
     */
    function getCampaignCount() external view returns (uint256) {
        return deployedCampaigns.length;
    }
    
    /**
     * @dev Get campaign address by index
     */
    function getCampaign(uint256 index) external view returns (address) {
        require(index < deployedCampaigns.length, "Index out of bounds");
        return deployedCampaigns[index];
    }
    
    /**
     * @dev Get basic info for multiple campaigns (addresses, names, beneficiaries)
     * @param startIndex Starting index in the deployedCampaigns array
     * @param count Number of campaigns to retrieve
     */
    function getCampaignsBasicInfo(uint256 startIndex, uint256 count) 
        external 
        view 
        returns (
            address[] memory addresses,
            string[] memory names,
            address[] memory beneficiaries
        ) 
    {
        require(startIndex < deployedCampaigns.length, "Start index out of bounds");
        
        uint256 endIndex = startIndex + count;
        if (endIndex > deployedCampaigns.length) {
            endIndex = deployedCampaigns.length;
        }
        uint256 actualCount = endIndex - startIndex;
        
        addresses = new address[](actualCount);
        names = new string[](actualCount);
        beneficiaries = new address[](actualCount);
        
        for (uint256 i = 0; i < actualCount; i++) {
            address campaignAddress = deployedCampaigns[startIndex + i];
            addresses[i] = campaignAddress;
            
            Crowdfund campaign = Crowdfund(payable(campaignAddress));
            names[i] = campaign.name();
            beneficiaries[i] = campaign.beneficiary();
        }
    }
    
    /**
     * @dev Get financial info for multiple campaigns
     * @param startIndex Starting index in the deployedCampaigns array
     * @param count Number of campaigns to retrieve
     */
    function getCampaignsFinancialInfo(uint256 startIndex, uint256 count) 
        external 
        view 
        returns (
            address[] memory addresses,
            uint256[] memory fundingCaps,
            uint256[] memory totalFundsRaised
        ) 
    {
        require(startIndex < deployedCampaigns.length, "Start index out of bounds");
        
        uint256 endIndex = startIndex + count;
        if (endIndex > deployedCampaigns.length) {
            endIndex = deployedCampaigns.length;
        }
        uint256 actualCount = endIndex - startIndex;
        
        addresses = new address[](actualCount);
        fundingCaps = new uint256[](actualCount);
        totalFundsRaised = new uint256[](actualCount);
        
        for (uint256 i = 0; i < actualCount; i++) {
            address campaignAddress = deployedCampaigns[startIndex + i];
            addresses[i] = campaignAddress;
            
            Crowdfund campaign = Crowdfund(payable(campaignAddress));
            fundingCaps[i] = campaign.fundingCap();
            totalFundsRaised[i] = campaign.totalFundsRaised();
        }
    }
    
    /**
     * @dev Get status info for multiple campaigns
     * @param startIndex Starting index in the deployedCampaigns array
     * @param count Number of campaigns to retrieve
     */
    function getCampaignsStatus(uint256 startIndex, uint256 count) 
        external 
        view 
        returns (
            address[] memory addresses,
            uint256[] memory deadlines,
            bool[] memory finalized,
            bool[] memory successful
        ) 
    {
        require(startIndex < deployedCampaigns.length, "Start index out of bounds");
        
        uint256 endIndex = startIndex + count;
        if (endIndex > deployedCampaigns.length) {
            endIndex = deployedCampaigns.length;
        }
        uint256 actualCount = endIndex - startIndex;
        
        addresses = new address[](actualCount);
        deadlines = new uint256[](actualCount);
        finalized = new bool[](actualCount);
        successful = new bool[](actualCount);
        
        for (uint256 i = 0; i < actualCount; i++) {
            address campaignAddress = deployedCampaigns[startIndex + i];
            addresses[i] = campaignAddress;
            
            Crowdfund campaign = Crowdfund(payable(campaignAddress));
            deadlines[i] = campaign.deadline();
            finalized[i] = campaign.finalized();
            successful[i] = campaign.isSuccessful();
        }
    }
    
    /**
     * @dev Get active campaigns (not finalized and before deadline)
     */
    function getActiveCampaigns() external view returns (address[] memory) {
        // First pass: count active campaigns
        uint256 activeCount = 0;
        for (uint256 i = 0; i < deployedCampaigns.length; i++) {
            Crowdfund campaign = Crowdfund(payable(deployedCampaigns[i]));
            if (!campaign.finalized() && block.timestamp < campaign.deadline()) {
                activeCount++;
            }
        }
        
        // Second pass: populate array
        address[] memory activeCampaigns = new address[](activeCount);
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < deployedCampaigns.length; i++) {
            Crowdfund campaign = Crowdfund(payable(deployedCampaigns[i]));
            if (!campaign.finalized() && block.timestamp < campaign.deadline()) {
                activeCampaigns[currentIndex] = deployedCampaigns[i];
                currentIndex++;
            }
        }
        
        return activeCampaigns;
    }
}
