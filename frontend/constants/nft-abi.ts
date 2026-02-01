// constants/nft-abi.ts
export const NFT_CONTRACT_ABI = [
  // View functions
  {
    type: 'function',
    name: 'getContributionData',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'campaign', type: 'address' },
      { name: 'contributor', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'campaignName', type: 'string' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'contributorNumber', type: 'uint256' }
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenURI',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasNFT',
    inputs: [
      { name: 'campaign', type: 'address' },
      { name: 'contributor', type: 'address' }
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTokenId',
    inputs: [
      { name: 'campaign', type: 'address' },
      { name: 'contributor', type: 'address' }
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  
  // Events
  {
    type: 'event',
    name: 'ContributionNFTMinted',
    inputs: [
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: true, name: 'campaign', type: 'address' },
      { indexed: true, name: 'contributor', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' }
    ],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' }
    ],
  },
] as const;