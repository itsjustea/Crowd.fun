// src/indexer/indexer.service.ts - EVENT-BASED APPROACH

import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { CROWDFUND_ABI } from './abis';

const prisma = new PrismaClient();

export class EventBasedIndexer {
  private provider: ethers.JsonRpcProvider;
  private factoryAddress: string;
  private factoryContract: ethers.Contract;

  constructor(rpcUrl: string, factoryAddress: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.factoryAddress = factoryAddress;
    this.factoryContract = new ethers.Contract(
      factoryAddress,
      CROWDFUND_ABI,
      this.provider
    );
  }

  /**
   * Index all CampaignCreated events using event filtering
   * This ONLY queries blocks that have events - much more efficient!
   */
  async indexAllCampaigns() {
    console.log('🔍 Querying CampaignCreated events...');

    try {
      // Get deployment block (or use 0)
      const startBlock = await this.getFactoryDeploymentBlock();
      const currentBlock = await this.provider.getBlockNumber();

      console.log(`📊 Scanning from block ${startBlock.toLocaleString()} to ${currentBlock.toLocaleString()}`);
      console.log('⚡ Using event filtering (efficient!)');
      console.log('');

      // Query ALL CampaignCreated events in ONE call
      // Alchemy allows this for events (not eth_getLogs with block range)
      const filter = this.factoryContract.filters.CampaignCreated();
      
      // Split into chunks if needed
      const chunkSize = 10; // Alchemy allows larger ranges for event queries
      let allEvents: ethers.EventLog[] = [];

      for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += chunkSize) {
        const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
        
        console.log(`Querying events from blocks ${fromBlock.toLocaleString()} - ${toBlock.toLocaleString()}...`);
        
        const events = await this.factoryContract.queryFilter(
          filter,
          fromBlock,
          toBlock
        ) as ethers.EventLog[];

        allEvents = allEvents.concat(events);
        
        if (events.length > 0) {
          console.log(`  ✅ Found ${events.length} event(s)`);
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log('');
      console.log(`📊 Total events found: ${allEvents.length}`);
      console.log('');

      // Process each event
      for (const event of allEvents) {
        await this.processCampaignCreatedEvent(event);
      }

      console.log('✅ All campaigns indexed!');
      console.log('');

    } catch (error) {
      console.error('❌ Error querying events:', error);
      throw error;
    }
  }

  /**
   * Get factory deployment block using binary search
   */
  async getFactoryDeploymentBlock(): Promise<number> {
    console.log('🔍 Finding factory deployment block...');
    
    try {
      const code = await this.provider.getCode(this.factoryAddress);
      
      if (code === '0x') {
        throw new Error('Factory contract not found');
      }

      let left = 0;
      let right = await this.provider.getBlockNumber();
      let deploymentBlock = right;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const codeAtBlock = await this.provider.getCode(this.factoryAddress, mid);

        if (codeAtBlock === '0x') {
          left = mid + 1;
        } else {
          deploymentBlock = mid;
          right = mid - 1;
        }
      }

      console.log(`✅ Factory deployed at block: ${deploymentBlock.toLocaleString()}`);
      console.log('');
      return deploymentBlock;
    } catch (error) {
      console.log('⚠️  Could not find deployment block, using 0');
      return 0;
    }
  }

  /**
   * Process CampaignCreated event
   */
  async processCampaignCreatedEvent(event: ethers.EventLog) {
    const {
      campaign,
      creator,
      nftContract,
      name,
      fundingCap,
      deadline,
      nftRewardsEnabled,
      governanceEnabled,
    } = event.args as any;

    // Check if already indexed
    const existing = await prisma.campaign.findUnique({
      where: { address: campaign.toLowerCase() },
    });

    if (existing) {
      console.log(`  ⏭️  Campaign already indexed: ${name}`);
      return;
    }

    // Create campaign
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
        blockNumber: BigInt(event.blockNumber),
        transactionHash: event.transactionHash,
      },
    });

    console.log(`  ✅ Indexed campaign: ${name} (${campaign})`);

    // Index campaign details
    await this.indexCampaignDetails(campaign);
  }

  /**
   * Index campaign details (milestones, etc.)
   */
  async indexCampaignDetails(campaignAddress: string) {
    const campaign = new ethers.Contract(
      campaignAddress,
      CROWDFUND_ABI,
      this.provider
    );

    try {
      const details = await campaign.getCampaignDetails();
      
      await prisma.campaign.update({
        where: { address: campaignAddress.toLowerCase() },
        data: {
          beneficiary: details[1].toLowerCase(),
          totalFundsRaised: details[4].toString(),
          finalized: details[5],
          successful: details[6],
          contributorCount: Number(details[8]),
        },
      });

      const milestones = await campaign.getAllMilestones();
      const campaignRecord = await prisma.campaign.findUnique({
        where: { address: campaignAddress.toLowerCase() },
        select: { id: true },
      });

      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        await prisma.milestone.create({
          data: {
            campaignId: campaignRecord!.id,
            milestoneIndex: i,
            description: m.description,
            amount: m.amount.toString(),
            completed: m.completed,
            fundsReleased: m.fundsReleased,
          },
        });
      }

      console.log(`    📋 Indexed ${milestones.length} milestone(s)`);
    } catch (error) {
      console.error(`    ❌ Error indexing details:`, error);
    }
  }

  /**
   * Watch for new events in real-time
   */
  async watchNewEvents() {
    console.log('👁️  Starting real-time event watcher...');
    console.log('');

    // Watch CampaignCreated
    this.factoryContract.on('CampaignCreated', async (...args) => {
      try {
        const event = args[args.length - 1] as ethers.EventLog;
        console.log(`🆕 New campaign detected! Block: ${event.blockNumber}`);
        await this.processCampaignCreatedEvent(event);
      } catch (error) {
        console.error('Error processing event:', error);
      }
    });

    const campaigns = await prisma.campaign.findMany({
      select: { address: true, name: true },
    });

    console.log(`  👁️  Watching ${campaigns.length} campaign(s) for events`);
    console.log('');
  }
}