// src/indexer/real-time-listener.ts
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { FACTORY_ABI,CROWDFUND_ABI } from './abis';

const prisma = new PrismaClient();

export class RealTimeEventListener {
  private provider: ethers.WebSocketProvider | ethers.JsonRpcProvider;
  private factoryAddress: string;
  private factoryContract: ethers.Contract;
  private campaignContracts: Map<string, ethers.Contract>;

  constructor(rpcUrl: string, factoryAddress: string) {
    // Use WebSocket if available, otherwise fall back to polling
    if (rpcUrl.startsWith('wss://') || rpcUrl.startsWith('ws://')) {
      this.provider = new ethers.WebSocketProvider(rpcUrl);
      console.log('📡 Using WebSocket provider (real-time)');
    } else {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      (this.provider as ethers.JsonRpcProvider).pollingInterval = 15000; // 15 seconds
      console.log('📡 Using HTTP provider with polling (15s interval)');
    }

    this.factoryAddress = factoryAddress;
    this.factoryContract = new ethers.Contract(
      factoryAddress,
      CROWDFUND_ABI,
      this.provider
    );
    this.campaignContracts = new Map();
  }

  /**
   * Start listening to all events
   */
  async startListening() {
    console.log('🎧 Starting real-time event listener...');
    console.log(`📍 Factory: ${this.factoryAddress}`);
    console.log('');

    // Listen to CampaignCreated events
    this.listenToFactoryEvents();

    // Load and listen to existing campaigns
    await this.loadExistingCampaigns();

    // Handle provider errors
    this.provider.on('error', (error) => {
      console.error('❌ Provider error:', error);
    });

    console.log('✅ Event listener active!');
    console.log('');
  }

  /**
   * Listen to factory events (new campaigns)
   */
  private listenToFactoryEvents() {
    console.log('👂 Listening for new campaigns...');

    this.factoryContract.on(
      'CampaignCreated',
      async (
        campaign,
        creator,
        nftContract,
        name,
        fundingCap,
        deadline,
        nftRewardsEnabled,
        governanceEnabled,
        event
      ) => {
        try {
          console.log('');
          console.log(`🆕 NEW CAMPAIGN DETECTED!`);
          console.log(`   Name: ${name}`);
          console.log(`   Address: ${campaign}`);
          console.log(`   Creator: ${creator}`);
          console.log(`   Block: ${event.log.blockNumber}`);

          await this.processCampaignCreated(
            campaign,
            creator,
            nftContract,
            name,
            fundingCap,
            deadline,
            nftRewardsEnabled,
            governanceEnabled,
            event
          );

          // Start listening to this campaign's events
          this.listenToCampaignEvents(campaign, name);

          console.log(`   ✅ Campaign indexed and monitoring started`);
          console.log('');
        } catch (error) {
          console.error(`   ❌ Error processing campaign:`, error);
          console.log('');
        }
      }
    );
  }

  /**
   * Process CampaignCreated event
   */
  private async processCampaignCreated(
    campaignAddress: string,
    creator: string,
    nftContract: string,
    name: string,
    fundingCap: bigint,
    deadline: bigint,
    nftRewardsEnabled: boolean,
    governanceEnabled: boolean,
    event: any
  ) {
    // Check if already exists
    const existing = await prisma.campaign.findUnique({
      where: { address: campaignAddress.toLowerCase() },
    });

    if (existing) {
      console.log(`   ⏭️  Campaign already in database`);
      return;
    }

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        address: campaignAddress.toLowerCase(),
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

    // Fetch and index campaign details
    await this.indexCampaignDetails(campaignAddress);

    return campaign;
  }

