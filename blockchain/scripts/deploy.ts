import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Deploying NodeRegistry...");
  const NodeRegistry = await ethers.getContractFactory("NodeRegistry");
  const nodeRegistry = await NodeRegistry.deploy();
  await nodeRegistry.waitForDeployment();
  const registryAddress = await nodeRegistry.getAddress();
  console.log(`NodeRegistry deployed to: ${registryAddress}`);

  console.log("Deploying TrustLedger...");
  const TrustLedger = await ethers.getContractFactory("TrustLedger");
  const trustLedger = await TrustLedger.deploy(registryAddress);
  await trustLedger.waitForDeployment();
  const ledgerAddress = await trustLedger.getAddress();
  console.log(`TrustLedger deployed to: ${ledgerAddress}`);

  // Save the contract addresses and ABIs to the backend and frontend
  const contractsDir = path.join(__dirname, "../../backend/src/config");
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  const contractAddresses = {
    NodeRegistry: registryAddress,
    TrustLedger: ledgerAddress
  };

  fs.writeFileSync(
    path.join(contractsDir, "contractAddresses.json"),
    JSON.stringify(contractAddresses, null, 2)
  );

  console.log("Addresses saved to backend config.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
