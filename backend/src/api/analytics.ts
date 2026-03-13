// backend/src/api/analytics.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * Helper function to serialize BigInt and Date fields for JSON
 */
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const key in obj) {
      serialized[key] = serializeBigInt(obj[key]);
    }
    return serialized;
  }
  
  return obj;
}

/**
 * GET /api/analytics/platform
 * Get comprehensive platform-wide analytics
 */
router.get('/platform', async (req, res) => {
  try {
    // Get all campaigns
    const allCampaigns = await prisma.campaign.findMany({
      select: {
        totalFundsRaised: true,
        successful: true,
        finalized: true,
        deadline: true,
      },
    });

    // Total campaigns
    const totalCampaigns = allCampaigns.length;

    // Total ETH raised
    const totalRaised = allCampaigns.reduce(
      (sum: bigint, c: { totalFundsRaised: string }) => sum + BigInt(c.totalFundsRaised),
      BigInt(0)
    );

    // Active campaigns (not finalized, deadline in future)
    const now = new Date();
    const activeCampaigns = allCampaigns.filter(
      (c: { finalized: boolean; deadline: Date }) => !c.finalized && c.deadline > now
    ).length;

    // Successful campaigns
    const successfulCampaigns = allCampaigns.filter((c: { successful: boolean }) => c.successful).length;
    
    // Success rate
    const successRate = totalCampaigns > 0 
      ? ((successfulCampaigns / totalCampaigns) * 100).toFixed(2)
      : '0';

    // Get unique contributors
    const uniqueContributors = await prisma.contribution.groupBy({
      by: ['contributor'],
    });
    const totalContributors = uniqueContributors.length;

    // Total contributions (transactions)
    const totalContributions = await prisma.contribution.count();

    // Average contribution
    const avgContribution = totalContributions > 0
      ? totalRaised / BigInt(totalContributions)
      : BigInt(0);

    res.json({
      totalCampaigns,
      activeCampaigns,
      successfulCampaigns,
      totalRaised: totalRaised.toString(),
      totalContributors,
      totalContributions,
      avgContribution: avgContribution.toString(),
      successRate: parseFloat(successRate),
    });
  } catch (error) {
    console.error('Error fetching platform analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/top-campaigns
 * Get top campaigns by total raised (successful campaigns only)
 */
router.get('/top-campaigns', async (req, res) => {
  try {
    const { limit = '10', filter = 'raised' } = req.query;

    // For 'raised' filter, we need to sort manually since totalFundsRaised is a String
    if (filter === 'raised') {
      const campaigns = await prisma.campaign.findMany({
        where: {
          successful: true,
        },
        select: {
          address: true,
          name: true,
          creator: true,
          totalFundsRaised: true,
          fundingCap: true,
          contributorCount: true,
          successful: true,
          finalized: true,
          createdAt: true,
        },
      });

      // Sort manually by totalFundsRaised
      const sorted = campaigns.sort((a: { totalFundsRaised: string }, b: { totalFundsRaised: string }) => {
        const aRaised = BigInt(a.totalFundsRaised);
        const bRaised = BigInt(b.totalFundsRaised);
        if (aRaised > bRaised) return -1;
        if (aRaised < bRaised) return 1;
        return 0;
      });

      const topCampaigns = sorted.slice(0, parseInt(limit as string));
      const serialized = serializeBigInt(topCampaigns);

      return res.json({ campaigns: serialized });
    }

    // For other filters, use database ordering
    let orderBy: any = {};
    if (filter === 'contributors') {
      orderBy = { contributorCount: 'desc' };
    } else if (filter === 'recent') {
      orderBy = { createdAt: 'desc' };
    }

    const topCampaigns = await prisma.campaign.findMany({
      where: {
        successful: true,
      },
      orderBy,
      take: parseInt(limit as string),
      select: {
        address: true,
        name: true,
        creator: true,
        totalFundsRaised: true,
        fundingCap: true,
        contributorCount: true,
        successful: true,
        finalized: true,
        createdAt: true,
      },
    });

    const serialized = serializeBigInt(topCampaigns);

    res.json({ campaigns: serialized });
  } catch (error) {
    console.error('Error fetching top campaigns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/top-contributors
 * Get top contributors by total amount contributed
 */
router.get('/top-contributors', async (req, res) => {
  try {
    const { limit = '5' } = req.query;

    // Get all contributions
    const contributions = await prisma.contribution.findMany({
      select: {
        contributor: true,
        amount: true,
      },
    });

    // Group manually
    const contributorMap = new Map<string, { total: bigint; count: number }>();

    contributions.forEach((c: { contributor: string; amount: string }) => {
      const existing = contributorMap.get(c.contributor) || { total: BigInt(0), count: 0 };
      contributorMap.set(c.contributor, {
        total: existing.total + BigInt(c.amount),
        count: existing.count + 1,
      });
    });

    // Sort and format
    const topContributors = Array.from(contributorMap.entries())
      .map(([address, data]) => ({
        address,
        totalContributed: data.total.toString(),
        campaignsSupported: data.count,
      }))
      .sort((a, b) => {
        const aTotal = BigInt(a.totalContributed);
        const bTotal = BigInt(b.totalContributed);
        if (aTotal > bTotal) return -1;
        if (aTotal < bTotal) return 1;
        return 0;
      })
      .slice(0, parseInt(limit as string));

    res.json({ contributors: topContributors });
  } catch (error) {
    console.error('Error fetching top contributors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/timeline
 * Get campaign creation and funding timeline
 */
router.get('/timeline', async (req, res) => {
  try {
    const { days = '30' } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days as string));

    // Get campaigns created in the last X days
    const campaigns = await prisma.campaign.findMany({
      where: {
        createdAt: {
          gte: daysAgo,
        },
      },
      select: {
        createdAt: true,
      },
    });

    // Get contributions in the last X days
    const contributions = await prisma.contribution.findMany({
      where: {
        timestamp: {
          gte: daysAgo,
        },
      },
      select: {
        timestamp: true,
        amount: true,
      },
    });

    // Group by day
    const timelineData: Record<string, { date: string; campaigns: number; contributions: number; totalRaised: string }> = {};

    // Process campaigns
    campaigns.forEach((c: { createdAt: Date }) => {
      const dateKey = c.createdAt.toISOString().split('T')[0];
      if (!timelineData[dateKey]) {
        timelineData[dateKey] = {
          date: dateKey,
          campaigns: 0,
          contributions: 0,
          totalRaised: '0',
        };
      }
      timelineData[dateKey].campaigns += 1;
    });

    // Process contributions
    contributions.forEach((c: { timestamp: Date; amount: string }) => {
      const dateKey = c.timestamp.toISOString().split('T')[0];
      if (!timelineData[dateKey]) {
        timelineData[dateKey] = {
          date: dateKey,
          campaigns: 0,
          contributions: 0,
          totalRaised: '0',
        };
      }
      timelineData[dateKey].contributions += 1;
      timelineData[dateKey].totalRaised = (
        BigInt(timelineData[dateKey].totalRaised) + BigInt(c.amount)
      ).toString();
    });

    // Convert to array and sort by date
    const timeline = Object.values(timelineData).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    res.json({ timeline });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/categories
 * Get statistics by campaign category (governance enabled, NFT enabled)
 */
router.get('/categories', async (req, res) => {
  try {
    // Campaigns with governance
    const governanceCampaigns = await prisma.campaign.findMany({
      where: { governanceEnabled: true },
      select: { totalFundsRaised: true },
    });

    const governanceRaised = governanceCampaigns.reduce(
      (sum: bigint, c: { totalFundsRaised: string }) => sum + BigInt(c.totalFundsRaised),
      BigInt(0)
    );

    // Campaigns with NFT rewards
    const nftCampaigns = await prisma.campaign.findMany({
      where: { nftRewardsEnabled: true },
      select: { totalFundsRaised: true },
    });

    const nftRaised = nftCampaigns.reduce(
      (sum: bigint, c: { totalFundsRaised: string }) => sum + BigInt(c.totalFundsRaised),
      BigInt(0)
    );

    // Regular campaigns
    const regularCampaignsData = await prisma.campaign.findMany({
      where: {
        governanceEnabled: false,
        nftRewardsEnabled: false,
      },
      select: { totalFundsRaised: true },
    });

    const regularRaised = regularCampaignsData.reduce(
      (sum: bigint, c: { totalFundsRaised: string }) => sum + BigInt(c.totalFundsRaised),
      BigInt(0)
    );

    res.json({
      governance: {
        count: governanceCampaigns.length,
        totalRaised: governanceRaised.toString(),
      },
      nft: {
        count: nftCampaigns.length,
        totalRaised: nftRaised.toString(),
      },
      regular: {
        count: regularCampaignsData.length,
        totalRaised: regularRaised.toString(),
      },
    });
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;