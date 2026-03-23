// src/indexer/index.ts - WebSocket Event Listener
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { FACTORY_ABI, CROWDFUND_ABI } from './abis';

dotenv.config();

const prisma = new PrismaClient();

class EventIndexer {
  private provider: ethers.WebSocketProvider;
  private factoryContract: ethers.Contract;
  private campaignContracts: Map<string, ethers.Contract>;
  private factoryAddress: string;

  constructor(wsUrl: string, factoryAddress: string) {
    this.provider = new ethers.WebSocketProvider(wsUrl);
    this.factoryAddress = factoryAddress;
    
    this.factoryContract = new ethers.Contract(
      factoryAddress,
      FACTORY_ABI,
      this.provider
    );
    
    this.campaignContracts = new Map();
    this.provider.on('error', (error: Error) => {
      console.error('❌ Provider error:', error.message);
    });
  }

  

  async start() {
    console.log('🚀 Starting WebSocket Event Indexer');
    console.log('📡 Connecting to blockchain...');
    console.log('');

    try {
      await this.provider.getNetwork();
      console.log('✅ WebSocket connected');
      console.log('');
    } catch (error) {
      console.error('❌ Failed to connect to WebSocket');
      throw error;
    }

    await this.syncExistingCampaigns();

    this.listenToFactoryEvents();

    console.log('✅ Indexer active!');
    console.log('👂 Listening for real-time events...');
    console.log('');
  }

  private async syncExistingCampaigns() {
    try {
      console.log('🔄 Syncing existing campaigns...');
      
      // Get all campaigns from factory
      const campaignAddresses = await this.factoryContract.getAllCampaigns() as string[];
      
      console.log(`📊 Found ${campaignAddresses.length} campaign(s) on-chain`);

      let newCount = 0;
      let existingCount = 0;

      for (const campaignAddress of campaignAddresses) {
        const existing = await prisma.campaign.findUnique({
          where: { address: campaignAddress.toLowerCase() },
        });

        if (!existing) {
          console.log(`      ➕ New campaign - adding to database...`);
          try {
            
            await this.addNewCampaign(campaignAddress);
            newCount++;
            console.log(`      ✅ Added successfully`);
          } catch (error: any) {
            if (error.code === 'P2002') {
              console.log(`      ⚠️  Campaign was just added (race condition) - setting up listener...`);
              const campaign = await prisma.campaign.findUnique({
                where: { address: campaignAddress.toLowerCase() },
              });
              if (campaign) {
                this.listenToCampaign(campaignAddress, campaign.name);
                existingCount++;
              }
            } else {
              console.error(`      ❌ Error adding campaign:`, error.message);
            }
          }
        } else {
          console.log(`      ✓ Already in database - setting up listener...`);
          existingCount++;
          this.listenToCampaign(campaignAddress, existing.name);
        }
      }

      console.log(`✅ Sync complete: ${newCount} new, ${existingCount} existing`);
      console.log('');
    } catch (error) {
      console.error('❌ Sync error:', error);
    }
  }

  private listenToFactoryEvents() {
    console.log('👂 Listening to Factory for new campaigns...');
    
    // Listen for CampaignCreated events in real-time
    this.factoryContract.on(
      'CampaignCreated',
      async (
        campaign: string,
        creator: string,
        nftContract: string,
        fundingCap: bigint,
        deadline: bigint,
        nftRewardsEnabled: boolean,
        governanceEnabled: boolean,
        event: ethers.EventLog
      ) => {
        try {
          console.log('');
          console.log('🎉 NEW CAMPAIGN CREATED EVENT!');
          console.log(`   Campaign: ${campaign}`);
          console.log(`   Creator: ${creator}`);
          console.log(`   Block: ${event.blockNumber}`);
          console.log(`   Tx: ${event.transactionHash}`);

          // Check if already in database
          const existing = await prisma.campaign.findUnique({
            where: { address: campaign.toLowerCase() },
          });

          if (existing) {
            console.log('   ℹ️  Campaign already in database');
            return;
          }

          // Add new campaign immediately
          await this.addNewCampaign(campaign, event.blockNumber, event.transactionHash);
          console.log('');
        } catch (error) {
          console.error('❌ Error handling CampaignCreated event:', error);
        }
      }
    );

    console.log('✅ Factory event listener active');
    console.log('');
  }

