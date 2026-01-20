import { time } from "@nomicfoundation/hardhat-network-helpers";
import { CrowdfundFactory, Crowdfund } from "../typechain-types";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("CrowdfundFactory and Crowdfund (constructor milestones)", function () {
  let factory: CrowdfundFactory;
  let owner: any;
  let beneficiary: any;
  let contributor1: any;
  let contributor2: any;

  const CAMPAIGN_NAME = "Test Campaign";
  const DURATION = 7 * 24 * 60 * 60; // 7 days
  const FUNDING_CAP = ethers.parseEther("10");

  const NO_MILESTONES: Crowdfund.MilestoneStruct[] = [];

  const THREE_MILESTONES: Crowdfund.MilestoneStruct[] = [
    { description: "Phase 1", amount: ethers.parseEther("3"), completed: false, fundsReleased: false },
    { description: "Phase 2", amount: ethers.parseEther("4"), completed: false, fundsReleased: false },
    { description: "Phase 3", amount: ethers.parseEther("3"), completed: false, fundsReleased: false },
  ];

  beforeEach(async function () {
    [owner, beneficiary, contributor1, contributor2] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("CrowdfundFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();
  });

  /* -------------------------------------------------------------------------- */
  /*                               Factory Tests                                */
  /* -------------------------------------------------------------------------- */

  describe("Factory Deployment", function () {
    it("Should deploy successfully", async function () {
      const address = await factory.getAddress();
      expect(address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });

    it("Should have zero campaigns initially", async function () {
      expect(await factory.getCampaignCount()).to.equal(0n);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                            Campaign Creation                               */
  /* -------------------------------------------------------------------------- */

  describe("Campaign Creation", function () {
    it("Should create campaign with milestones", async function () {
      await factory.createCampaign(
        CAMPAIGN_NAME,
        beneficiary.address,
        DURATION,
        FUNDING_CAP,
        THREE_MILESTONES
      );

      expect(await factory.getCampaignCount()).to.equal(1n);
    });

    it("Should initialize milestones correctly", async function () {
      await factory.createCampaign(
        CAMPAIGN_NAME,
        beneficiary.address,
        DURATION,
        FUNDING_CAP,
        THREE_MILESTONES
      );

      const [addr] = await factory.getAllCampaigns();
      const crowdfund = await ethers.getContractAt("Crowdfund", addr);

      expect(await crowdfund.getMilestoneCount()).to.equal(3n);

      const m0 = await crowdfund.getMilestone(0);
      expect(m0.description).to.equal("Phase 1");
      expect(m0.amount).to.equal(ethers.parseEther("3"));
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                          Campaign Contributions                             */
  /* -------------------------------------------------------------------------- */

  describe("Campaign Contributions", function () {
    let crowdfund: Crowdfund;

    beforeEach(async function () {
      await factory.createCampaign(
        CAMPAIGN_NAME,
        beneficiary.address,
        DURATION,
        FUNDING_CAP,
        NO_MILESTONES
      );

      const [addr] = await factory.getAllCampaigns();
      crowdfund = await ethers.getContractAt("Crowdfund", addr);
    });

    it("Should accept contributions", async function () {
      const amount = ethers.parseEther("1");

      await crowdfund.connect(contributor1).contribute({ value: amount });

      expect(await crowdfund.contributions(contributor1.address)).to.equal(
        amount
      );
      expect(await crowdfund.totalFundsRaised()).to.equal(amount);
    });

    it("Should reject contributions after deadline", async function () {
      await time.increase(DURATION + 1);

      await expect(
        crowdfund.connect(contributor1).contribute({
          value: ethers.parseEther("1"),
        })
      ).to.be.revertedWith("Campaign has ended");
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                  Successful Campaign WITHOUT Milestones                     */
  /* -------------------------------------------------------------------------- */

  describe("Successful Campaign WITHOUT Milestones", function () {
    let crowdfund: Crowdfund;

    beforeEach(async function () {
      await factory.createCampaign(
        CAMPAIGN_NAME,
        beneficiary.address,
        DURATION,
        FUNDING_CAP,
        NO_MILESTONES
      );

      const [addr] = await factory.getAllCampaigns();
      crowdfund = await ethers.getContractAt("Crowdfund", addr);

      await crowdfund
        .connect(contributor1)
        .contribute({ value: FUNDING_CAP });
    });

    it("Should release all funds to beneficiary", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      const before = await ethers.provider.getBalance(beneficiary.address);
      await crowdfund.connect(owner).releaseAllFunds();
      const after = await ethers.provider.getBalance(beneficiary.address);

      expect(after - before).to.equal(FUNDING_CAP);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                  Successful Campaign WITH Milestones                        */
  /* -------------------------------------------------------------------------- */

  describe("Successful Campaign WITH Milestones", function () {
    let crowdfund: Crowdfund;

    beforeEach(async function () {
      await factory.createCampaign(
        CAMPAIGN_NAME,
        beneficiary.address,
        DURATION,
        FUNDING_CAP,
        THREE_MILESTONES
      );

      const [addr] = await factory.getAllCampaigns();
      crowdfund = await ethers.getContractAt("Crowdfund", addr);

      await crowdfund
        .connect(contributor1)
        .contribute({ value: FUNDING_CAP });
    });

    it("Should complete and release all milestones", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      const before = await ethers.provider.getBalance(beneficiary.address);

      for (let i = 0; i < 3; i++) {
        await crowdfund.connect(owner).completeMilestone(i);
        await crowdfund.releaseMilestoneFunds(i);
      }

      const after = await ethers.provider.getBalance(beneficiary.address);
      expect(after - before).to.equal(FUNDING_CAP);
      expect(await crowdfund.getEscrowBalance()).to.equal(0n);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                           Failed Campaign Refunds                           */
  /* -------------------------------------------------------------------------- */

  describe("Failed Campaign Refunds", function () {
    let crowdfund: Crowdfund;

    beforeEach(async function () {
      await factory.createCampaign(
        CAMPAIGN_NAME,
        beneficiary.address,
        DURATION,
        FUNDING_CAP,
        NO_MILESTONES
      );

      const [addr] = await factory.getAllCampaigns();
      crowdfund = await ethers.getContractAt("Crowdfund", addr);

      await crowdfund
        .connect(contributor1)
        .contribute({ value: ethers.parseEther("3") });
    });

    it("Should allow refunds after failure", async function () {
      const before = await ethers.provider.getBalance(contributor1.address);

      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      const tx = await crowdfund.connect(contributor1).claimRefund();
      const receipt = await tx.wait();
      const gas = receipt!.gasUsed * receipt!.gasPrice!;

      const after = await ethers.provider.getBalance(contributor1.address);
      expect(after + gas - before).to.equal(ethers.parseEther("3"));
    });
  });
});