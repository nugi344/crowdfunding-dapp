const hre = require("hardhat");

async function main() {
  const Crowdfunding = await hre.ethers.getContractFactory("Crowdfunding");
  const crowdfunding = await Crowdfunding.deploy();

  console.log("Crowdfunding deployed to:", crowdfunding.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});