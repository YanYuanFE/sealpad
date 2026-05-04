import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { SealPadFactory, SealPadFactory__factory, SaleVault, MockERC20 } from "../types";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  creator: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

const SaleType = { FixedPrice: 0, DutchAuction: 1 };
const SaleStatus = { Active: 0, Finalizing: 1, Settled: 2, Failed: 3, Cancelled: 4 };
const UINT64_MAX = (1n << 64n) - 1n;

async function getBlockTimestamp(): Promise<number> {
  return (await ethers.provider.getBlock("latest"))!.timestamp;
}

async function deployFixture(signers: Signers) {
  const factoryFactory = (await ethers.getContractFactory("SealPadFactory")) as SealPadFactory__factory;
  const factory = (await factoryFactory.deploy()) as SealPadFactory;
  const factoryAddress = await factory.getAddress();

  const mockFactory = await ethers.getContractFactory("MockERC20");
  const saleToken = (await mockFactory.deploy("Sale Token", "SALE", 18)) as MockERC20;
  const saleTokenAddress = await saleToken.getAddress();
  const payToken = (await mockFactory.deploy("Mock USDC", "USDC", 6)) as MockERC20;
  const payTokenAddress = await payToken.getAddress();

  // Generous mints + approvals so the test file rarely has to top up.
  // Sale-token approvals point at the factory (factory pulls on createSale).
  // Pay-token approvals are set up per-vault inside helpers.
  const saleAmount = ethers.parseEther("10000");
  const factorySaleAllowance = ethers.parseEther("100000"); // covers many sales
  await saleToken.mint(signers.creator.address, factorySaleAllowance);
  await saleToken.connect(signers.creator).approve(factoryAddress, factorySaleAllowance);

  const payAmount = ethers.parseUnits("10000", 6);
  for (const s of [signers.alice, signers.bob, signers.charlie]) {
    await payToken.mint(s.address, payAmount);
  }

  return {
    factory,
    factoryAddress,
    saleToken,
    saleTokenAddress,
    payToken,
    payTokenAddress,
    saleAmount,
  };
}

async function publicDecryptUint64(handles: string[]): Promise<{ values: bigint[]; proof: string }> {
  const result = await fhevm.publicDecrypt(handles);
  const clearValues = new Map<string, bigint | boolean | string | number>();
  for (const [handle, value] of Object.entries(result.clearValues)) {
    clearValues.set(handle.toLowerCase(), value as bigint | boolean | string | number);
  }
  const values = handles.map((handle) => {
    const value = clearValues.get(handle.toLowerCase());
    if (value === undefined) {
      throw new Error(`No public decrypt result for handle ${handle}`);
    }
    if (typeof value === "boolean") return value ? 1n : 0n;
    return BigInt(value);
  });
  return { values, proof: result.decryptionProof };
}

function makeFixedParams(overrides: Record<string, any>) {
  return {
    saleToken: overrides.saleToken,
    saleAmount: overrides.saleAmount ?? ethers.parseEther("10000"),
    payToken: overrides.payToken,
    saleType: SaleType.FixedPrice,
    price: overrides.price ?? 1000,
    softCap: overrides.softCap ?? 500,
    hardCap: overrides.hardCap ?? 5000,
    maxPerUser: overrides.maxPerUser ?? 0,
    startTime: overrides.startTime,
    endTime: overrides.endTime,
    whitelistRoot: overrides.whitelistRoot ?? ethers.ZeroHash,
    cliffDuration: overrides.cliffDuration ?? 0,
    vestingDuration: overrides.vestingDuration ?? 0,
  };
}

function makeDutchParams(overrides: Record<string, any>) {
  return {
    saleToken: overrides.saleToken,
    saleAmount: overrides.saleAmount ?? ethers.parseEther("10000"),
    payToken: overrides.payToken,
    saleType: SaleType.DutchAuction,
    price: overrides.price ?? 500,
    softCap: overrides.softCap ?? 500,
    hardCap: overrides.hardCap ?? 5000,
    maxPerUser: overrides.maxPerUser ?? 0,
    startTime: overrides.startTime,
    endTime: overrides.endTime,
    whitelistRoot: overrides.whitelistRoot ?? ethers.ZeroHash,
    cliffDuration: overrides.cliffDuration ?? 0,
    vestingDuration: overrides.vestingDuration ?? 0,
  };
}

/// Drives both finalize phases for a vault: request, mine past the reorg
/// window, then finalize. Empty sales return without calling finalize() since
/// requestFinalize() short-circuits them to Failed.
async function performFinalize(vault: SaleVault): Promise<void> {
  await vault.requestFinalize();
  const after = await vault.getSale();
  if (Number(after.status) !== SaleStatus.Active) return;
  // Advance past the FINALIZE_REORG_DELAY window (95 blocks per the contract).
  for (let i = 0; i < 95; i++) {
    await ethers.provider.send("evm_mine", []);
  }
  await vault.finalize();
}

