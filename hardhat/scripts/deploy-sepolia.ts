import { ethers } from "hardhat";

async function main() {
  console.log("Starting deployment to Sepolia...");
  console.log("=".repeat(50));

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    console.error("⚠️  Warning: Low balance! Get more test ETH from faucet.");
  }

  console.log("=".repeat(50));

  // Deploy CrowdfundFactory
  console.log("\n📦 Deploying CrowdfundFactory...");
  const CrowdfundFactory = await ethers.getContractFactory("CrowdfundFactory");
  const factory = await CrowdfundFactory.deploy();
  
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("✅ CrowdfundFactory deployed to:", factoryAddress);

  // Wait for block confirmations
  console.log("\n⏳ Waiting for 5 block confirmations...");
  const deployTx = factory.deploymentTransaction();
  if (deployTx) {
    await deployTx.wait(5);
    console.log("✅ Confirmed!");
  }

  console.log("\n" + "=".repeat(50));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(50));
  console.log("Network:", "Sepolia");
  console.log("Factory Address:", factoryAddress);
  console.log("Deployer:", deployer.address);
  console.log("Block Explorer:", `https://sepolia.etherscan.io/address/${factoryAddress}`);
  console.log("=".repeat(50));

  // Optional: Create a sample campaign
  console.log("\n🎯 Creating sample campaign for testing...");
  try {
    const tx = await factory.createCampaign(
      "Sample Campaign -  Sepolia",
      deployer.address,
      7 * 24 * 60 * 60, // 7 days
      ethers.parseEther("1") // 1 ETH goal
    );

    const receipt = await tx.wait();
    console.log("✅ Sample campaign created!");
    
    const campaigns = await factory.getAllCampaigns();
    console.log("Sample Campaign Address:", campaigns[0]);
  } catch (error) {
    console.log("⚠️  Sample campaign creation skipped");
  }

  console.log("\n" + "=".repeat(50));
  console.log("🔍 VERIFICATION");
  console.log("=".repeat(50));
  console.log("To verify the contract, run:");
  console.log(`npx hardhat verify --network sepolia ${factoryAddress}`);
  console.log("=".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });