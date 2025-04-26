const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Crowdfunding", function () {
  let Crowdfunding, crowdfunding, owner, addr1, addr2;

  beforeEach(async function () {
    Crowdfunding = await ethers.getContractFactory("Crowdfunding");
    [owner, addr1, addr2] = await ethers.getSigners();
    crowdfunding = await Crowdfunding.deploy();
  });

  it("Should create a campaign", async function () {
    await crowdfunding.createCampaign(ethers.parseEther("1"), 86400);
    const campaign = await crowdfunding.campaigns(1);
    expect(campaign.goal).to.equal(ethers.parseEther("1"));
    expect(campaign.creator).to.equal(owner.address);
    expect(campaign.deadline).to.be.above(0);
  });

  it("Should allow donations", async function () {
    await crowdfunding.createCampaign(ethers.parseEther("1"), 86400);
    await crowdfunding.connect(addr1).donate(1, { value: ethers.parseEther("0.5") });
    const campaign = await crowdfunding.campaigns(1);
    expect(campaign.raised).to.equal(ethers.parseEther("0.5"));
    expect(await crowdfunding.contributions(1, addr1.address)).to.equal(ethers.parseEther("0.5"));
  });

  it("Should disburse funds if goal is reached", async function () {
    await crowdfunding.createCampaign(ethers.parseEther("1"), 86400);
    await crowdfunding.connect(addr1).donate(1, { value: ethers.parseEther("1") });
    await ethers.provider.send("evm_increaseTime", [86400]);
    await ethers.provider.send("evm_mine", []);
    const initialBalance = await ethers.provider.getBalance(owner.address);
    await crowdfunding.disburseFunds(1);
    const finalBalance = await ethers.provider.getBalance(owner.address);
    expect(finalBalance).to.be.above(initialBalance);
  });

  it("Should refund if goal is not reached", async function () {
    await crowdfunding.createCampaign(ethers.parseEther("1"), 86400);
    await crowdfunding.connect(addr1).donate(1, { value: ethers.parseEther("0.5") });
    await ethers.provider.send("evm_increaseTime", [86400]);
    await ethers.provider.send("evm_mine", []);
    const initialBalance = await ethers.provider.getBalance(addr1.address);
    await crowdfunding.connect(addr1).refund(1);
    const finalBalance = await ethers.provider.getBalance(addr1.address);
    expect(finalBalance).to.be.above(initialBalance);
  });
});