/// Creates a sale via factory and returns the resulting vault contract handle.
async function createSaleAndGetVault(
  factory: SealPadFactory,
  signer: HardhatEthersSigner,
  params: any,
): Promise<{ vault: SaleVault; vaultAddress: string }> {
  const tx = await factory.connect(signer).createSale(params);
  const receipt = await tx.wait();
  const event = receipt!.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed?.name === "SaleCreated");
  if (!event) throw new Error("SaleCreated event not found");
  const vaultAddress = event.args.vault as string;
  const vault = (await ethers.getContractAt("SaleVault", vaultAddress)) as SaleVault;
  return { vault, vaultAddress };
}

describe("SealPadFactory + SaleVault", function () {
  let signers: Signers;
  let factory: SealPadFactory;
  let factoryAddress: string;
  let saleToken: MockERC20;
  let saleTokenAddress: string;
  let payToken: MockERC20;
  let payTokenAddress: string;
  let saleAmount: bigint;

  before(async function () {
    const ethSigners = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      creator: ethSigners[1],
      alice: ethSigners[2],
      bob: ethSigners[3],
      charlie: ethSigners[4],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite requires mock FHE");
      this.skip();
    }
    ({
      factory,
      factoryAddress,
      saleToken,
      saleTokenAddress,
      payToken,
      payTokenAddress,
      saleAmount,
    } = await deployFixture(signers));
  });

  // ============================================================
  //                     FACTORY BASICS
  // ============================================================

  describe("factory", function () {
    it("deploys an implementation in the constructor", async function () {
      const impl = await factory.implementation();
      expect(impl).to.not.eq(ethers.ZeroAddress);
    });

    it("rejects registerParticipant from non-vault callers", async function () {
      await expect(
        factory.connect(signers.alice).registerParticipant(signers.alice.address),
      ).to.be.revertedWithCustomError(factory, "NotASale");
    });

    it("indexes vaults by creator", async function () {
      const now = await getBlockTimestamp();
      const params = makeFixedParams({
        saleToken: saleTokenAddress,
        payToken: payTokenAddress,
        startTime: now + 1,
        endTime: now + 3600,
      });
      const a = await createSaleAndGetVault(factory, signers.creator, params);
      const b = await createSaleAndGetVault(factory, signers.creator, params);

      const ids = await factory.salesByCreator(signers.creator.address);
      expect(ids.length).to.eq(2);
      expect(ids[0]).to.eq(a.vaultAddress);
      expect(ids[1]).to.eq(b.vaultAddress);

      expect((await factory.salesByCreator(signers.alice.address)).length).to.eq(0);
    });

    it("getAllSales returns vaults in creation order", async function () {
      const now = await getBlockTimestamp();
      const params = makeFixedParams({
        saleToken: saleTokenAddress,
        payToken: payTokenAddress,
        startTime: now + 1,
        endTime: now + 3600,
      });
      const a = await createSaleAndGetVault(factory, signers.creator, params);
      const b = await createSaleAndGetVault(factory, signers.creator, params);
      const all = await factory.getAllSales();
      expect(all).to.deep.eq([a.vaultAddress, b.vaultAddress]);
      expect(await factory.totalSales()).to.eq(2);
    });
  });

  // ============================================================
  //                     CREATE SALE
  // ============================================================

  describe("createSale", function () {
    it("should create a Fixed Price sale and lock tokens", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      const sale = await vault.getSale();
      expect(sale.creator).to.eq(signers.creator.address);
      expect(sale.saleType).to.eq(SaleType.FixedPrice);
      expect(sale.status).to.eq(SaleStatus.Active);
      expect(sale.price).to.eq(1000);
      expect(sale.saleTokenScale).to.eq(10n ** 18n);
      expect(await saleToken.balanceOf(vaultAddress)).to.eq(saleAmount);
    });

    it("should create a Dutch Auction sale with floor price", async function () {
      const now = await getBlockTimestamp();
      const { vault } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeDutchParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
          price: 800,
        }),
      );
      const sale = await vault.getSale();
      expect(sale.saleType).to.eq(SaleType.DutchAuction);
      expect(sale.price).to.eq(800);
    });

    it("should revert with softCap > hardCap", async function () {
      const now = await getBlockTimestamp();
      await expect(
        factory.connect(signers.creator).createSale(
          makeFixedParams({
            saleToken: saleTokenAddress,
            payToken: payTokenAddress,
            startTime: now + 1,
            endTime: now + 3600,
            softCap: 5000,
            hardCap: 1000,
          }),
        ),
      ).to.be.revertedWithCustomError(
        await ethers.getContractAt("SaleVault", await factory.implementation()),
        "InvalidParams",
      );
    });

    it("should revert with price zero", async function () {
      const now = await getBlockTimestamp();
      await expect(
        factory.connect(signers.creator).createSale(
          makeFixedParams({
            saleToken: saleTokenAddress,
            payToken: payTokenAddress,
            startTime: now + 1,
            endTime: now + 3600,
            price: 0,
          }),
        ),
      ).to.be.revertedWithCustomError(
        await ethers.getContractAt("SaleVault", await factory.implementation()),
        "InvalidParams",
      );
    });

    it("should reject fixed-price hard cap above token capacity", async function () {
      const now = await getBlockTimestamp();
      await expect(
        factory.connect(signers.creator).createSale(
          makeFixedParams({
            saleToken: saleTokenAddress,
            saleAmount: ethers.parseEther("1"),
            payToken: payTokenAddress,
            startTime: now + 1,
            endTime: now + 3600,
            price: 1000,
            softCap: 500,
            hardCap: 2000,
          }),
        ),
      ).to.be.revertedWithCustomError(
        await ethers.getContractAt("SaleVault", await factory.implementation()),
        "InvalidParams",
      );
    });

    it("should accept sale tokens with arbitrary decimals", async function () {
      const mockFactory = await ethers.getContractFactory("MockERC20");
      const sixDecToken = (await mockFactory.deploy("Six Dec", "SIX", 6)) as MockERC20;
      const sixDecAddress = await sixDecToken.getAddress();
      const saleAmount6 = ethers.parseUnits("1000", 6);
      await sixDecToken.mint(signers.creator.address, saleAmount6);
      await sixDecToken.connect(signers.creator).approve(factoryAddress, saleAmount6);

      const now = await getBlockTimestamp();
      const { vault } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: sixDecAddress,
          saleAmount: saleAmount6,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
          price: 1000,
          softCap: 500,
          hardCap: 1_000_000,
        }),
      );

      const sale = await vault.getSale();
      expect(sale.saleTokenScale).to.eq(10n ** 6n);
      expect(sale.saleAmount).to.eq(saleAmount6);
    });

    it("rejects double initialization on a clone", async function () {
      const now = await getBlockTimestamp();
      const { vault } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      // Direct re-init from anyone (including factory) should now fail.
      await expect(
        vault.initialize(
          makeFixedParams({
            saleToken: saleTokenAddress,
            payToken: payTokenAddress,
            startTime: now + 1,
            endTime: now + 3600,
          }),
          signers.creator.address,
        ),
      ).to.be.revertedWithCustomError(vault, "NotFactory");
    });
  });

  // ============================================================
  //                     CANCEL SALE
  // ============================================================

  describe("cancelSale", function () {
    it("should cancel and return tokens if no participants", async function () {
      const now = await getBlockTimestamp();
      const { vault } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      const balBefore = await saleToken.balanceOf(signers.creator.address);
      await vault.connect(signers.creator).cancelSale();
      const balAfter = await saleToken.balanceOf(signers.creator.address);
      expect(balAfter - balBefore).to.eq(saleAmount);
      expect((await vault.getSale()).status).to.eq(SaleStatus.Cancelled);
    });

    it("should revert if not creator", async function () {
      const now = await getBlockTimestamp();
      const { vault } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      await expect(vault.connect(signers.alice).cancelSale()).to.be.revertedWithCustomError(
        vault,
        "NotCreator",
      );
    });
  });

  // ============================================================
  //                     DEPOSIT
  // ============================================================

  describe("addDeposit", function () {
    let vault: SaleVault;
    let vaultAddress: string;

    beforeEach(async function () {
      const now = await getBlockTimestamp();
      const out = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 7200,
        }),
      );
      vault = out.vault;
      vaultAddress = out.vaultAddress;
      // Each test pays from this fixture; approve the vault generously.
      await payToken.connect(signers.alice).approve(vaultAddress, ethers.parseUnits("10000", 6));
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
    });

    it("should accept ERC-20 deposit", async function () {
      await vault.connect(signers.alice).addDeposit(1000);
      expect(await vault.deposits(signers.alice.address)).to.eq(1000);
    });

    it("should accumulate deposits", async function () {
      await vault.connect(signers.alice).addDeposit(400);
      await vault.connect(signers.alice).addDeposit(600);
      expect(await vault.deposits(signers.alice.address)).to.eq(1000);
    });

    it("should lock pay tokens", async function () {
      const before = await payToken.balanceOf(signers.alice.address);
      await vault.connect(signers.alice).addDeposit(1000);
      expect(before - (await payToken.balanceOf(signers.alice.address))).to.eq(1000);
    });

    it("should reject ETH accidentally sent to an ERC-20 deposit", async function () {
      await expect(
        vault.connect(signers.alice).addDeposit(1000, { value: 1 }),
      ).to.be.revertedWithCustomError(vault, "DepositMismatch");
    });
  });

  // ============================================================
  //                  CONTRIBUTE (Fixed Price)
  // ============================================================

  describe("contribute — Fixed Price", function () {
    let vault: SaleVault;
    let vaultAddress: string;

    beforeEach(async function () {
      const now = await getBlockTimestamp();
      const out = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 7200,
        }),
      );
      vault = out.vault;
      vaultAddress = out.vaultAddress;
      for (const s of [signers.alice, signers.bob, signers.charlie]) {
        await payToken.connect(s).approve(vaultAddress, ethers.parseUnits("10000", 6));
      }
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
    });

    it("should accept encrypted contribution", async function () {
      await vault.connect(signers.alice).addDeposit(2000);
      const enc = await fhevm.createEncryptedInput(vaultAddress, signers.alice.address).add64(1500).encrypt();
      await vault.connect(signers.alice).contribute(enc.handles[0], enc.inputProof, []);
      expect(await vault.hasParticipated(signers.alice.address)).to.eq(true);
      expect((await vault.getSale()).participantCount).to.eq(1);
      expect(await factory.salesByParticipant(signers.alice.address)).to.deep.eq([vaultAddress]);
    });

    it("should revert without deposit", async function () {
      const enc = await fhevm.createEncryptedInput(vaultAddress, signers.alice.address).add64(1000).encrypt();
      await expect(
        vault.connect(signers.alice).contribute(enc.handles[0], enc.inputProof, []),
      ).to.be.revertedWithCustomError(vault, "InsufficientDeposit");
    });

    it("should allow update without moving tokens", async function () {
      await vault.connect(signers.alice).addDeposit(3000);
      const enc1 = await fhevm.createEncryptedInput(vaultAddress, signers.alice.address).add64(1000).encrypt();
      await vault.connect(signers.alice).contribute(enc1.handles[0], enc1.inputProof, []);
      const balMid = await payToken.balanceOf(signers.alice.address);

      const enc2 = await fhevm.createEncryptedInput(vaultAddress, signers.alice.address).add64(2500).encrypt();
      await vault.connect(signers.alice).contribute(enc2.handles[0], enc2.inputProof, []);
      expect(await payToken.balanceOf(signers.alice.address)).to.eq(balMid);
      expect((await vault.getSale()).participantCount).to.eq(1);
      // Updating should NOT register the user a second time on the factory index.
      expect(await factory.salesByParticipant(signers.alice.address)).to.deep.eq([vaultAddress]);
    });

    it("should support multiple participants", async function () {
      for (const s of [signers.alice, signers.bob, signers.charlie]) {
        await vault.connect(s).addDeposit(2000);
        const enc = await fhevm.createEncryptedInput(vaultAddress, s.address).add64(1500).encrypt();
        await vault.connect(s).contribute(enc.handles[0], enc.inputProof, []);
      }
      expect((await vault.getSale()).participantCount).to.eq(3);
    });
  });

  // ============================================================
  //                  BID (Dutch Auction)
  // ============================================================

  describe("bid — Dutch Auction", function () {
    let vault: SaleVault;
    let vaultAddress: string;

    beforeEach(async function () {
      const now = await getBlockTimestamp();
      const out = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeDutchParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 7200,
          price: 500,
        }),
      );
      vault = out.vault;
      vaultAddress = out.vaultAddress;
      for (const s of [signers.alice, signers.bob, signers.charlie]) {
        await payToken.connect(s).approve(vaultAddress, ethers.parseUnits("10000", 6));
      }
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
    });

    it("should accept bid with user-chosen price", async function () {
      await vault.connect(signers.alice).addDeposit(3000);
      const enc = await fhevm.createEncryptedInput(vaultAddress, signers.alice.address).add64(2000).encrypt();
      await vault.connect(signers.alice).bid(1200, enc.handles[0], enc.inputProof, []);

      expect(await vault.hasParticipated(signers.alice.address)).to.eq(true);
      expect(await vault.userBidPrice(signers.alice.address)).to.eq(1200);
    });

    it("should revert if bid price below floor", async function () {
      await vault.connect(signers.alice).addDeposit(3000);
      const enc = await fhevm.createEncryptedInput(vaultAddress, signers.alice.address).add64(2000).encrypt();
      await expect(
        vault.connect(signers.alice).bid(400, enc.handles[0], enc.inputProof, []),
      ).to.be.revertedWithCustomError(vault, "PriceBelowFloor");
    });

    it("should allow updating bid price and amount", async function () {
      await vault.connect(signers.alice).addDeposit(3000);

      const enc1 = await fhevm.createEncryptedInput(vaultAddress, signers.alice.address).add64(1500).encrypt();
      await vault.connect(signers.alice).bid(1000, enc1.handles[0], enc1.inputProof, []);
      expect(await vault.userBidPrice(signers.alice.address)).to.eq(1000);

      const enc2 = await fhevm.createEncryptedInput(vaultAddress, signers.alice.address).add64(2500).encrypt();
      await vault.connect(signers.alice).bid(1500, enc2.handles[0], enc2.inputProof, []);
      expect(await vault.userBidPrice(signers.alice.address)).to.eq(1500);
      expect((await vault.getSale()).participantCount).to.eq(1);
    });

    it("should support multiple bidders at different prices", async function () {
      await vault.connect(signers.alice).addDeposit(3000);
      const encA = await fhevm.createEncryptedInput(vaultAddress, signers.alice.address).add64(2000).encrypt();
      await vault.connect(signers.alice).bid(2000, encA.handles[0], encA.inputProof, []);

      await vault.connect(signers.bob).addDeposit(2000);
      const encB = await fhevm.createEncryptedInput(vaultAddress, signers.bob.address).add64(1000).encrypt();
      await vault.connect(signers.bob).bid(800, encB.handles[0], encB.inputProof, []);

      await vault.connect(signers.charlie).addDeposit(2500);
      const encC = await fhevm.createEncryptedInput(vaultAddress, signers.charlie.address).add64(1500).encrypt();
      await vault.connect(signers.charlie).bid(1200, encC.handles[0], encC.inputProof, []);

      expect((await vault.getSale()).participantCount).to.eq(3);
      expect(await vault.userBidPrice(signers.alice.address)).to.eq(2000);
      expect(await vault.userBidPrice(signers.bob.address)).to.eq(800);
      expect(await vault.userBidPrice(signers.charlie.address)).to.eq(1200);
    });
  });

  // ============================================================
  //                     FINALIZE
  // ============================================================

  describe("finalize", function () {
    it("should fail sale if no participants", async function () {
      const now = await getBlockTimestamp();
      const { vault } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 5,
        }),
      );
      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine", []);

      const before = await saleToken.balanceOf(signers.creator.address);
      // Empty sale: requestFinalize short-circuits to Failed, no ACL is granted
      // so the reorg-window timelock isn't needed.
      await vault.requestFinalize();
      expect((await vault.getSale()).status).to.eq(SaleStatus.Failed);
      expect((await saleToken.balanceOf(signers.creator.address)) - before).to.eq(saleAmount);
    });

    it("should enter Finalizing for Fixed Price", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      await payToken.connect(signers.alice).approve(vaultAddress, ethers.parseUnits("10000", 6));
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      await vault.connect(signers.alice).addDeposit(2000);
      const enc = await fhevm.createEncryptedInput(vaultAddress, signers.alice.address).add64(1000).encrypt();
      await vault.connect(signers.alice).contribute(enc.handles[0], enc.inputProof, []);

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);

      await performFinalize(vault);
      expect((await vault.getSale()).status).to.eq(SaleStatus.Finalizing);
    });

    it("should enter Finalizing for Dutch Auction", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeDutchParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      await payToken.connect(signers.alice).approve(vaultAddress, ethers.parseUnits("10000", 6));
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      await vault.connect(signers.alice).addDeposit(3000);
      const enc = await fhevm.createEncryptedInput(vaultAddress, signers.alice.address).add64(2000).encrypt();
      await vault.connect(signers.alice).bid(1000, enc.handles[0], enc.inputProof, []);

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);

      await performFinalize(vault);
      expect((await vault.getSale()).status).to.eq(SaleStatus.Finalizing);
    });

    it("requestFinalize reverts if sale not ended", async function () {
      const now = await getBlockTimestamp();
      const { vault } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 7200,
        }),
      );
      await expect(vault.requestFinalize()).to.be.revertedWithCustomError(
        vault,
        "SaleNotEnded",
      );
    });

    it("requestFinalize twice reverts AlreadyRequested", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      await payToken.connect(signers.alice).approve(vaultAddress, ethers.parseUnits("10000", 6));
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      await vault.connect(signers.alice).addDeposit(2000);
      const enc = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add64(1000)
        .encrypt();
      await vault.connect(signers.alice).contribute(enc.handles[0], enc.inputProof, []);

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);

      await vault.requestFinalize();
      await expect(vault.requestFinalize()).to.be.revertedWithCustomError(
        vault,
        "AlreadyRequested",
      );
    });

    it("finalize without prior request reverts NotRequested", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      await payToken.connect(signers.alice).approve(vaultAddress, ethers.parseUnits("10000", 6));
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      await vault.connect(signers.alice).addDeposit(2000);
      const enc = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add64(1000)
        .encrypt();
      await vault.connect(signers.alice).contribute(enc.handles[0], enc.inputProof, []);

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);

      await expect(vault.finalize()).to.be.revertedWithCustomError(
        vault,
        "NotRequested",
      );
    });

    it("finalize before reorg window reverts ReorgWindow", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      await payToken.connect(signers.alice).approve(vaultAddress, ethers.parseUnits("10000", 6));
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      await vault.connect(signers.alice).addDeposit(2000);
      const enc = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add64(1000)
        .encrypt();
      await vault.connect(signers.alice).contribute(enc.handles[0], enc.inputProof, []);

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);

      await vault.requestFinalize();
      // Mine 93 blocks; the finalize() tx itself adds one more to land at
      // requestedAt + 94 — still inside the FINALIZE_REORG_DELAY = 95 window.
      for (let i = 0; i < 93; i++) {
        await ethers.provider.send("evm_mine", []);
      }
      await expect(vault.finalize()).to.be.revertedWithCustomError(
        vault,
        "ReorgWindow",
      );
      // One more mined block, plus the finalize() tx, lands at requestedAt + 95
      // and clears the window.
      await ethers.provider.send("evm_mine", []);
      await vault.finalize();
      expect((await vault.getSale()).status).to.eq(SaleStatus.Finalizing);
    });
  });

  // ============================================================
  //                     WITHDRAW DEPOSIT
  // ============================================================

  describe("withdrawDeposit", function () {
    it("should allow withdrawal after failure", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 60,
        }),
      );
      await payToken.connect(signers.alice).approve(vaultAddress, ethers.parseUnits("10000", 6));
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      await vault.connect(signers.alice).addDeposit(1000);

      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);
      await performFinalize(vault);

      const before = await payToken.balanceOf(signers.alice.address);
      await vault.connect(signers.alice).withdrawDeposit();
      expect((await payToken.balanceOf(signers.alice.address)) - before).to.eq(1000);
    });

    it("should allow withdrawal when not participated", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 7200,
        }),
      );
      await payToken.connect(signers.alice).approve(vaultAddress, ethers.parseUnits("10000", 6));
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      await vault.connect(signers.alice).addDeposit(1000);

      const before = await payToken.balanceOf(signers.alice.address);
      await vault.connect(signers.alice).withdrawDeposit();
      expect((await payToken.balanceOf(signers.alice.address)) - before).to.eq(1000);
    });

    it("should revert if participated and sale not finished", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 7200,
        }),
      );
      await payToken.connect(signers.alice).approve(vaultAddress, ethers.parseUnits("10000", 6));
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      await vault.connect(signers.alice).addDeposit(2000);
      const enc = await fhevm.createEncryptedInput(vaultAddress, signers.alice.address).add64(1000).encrypt();
      await vault.connect(signers.alice).contribute(enc.handles[0], enc.inputProof, []);

      await expect(vault.connect(signers.alice).withdrawDeposit()).to.be.revertedWithCustomError(
        vault,
        "NotFinished",
      );
    });
  });

  // ============================================================
  //                     SETTLEMENT
  // ============================================================

  describe("settlement", function () {
    it("should settle a fixed-price sale whose sale token has 6 decimals", async function () {
      const mockFactory = await ethers.getContractFactory("MockERC20");
      const sixDecToken = (await mockFactory.deploy("Six Dec", "SIX", 6)) as MockERC20;
      const sixDecAddress = await sixDecToken.getAddress();
      const saleAmount6 = ethers.parseUnits("100", 6);
      const pricePerWholeToken = 1_000_000n;
      await sixDecToken.mint(signers.creator.address, saleAmount6);
      await sixDecToken.connect(signers.creator).approve(factoryAddress, saleAmount6);

      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: sixDecAddress,
          saleAmount: saleAmount6,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
          price: pricePerWholeToken,
          softCap: 1_000_000,
          hardCap: 100_000_000,
        }),
      );
      for (const s of [signers.alice, signers.bob]) {
        await payToken.connect(s).approve(vaultAddress, ethers.parseUnits("10000", 6));
      }
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      const contribution = 5_000_000n;
      for (const s of [signers.alice, signers.bob]) {
        await vault.connect(s).addDeposit(contribution);
        const enc = await fhevm
          .createEncryptedInput(vaultAddress, s.address)
          .add64(contribution)
          .encrypt();
        await vault.connect(s).contribute(enc.handles[0], enc.inputProof, []);
      }

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);
      await performFinalize(vault);

      const handles = [
        await vault.getTotalContributedHandle(),
        await vault.getContributionHandle(signers.alice.address),
        await vault.getContributionHandle(signers.bob.address),
      ];
      const { values, proof } = await publicDecryptUint64(handles);
      await vault.settleFixed(values, proof);

      expect(await vault.allocations(signers.alice.address)).to.eq(5_000_000n);
      expect(await vault.allocations(signers.bob.address)).to.eq(5_000_000n);
      expect(await vault.deposits(signers.alice.address)).to.eq(0n);
      expect(await vault.deposits(signers.bob.address)).to.eq(0n);

      const sale = await vault.getSale();
      expect(sale.status).to.eq(SaleStatus.Settled);
      expect(sale.totalRaised).to.eq(10_000_000n);
      expect(sale.saleTokenScale).to.eq(10n ** 6n);
    });

    it("should settle fixed price from individual contributions when encrypted total wraps", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          saleAmount: ethers.parseEther("100"),
          payToken: ethers.ZeroAddress,
          startTime: now + 1,
          endTime: now + 3600,
          price: ethers.parseEther("1"),
          softCap: ethers.parseEther("15"),
          hardCap: UINT64_MAX,
        }),
      );
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      for (const s of [signers.alice, signers.bob]) {
        await vault.connect(s).addDeposit(0, { value: ethers.parseEther("10") });
        const enc = await fhevm
          .createEncryptedInput(vaultAddress, s.address)
          .add64(ethers.parseEther("10"))
          .encrypt();
        await vault.connect(s).contribute(enc.handles[0], enc.inputProof, []);
      }

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);
      await performFinalize(vault);

      const handles = [
        await vault.getTotalContributedHandle(),
        await vault.getContributionHandle(signers.alice.address),
        await vault.getContributionHandle(signers.bob.address),
      ];
      const { values, proof } = await publicDecryptUint64(handles);
      await vault.settleFixed(values, proof);

      const sale = await vault.getSale();
      expect(sale.status).to.eq(SaleStatus.Settled);
      expect(sale.totalRaised >= ethers.parseEther("15")).to.eq(true);
      expect(sale.totalRaised <= UINT64_MAX).to.eq(true);
      expect((await vault.allocations(signers.alice.address)) > 0n).to.eq(true);
      expect((await vault.allocations(signers.bob.address)) > 0n).to.eq(true);
    });

    it("should allocate an overflowing Dutch clearing price level pro-rata", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeDutchParams({
          saleToken: saleTokenAddress,
          saleAmount: ethers.parseEther("100"),
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
          price: 1,
          softCap: 100,
          hardCap: 200,
        }),
      );
      for (const s of [signers.alice, signers.bob]) {
        await payToken.connect(s).approve(vaultAddress, ethers.parseUnits("10000", 6));
      }
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      for (const s of [signers.alice, signers.bob]) {
        await vault.connect(s).addDeposit(60);
        const enc = await fhevm.createEncryptedInput(vaultAddress, s.address).add64(60).encrypt();
        await vault.connect(s).bid(1, enc.handles[0], enc.inputProof, []);
      }

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);
      await performFinalize(vault);

      const handles = [
        await vault.getBidAmountHandle(signers.alice.address),
        await vault.getBidAmountHandle(signers.bob.address),
      ];
      const { values, proof } = await publicDecryptUint64(handles);
      await vault.settleDutch(values, proof);

      expect(await vault.allocations(signers.alice.address)).to.eq(ethers.parseEther("50"));
      expect(await vault.allocations(signers.bob.address)).to.eq(ethers.parseEther("50"));
      expect(await vault.deposits(signers.alice.address)).to.eq(10);
      expect(await vault.deposits(signers.bob.address)).to.eq(10);

      const sale = await vault.getSale();
      expect(sale.status).to.eq(SaleStatus.Settled);
      expect(sale.totalRaised).to.eq(100);
    });

    it("should cap Dutch settlement at hard cap", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeDutchParams({
          saleToken: saleTokenAddress,
          saleAmount: ethers.parseEther("100"),
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
          price: 1,
          softCap: 1,
          hardCap: 50,
        }),
      );
      for (const s of [signers.alice, signers.bob]) {
        await payToken.connect(s).approve(vaultAddress, ethers.parseUnits("10000", 6));
      }
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      for (const s of [signers.alice, signers.bob]) {
        await vault.connect(s).addDeposit(60);
        const enc = await fhevm.createEncryptedInput(vaultAddress, s.address).add64(60).encrypt();
        await vault.connect(s).bid(1, enc.handles[0], enc.inputProof, []);
      }

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);
      await performFinalize(vault);

      const handles = [
        await vault.getBidAmountHandle(signers.alice.address),
        await vault.getBidAmountHandle(signers.bob.address),
      ];
      const { values, proof } = await publicDecryptUint64(handles);
      await vault.settleDutch(values, proof);

      expect(await vault.allocations(signers.alice.address)).to.eq(ethers.parseEther("25"));
      expect(await vault.allocations(signers.bob.address)).to.eq(ethers.parseEther("25"));
      expect(await vault.deposits(signers.alice.address)).to.eq(35);
      expect(await vault.deposits(signers.bob.address)).to.eq(35);

      const sale = await vault.getSale();
      expect(sale.status).to.eq(SaleStatus.Settled);
      expect(sale.totalRaised).to.eq(50);
    });

    it("should settle Dutch bids whose raw sum exceeds uint64 max", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeDutchParams({
          saleToken: saleTokenAddress,
          saleAmount: ethers.parseEther("100"),
          payToken: ethers.ZeroAddress,
          startTime: now + 1,
          endTime: now + 3600,
          price: ethers.parseEther("1"),
          softCap: ethers.parseEther("1"),
          hardCap: UINT64_MAX,
        }),
      );
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      for (const s of [signers.alice, signers.bob]) {
        await vault.connect(s).addDeposit(0, { value: ethers.parseEther("10") });
        const enc = await fhevm
          .createEncryptedInput(vaultAddress, s.address)
          .add64(ethers.parseEther("10"))
          .encrypt();
        await vault.connect(s).bid(ethers.parseEther("1"), enc.handles[0], enc.inputProof, []);
      }

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);
      await performFinalize(vault);

      const handles = [
        await vault.getBidAmountHandle(signers.alice.address),
        await vault.getBidAmountHandle(signers.bob.address),
      ];
      const { values, proof } = await publicDecryptUint64(handles);
      await vault.settleDutch(values, proof);

      const sale = await vault.getSale();
      expect(sale.status).to.eq(SaleStatus.Settled);
      expect(sale.totalRaised >= ethers.parseEther("1")).to.eq(true);
      expect(sale.totalRaised <= UINT64_MAX).to.eq(true);
    });

    it("should fail Dutch settlement when actual uniform-price payment misses soft cap", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeDutchParams({
          saleToken: saleTokenAddress,
          saleAmount: ethers.parseEther("100"),
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
          price: 1,
          softCap: 150,
          hardCap: 200,
        }),
      );
      await payToken.connect(signers.alice).approve(vaultAddress, ethers.parseUnits("10000", 6));
      await payToken.connect(signers.bob).approve(vaultAddress, ethers.parseUnits("10000", 6));
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      await vault.connect(signers.alice).addDeposit(100);
      const encAlice = await fhevm.createEncryptedInput(vaultAddress, signers.alice.address).add64(100).encrypt();
      await vault.connect(signers.alice).bid(2, encAlice.handles[0], encAlice.inputProof, []);

      await vault.connect(signers.bob).addDeposit(60);
      const encBob = await fhevm.createEncryptedInput(vaultAddress, signers.bob.address).add64(60).encrypt();
      await vault.connect(signers.bob).bid(1, encBob.handles[0], encBob.inputProof, []);

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);
      await performFinalize(vault);

      const handles = [
        await vault.getBidAmountHandle(signers.alice.address),
        await vault.getBidAmountHandle(signers.bob.address),
      ];
      const { values, proof } = await publicDecryptUint64(handles);
      const creatorBalanceBefore = await saleToken.balanceOf(signers.creator.address);
      await vault.settleDutch(values, proof);

      const sale = await vault.getSale();
      expect(sale.status).to.eq(SaleStatus.Failed);
      expect(await vault.deposits(signers.alice.address)).to.eq(100);
      expect(await vault.deposits(signers.bob.address)).to.eq(60);
      expect((await saleToken.balanceOf(signers.creator.address)) - creatorBalanceBefore).to.eq(
        ethers.parseEther("100"),
      );
    });
  });

  // ============================================================
  //                     ETH SALES
  // ============================================================

  describe("ETH sales", function () {
    it("should accept ETH deposit", async function () {
      const now = await getBlockTimestamp();
      const { vault } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: ethers.ZeroAddress,
          startTime: now + 1,
          endTime: now + 7200,
          price: ethers.parseEther("0.001"),
          softCap: ethers.parseEther("0.01"),
          hardCap: ethers.parseEther("1"),
        }),
      );
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      await vault.connect(signers.alice).addDeposit(0, { value: ethers.parseEther("0.5") });
      expect(await vault.deposits(signers.alice.address)).to.eq(ethers.parseEther("0.5"));
    });

    it("should place encrypted bid on ETH Dutch sale", async function () {
      const now = await getBlockTimestamp();
      const { vault, vaultAddress } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeDutchParams({
          saleToken: saleTokenAddress,
          payToken: ethers.ZeroAddress,
          startTime: now + 1,
          endTime: now + 7200,
          price: ethers.parseEther("0.0005"),
          softCap: ethers.parseEther("0.01"),
          hardCap: ethers.parseEther("1"),
        }),
      );
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      await vault.connect(signers.alice).addDeposit(0, { value: ethers.parseEther("0.5") });

      const enc = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add64(ethers.parseEther("0.3"))
        .encrypt();

      await vault.connect(signers.alice).bid(ethers.parseEther("0.001"), enc.handles[0], enc.inputProof, []);
      expect(await vault.hasParticipated(signers.alice.address)).to.eq(true);
      expect(await vault.userBidPrice(signers.alice.address)).to.eq(ethers.parseEther("0.001"));
    });
  });

  // ============================================================
  //                  CONSTANTS & VIEWS
  // ============================================================

  describe("constants & views", function () {
    it("vault has correct MAX_PARTICIPANTS", async function () {
      const now = await getBlockTimestamp();
      const { vault } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      expect(await vault.MAX_PARTICIPANTS()).to.eq(50);
    });

    it("returns 0 claimable when not settled", async function () {
      const now = await getBlockTimestamp();
      const { vault } = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      expect(await vault.claimable(signers.alice.address)).to.eq(0);
    });

    it("salesByParticipant tracks contributors but not deposit-only users", async function () {
      const now = await getBlockTimestamp();
      const a = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 7200,
        }),
      );
      const b = await createSaleAndGetVault(
        factory,
        signers.creator,
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 7200,
        }),
      );
      for (const s of [signers.alice, signers.bob, signers.charlie]) {
        await payToken.connect(s).approve(a.vaultAddress, ethers.parseUnits("10000", 6));
        await payToken.connect(s).approve(b.vaultAddress, ethers.parseUnits("10000", 6));
      }
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      // Alice contributes to both, bob to only the second.
      for (const v of [a.vault, b.vault]) {
        await v.connect(signers.alice).addDeposit(2000);
        const enc = await fhevm.createEncryptedInput(await v.getAddress(), signers.alice.address).add64(1000).encrypt();
        await v.connect(signers.alice).contribute(enc.handles[0], enc.inputProof, []);
      }
      await b.vault.connect(signers.bob).addDeposit(2000);
      const encBob = await fhevm
        .createEncryptedInput(b.vaultAddress, signers.bob.address)
        .add64(800)
        .encrypt();
      await b.vault.connect(signers.bob).contribute(encBob.handles[0], encBob.inputProof, []);

      // Charlie only deposits, no contribution.
      await a.vault.connect(signers.charlie).addDeposit(500);

      expect(await factory.salesByParticipant(signers.alice.address)).to.deep.eq([
        a.vaultAddress,
        b.vaultAddress,
      ]);
      expect(await factory.salesByParticipant(signers.bob.address)).to.deep.eq([b.vaultAddress]);
      expect((await factory.salesByParticipant(signers.charlie.address)).length).to.eq(0);
    });
  });
});
