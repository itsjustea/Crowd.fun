// backend/src/indexer/test-factory-events.ts
// Simple test to check if factory events exist at all

import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { FACTORY_ABI } from './abis';

dotenv.config();

async function testFactoryEvents() {
  const RPC_URL = process.env.ALCHEMY_API_KEY!;
  const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS!;

  console.log('');
  console.log('🧪 Testing Factory Events');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Factory: ${FACTORY_ADDRESS}`);
  console.log(`RPC: ${RPC_URL.substring(0, 50)}...`);
  console.log('');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

  // Test 1: Get current block
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Network Connection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const currentBlock = await provider.getBlockNumber();
  const network = await provider.getNetwork();
  console.log(`✅ Connected to chain ${network.chainId}`);
  console.log(`✅ Current block: ${currentBlock}`);
  console.log('');

  // Test 2: Query for ALL events from factory deployment
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Query Historical Events');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Querying for ALL CampaignCreated events from block 0...');
  console.log('   (This may take a minute...)');
  console.log('');

  try {
    const allEvents = await factory.queryFilter(
      'CampaignCreated',
      0,
      currentBlock
    );

    console.log(`✅ Total events found: ${allEvents.length}`);
    console.log('');

    if (allEvents.length > 0) {
      console.log('📋 Last 5 events:');
      const recent = allEvents.slice(-5);
      recent.forEach((event, i) => {
        const eventLog = event as ethers.EventLog;
        console.log(`   [${i + 1}] Block ${event.blockNumber}`);
        console.log(`       Name: ${eventLog.args?.[3] || 'unknown'}`);
        console.log(`       Campaign: ${eventLog.args?.[0] || 'unknown'}`);
        console.log(`       Creator: ${eventLog.args?.[1] || 'unknown'}`);
        console.log(`       NFT Enabled: ${eventLog.args?.[6] ? 'Yes' : 'No'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  NO EVENTS FOUND!');
      console.log('');
      console.log('   This means either:');
      console.log('   1. No campaigns have been created on this factory');
      console.log('   2. Wrong factory address in .env');
      console.log('   3. Event name/signature is wrong in ABI');
      console.log('');
    }
  } catch (error: any) {
    console.error('❌ Query failed:', error.message);
    console.log('');
    console.log('This usually means:');
    console.log('- ABI is incorrect');
    console.log('- Event name is wrong');
    console.log('- Factory address is wrong');
    console.log('');
  }

  // Test 3: Try to get campaign count
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: Factory Functions');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    const count = await factory.getCampaignCount();
    console.log(`✅ Campaign count from factory: ${count.toString()}`);
    
    if (count > 0) {
      const campaigns = await factory.getAllCampaigns();
      console.log(`✅ Campaigns array length: ${campaigns.length}`);
      console.log('');
      console.log('📋 All campaigns in factory:');
      campaigns.forEach((addr: string, i: number) => {
        console.log(`   [${i + 1}] ${addr}`);
      });
      console.log('');
    }
  } catch (error: any) {
    console.error('❌ Function call failed:', error.message);
    console.log('');
  }

  // Test 4: Test event listener
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 4: Event Listener Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let eventReceived = false;

  factory.on('CampaignCreated', (...args) => {
    eventReceived = true;
    console.log('');
    console.log('🎉 EVENT LISTENER TRIGGERED!');
    console.log(`   Campaign: ${args[3]}`);
    console.log(`   Address: ${args[0]}`);
    console.log('');
  });

  const listenerCount = await factory.listenerCount('CampaignCreated');
  console.log(`✅ Event listeners attached: ${listenerCount}`);
  
  if (listenerCount === 0) {
    console.log('❌ WARNING: Listener not attached!');
  } else {
    console.log('✅ Listener is ready');
  }
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📢 NEXT STEPS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('This script will now listen for 60 seconds.');
  console.log('');
  console.log('👉 CREATE A CAMPAIGN NOW in your browser');
  console.log('');
  console.log('If the event listener works, you will see:');
  console.log('   🎉 EVENT LISTENER TRIGGERED!');
  console.log('');
  console.log('If nothing appears after creating a campaign,');
  console.log('the event listener is NOT working.');
  console.log('');
  console.log('Waiting for events...');
  console.log('');

  await new Promise(resolve => setTimeout(resolve, 60000));

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Test Complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  if (eventReceived) {
    console.log('✅ SUCCESS: Event listener is working!');
  } else {
    console.log('❌ FAILED: No events received during test period');
    console.log('');
    console.log('Possible issues:');
    console.log('1. Event listener not working with this RPC provider');
    console.log('2. Polling interval too long');
    console.log('3. Need to use WebSocket instead of HTTPS');
  }
  console.log('');

  process.exit(0);
}

testFactoryEvents().catch((error) => {
  console.error('');
  console.error('❌ Fatal error:', error);
  process.exit(1);
});