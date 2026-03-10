// src/indexer/index.ts - Listener with initial sync

import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { FACTORY_ABI, CROWDFUND_ABI } from './abis';
import { syncAllExistingCampaigns } from './sync-index';

dotenv.config();

const prisma = new PrismaClient();

class RealTimeListener {
  private provider: ethers.JsonRpcProvider;
  private factoryContract: ethers.Contract;
  private campaignContracts: Map<string, ethers.Contract>;
  private factoryAddress: string;

  constructor(rpcUrl: string, factoryAddress: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.provider.pollingInterval = 15000;
    this.factoryAddress = factoryAddress;
    
    this.factoryContract = new ethers.Contract(
      factoryAddress,
      FACTORY_ABI,
      this.provider
    );
    
    this.campaignContracts = new Map();
  }

  async start() {
    console.log('🎧 Starting real-time listener');
    console.log('');

    // STEP 1: Sync all existing campaigns from factory
    await syncAllExistingCampaigns(this.provider, this.factoryAddress);

    // STEP 2: Start listening to existing campaigns
    await this.loadExistingCampaigns();

    // STEP 3: Listen for new campaigns
    this.listenToFactory();

    // Error handling
    this.provider.on('error', (error) => {
      console.error('❌ Provider error:', error.message);
    });

    console.log('✅ Listener active!');
    console.log('📡 Monitoring for new events...');
    console.log('');
  }