  private async addNewCampaign(
    campaignAddress: string,
    blockNumber?: number,
    transactionHash?: string
  ) {
    try {
        console.log('💾 Adding new campaign to database...');
        console.log(`   Address: ${campaignAddress}`);

        const alreadyExists = await prisma.campaign.findUnique({
            where: { address: campaignAddress.toLowerCase() },
        });
        if (alreadyExists) {
            console.log('   ⚠️  Campaign already exists, skipping...');
            return;
        }

        const campaign = new ethers.Contract(
            campaignAddress,
            CROWDFUND_ABI,
            this.provider
        );

      const details = await campaign.getCampaignDetails();

      const name = details[0];
      const beneficiary = details[1];
      const fundingCap = details[2];
      const deadline = details[3];
      const totalFundsRaised = details[4];
      const finalized = details[5];
      const successful = details[6];
      const creator = details[7];
      const governanceEnabled = details[9];
      const updateCount = details[10];
      const nftRewardsEnabled = details[11];

      console.log(`   Name: ${name}`);
      console.log(`   Creator: ${creator}`);
      console.log(`   NFT Rewards: ${nftRewardsEnabled ? 'Yes' : 'No'}`);
      console.log(`   Governance: ${governanceEnabled ? 'Enabled' : 'Disabled'}`);

      // Get NFT contract address
      let nftContractAddress = null;
      if (nftRewardsEnabled) {
        try {
          nftContractAddress = await this.factoryContract.getNFTContractForCampaign(campaignAddress);
          console.log(`   NFT Contract: ${nftContractAddress}`);
        } catch (error) {
          console.warn('   ⚠️  Could not get NFT contract address');
        }
      }

      // Save to database
      await prisma.campaign.create({
        data: {
          address: campaignAddress.toLowerCase(),
          name,
          beneficiary: beneficiary.toLowerCase(),
          creator: creator.toLowerCase(),
          fundingCap: fundingCap.toString(),
          deadline: new Date(Number(deadline) * 1000),
          totalFundsRaised: totalFundsRaised.toString(),
          finalized: Boolean(finalized),
          successful: Boolean(successful),
          governanceEnabled: Boolean(governanceEnabled),
          nftRewardsEnabled: Boolean(nftRewardsEnabled),
          nftContractAddress: nftContractAddress ? nftContractAddress.toLowerCase() : null,
          blockNumber: BigInt(blockNumber || 0),
          transactionHash: transactionHash || '',
        },
      });

      console.log('   ✅ Saved to database');

      // Sync milestones
      await this.syncMilestones(campaignAddress);

      // Start listening to campaign events immediately
      this.listenToCampaign(campaignAddress, name);

      console.log('   👂 Now monitoring campaign events');
      
    } catch (error: any) {
        if (error.code === 'P2002') {
            console.log('   ⚠️  Duplicate detected (race condition), skipping...');
            return;
        }
        console.error('❌ Error adding campaign:', error.message);
    }
  }

