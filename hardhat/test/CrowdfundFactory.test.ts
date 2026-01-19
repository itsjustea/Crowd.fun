// test/CrowdfundFactory.test.ts
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { CrowdfundFactory, Crowdfund } from "../typechain-types";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("CrowdfundFactory and Crowdfund with Milestone Escrow", function () {
  let factory: CrowdfundFactory;
  let owner: any;
  let beneficiary: any;
  let contributor1: any;
  let contributor2: any;

  const CAMPAIGN_NAME = "Test Campaign";
  const DURATION = 7 * 24 * 60 * 60; // 7 days
  const FUNDING_CAP = ethers.parseEther("10"); // bigint

  beforeEach(async function () {
    [owner, beneficiary, contributor1, contributor2] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("CrowdfundFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();
  });

  /* -------------------------------------------------------------------------- */
  /*                               Factory tests                                */
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
  /*                            Campaign Creation                                */
  /* -------------------------------------------------------------------------- */

  describe("Campaign Creation", function () {
    it("Should create a campaign", async function () {
      await factory.createCampaign(
        CAMPAIGN_NAME,
        beneficiary.address,
        DURATION,
        FUNDING_CAP
      );

      expect(await factory.getCampaignCount()).to.equal(1n);
    });

    it("Should track campaigns by creator", async function () {
      await factory.createCampaign(
        CAMPAIGN_NAME,
        beneficiary.address,
        DURATION,
        FUNDING_CAP
      );

      const campaigns = await factory.getCampaignsByCreator(owner.address);
      expect(campaigns.length).to.equal(1);
    });

    it("Should mark campaign as valid", async function () {
      await factory.createCampaign(
        CAMPAIGN_NAME,
        beneficiary.address,
        DURATION,
        FUNDING_CAP
      );

      const campaigns = await factory.getAllCampaigns();
      const campaignAddress = campaigns[0];

      expect(await factory.isValidCampaign(campaignAddress)).to.equal(true);
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
        FUNDING_CAP
      );

      const [campaignAddress] = await factory.getAllCampaigns();
      const Crowdfund = await ethers.getContractFactory("Crowdfund");
      crowdfund = Crowdfund.attach(campaignAddress) as Crowdfund;
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

    it("Should reject contributions exceeding funding cap", async function () {
      const excess = ethers.parseEther("11");

      await expect(
        crowdfund.connect(contributor1).contribute({ value: excess })
      ).to.be.revertedWith("Contribution exceeds funding cap");
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                          Milestone Management                               */
  /* -------------------------------------------------------------------------- */

  describe("Milestone Management", function () {
    let crowdfund: Crowdfund;

    beforeEach(async function () {
      await factory.createCampaign(
        CAMPAIGN_NAME,
        beneficiary.address,
        DURATION,
        FUNDING_CAP
      );

      const [campaignAddress] = await factory.getAllCampaigns();
      const Crowdfund = await ethers.getContractFactory("Crowdfund");
      crowdfund = Crowdfund.attach(campaignAddress) as Crowdfund;
    });

    it("Should allow creator to add milestones before deadline", async function () {
      await crowdfund
        .connect(owner)
        .addMilestone("Prototype", ethers.parseEther("3"));

      await crowdfund
        .connect(owner)
        .addMilestone("Launch", ethers.parseEther("7"));

      expect(await crowdfund.getMilestoneCount()).to.equal(2n);
    });

    it("Should not allow non-creator to add milestones", async function () {
      await expect(
        crowdfund
          .connect(contributor1)
          .addMilestone("Fake", ethers.parseEther("1"))
      ).to.be.revertedWith("Only creator can call this");
    });

    it("Should not allow adding milestones after deadline", async function () {
      await time.increase(DURATION + 1);

      await expect(
        crowdfund
          .connect(owner)
          .addMilestone("Late", ethers.parseEther("1"))
      ).to.be.revertedWith("Campaign has ended");
    });

    it("Should not allow milestone amounts exceeding funding cap", async function () {
      await crowdfund
        .connect(owner)
        .addMilestone("Big", ethers.parseEther("6"));

      await expect(
        crowdfund
          .connect(owner)
          .addMilestone("Too Big", ethers.parseEther("5"))
      ).to.be.revertedWith("Total milestone amount exceeds funding cap");
    });

    it("Should return correct milestone information", async function () {
      await crowdfund
        .connect(owner)
        .addMilestone("Test Milestone", ethers.parseEther("5"));

      const milestone = await crowdfund.getMilestone(0);

      expect(milestone.description).to.equal("Test Milestone");
      expect(milestone.amount).to.equal(ethers.parseEther("5"));
      expect(milestone.completed).to.equal(false);
      expect(milestone.fundsReleased).to.equal(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                  Successful Campaign with NO Milestones                     */
  /* -------------------------------------------------------------------------- */

  describe("Successful Campaign WITHOUT Milestones", function () {
    let crowdfund: Crowdfund;

    beforeEach(async function () {
      await factory.createCampaign(
        CAMPAIGN_NAME,
        beneficiary.address,
        DURATION,
        FUNDING_CAP
      );

      const [campaignAddress] = await factory.getAllCampaigns();
      const Crowdfund = await ethers.getContractFactory("Crowdfund");
      crowdfund = Crowdfund.attach(campaignAddress) as Crowdfund;

      // Fully fund the campaign
      await crowdfund.connect(contributor1).contribute({ value: FUNDING_CAP });
    });

    it("Should hold funds in escrow after finalization", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      const escrowBalance = await crowdfund.getEscrowBalance();
      expect(escrowBalance).to.equal(FUNDING_CAP);
      expect(await crowdfund.finalized()).to.equal(true);
    });

    it("Should allow creator to release all funds when no milestones", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      const beforeBalance = await ethers.provider.getBalance(
        beneficiary.address
      );

      await crowdfund.connect(owner).releaseAllFunds();

      const afterBalance = await ethers.provider.getBalance(
        beneficiary.address
      );
      expect(afterBalance - beforeBalance).to.equal(FUNDING_CAP);
    });

    it("Should not allow non-creator to release all funds", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      await expect(
        crowdfund.connect(contributor1).releaseAllFunds()
      ).to.be.revertedWith("Only creator can call this");
    });

    it("Should not allow releasing all funds twice", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      await crowdfund.connect(owner).releaseAllFunds();

      await expect(
        crowdfund.connect(owner).releaseAllFunds()
      ).to.be.revertedWith("Funds already released");
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
        FUNDING_CAP
      );

      const [campaignAddress] = await factory.getAllCampaigns();
      const Crowdfund = await ethers.getContractFactory("Crowdfund");
      crowdfund = Crowdfund.attach(campaignAddress) as Crowdfund;

      // Add milestones
      await crowdfund
        .connect(owner)
        .addMilestone("Phase 1", ethers.parseEther("3"));
      await crowdfund
        .connect(owner)
        .addMilestone("Phase 2", ethers.parseEther("4"));
      await crowdfund
        .connect(owner)
        .addMilestone("Phase 3", ethers.parseEther("3"));

      // Fully fund the campaign
      await crowdfund.connect(contributor1).contribute({ value: FUNDING_CAP });
    });

    it("Should not allow releaseAllFunds when milestones exist", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      await expect(
        crowdfund.connect(owner).releaseAllFunds()
      ).to.be.revertedWith("Cannot release all funds when milestones exist");
    });

    it("Should allow creator to complete milestone", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      await crowdfund.connect(owner).completeMilestone(0);

      const milestone = await crowdfund.getMilestone(0);
      expect(milestone.completed).to.equal(true);
      expect(milestone.fundsReleased).to.equal(false);
    });

    it("Should not allow non-creator to complete milestone", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      await expect(
        crowdfund.connect(contributor1).completeMilestone(0)
      ).to.be.revertedWith("Only creator can call this");
    });

    it("Should allow anyone to release milestone funds after completion", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      await crowdfund.connect(owner).completeMilestone(0);

      const beforeBalance = await ethers.provider.getBalance(
        beneficiary.address
      );

      // Anyone (contributor1) can trigger release
      await crowdfund.connect(contributor1).releaseMilestoneFunds(0);

      const afterBalance = await ethers.provider.getBalance(
        beneficiary.address
      );
      expect(afterBalance - beforeBalance).to.equal(ethers.parseEther("3"));

      const milestone = await crowdfund.getMilestone(0);
      expect(milestone.fundsReleased).to.equal(true);
    });

    it("Should not allow releasing funds for uncompleted milestone", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      await expect(
        crowdfund.connect(contributor1).releaseMilestoneFunds(0)
      ).to.be.revertedWith("Milestone not completed");
    });

    it("Should not allow releasing milestone funds twice", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      await crowdfund.connect(owner).completeMilestone(0);
      await crowdfund.connect(contributor1).releaseMilestoneFunds(0);

      await expect(
        crowdfund.connect(contributor1).releaseMilestoneFunds(0)
      ).to.be.revertedWith("Funds already released");
    });

    it("Should track released amount correctly", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      // Release first milestone
      await crowdfund.connect(owner).completeMilestone(0);
      await crowdfund.releaseMilestoneFunds(0);

      expect(await crowdfund.releasedAmount()).to.equal(
        ethers.parseEther("3")
      );

      // Release second milestone
      await crowdfund.connect(owner).completeMilestone(1);
      await crowdfund.releaseMilestoneFunds(1);

      expect(await crowdfund.releasedAmount()).to.equal(
        ethers.parseEther("7")
      );
    });

    it("Should maintain correct escrow balance", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      // Initial escrow should be full amount
      expect(await crowdfund.getEscrowBalance()).to.equal(FUNDING_CAP);

      // After releasing first milestone
      await crowdfund.connect(owner).completeMilestone(0);
      await crowdfund.releaseMilestoneFunds(0);

      expect(await crowdfund.getEscrowBalance()).to.equal(
        ethers.parseEther("7")
      );

      // After releasing second milestone
      await crowdfund.connect(owner).completeMilestone(1);
      await crowdfund.releaseMilestoneFunds(1);

      expect(await crowdfund.getEscrowBalance()).to.equal(
        ethers.parseEther("3")
      );
    });

    it("Should complete full milestone workflow", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      const beforeBalance = await ethers.provider.getBalance(
        beneficiary.address
      );

      // Complete and release all three milestones
      for (let i = 0; i < 3; i++) {
        await crowdfund.connect(owner).completeMilestone(i);
        await crowdfund.releaseMilestoneFunds(i);
      }

      const afterBalance = await ethers.provider.getBalance(
        beneficiary.address
      );
      expect(afterBalance - beforeBalance).to.equal(FUNDING_CAP);
      expect(await crowdfund.getEscrowBalance()).to.equal(0n);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                           Failed Campaign Refunds                           */
  /* -------------------------------------------------------------------------- */

  describe("Failed Campaign and Refunds", function () {
    let crowdfund: Crowdfund;
    const PARTIAL = ethers.parseEther("3");

    beforeEach(async function () {
      await factory.createCampaign(
        CAMPAIGN_NAME,
        beneficiary.address,
        DURATION,
        FUNDING_CAP
      );

      const [campaignAddress] = await factory.getAllCampaigns();
      const Crowdfund = await ethers.getContractFactory("Crowdfund");
      crowdfund = Crowdfund.attach(campaignAddress) as Crowdfund;

      await crowdfund.connect(contributor1).contribute({ value: PARTIAL });
    });

    it("Should allow refund after failed campaign", async function () {
      const before = await ethers.provider.getBalance(contributor1.address);

      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      const tx = await crowdfund.connect(contributor1).claimRefund();
      const receipt = await tx.wait();
      const gas = receipt!.gasUsed * receipt!.gasPrice!;

      const after = await ethers.provider.getBalance(contributor1.address);
      expect(after + gas - before).to.equal(PARTIAL);
    });

    it("Should not allow refund for successful campaign", async function () {
      // Add more to make it successful
      const remaining = FUNDING_CAP - PARTIAL;
      await crowdfund.connect(contributor2).contribute({ value: remaining });

      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      await expect(
        crowdfund.connect(contributor1).claimRefund()
      ).to.be.revertedWith("Campaign was successful, no refunds");
    });

    it("Should not allow refund before finalization", async function () {
      await time.increase(DURATION + 1);

      await expect(
        crowdfund.connect(contributor1).claimRefund()
      ).to.be.revertedWith("Campaign not finalized yet");
    });

    it("Should track contributions to zero after refund", async function () {
      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      await crowdfund.connect(contributor1).claimRefund();

      expect(await crowdfund.contributions(contributor1.address)).to.equal(0n);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                      Campaign Information Queries                           */
  /* -------------------------------------------------------------------------- */

  describe("Campaign Information Queries", function () {
    let crowdfund: Crowdfund;

    beforeEach(async function () {
      await factory.createCampaign(
        CAMPAIGN_NAME,
        beneficiary.address,
        DURATION,
        FUNDING_CAP
      );

      const [campaignAddress] = await factory.getAllCampaigns();
      const Crowdfund = await ethers.getContractFactory("Crowdfund");
      crowdfund = Crowdfund.attach(campaignAddress) as Crowdfund;
    });

    it("Should return correct campaign info", async function () {
      const info = await crowdfund.getCampaignInfo();

      expect(info._name).to.equal(CAMPAIGN_NAME);
      expect(info._beneficiary).to.equal(beneficiary.address);
      expect(info._fundingCap).to.equal(FUNDING_CAP);
      expect(info._finalized).to.equal(false);
      expect(info._isSuccessful).to.equal(false);
    });

    it("Should get active campaigns from factory", async function () {
      await factory.createCampaign(
        "Campaign 2",
        beneficiary.address,
        DURATION,
        FUNDING_CAP
      );

      const activeCampaigns = await factory.getActiveCampaigns();
      expect(activeCampaigns.length).to.equal(2);
    });

    it("Should get campaigns basic info", async function () {
      await factory.createCampaign(
        "Campaign 2",
        beneficiary.address,
        DURATION,
        FUNDING_CAP
      );

      const basicInfo = await factory.getCampaignsBasicInfo(0, 2);
      expect(basicInfo.addresses.length).to.equal(2);
      expect(basicInfo.names.length).to.equal(2);
      expect(basicInfo.names[0]).to.equal(CAMPAIGN_NAME);
      expect(basicInfo.names[1]).to.equal("Campaign 2");
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                          Edge Cases & Security                              */
  /* -------------------------------------------------------------------------- */

  describe("Edge Cases and Security", function () {
    let crowdfund: Crowdfund;

    beforeEach(async function () {
      await factory.createCampaign(
        CAMPAIGN_NAME,
        beneficiary.address,
        DURATION,
        FUNDING_CAP
      );

      const [campaignAddress] = await factory.getAllCampaigns();
      const Crowdfund = await ethers.getContractFactory("Crowdfund");
      crowdfund = Crowdfund.attach(campaignAddress) as Crowdfund;
    });

    it("Should not allow completing milestone before finalization", async function () {
      await crowdfund
        .connect(owner)
        .addMilestone("Test", ethers.parseEther("5"));
      
        // Fund the campaign to make it successful
      await crowdfund.connect(contributor1).contribute({ value: FUNDING_CAP });

      await expect(
        crowdfund.connect(owner).completeMilestone(0)
      ).to.be.revertedWith("Campaign must be finalized first");
    });

    it("Should not allow milestone completion on unsuccessful campaign", async function () {
      await crowdfund
        .connect(owner)
        .addMilestone("Test", ethers.parseEther("5"));

      // Partial funding
      await crowdfund
        .connect(contributor1)
        .contribute({ value: ethers.parseEther("3") });

      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      await expect(
        crowdfund.connect(owner).completeMilestone(0)
      ).to.be.revertedWith("Campaign was not successful");
    });

    it("Should not allow double completion of milestone", async function () {
      await crowdfund
        .connect(owner)
        .addMilestone("Test", ethers.parseEther("10"));

      await crowdfund.connect(contributor1).contribute({ value: FUNDING_CAP });

      await time.increase(DURATION + 1);
      await crowdfund.finalize();

      await crowdfund.connect(owner).completeMilestone(0);

      await expect(
        crowdfund.connect(owner).completeMilestone(0)
      ).to.be.revertedWith("Milestone already completed");
    });
  });
});