  private listenToFactory() {
    console.log('👂 Listening for NEW campaigns...');
    console.log('');

    this.factoryContract.on(
      'CampaignCreated',
      async (campaign, creator, nftContract, name, fundingCap, deadline, nftRewardsEnabled, governanceEnabled, event) => {
        try {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('🆕 NEW CAMPAIGN DETECTED!');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`   Name: ${name}`);
          console.log(`   Address: ${campaign}`);
          console.log(`   Creator: ${creator}`);
          console.log(`   Block: ${event.log.blockNumber}`);
          console.log('');

          // Check if already exists
          const existing = await prisma.campaign.findUnique({
            where: { address: campaign.toLowerCase() },
          });

          if (existing) {
            console.log('   ⏭️  Already in database');
            console.log('');
            return;
          }

          // Save to database
          await prisma.campaign.create({
            data: {
              address: campaign.toLowerCase(),
              name,
              beneficiary: creator.toLowerCase(),
              creator: creator.toLowerCase(),
              fundingCap: fundingCap.toString(),
              deadline: new Date(Number(deadline) * 1000),
              governanceEnabled,
              nftRewardsEnabled,
              nftContractAddress: nftRewardsEnabled ? nftContract.toLowerCase() : null,
              blockNumber: BigInt(event.log.blockNumber),
              transactionHash: event.log.transactionHash,
            },
          });

          console.log('   ✅ Saved to database');

          // Fetch details
          await this.fetchCampaignDetails(campaign);

          // Start listening
          this.listenToCampaign(campaign, name);

          console.log('   ✅ Now monitoring this campaign');
          console.log('');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
        } catch (error) {
          console.error('   ❌ Error:', error);
          console.log('');
        }
      }
    );
  }

  private async fetchCampaignDetails(campaignAddress: string) {
    try {
      const campaign = new ethers.Contract(
        campaignAddress,
        CROWDFUND_ABI,
        this.provider
      );

      const details = await campaign.getCampaignDetails();

      await prisma.campaign.update({
        where: { address: campaignAddress.toLowerCase() },
        data: {
          name: details[0],
          beneficiary: details[1].toLowerCase(),
          fundingCap: details[2].toString(),
          deadline: new Date(Number(details[3]) * 1000),
          totalFundsRaised: details[4].toString(),
          finalized: details[5],
          successful: details[6],
          creator: details[7].toLowerCase(),
          governanceEnabled: details[9],
        },
      });

      const milestones = await campaign.getAllMilestones();
      const campaignRecord = await prisma.campaign.findUnique({
        where: { address: campaignAddress.toLowerCase() },
        select: { id: true },
      });

      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        await prisma.milestone.upsert({
          where: {
            campaignId_milestoneIndex: {
              campaignId: campaignRecord!.id,
              milestoneIndex: i,
            },
          },
          update: {},
          create: {
            campaignId: campaignRecord!.id,
            milestoneIndex: i,
            description: m.description,
            amount: m.amount.toString(),
            completed: m.completed,
            fundsReleased: m.fundsReleased,
            votesFor: Number(m.votesFor),
            votesAgainst: Number(m.votesAgainst),
          },
        });
      }

      console.log(`   📋 Fetched ${milestones.length} milestone(s)`);
    } catch (error) {
      console.error('   ⚠️  Could not fetch details:', error);
    }
  }

  private listenToCampaign(campaignAddress: string, campaignName: string) {
    if (this.campaignContracts.has(campaignAddress.toLowerCase())) {
      return;
    }

    const campaign = new ethers.Contract(
      campaignAddress,
      CROWDFUND_ABI,
      this.provider
    );

    this.campaignContracts.set(campaignAddress.toLowerCase(), campaign);

    // Contribution
    campaign.on('ContributionReceived', async (contributor, amount, event) => {
      try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`💰 CONTRIBUTION to "${campaignName}"`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Amount: ${ethers.formatEther(amount)} ETH`);
        console.log(`   From: ${contributor}`);
        console.log('');

        const campaignRecord = await prisma.campaign.findUnique({
          where: { address: campaignAddress.toLowerCase() },
          select: { id: true },
        });

        if (!campaignRecord) return;

        const block = await this.provider.getBlock(event.log.blockNumber);

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
            blockNumber: BigInt(event.log.blockNumber),
            transactionHash: event.log.transactionHash,
            timestamp: new Date(block!.timestamp * 1000),
          },
        });

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
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
      } catch (error) {
        console.error('   ❌ Error:', error);
      }
    });

    // Finalization
    campaign.on('CampaignFinalized', async (successful, totalRaised, event) => {
      try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🏁 CAMPAIGN FINALIZED: "${campaignName}"`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Status: ${successful ? 'SUCCESS ✅' : 'FAILED ❌'}`);
        console.log(`   Total: ${ethers.formatEther(totalRaised)} ETH`);
        console.log('');

        await prisma.campaign.update({
          where: { address: campaignAddress.toLowerCase() },
          data: {
            finalized: true,
            successful,
            totalFundsRaised: totalRaised.toString(),
          },
        });

        console.log('   ✅ Status updated');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
      } catch (error) {
        console.error('   ❌ Error:', error);
      }
    });

    // Votes
    campaign.on('VoteCast', async (milestoneId, voter, support, event) => {
      try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🗳️  VOTE on "${campaignName}"`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Milestone: ${milestoneId}`);
        console.log(`   Vote: ${support ? 'FOR ✅' : 'AGAINST ❌'}`);
        console.log('');

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

        const block = await this.provider.getBlock(event.log.blockNumber);

        await prisma.milestoneVote.create({
          data: {
            campaignId: campaignRecord.id,
            milestoneId: milestone.id,
            voter: voter.toLowerCase(),
            support,
            blockNumber: BigInt(event.log.blockNumber),
            transactionHash: event.log.transactionHash,
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
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
      } catch (error) {
        console.error('   ❌ Error:', error);
      }
    });

    // Updates
    campaign.on('UpdatePosted', async (milestoneId, title, ipfsHash, timestamp, event) => {
      try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📢 UPDATE on "${campaignName}"`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Title: ${title}`);
        console.log('');

        const campaignRecord = await prisma.campaign.findUnique({
          where: { address: campaignAddress.toLowerCase() },
          select: { id: true },
        });

        if (!campaignRecord) return;

        await prisma.campaignUpdate.create({
          data: {
            campaignId: campaignRecord.id,
            title,
            ipfsHash,
            milestoneId: milestoneId === BigInt(Number.MAX_SAFE_INTEGER) ? null : milestoneId.toString(),
            blockNumber: BigInt(event.log.blockNumber),
            transactionHash: event.log.transactionHash,
            timestamp: new Date(Number(timestamp) * 1000),
          },
        });

        console.log('   ✅ Update recorded');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
      } catch (error) {
        console.error('   ❌ Error:', error);
      }
    });
  }

  private async loadExistingCampaigns() {
    try {
      const campaigns = await prisma.campaign.findMany({
        select: { address: true, name: true },
      });

      if (campaigns.length > 0) {
        console.log(`👂 Setting up listeners for ${campaigns.length} campaign(s)...`);
        for (const c of campaigns) {
          this.listenToCampaign(c.address, c.name);
        }
        console.log(`✅ Monitoring ${campaigns.length} campaign(s)`);
        console.log('');
      }
    } catch (error) {
      console.warn('⚠️  Could not load campaigns:', error);
    }
  }

  async stop() {
    console.log('');
    console.log('🛑 Stopping listener...');
    this.factoryContract.removeAllListeners();
    for (const contract of this.campaignContracts.values()) {
      contract.removeAllListeners();
    }
    await prisma.$disconnect();
    console.log('✅ Stopped');
  }
}

async function main() {
  const RPC_URL = process.env.ALCHEMY_API_KEY;
  const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;

  if (!RPC_URL || !FACTORY_ADDRESS) {
    console.error('❌ Missing RPC_URL or FACTORY_ADDRESS');
    process.exit(1);
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Crowdfund Indexer');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`📍 Factory: ${FACTORY_ADDRESS}`);
  console.log(`🌐 RPC: ${RPC_URL.substring(0, 50)}...`);
  console.log('');

  const listener = new RealTimeListener(RPC_URL, FACTORY_ADDRESS);
  await listener.start();

  const shutdown = async () => {
    await listener.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(async (error) => {
  console.error('');
  console.error('❌ Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});