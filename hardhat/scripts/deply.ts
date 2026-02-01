// scripts/deploy-enhanced.ts
import { ethers } from "hardhat";
import * as fs from "fs";

interface Milestone {
  description: string;
  amount: bigint;
}

interface DeployedAddresses {
  nftContract: string;
  factory: string;
  testCampaign: string;
  network: string;
  deployer: string;
  timestamp: string;
}

async function main(): Promise<void> {
  console.log("🚀 Deploying Enhanced Crowdfunding Platform with Governance & Updates...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // 1. Deploy ProofOfContribution NFT Contract
  console.log("📝 Deploying ProofOfContribution NFT contract...");
  const ProofOfContribution = await ethers.getContractFactory("ProofOfContribution");
  const nftContract = await ProofOfContribution.deploy();
  await nftContract.waitForDeployment();
  
  const nftAddress = await nftContract.getAddress();
  console.log("✅ ProofOfContribution deployed to:", nftAddress);
  console.log("");

  // 2. Deploy CrowdfundFactory with NFT contract address
  console.log("🏭 Deploying CrowdfundFactory Enhanced...");
  const CrowdfundFactory = await ethers.getContractFactory("CrowdfundFactory");
  const factory = await CrowdfundFactory.deploy(nftAddress);
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  console.log("✅ CrowdfundFactory Enhanced deployed to:", factoryAddress);
  console.log("");

  // 3. Authorize factory to mint NFTs
  console.log("🔐 Authorizing factory to mint NFTs...");
  const authorizeTx = await nftContract.transferOwnership(factoryAddress);
  await authorizeTx.wait();
  console.log("✅ Factory authorized to mint NFTs");
  console.log("");

  // 4. Create a test campaign with governance enabled
  console.log("🎯 Creating test campaign with governance...");
  
  const campaignName = "Test Campaign with Governance";
  const beneficiary = deployer.address;
  const duration = 5 * 60; // 30 days in seconds
  const fundingCap = ethers.parseEther("0.01"); // 10 ETH
  
  // Define milestones with proper typing
  const milestones: Milestone[] = [
    {
      description: "Phase 1: Planning and Design",
      amount: ethers.parseEther("0.005")
    },
    {
      description: "Phase 2: Development",
      amount: ethers.parseEther("0.005")
    },
  ];
  
  const createTx = await factory.createCampaign(
    campaignName,
    beneficiary,
    duration,
    fundingCap,
    milestones,
    true,  // enableNFTRewards
    true   // enableGovernance - NEW!
  );
  
  const receipt = await createTx.wait();
  
  // Find CampaignCreated event and extract campaign address
  let campaignAddress = "N/A";
  
  if (receipt && receipt.logs) {
    for (const log of receipt.logs) {
      try {
        const parsed = factory.interface.parseLog({
          topics: [...log.topics],
          data: log.data
        });
        
        if (parsed && parsed.name === 'CampaignCreated') {
          campaignAddress = parsed.args.campaign;
          break;
        }
      } catch (e) {
        // Skip logs that don't match
        continue;
      }
    }
  }
  
  console.log("✅ Test campaign created at:", campaignAddress);
  console.log("   - Governance: ENABLED");
  console.log("   - NFT Rewards: ENABLED");
  console.log("   - Milestones: 3");
  console.log("");

  // Summary
  const separator = "=".repeat(60);
  console.log(separator);
  console.log("📊 DEPLOYMENT SUMMARY");
  console.log(separator);
  console.log("ProofOfContribution NFT:", nftAddress);
  console.log("CrowdfundFactory:       ", factoryAddress);
  console.log("Test Campaign:          ", campaignAddress);
  console.log(separator);
  console.log("");
  
  console.log("🎉 Deployment complete!");
  console.log("");
  console.log("📝 Next steps:");
  console.log("1. Update frontend config with factory address:", factoryAddress);
  console.log("2. Verify contracts on Etherscan (if on testnet/mainnet)");
  console.log("3. Test campaign updates feature");
  console.log("4. Test contributor governance voting");
  console.log("");
  
  // Save addresses to file
  const network = await ethers.provider.getNetwork();
  const addresses: DeployedAddresses = {
    nftContract: nftAddress,
    factory: factoryAddress,
    testCampaign: campaignAddress,
    network: network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };
  
  const outputPath = 'deployed-addresses-enhanced.json';
  fs.writeFileSync(
    outputPath,
    JSON.stringify(addresses, null, 2)
  );
  console.log(`💾 Addresses saved to ${outputPath}`);
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });