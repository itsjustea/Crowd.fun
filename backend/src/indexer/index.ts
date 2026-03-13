// src/indexer/index.ts - Polling-based approach (no event listeners for factory)

import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { FACTORY_ABI, CROWDFUND_ABI } from './abis';

dotenv.config();

const prisma = new PrismaClient();

class PollingIndexer {
  private provider: ethers.JsonRpcProvider;
  private factoryContract: ethers.Contract;
  private campaignContracts: Map<string, ethers.Contract>;
  private factoryAddress: string;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(rpcUrl: string, factoryAddress: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.factoryAddress = factoryAddress;
    
    this.factoryContract = new ethers.Contract(
      factoryAddress,
      FACTORY_ABI,
      this.provider
    );
    
    this.campaignContracts = new Map();
  }

  async start() {
    console.log('Starting polling indexer');
    console.log('');

    // Initial sync
    await this.syncAllCampaigns();

    // Start polling every 15 seconds
    this.startPolling();

    console.log('Indexer active!');
    console.log('Polling every 15 seconds...');
    console.log('');
  }

  private startPolling() {
    console.log('Starting campaign polling (every 15 seconds)');
    console.log('');

    this.pollingInterval = setInterval(async () => {
      try {
        await this.syncAllCampaigns();
      } catch (error) {
        console.error('⚠️  Polling error:', error);
      }
    }, 15000); // Poll every 15 seconds
  }

  private async syncAllCampaigns() {
    try {
      // Get all campaigns from factory
      const campaignAddresses = await this.factoryContract.getAllCampaigns() as string[];
      
      console.log(`Checking ${campaignAddresses.length} campaign(s)...`);

      let newCount = 0;
      let updatedCount = 0;

      for (const campaignAddress of campaignAddresses) {
        const existing = await prisma.campaign.findUnique({
          where: { address: campaignAddress.toLowerCase() },
        });

        if (!existing) {
          // New campaign!
          await this.addNewCampaign(campaignAddress);
          newCount++;
        } else {
          // Update existing campaign
          await this.updateCampaign(campaignAddress);
          updatedCount++;
        }
      }

      if (newCount > 0) {
        console.log(`Found ${newCount} new campaign(s)`);
      }
      if (updatedCount > 0) {
        console.log(`Updated ${updatedCount} campaign(s)`);
      }
      if (newCount === 0 && updatedCount === 0) {
        console.log(`No changes`);
      }
      console.log('');
    } catch (error) {
      console.error('Sync error:', error);
    }
  }

  private async addNewCampaign(campaignAddress: string) {
    try {
      console.log('');
      console.log('NEW CAMPAIGN DETECTED!');
      console.log(`   Address: ${campaignAddress}`);

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
      const nftRewardsEnabled = details[10];

      console.log(`   Name: ${name}`);
      console.log(`   Creator: ${creator}`);
      console.log(`   NFT Rewards: ${nftRewardsEnabled ? 'Yes' : 'No'}`);

      // Get NFT contract address from factory
      let nftContractAddress = null;
      if (nftRewardsEnabled) {
        try {
          nftContractAddress = await this.factoryContract.getNFTContractForCampaign(campaignAddress);
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
          blockNumber: BigInt(0), // Will be updated on first event
          transactionHash: '',    // Will be updated on first event
        },
      });

      console.log('Saved to database');

      // Sync milestones
      await this.syncMilestones(campaignAddress);

      // Start listening to campaign events
      this.listenToCampaign(campaignAddress, name);

      console.log('Now monitoring this campaign');
      
    } catch (error) {
      console.error('Error adding campaign:', error);
    }
  }

  private async updateCampaign(campaignAddress: string) {
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
          totalFundsRaised: details[4].toString(),
          finalized: details[5],
          successful: details[6],
        },
      });

      // Sync milestones
      await this.syncMilestones(campaignAddress);

      // Make sure we're listening to this campaign
      const campaignRecord = await prisma.campaign.findUnique({
        where: { address: campaignAddress.toLowerCase() },
        select: { name: true },
      });

      if (campaignRecord && !this.campaignContracts.has(campaignAddress.toLowerCase())) {
        this.listenToCampaign(campaignAddress, campaignRecord.name);
      }
    } catch (error) {
      // Silently fail for updates
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
    } catch (error) {
      // Silently fail
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
        console.log(`CONTRIBUTION to "${campaignName}"`);
        console.log(`Amount: ${ethers.formatEther(amount)} ETH`);
        console.log(`From: ${contributor}`);
  
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
      } catch (error) {
        console.error('   ❌ Error:', error);
      }
    });

    // Finalization
    campaign.on('CampaignFinalized', async (successful, totalRaised, event) => {
      try {
        console.log(`CAMPAIGN FINALIZED: "${campaignName}"`);
        console.log(`Status: ${successful ? 'SUCCESS' : 'FAILED'}`);
        console.log(`Total: ${ethers.formatEther(totalRaised)} ETH`);

        await prisma.campaign.update({
          where: { address: campaignAddress.toLowerCase() },
          data: {
            finalized: true,
            successful,
            totalFundsRaised: totalRaised.toString(),
          },
        });

        console.log('Status updated');
      } catch (error) {
        console.error('   ❌ Error:', error);
      }
    });

    // Votes
    campaign.on('VoteCast', async (milestoneId, voter, support, event) => {
      try {
        console.log(`VOTE on "${campaignName}"`);
        console.log(`   Milestone: ${milestoneId}`);
        console.log(`   Vote: ${support ? 'FOR' : 'AGAINST'}`);
        
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

        console.log('Vote recorded');
      } catch (error) {
        console.error('   ❌ Error:', error);
      }
    });

    // Updates
    campaign.on('UpdatePosted', async (milestoneId, title, ipfsHash, timestamp, event) => {
      try {
        console.log(`UPDATE on "${campaignName}"`);
        console.log(`   Title: ${title}`);

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

        console.log('Update recorded');
      } catch (error) {
        console.error('   ❌ Error:', error);
      }
    });
  }

  async stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    for (const contract of this.campaignContracts.values()) {
      contract.removeAllListeners();
    }
    
    await prisma.$disconnect();
   
  }
}

async function main() {
  const RPC_URL = process.env.ALCHEMY_API_KEY;
  const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;

  if (!RPC_URL || !FACTORY_ADDRESS) {
    console.error('❌ Missing RPC_URL or FACTORY_ADDRESS');
    process.exit(1);
  }

  console.log('Crowdfund Indexer (Polling Mode)');
  console.log(`Factory: ${FACTORY_ADDRESS}`);
  console.log(`RPC: ${RPC_URL.substring(0, 50)}...`);
  
  const indexer = new PollingIndexer(RPC_URL, FACTORY_ADDRESS);
  await indexer.start();

  const shutdown = async () => {
    await indexer.stop();
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

function safeToNumber(value: bigint): number {
  const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
  
  if (value > MAX_SAFE_INTEGER || value < BigInt(0)) {
    console.warn(`   ⚠️  Vote count overflow: ${value.toString()}, using 0`);
    return 0;
  }
  
  return Number(value);
}