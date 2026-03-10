// src/api/routes.ts
import { Router } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * Helper function to serialize BigInt fields to strings for JSON
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

// ==================== CAMPAIGNS ====================

/**
 * GET /api/campaigns
 * Get all campaigns with optional filters
 */
router.get('/campaigns', async (req, res) => {
  try {
    const {
      status, // 'active', 'successful', 'failed', 'ended'
      creator,
      limit = '50',
      offset = '0',
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    const where: any = {};

    // Status filters
    if (status === 'active') {
      where.finalized = false;
      where.deadline = { gte: new Date() };
    } else if (status === 'successful') {
      where.successful = true;
    } else if (status === 'failed') {
      where.finalized = true;
      where.successful = false;
    } else if (status === 'ended') {
      where.OR = [
        { finalized: true },
        { deadline: { lt: new Date() } },
      ];
    }

    // Creator filter
    if (creator) {
      where.creator = creator;
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          milestones: true,
          _count: {
            select: {
              contributions: true,
              updates: true,
            },
          },
        },
        orderBy: { [sortBy as string]: order },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.campaign.count({ where }),
    ]);

    // Serialize BigInt fields
    const serialized = serializeBigInt(campaigns);

    res.json({
      campaigns: serialized,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/campaigns/:address
 * Get single campaign with all details
 */
router.get('/campaigns/:address', async (req, res) => {
  try {
    const { address } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { address },
      include: {
        milestones: {
          include: {
            votes: true,
          },
        },
        contributions: {
          orderBy: { timestamp: 'desc' },
        },
        updates: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Serialize BigInt fields
    const serialized = serializeBigInt(campaign);

    res.json(serialized);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/campaigns/:address/contributors
 * Get all contributors for a campaign
 */
router.get('/campaigns/:address/contributors', async (req, res) => {
  try {
    const { address } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { address },
      select: { id: true },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const contributors = await prisma.contribution.findMany({
      where: { campaignId: campaign.id },
      orderBy: { amount: 'desc' },
    });

    // Serialize BigInt fields
    const serialized = serializeBigInt(contributors);

    res.json(serialized);
  } catch (error) {
    console.error('Error fetching contributors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== USER ====================

/**
 * GET /api/users/:address/campaigns
 * Get all campaigns created by a user
 */
router.get('/users/:address/campaigns', async (req, res) => {
  try {
    const { address } = req.params;

    const campaigns = await prisma.campaign.findMany({
      where: { creator: address.toLowerCase() },
      include: {
        milestones: true,
        _count: {
          select: {
            contributions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Serialize BigInt fields
    const serialized = serializeBigInt(campaigns);

    res.json(serialized);
  } catch (error) {
    console.error('Error fetching user campaigns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/:address/contributions
 * Get all contributions by a user
 */
router.get('/users/:address/contributions', async (req, res) => {
  try {
    const { address } = req.params;

    const contributions = await prisma.contribution.findMany({
      where: { contributor: address.toLowerCase() },
      include: {
        campaign: {
          select: {
            address: true,
            name: true,
            finalized: true,
            successful: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Serialize BigInt fields
    const serialized = serializeBigInt(contributions);

    res.json(serialized);
  } catch (error) {
    console.error('Error fetching user contributions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== ANALYTICS ====================

/**
 * GET /api/analytics/overview
 * Get platform-wide statistics
 */
router.get('/analytics/overview', async (req, res) => {
  try {
    const [
      totalCampaigns,
      activeCampaigns,
      successfulCampaigns,
      allCampaigns,
      totalContributions,
    ] = await Promise.all([
      prisma.campaign.count(),
      prisma.campaign.count({
        where: {
          finalized: false,
          deadline: { gte: new Date() },
        },
      }),
      prisma.campaign.count({
        where: { successful: true },
      }),
      prisma.campaign.findMany(),
      prisma.contribution.count(),
    ]);

    const totalRaised = allCampaigns.reduce(
      (sum: bigint, c: { totalFundsRaised: bigint | number | string }) =>
        sum + BigInt(c.totalFundsRaised),
      BigInt(0)
    );

    const uniqueContributors = await prisma.contribution.groupBy({
      by: ['contributor'],
    });

    res.json({
      totalCampaigns,
      activeCampaigns,
      successfulCampaigns,
      failedCampaigns: totalCampaigns - activeCampaigns - successfulCampaigns,
      totalRaised: totalRaised.toString(),
      totalContributions,
      uniqueContributors: uniqueContributors.length,
      successRate:
        totalCampaigns > 0
          ? ((successfulCampaigns / totalCampaigns) * 100).toFixed(2)
          : '0',
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/daily
 * Get daily statistics over time
 */
router.get('/analytics/daily', async (req, res) => {
  try {
    const { days = '30' } = req.query;

    const stats = await prisma.dailyStats.findMany({
      orderBy: { date: 'desc' },
      take: parseInt(days as string),
    });

    // Serialize BigInt fields
    const serialized = serializeBigInt(stats.reverse()); // Return chronologically

    res.json(serialized);
  } catch (error) {
    console.error('Error fetching daily stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/trending
 * Get trending campaigns
 */
router.get('/analytics/trending', async (req, res) => {
  try {
    const { limit = '10' } = req.query;

    // Get campaigns with most recent activity
    const recentContributions = await prisma.contribution.groupBy({
      by: ['campaignId'],
      where: {
        timestamp: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      _count: true,
      orderBy: {
        _count: {
          campaignId: 'desc',
        },
      },
      take: parseInt(limit as string),
    });

    const campaignIds = recentContributions.map((c: {campaignId: string }) => c.campaignId);

    const campaigns = await prisma.campaign.findMany({
      where: {
        id: { in: campaignIds },
      },
      include: {
        _count: {
          select: {
            contributions: true,
          },
        },
      },
    });

    // Serialize BigInt fields
    const serialized = serializeBigInt(campaigns);

    res.json(serialized);
  } catch (error) {
    console.error('Error fetching trending campaigns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== SEARCH ====================

/**
 * GET /api/search
 * Search campaigns by name or description
 */
router.get('/search', async (req, res) => {
  try {
    const { q, limit = '20' } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const campaigns = await prisma.campaign.findMany({
      where: {
        name: {
          contains: q as string,
          mode: 'insensitive',
        },
      },
      include: {
        _count: {
          select: {
            contributions: true,
          },
        },
      },
      take: parseInt(limit as string),
    });

    // Serialize BigInt fields
    const serialized = serializeBigInt(campaigns);

    res.json(serialized);
  } catch (error) {
    console.error('Error searching campaigns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;