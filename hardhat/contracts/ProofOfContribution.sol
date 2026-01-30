// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title ProofOfContribution
 * @dev NFT contract that mints proof of contribution tokens for crowdfunding backers
 */
contract ProofOfContribution is ERC721, ERC721URIStorage, Ownable {
    using Strings for uint256;
    
    uint256 private _nextTokenId;
    
    // Mapping from campaign address to whether it's authorized
    mapping(address => bool) public authorizedCampaigns;
    
    // Struct to store contribution data
    struct ContributionData {
        address campaign;
        address contributor;
        uint256 amount;
        string campaignName;
        uint256 timestamp;
        uint256 contributorNumber; // 1st, 2nd, 3rd contributor etc.
    }
    
    // Mapping from token ID to contribution data
    mapping(uint256 => ContributionData) public contributions;
    
    // Mapping from campaign + contributor to token ID
    mapping(address => mapping(address => uint256)) public campaignContributorTokens;
    
    // Events
    event CampaignAuthorized(address indexed campaign);
    event CampaignRevoked(address indexed campaign);
    event ContributionNFTMinted(
        uint256 indexed tokenId,
        address indexed campaign,
        address indexed contributor,
        uint256 amount
    );
    
    constructor() ERC721("Crowdfund Proof of Contribution", "CFPOC") Ownable(msg.sender) {}
    
    /**
     * @dev Authorize a campaign contract to mint NFTs
     */
    function authorizeCampaign(address campaign) external onlyOwner {
        require(campaign != address(0), "Invalid campaign address");
        authorizedCampaigns[campaign] = true;
        emit CampaignAuthorized(campaign);
    }
    
    /**
     * @dev Revoke campaign authorization
     */
    function revokeCampaign(address campaign) external onlyOwner {
        authorizedCampaigns[campaign] = false;
        emit CampaignRevoked(campaign);
    }
    
    /**
     * @dev Mint NFT to contributor (called by authorized campaign)
     */
    function mintContribution(
        address contributor,
        uint256 amount,
        string memory campaignName,
        uint256 contributorNumber
    ) external returns (uint256) {
        require(authorizedCampaigns[msg.sender], "Campaign not authorized");
        require(contributor != address(0), "Invalid contributor");
        require(amount > 0, "Amount must be greater than 0");
        
        // Check if contributor already has NFT for this campaign
        uint256 existingToken = campaignContributorTokens[msg.sender][contributor];
        require(existingToken == 0, "Contributor already has NFT for this campaign");
        
        uint256 tokenId = _nextTokenId++;
        
        // Store contribution data
        contributions[tokenId] = ContributionData({
            campaign: msg.sender,
            contributor: contributor,
            amount: amount,
            campaignName: campaignName,
            timestamp: block.timestamp,
            contributorNumber: contributorNumber
        });
        
        // Map campaign + contributor to token
        campaignContributorTokens[msg.sender][contributor] = tokenId;
        
        // Mint NFT
        _safeMint(contributor, tokenId);
        
        emit ContributionNFTMinted(tokenId, msg.sender, contributor, amount);
        
        return tokenId;
    }
    
    /**
     * @dev Generate SVG image for NFT
     */
    function generateSVG(uint256 tokenId) internal view returns (string memory) {
        ContributionData memory data = contributions[tokenId];
        
        return string(
            abi.encodePacked(
                '<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">',
                '<defs>',
                '<linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" style="stop-color:rgb(99,102,241);stop-opacity:1" />',
                '<stop offset="100%" style="stop-color:rgb(168,85,247);stop-opacity:1" />',
                '</linearGradient>',
                '</defs>',
                '<rect width="400" height="400" fill="url(#grad)"/>',
                '<circle cx="200" cy="120" r="60" fill="white" opacity="0.2"/>',
                '<text x="200" y="135" font-family="Arial" font-size="48" fill="white" text-anchor="middle">',
                unicode'✓',
                '</text>',
                '<text x="200" y="200" font-family="Arial" font-size="20" font-weight="bold" fill="white" text-anchor="middle">',
                'Proof of Contribution',
                '</text>',
                '<text x="200" y="240" font-family="Arial" font-size="14" fill="white" opacity="0.9" text-anchor="middle">',
                _truncateString(data.campaignName, 25),
                '</text>',
                '<text x="200" y="280" font-family="Arial" font-size="18" font-weight="bold" fill="white" text-anchor="middle">',
                _formatAmount(data.amount),
                ' ETH',
                '</text>',
                '<text x="200" y="310" font-family="Arial" font-size="12" fill="white" opacity="0.7" text-anchor="middle">',
                'Contributor #',
                data.contributorNumber.toString(),
                '</text>',
                '<text x="200" y="360" font-family="Arial" font-size="10" fill="white" opacity="0.5" text-anchor="middle">',
                'Token #',
                tokenId.toString(),
                '</text>',
                '</svg>'
            )
        );
    }
    
    /**
     * @dev Generate token URI with metadata
     */
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        _requireOwned(tokenId);
        
        ContributionData memory data = contributions[tokenId];
        
        string memory svg = generateSVG(tokenId);
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{',
                        '"name": "Proof of Contribution #', tokenId.toString(), '",',
                        '"description": "This NFT proves contribution to the crowdfunding campaign: ', data.campaignName, '",',
                        '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
                        '"attributes": [',
                        '{"trait_type": "Campaign", "value": "', data.campaignName, '"},',
                        '{"trait_type": "Contribution Amount", "display_type": "number", "value": ', _formatAmount(data.amount), '},',
                        '{"trait_type": "Contributor Number", "display_type": "number", "value": ', data.contributorNumber.toString(), '},',
                        '{"trait_type": "Timestamp", "display_type": "date", "value": ', data.timestamp.toString(), '}',
                        ']',
                        '}'
                    )
                )
            )
        );
        
        return string(abi.encodePacked("data:application/json;base64,", json));
    }
    
    /**
     * @dev Format amount for display (ETH with 4 decimals)
     */
    function _formatAmount(uint256 amount) internal pure returns (string memory) {
        uint256 eth = amount / 1e18;
        uint256 decimals = (amount % 1e18) / 1e14; // 4 decimal places
        
        if (decimals == 0) {
            return eth.toString();
        }
        
        return string(abi.encodePacked(eth.toString(), ".", _padDecimals(decimals)));
    }
    
    /**
     * @dev Pad decimals to 4 digits
     */
    function _padDecimals(uint256 decimals) internal pure returns (string memory) {
        string memory decStr = decimals.toString();
        uint256 len = bytes(decStr).length;
        
        if (len >= 4) return decStr;
        
        string memory padding = "";
        for (uint256 i = len; i < 4; i++) {
            padding = string(abi.encodePacked(padding, "0"));
        }
        
        return string(abi.encodePacked(padding, decStr));
    }
    
    /**
     * @dev Truncate string to max length
     */
    function _truncateString(string memory str, uint256 maxLength) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        if (strBytes.length <= maxLength) {
            return str;
        }
        
        bytes memory truncated = new bytes(maxLength);
        for (uint256 i = 0; i < maxLength - 3; i++) {
            truncated[i] = strBytes[i];
        }
        truncated[maxLength - 3] = ".";
        truncated[maxLength - 2] = ".";
        truncated[maxLength - 1] = ".";
        
        return string(truncated);
    }
    
    /**
     * @dev Get contribution data for a token
     */
    function getContributionData(uint256 tokenId) external view returns (
        address campaign,
        address contributor,
        uint256 amount,
        string memory campaignName,
        uint256 timestamp,
        uint256 contributorNumber
    ) {
        ContributionData memory data = contributions[tokenId];
        return (
            data.campaign,
            data.contributor,
            data.amount,
            data.campaignName,
            data.timestamp,
            data.contributorNumber
        );
    }
    
    /**
     * @dev Check if contributor has NFT for a campaign
     */
    function hasNFT(address campaign, address contributor) external view returns (bool) {
        return campaignContributorTokens[campaign][contributor] != 0;
    }
    
    /**
     * @dev Get token ID for campaign contributor
     */
    function getTokenId(address campaign, address contributor) external view returns (uint256) {
        return campaignContributorTokens[campaign][contributor];
    }
    
    /**
     * @dev Override required by Solidity
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
