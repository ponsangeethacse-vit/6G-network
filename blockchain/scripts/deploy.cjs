const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  
  // Default Account 0 in local hardhat node
  const signer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);

  console.log("Compiling assumed complete. Deploying NodeRegistry...");
  
  const nodeRegistryJson = require("../artifacts/contracts/NodeRegistry.sol/NodeRegistry.json");
  const registryFactory = new ethers.ContractFactory(nodeRegistryJson.abi, nodeRegistryJson.bytecode, signer);
  const nodeRegistry = await registryFactory.deploy();
  await nodeRegistry.waitForDeployment();
  const registryAddress = await nodeRegistry.getAddress();
  console.log(`NodeRegistry deployed to: ${registryAddress}`);

  console.log("Deploying TrustLedger...");
  const trustLedgerJson = require("../artifacts/contracts/TrustLedger.sol/TrustLedger.json");
  const ledgerFactory = new ethers.ContractFactory(trustLedgerJson.abi, trustLedgerJson.bytecode, signer);
  const trustLedger = await ledgerFactory.deploy(registryAddress);
  await trustLedger.waitForDeployment();
  const ledgerAddress = await trustLedger.getAddress();
  console.log(`TrustLedger deployed to: ${ledgerAddress}`);

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
