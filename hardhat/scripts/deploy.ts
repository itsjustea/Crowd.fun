// scripts/deploy-streamlined.ts
import { ethers } from "hardhat";
import * as fs from "fs";

interface Milestone {
  description: string;
  amount: bigint;
}

interface DeployedAddresses {
  factory: string;
  testCampaign: string;
  testCampaignNFT: string;
  network: string;
  deployer: string;
  timestamp: string;
  governanceType: string;
  version: string;
}

async function main(): Promise<void> {
  console.log("Deploying Streamlined Per-Campaign NFT Architecture...\n");
  console.log("=" .repeat(70));
  console.log("ℹVersion: Streamlined (event-based updates, optimized for size)");
  console.log("=" .repeat(70));
  console.log("");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  console.log("=" .repeat(70));
  console.log("");

  // ================================================================
  // STEP 1: Deploy CrowdfundFactory
  // ================================================================
  console.log("Step 1/2: Deploying CrowdfundFactory (Streamlined)...");
  console.log("This may take a moment...");
  
  const CrowdfundFactory = await ethers.getContractFactory("CrowdfundFactory");
  const factory = await CrowdfundFactory.deploy();
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  console.log("CrowdfundFactory deployed to:", factoryAddress);
  console.log("Each campaign will get its own ProofOfContribution NFT contract");
  console.log("Campaign updates use events (no on-chain storage)");
  console.log("");

  // ================================================================
  // STEP 2: Create test campaign
  // ================================================================
  console.log("Step 2/2: Creating test campaign...");
  
  const campaignConfig = {
    name: "Demo: Streamlined Architecture",
    beneficiary: deployer.address,
    duration: 30 * 24 * 60 * 60, // 30 days
    fundingCap: ethers.parseEther("10"), // 10 ETH goal
    enableNFT: true,
    enableGovernance: true
  };
  
  const milestones: Milestone[] = [
    {
      description: "Phase 1: Planning & Research",
      amount: ethers.parseEther("2")
    },
    {
      description: "Phase 2: Development & Implementation",
      amount: ethers.parseEther("5")
    },
    {
      description: "Phase 3: Testing & Launch",
      amount: ethers.parseEther("3")
    }
  ];
  
  console.log("📋 Campaign Configuration:");
  console.log("   Name:       ", campaignConfig.name);
  console.log("   Goal:       ", ethers.formatEther(campaignConfig.fundingCap), "ETH");
  console.log("   Duration:   ", campaignConfig.duration / 86400, "days");
  console.log("   Milestones: ", milestones.length);
  console.log("   NFT Rewards:", campaignConfig.enableNFT ? "Enabled" : "Disabled");
  console.log("   Governance: ", campaignConfig.enableGovernance ? "ONE-PERSON-ONE-VOTE" : "Disabled");
  console.log("");
  console.log("   Creating campaign...");

  const createTx = await factory.createCampaign(
    campaignConfig.name,
    campaignConfig.beneficiary,
    campaignConfig.duration,
    campaignConfig.fundingCap,
    milestones,
    campaignConfig.enableNFT,
    campaignConfig.enableGovernance
  );
  
  console.log("Waiting for transaction confirmation...");
  const receipt = await createTx.wait();
  
  // Extract campaign and NFT addresses from CampaignCreated event
  let campaignAddress = "N/A";
  let nftAddress = "N/A";
  
  if (receipt && receipt.logs) {
    for (const log of receipt.logs) {
      try {
        const parsed = factory.interface.parseLog({
          topics: [...log.topics],
          data: log.data
        });
        
        if (parsed && parsed.name === 'CampaignCreated') {
          campaignAddress = parsed.args.campaign;
          nftAddress = parsed.args.nftContract;
          break;
        }
      } catch (e) {
        continue;
      }
    }
  }
  
  console.log("Campaign deployed to:     ", campaignAddress);
  console.log("Campaign's NFT contract:  ", nftAddress);
  console.log("");

  // ================================================================
  // Verify NFT ownership
  // ================================================================
  if (nftAddress !== "0x0000000000000000000000000000000000000000" && nftAddress !== "N/A") {
    try {
      console.log("🔍 Verifying NFT contract ownership...");
      const nftContract = await ethers.getContractAt("ProofOfContribution", nftAddress);
      const nftOwner = await nftContract.owner();
      
      const ownershipMatch = nftOwner.toLowerCase() === campaignAddress.toLowerCase();
      
      console.log("   NFT contract owner: ", nftOwner);
      console.log("   Campaign address:   ", campaignAddress);
      console.log("   Ownership match:    ", ownershipMatch ? "YES" : "NO");
      
      if (!ownershipMatch) {
        console.log("");
        console.log("WARNING: NFT ownership mismatch!");
        console.log("   NFT minting may fail. Check factory logic.");
      }
      console.log("");
    } catch (e) {
      console.log("Could not verify ownership:", (e as Error).message);
      console.log("");
    }
  }

  // ================================================================
  // Test posting an update (event-based)
  // ================================================================
  console.log("Testing event-based updates...");
  try {
    const campaign = await ethers.getContractAt("Crowdfund", campaignAddress);
    
    console.log("Posting test update...");
    const updateTx = await campaign.postUpdate(
      "Welcome to the Campaign!",
      "QmTestHash123",  // Mock IPFS hash
      ethers.MaxUint256  // General update (not milestone-specific)
    );
    await updateTx.wait();
    
    console.log("Update posted successfully (check events)");
    console.log("Updates are now event-based - no on-chain storage");
    console.log("Frontend should read UpdatePosted events");
    console.log("");
  } catch (e) {
    console.log("Could not post update:", (e as Error).message);
    console.log("   (This is non-critical for deployment)");
    console.log("");
  }

  // ================================================================
  // DEPLOYMENT SUMMARY
  // ================================================================
  const separator = "=" .repeat(70);
  console.log(separator);
  console.log("DEPLOYMENT COMPLETE!");
  console.log(separator);
  console.log("");
  console.log("Deployed Contracts:");
  console.log("   CrowdfundFactory:        ", factoryAddress);
  console.log("   Test Campaign:           ", campaignAddress);
  console.log("   Campaign's NFT Contract: ", nftAddress);
  console.log("");
  console.log("Architecture:");
  console.log("   • Each campaign has its own ProofOfContribution NFT contract");
  console.log("   • Campaign owns its NFT contract directly (no authorization)");
  console.log("   • Token IDs restart at 1 per campaign");
  console.log("   • Complete isolation between campaigns");
  console.log("");
  console.log("Campaign Updates:");
  console.log("   • Updates are EVENT-BASED (not stored on-chain)");
  console.log("   • Cheaper gas, better scalability");
  console.log("   • Frontend reads UpdatePosted events");
  console.log("   • Full content stored in IPFS");
  console.log("");
  console.log("Governance: ONE-PERSON-ONE-VOTE");
  console.log("   • Each contributor gets exactly 1 vote");
  console.log("   • 60% approval required for milestones");
  console.log("   • 30% minimum participation");
  console.log("");
  console.log("Next Steps:");
  console.log("");
  console.log("   1. Update .env.local:");
  console.log(`      NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}`);
  console.log("");
  console.log("   2. Update your frontend to read events:");
  console.log("      const filter = campaign.filters.UpdatePosted();");
  console.log("      const events = await campaign.queryFilter(filter);");
  console.log("");
  console.log("   3. Test the deployment:");
  console.log("      • Create a campaign");
  console.log("      • Contribute to it");
  console.log("      • Post updates (check events)");
  console.log("      • Finalize when deadline passes");
  console.log("      • Verify NFTs are minted");
  console.log("");
  console.log("   4. Verify contracts on Etherscan:");
  console.log(`      npx hardhat verify --network <network> ${factoryAddress}`);
  console.log(`      npx hardhat verify --network <network> ${campaignAddress} \\`);
  console.log(`        "<name>" "${deployer.address}" <duration> <cap> \\`);
  console.log(`        "${deployer.address}" '[]' "${nftAddress}" true`);
  console.log("");
  console.log(separator);
  console.log("");
  
  // ================================================================
  // Save deployment info
  // ================================================================
  const network = await ethers.provider.getNetwork();
  const addresses: DeployedAddresses = {
    factory: factoryAddress,
    testCampaign: campaignAddress,
    testCampaignNFT: nftAddress,
    network: network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    governanceType: "ONE-PERSON-ONE-VOTE",
    version: "streamlined-v1"
  };
  
  const outputPath = 'deployed-addresses-streamlined.json';
  fs.writeFileSync(
    outputPath,
    JSON.stringify(addresses, null, 2)
  );
  console.log(`Deployment info saved to ${outputPath}`);
  console.log("");

  // Create environment file snippet
  const envSnippet = `# Streamlined Per-Campaign NFT Architecture
# Add these to your .env.local file

NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}

# Notes:
# - NFT contract addresses are per-campaign
# - Use factory.getNFTContractForCampaign(campaignAddress) to get them
# - Campaign updates are event-based (read UpdatePosted events)
`;

  fs.writeFileSync('.env.deployment', envSnippet);
  console.log("Environment variables saved to .env.deployment");
  console.log("   Copy these to your .env.local file");
  console.log("");
  
  // ================================================================
  // Contract size info
  // ================================================================
  console.log("Contract Size Info:");
  console.log("   This streamlined version removes on-chain update storage");
  console.log("   to stay under Ethereum's 24KB contract size limit.");
  console.log("");
  console.log("   Updates are now event-based:");
  console.log("   - Creator calls postUpdate(title, ipfsHash, milestoneId)");
  console.log("   - Event emitted: UpdatePosted(milestoneId, title, ipfsHash, timestamp)");
  console.log("   - Frontend reads events and fetches full content from IPFS");
  console.log("");
  console.log("   Benefits:");
  console.log("Contract deploys successfully");
  console.log("Lower gas costs for updates");
  console.log("Better scalability (no storage bloat)");
  console.log("All other functionality preserved");
  console.log("");
  console.log(separator);
}

// Execute deployment
main()
  .then(() => {
    console.log("Deployment script completed successfully");
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error("");
    console.error("❌ DEPLOYMENT FAILED");
    console.error("=" .repeat(70));
    console.error("Error:", error.message);
    console.error("");
    if (error.stack) {
      console.error("Stack trace:");
      console.error(error.stack);
    }
    console.error("");
    console.error("💡 Troubleshooting:");
    console.error("   1. Make sure you're using hardhat.config.optimized.ts");
    console.error("   2. Clean and recompile: npx hardhat clean && npx hardhat compile");
    console.error("   3. Check that contracts/ has Crowdfund-Streamlined.sol");
    console.error("   4. Verify your network has enough ETH for gas");
    console.error("");
    process.exit(1);
  });