  private async syncMilestones(campaignAddress: string) {
    try {
      const campaign = new ethers.Contract(
        campaignAddress,
        CROWDFUND_ABI,
        this.provider
      );

      const milestones = await campaign.getAllMilestones();
      
      if (milestones.length === 0) {
        console.log('   ℹ️  No milestones configured');
        return;
      }

      console.log(`   📍 Syncing ${milestones.length} milestone(s)...`);

      const campaignRecord = await prisma.campaign.findUnique({
        where: { address: campaignAddress.toLowerCase() },
        select: { id: true },
      });

      if (!campaignRecord) return;

      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        await prisma.milestone.upsert({
          where: {
            campaignId_milestoneIndex: {
              campaignId: campaignRecord.id,
              milestoneIndex: i,
            },
          },
          update: {
            completed: m.completed,
            fundsReleased: m.fundsReleased,
            votesFor: safeToNumber(m.votesFor),
            votesAgainst: safeToNumber(m.votesAgainst),
          },
          create: {
            campaignId: campaignRecord.id,
            milestoneIndex: i,
            description: m.description,
            amount: m.amount.toString(),
            completed: m.completed,
            fundsReleased: m.fundsReleased,
            votesFor: safeToNumber(m.votesFor),
            votesAgainst: safeToNumber(m.votesAgainst),
          },
        });
      }

      console.log(`   ✅ Milestones synced`);
    } catch (error) {
      console.warn('   ⚠️  Could not sync milestones:', error);
    }
  }

  private listenToCampaign(campaignAddress: string, campaignName: string) {
    if (this.campaignContracts.has(campaignAddress.toLowerCase())) {
      return; // Already listening
    }

    const campaign = new ethers.Contract(
      campaignAddress,
      CROWDFUND_ABI,
      this.provider
    );

    this.campaignContracts.set(campaignAddress.toLowerCase(), campaign);

    // ContributionReceived Event
    campaign.on('ContributionReceived', async (contributor: string, amount: bigint, event: ethers.EventLog) => {
      try {
        console.log('');
        console.log(`💰 CONTRIBUTION to "${campaignName}"`);
        console.log(`   Amount: ${ethers.formatEther(amount)} ETH`);
        console.log(`   From: ${contributor}`);
        console.log(`   Block: ${event.blockNumber}`);
  
        const campaignRecord = await prisma.campaign.findUnique({
          where: { address: campaignAddress.toLowerCase() },
          select: { id: true },
        });

        if (!campaignRecord) return;

        const block = await this.provider.getBlock(event.blockNumber);

        await prisma.contribution.upsert({
          where: {
            campaignId_contributor: {
              campaignId: campaignRecord.id,
              contributor: contributor.toLowerCase(),
            },
          },
          update: {
            amount: (
              BigInt(
                (await prisma.contribution.findUnique({
                  where: {
                    campaignId_contributor: {
                      campaignId: campaignRecord.id,
                      contributor: contributor.toLowerCase(),
                    },
                  },
                }))?.amount || '0'
              ) + amount
            ).toString(),
          },
          create: {
            campaignId: campaignRecord.id,
            contributor: contributor.toLowerCase(),
            amount: amount.toString(),
            blockNumber: BigInt(event.blockNumber),
            transactionHash: event.transactionHash,
            timestamp: new Date(block!.timestamp * 1000),
          },
        });

        // Update campaign total
        const contributions = await prisma.contribution.findMany({
          where: { campaignId: campaignRecord.id },
        });

        const totalRaised = contributions.reduce(
          (sum: bigint, c: { amount: string }) => sum + BigInt(c.amount),
          BigInt(0)
        );

        await prisma.campaign.update({
          where: { address: campaignAddress.toLowerCase() },
          data: {
            totalFundsRaised: totalRaised.toString(),
            contributorCount: contributions.length,
          },
        });

        console.log('   ✅ Contribution recorded');
      } catch (error) {
        console.error('   ❌ Error:', error);
      }
    });

    // CampaignFinalized Event
    campaign.on('CampaignFinalized', async (successful: boolean, totalRaised: bigint, event: ethers.EventLog) => {
      try {
        console.log('');
        console.log(`🏁 CAMPAIGN FINALIZED: "${campaignName}"`);
        console.log(`   Status: ${successful ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`   Total: ${ethers.formatEther(totalRaised)} ETH`);
        console.log(`   Block: ${event.blockNumber}`);

        await prisma.campaign.update({
          where: { address: campaignAddress.toLowerCase() },
          data: {
            finalized: true,
            successful,
            totalFundsRaised: totalRaised.toString(),
          },
        });

        console.log('   ✅ Status updated');
      } catch (error) {
        console.error('   ❌ Error:', error);
      }
    });

    // VoteCast Event
    campaign.on('VoteCast', async (milestoneId: bigint, voter: string, support: boolean, event: ethers.EventLog) => {
      try {
        console.log('');
        console.log(`🗳️  VOTE on "${campaignName}"`);
        console.log(`   Milestone: ${milestoneId}`);
        console.log(`   Vote: ${support ? '👍 FOR' : '👎 AGAINST'}`);
        console.log(`   Voter: ${voter}`);
        
        const campaignRecord = await prisma.campaign.findUnique({
          where: { address: campaignAddress.toLowerCase() },
          select: { id: true },
        });

        if (!campaignRecord) return;

        const milestone = await prisma.milestone.findUnique({
          where: {
            campaignId_milestoneIndex: {
              campaignId: campaignRecord.id,
              milestoneIndex: Number(milestoneId),
            },
          },
        });

        if (!milestone) return;

        const block = await this.provider.getBlock(event.blockNumber);

        await prisma.milestoneVote.create({
          data: {
            campaignId: campaignRecord.id,
            milestoneId: milestone.id,
            voter: voter.toLowerCase(),
            support,
            blockNumber: BigInt(event.blockNumber),
            transactionHash: event.transactionHash,
            timestamp: new Date(block!.timestamp * 1000),
          },
        });

        if (support) {
          await prisma.milestone.update({
            where: { id: milestone.id },
            data: { votesFor: { increment: 1 } },
          });
        } else {
          await prisma.milestone.update({
            where: { id: milestone.id },
            data: { votesAgainst: { increment: 1 } },
          });
        }

        console.log('   ✅ Vote recorded');
      } catch (error) {
        console.error('   ❌ Error:', error);
      }
    });

    // UpdatePosted Event
    campaign.on('UpdatePosted', async (milestoneId: bigint, title: string, ipfsHash: string, timestamp: bigint, event: ethers.EventLog) => {
      try {
        console.log('');
        console.log(`📝 UPDATE on "${campaignName}"`);
        console.log(`   Title: ${title}`);
        console.log(`   IPFS: ${ipfsHash}`);

        const campaignRecord = await prisma.campaign.findUnique({
          where: { address: campaignAddress.toLowerCase() },
          select: { id: true },
        });

        if (!campaignRecord) return;

        // Check if milestoneId is the "none" value (max uint256)
        const isNoMilestone = milestoneId === BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935');

        await prisma.campaignUpdate.create({
          data: {
            campaignId: campaignRecord.id,
            title,
            ipfsHash,
            milestoneId: isNoMilestone ? null : milestoneId.toString(),
            blockNumber: BigInt(event.blockNumber),
            transactionHash: event.transactionHash,
            timestamp: new Date(Number(timestamp) * 1000),
          },
        });

        console.log('   ✅ Update recorded');
      } catch (error) {
        console.error('   ❌ Error:', error);
      }
    });

    // MilestoneCompleted Event
    campaign.on('MilestoneCompleted', async (milestoneId: bigint, event: ethers.EventLog) => {
      try {
        console.log('');
        console.log(`✅ MILESTONE COMPLETED on "${campaignName}"`);
        console.log(`   Milestone: ${milestoneId}`);

        const campaignRecord = await prisma.campaign.findUnique({
          where: { address: campaignAddress.toLowerCase() },
          select: { id: true },
        });

        if (!campaignRecord) return;

        await prisma.milestone.update({
          where: {
            campaignId_milestoneIndex: {
              campaignId: campaignRecord.id,
              milestoneIndex: Number(milestoneId),
            },
          },
          data: {
            completed: true,
          },
        });

        console.log('   ✅ Milestone marked complete');
      } catch (error) {
        console.error('   ❌ Error:', error);
      }
    });

    // MilestoneFundsReleased Event
    campaign.on('MilestoneFundsReleased', async (milestoneId: bigint, amount: bigint, event: ethers.EventLog) => {
      try {
        console.log('');
        console.log(`💸 MILESTONE FUNDS RELEASED on "${campaignName}"`);
        console.log(`   Milestone: ${milestoneId}`);
        console.log(`   Amount: ${ethers.formatEther(amount)} ETH`);

        const campaignRecord = await prisma.campaign.findUnique({
          where: { address: campaignAddress.toLowerCase() },
          select: { id: true },
        });

        if (!campaignRecord) return;

        await prisma.milestone.update({
          where: {
            campaignId_milestoneIndex: {
              campaignId: campaignRecord.id,
              milestoneIndex: Number(milestoneId),
            },
          },
          data: {
            fundsReleased: true,
          },
        });

        console.log('   ✅ Funds release recorded');
      } catch (error) {
        console.error('   ❌ Error:', error);
      }
    });
  }

  async stop() {
    console.log('Stopping indexer...');
    
    this.factoryContract.removeAllListeners();
    
    for (const contract of this.campaignContracts.values()) {
      contract.removeAllListeners();
    }
    
    await this.provider.destroy();
    await prisma.$disconnect();
    
    console.log('✅ Indexer stopped');
  }
}

async function main() {
  const ALCHEMY_WS_URL = process.env.ALCHEMY_WS_URL; // WebSocket URL
  const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;

  if (!ALCHEMY_WS_URL || !FACTORY_ADDRESS) {
    console.error('❌ Missing ALCHEMY_WS_URL or FACTORY_ADDRESS');
    console.log('');
    console.log('Required environment variables:');
    console.log('  ALCHEMY_WS_URL=wss://arb-sepolia.g.alchemy.com/v2/YOUR_KEY');
    console.log('  NEXT_PUBLIC_FACTORY_ADDRESS=0x...');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════');
  console.log('  Crowdfund WebSocket Event Indexer');
  console.log('═══════════════════════════════════════════');
  console.log(`Factory: ${FACTORY_ADDRESS}`);
  console.log(`WebSocket: ${ALCHEMY_WS_URL.substring(0, 50)}...`);
  console.log('═══════════════════════════════════════════');
  console.log('');
  
  const indexer = new EventIndexer(ALCHEMY_WS_URL, FACTORY_ADDRESS);
  await indexer.start();

  const shutdown = async () => {
    console.log('');
    await indexer.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export async function startIndexer() {
  await main();
}

main().catch(async (error) => {
  console.error('');
  console.error('❌ Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});

// Helper function for safe vote count conversion
function safeToNumber(value: bigint): number {
  const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
  const MAX_REASONABLE_VOTES = BigInt(1000000);
  
  if (value > MAX_SAFE_INTEGER || value < BigInt(0) || value > MAX_REASONABLE_VOTES) {
    return 0; // Uninitialized or overflow
  }
  
  return Number(value);
}