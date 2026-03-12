// src/indexer/sync-existing.ts - Sync all existing campaigns from factory

import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { FACTORY_ABI, CROWDFUND_ABI } from './abis';

const prisma = new PrismaClient();

export async function syncAllExistingCampaigns(
  provider: ethers.Provider,
  factoryAddress: string
) {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📚 Syncing All Existing Campaigns');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // Create factory contract
    const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider);

    // Get all campaign addresses
    console.log('🔍 Fetching all campaigns from factory...');
    const campaignAddresses = await factory.getAllCampaigns();
    
    console.log(`✅ Found ${campaignAddresses.length} campaign(s)`);
    console.log('');

    if (campaignAddresses.length === 0) {
      console.log('💡 No campaigns exist yet - waiting for new ones');
      console.log('');
      return;
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Process each campaign
    for (let i = 0; i < campaignAddresses.length; i++) {
      const address = campaignAddresses[i];
      
      console.log(`[${i + 1}/${campaignAddresses.length}] Processing ${address}...`);

      try {
        // Check if already exists
        const existing = await prisma.campaign.findUnique({
          where: { address: address.toLowerCase() },
        });

        if (existing) {
          console.log(`   ⏭️  Already in database`);
          skipped++;
          continue;
        }

        // Fetch campaign details
        const campaign = new ethers.Contract(address, CROWDFUND_ABI, provider);
        const details = await campaign.getCampaignDetails();

        // details[0] = _name
        // details[1] = _beneficiary
        // details[2] = _fundingCap
        // details[3] = _deadline
        // details[4] = _totalFundsRaised
        // details[5] = _finalized
        // details[6] = _successful
        // details[7] = _creator
        // details[8] = _milestoneCount
        // details[9] = _governanceEnabled

        // Create campaign in database
        const campaignRecord = await prisma.campaign.create({
          data: {
            address: address.toLowerCase(),
            name: details[0],
            beneficiary: details[1].toLowerCase(),
            creator: details[7].toLowerCase(),
            fundingCap: details[2].toString(),
            deadline: new Date(Number(details[3]) * 1000),
            totalFundsRaised: details[4].toString(),
            finalized: details[5],
            successful: details[6],
            governanceEnabled: details[9],
            nftRewardsEnabled: details[11],
            nftContractAddress: details[11] ? await factory.getNFTContractForCampaign(address) : null,
            // nftRewardsEnabled: false, // Not in getCampaignDetails
            blockNumber: BigInt(0),   // Unknown
            transactionHash: '',      // Unknown
          },
        });

        console.log(`   ✅ Saved: ${details[0]}`);

        // Fetch and save milestones
        const milestones = await campaign.getAllMilestones();
        
        for (let j = 0; j < milestones.length; j++) {
            const m = milestones[j];
            const votesFor = safeToNumber(m.votesFor);
            const votesAgainst = safeToNumber(m.votesAgainst);
        

            await prisma.milestone.create({
                data: {
                campaignId: campaignRecord.id,
                milestoneIndex: j,
                description: m.description,
                amount: m.amount.toString(),
                completed: m.completed,
                fundsReleased: m.fundsReleased,
                votesFor: votesFor,
                votesAgainst: votesAgainst,
                },
            });
        }

        if (milestones.length > 0) {
          console.log(`   📋 Added ${milestones.length} milestone(s)`);
        }

        synced++;
        console.log('');

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
        errors++;
        console.log('');
      }
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Sync Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Synced: ${synced}`);
    console.log(`⏭️  Skipped (already exists): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('');

  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  }
}

/**
 * Safely convert BigInt to Number with bounds checking
 */
function safeToNumber(value: bigint): number {
  const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
  
  // If value is too large or negative, return 0
  if (value > MAX_SAFE_INTEGER || value < BigInt(0)) {
    console.warn(`Vote count overflow detected: ${value.toString()}, using 0`);
    return 0;
  }
  
  return Number(value);
}