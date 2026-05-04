import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // SealPadFactory's constructor deploys the SaleVault implementation, so a
  // single deployment gives us both the factory and the impl. Subsequent
  // sales are EIP-1167 clones — no further deployments needed.
  const deployed = await deploy("SealPadFactory", {
    from: deployer,
    log: true,
  });

  console.log(`SealPadFactory deployed to: ${deployed.address}`);

  // Surface the implementation address too so it can be Etherscan-verified.
  const factory = await hre.ethers.getContractAt("SealPadFactory", deployed.address);
  const impl = await factory.implementation();
  console.log(`SaleVault implementation:    ${impl}`);
};

export default func;
func.id = "deploy_sealpad_factory";
func.tags = ["SealPadFactory"];