  /**
   * Index campaign details from contract
   */
  private async indexCampaignDetails(campaignAddress: string) {
    const campaignContract = new ethers.Contract(
      campaignAddress,
      CROWDFUND_ABI,
      this.provider
    );

    try {
      const details = await campaignContract.getCampaignDetails();

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

      // Index milestones
      const milestones = await campaignContract.getAllMilestones();
      const campaign = await prisma.campaign.findUnique({
        where: { address: campaignAddress.toLowerCase() },
        select: { id: true },
      });

      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        await prisma.milestone.upsert({
          where: {
            campaignId_milestoneIndex: {
              campaignId: campaign!.id,
              milestoneIndex: i,
            },
          },
          update: {},
          create: {
            campaignId: campaign!.id,
            milestoneIndex: i,
            description: m.description,
            amount: m.amount.toString(),
            completed: m.completed,
            fundsReleased: m.fundsReleased,
          },
        });
      }

      console.log(`   📋 Indexed ${milestones.length} milestone(s)`);
    } catch (error) {
      console.error(`   ⚠️  Error fetching campaign details:`, error);
    }
  }

  /**
   * Listen to events for a specific campaign
   */
  private listenToCampaignEvents(campaignAddress: string, campaignName: string) {
    // Don't listen twice
    if (this.campaignContracts.has(campaignAddress.toLowerCase())) {
      return;
    }

    const campaignContract = new ethers.Contract(
      campaignAddress,
      CROWDFUND_ABI,
      this.provider
    );

    this.campaignContracts.set(campaignAddress.toLowerCase(), campaignContract);

    // Listen to ContributionReceived
    campaignContract.on(
      'ContributionReceived',
      async (contributor: string, amount: bigint, event: any) => {
        try {
          console.log('');
          console.log(`💰 CONTRIBUTION to "${campaignName}"`);
          console.log(`   Amount: ${ethers.formatEther(amount)} ETH`);
          console.log(`   From: ${contributor}`);
          console.log(`   Block: ${event.log.blockNumber}`);

          await this.processContribution(
            campaignAddress,
            contributor,
            amount,
            event
          );

          console.log(`   ✅ Contribution recorded`);
          console.log('');
        } catch (error) {
          console.error(`   ❌ Error processing contribution:`, error);
        }
      }
    );

    // Listen to CampaignFinalized
    campaignContract.on(
      'CampaignFinalized',
      async (successful: boolean, totalRaised: bigint, event: any) => {
        try {
          console.log('');
          console.log(`🏁 CAMPAIGN FINALIZED: "${campaignName}"`);
          console.log(`   Status: ${successful ? 'SUCCESS ✅' : 'FAILED ❌'}`);
          console.log(`   Total Raised: ${ethers.formatEther(totalRaised)} ETH`);

          await prisma.campaign.update({
            where: { address: campaignAddress.toLowerCase() },
            data: {
              finalized: true,
              successful,
              totalFundsRaised: totalRaised.toString(),
            },
          });

          console.log(`   ✅ Status updated`);
          console.log('');
        } catch (error) {
          console.error(`   ❌ Error processing finalization:`, error);
        }
      }
    );

    // Listen to VoteCast
    campaignContract.on(
      'VoteCast',
      async (milestoneId: bigint, voter: string, support: boolean, event: any) => {
        try {
          console.log('');
          console.log(`🗳️  VOTE CAST on "${campaignName}"`);
          console.log(`   Milestone: ${milestoneId}`);
          console.log(`   Voter: ${voter}`);
          console.log(`   Vote: ${support ? 'FOR ✅' : 'AGAINST ❌'}`);

          await this.processVote(
            campaignAddress,
            milestoneId,
            voter,
            support,
            event
          );

          console.log(`   ✅ Vote recorded`);
          console.log('');
        } catch (error) {
          console.error(`   ❌ Error processing vote:`, error);
        }
      }
    );

    // Listen to UpdatePosted
    campaignContract.on(
      'UpdatePosted',
      async (
        milestoneId: bigint,
        title: string,
        ipfsHash: string,
        timestamp: bigint,
        event: any
      ) => {
        try {
          console.log('');
          console.log(`📢 UPDATE POSTED on "${campaignName}"`);
          console.log(`   Title: ${title}`);
          console.log(`   IPFS: ${ipfsHash}`);

          await this.processUpdate(
            campaignAddress,
            milestoneId,
            title,
            ipfsHash,
            timestamp,
            event
          );

          console.log(`   ✅ Update recorded`);
          console.log('');
        } catch (error) {
          console.error(`   ❌ Error processing update:`, error);
        }
      }
    );
  }

  /**
   * Process contribution event
   */
  private async processContribution(
    campaignAddress: string,
    contributor: string,
    amount: bigint,
    event: any
  ) {
    const campaign = await prisma.campaign.findUnique({
      where: { address: campaignAddress.toLowerCase() },
      select: { id: true },
    });

    if (!campaign) return;

    const block = await this.provider.getBlock(event.log.blockNumber);

    await prisma.contribution.upsert({
      where: {
        campaignId_contributor: {
          campaignId: campaign.id,
          contributor: contributor.toLowerCase(),
        },
      },
      update: {
        amount: (
          BigInt(
            (
              await prisma.contribution.findUnique({
                where: {
                  campaignId_contributor: {
                    campaignId: campaign.id,
                    contributor: contributor.toLowerCase(),
                  },
                },
              })
            )?.amount || '0'
          ) + amount
        ).toString(),
      },
      create: {
        campaignId: campaign.id,
        contributor: contributor.toLowerCase(),
        amount: amount.toString(),
        blockNumber: BigInt(event.log.blockNumber),
        transactionHash: event.log.transactionHash,
        timestamp: new Date(block!.timestamp * 1000),
      },
    });

    // Update campaign stats
    await this.updateCampaignStats(campaignAddress);
  }

  /**
   * Process vote event
   */
  private async processVote(
    campaignAddress: string,
    milestoneIdBN: bigint,
    voter: string,
    support: boolean,
    event: any
  ) {
    const campaign = await prisma.campaign.findUnique({
      where: { address: campaignAddress.toLowerCase() },
      select: { id: true },
    });

    if (!campaign) return;

    const milestone = await prisma.milestone.findUnique({
      where: {
        campaignId_milestoneIndex: {
          campaignId: campaign.id,
          milestoneIndex: Number(milestoneIdBN),
        },
      },
    });

    if (!milestone) return;

    const block = await this.provider.getBlock(event.log.blockNumber);

    await prisma.milestoneVote.create({
      data: {
        campaignId: campaign.id,
        milestoneId: milestone.id,
        voter: voter.toLowerCase(),
        support,
        blockNumber: BigInt(event.log.blockNumber),
        transactionHash: event.log.transactionHash,
        timestamp: new Date(block!.timestamp * 1000),
      },
    });

    // Update vote counts
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
  }

  /**
   * Process update event
   */
  private async processUpdate(
    campaignAddress: string,
    milestoneIdBN: bigint,
    title: string,
    ipfsHash: string,
    timestampBN: bigint,
    event: any
  ) {
    const campaign = await prisma.campaign.findUnique({
      where: { address: campaignAddress.toLowerCase() },
      select: { id: true },
    });

    if (!campaign) return;

    await prisma.campaignUpdate.create({
      data: {
        campaignId: campaign.id,
        title,
        ipfsHash,
        milestoneId:
          milestoneIdBN === BigInt(Number.MAX_SAFE_INTEGER)
            ? null
            : milestoneIdBN.toString(),
        blockNumber: BigInt(event.log.blockNumber),
        transactionHash: event.log.transactionHash,
        timestamp: new Date(Number(timestampBN) * 1000),
      },
    });
  }

  /**
   * Update campaign statistics
   */
  private async updateCampaignStats(campaignAddress: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { address: campaignAddress.toLowerCase() },
      select: { id: true },
    });

    if (!campaign) return;

    const contributions = await prisma.contribution.findMany({
      where: { campaignId: campaign.id },
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
  }

  /**
   * Load existing campaigns and start listening
   */
  private async loadExistingCampaigns() {
    try {
      const campaigns = await prisma.campaign.findMany({
        select: { address: true, name: true },
      });

      console.log(`📚 Loading ${campaigns.length} existing campaign(s)...`);

      for (const campaign of campaigns) {
        this.listenToCampaignEvents(campaign.address, campaign.name);
      }

      console.log(`✅ Now monitoring ${campaigns.length} campaign(s)`);
      console.log('');
    } catch (error) {
      console.warn('⚠️  Could not load existing campaigns:', error);
    }
  }

  /**
   * Stop listening to all events
   */
  async stop() {
    console.log('🛑 Stopping event listener...');

    // Remove all listeners
    this.factoryContract.removeAllListeners();

    for (const contract of this.campaignContracts.values()) {
      contract.removeAllListeners();
    }

    // Close provider if WebSocket
    if (this.provider instanceof ethers.WebSocketProvider) {
      await this.provider.destroy();
    }

    console.log('✅ Event listener stopped');
  }
}