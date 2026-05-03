import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { SealPad, SealPad__factory, MockERC20 } from "../types";
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
  const sealPadFactory = (await ethers.getContractFactory("SealPad")) as SealPad__factory;
  const sealPad = (await sealPadFactory.deploy()) as SealPad;
  const sealPadAddress = await sealPad.getAddress();

  const mockFactory = await ethers.getContractFactory("MockERC20");
  const saleToken = (await mockFactory.deploy("Sale Token", "SALE", 18)) as MockERC20;
  const saleTokenAddress = await saleToken.getAddress();
  const payToken = (await mockFactory.deploy("Mock USDC", "USDC", 6)) as MockERC20;
  const payTokenAddress = await payToken.getAddress();

  const saleAmount = ethers.parseEther("10000");
  await saleToken.mint(signers.creator.address, saleAmount);
  await saleToken.connect(signers.creator).approve(sealPadAddress, saleAmount);

  const payAmount = ethers.parseUnits("10000", 6);
  for (const s of [signers.alice, signers.bob, signers.charlie]) {
    await payToken.mint(s.address, payAmount);
    await payToken.connect(s).approve(sealPadAddress, payAmount);
  }

  return { sealPad, sealPadAddress, saleToken, saleTokenAddress, payToken, payTokenAddress, saleAmount };
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
    price: overrides.price ?? 500, // floor price
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

describe("SealPad", function () {
  let signers: Signers;
  let sealPad: SealPad;
  let sealPadAddress: string;
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
    ({ sealPad, sealPadAddress, saleToken, saleTokenAddress, payToken, payTokenAddress, saleAmount } =
      await deployFixture(signers));
  });

  // ============================================================
  //                     CREATE SALE
  // ============================================================

  describe("createSale", function () {
    it("should create a Fixed Price sale and lock tokens", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      const sale = await sealPad.getSale(0);
      expect(sale.creator).to.eq(signers.creator.address);
      expect(sale.saleType).to.eq(SaleType.FixedPrice);
      expect(sale.status).to.eq(SaleStatus.Active);
      expect(sale.price).to.eq(1000);
      expect(await saleToken.balanceOf(sealPadAddress)).to.eq(saleAmount);
    });

    it("should create a Dutch Auction sale with floor price", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
        makeDutchParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
          price: 800,
        }),
      );
      const sale = await sealPad.getSale(0);
      expect(sale.saleType).to.eq(SaleType.DutchAuction);
      expect(sale.price).to.eq(800); // floor price
    });

    it("should revert with softCap > hardCap", async function () {
      const now = await getBlockTimestamp();
      await expect(
        sealPad.connect(signers.creator).createSale(
          makeFixedParams({
            saleToken: saleTokenAddress,
            payToken: payTokenAddress,
            startTime: now + 1,
            endTime: now + 3600,
            softCap: 5000,
            hardCap: 1000,
          }),
        ),
      ).to.be.revertedWithCustomError(sealPad, "InvalidParams");
    });

    it("should revert with price zero", async function () {
      const now = await getBlockTimestamp();
      await expect(
        sealPad.connect(signers.creator).createSale(
          makeFixedParams({
            saleToken: saleTokenAddress,
            payToken: payTokenAddress,
            startTime: now + 1,
            endTime: now + 3600,
            price: 0,
          }),
        ),
      ).to.be.revertedWithCustomError(sealPad, "InvalidParams");
    });

    it("should reject fixed-price hard cap above token capacity", async function () {
      const now = await getBlockTimestamp();
      await expect(
        sealPad.connect(signers.creator).createSale(
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
      ).to.be.revertedWithCustomError(sealPad, "InvalidParams");
    });

    it("should accept sale tokens with arbitrary decimals", async function () {
      const mockFactory = await ethers.getContractFactory("MockERC20");
      const sixDecToken = (await mockFactory.deploy("Six Dec", "SIX", 6)) as MockERC20;
      const sixDecAddress = await sixDecToken.getAddress();
      const saleAmount6 = ethers.parseUnits("1000", 6);
      await sixDecToken.mint(signers.creator.address, saleAmount6);
      await sixDecToken.connect(signers.creator).approve(sealPadAddress, saleAmount6);

      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
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

      const sale = await sealPad.getSale(0);
      expect(sale.saleTokenScale).to.eq(10n ** 6n);
      expect(sale.saleAmount).to.eq(saleAmount6);
    });
  });

  // ============================================================
  //                     CANCEL SALE
  // ============================================================

  describe("cancelSale", function () {
    it("should cancel and return tokens if no participants", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      const balBefore = await saleToken.balanceOf(signers.creator.address);
      await sealPad.connect(signers.creator).cancelSale(0);
      const balAfter = await saleToken.balanceOf(signers.creator.address);
      expect(balAfter - balBefore).to.eq(saleAmount);
      expect((await sealPad.getSale(0)).status).to.eq(SaleStatus.Cancelled);
    });

    it("should revert if not creator", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      await expect(sealPad.connect(signers.alice).cancelSale(0)).to.be.revertedWithCustomError(sealPad, "NotCreator");
    });
  });

  // ============================================================
  //                     DEPOSIT
  // ============================================================

  describe("addDeposit", function () {
    beforeEach(async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 7200,
        }),
      );
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
    });

    it("should accept ERC-20 deposit", async function () {
      await sealPad.connect(signers.alice).addDeposit(0, 1000);
      expect(await sealPad.deposits(0, signers.alice.address)).to.eq(1000);
    });

    it("should accumulate deposits", async function () {
      await sealPad.connect(signers.alice).addDeposit(0, 400);
      await sealPad.connect(signers.alice).addDeposit(0, 600);
      expect(await sealPad.deposits(0, signers.alice.address)).to.eq(1000);
    });

    it("should lock pay tokens", async function () {
      const before = await payToken.balanceOf(signers.alice.address);
      await sealPad.connect(signers.alice).addDeposit(0, 1000);
      expect(before - (await payToken.balanceOf(signers.alice.address))).to.eq(1000);
    });

    it("should reject ETH accidentally sent to an ERC-20 deposit", async function () {
      await expect(sealPad.connect(signers.alice).addDeposit(0, 1000, { value: 1 })).to.be.revertedWithCustomError(
        sealPad,
        "DepositMismatch",
      );
    });
  });

  // ============================================================
  //                  CONTRIBUTE (Fixed Price)
  // ============================================================

  describe("contribute — Fixed Price", function () {
    beforeEach(async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 7200,
        }),
      );
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
    });

    it("should accept encrypted contribution", async function () {
      await sealPad.connect(signers.alice).addDeposit(0, 2000);
      const enc = await fhevm.createEncryptedInput(sealPadAddress, signers.alice.address).add64(1500).encrypt();
      await sealPad.connect(signers.alice).contribute(0, enc.handles[0], enc.inputProof, []);
      expect(await sealPad.hasParticipated(0, signers.alice.address)).to.eq(true);
      expect((await sealPad.getSale(0)).participantCount).to.eq(1);
    });

    it("should revert without deposit", async function () {
      const enc = await fhevm.createEncryptedInput(sealPadAddress, signers.alice.address).add64(1000).encrypt();
      await expect(
        sealPad.connect(signers.alice).contribute(0, enc.handles[0], enc.inputProof, []),
      ).to.be.revertedWithCustomError(sealPad, "InsufficientDeposit");
    });

    it("should allow update without moving tokens", async function () {
      await sealPad.connect(signers.alice).addDeposit(0, 3000);
      const enc1 = await fhevm.createEncryptedInput(sealPadAddress, signers.alice.address).add64(1000).encrypt();
      await sealPad.connect(signers.alice).contribute(0, enc1.handles[0], enc1.inputProof, []);
      const balMid = await payToken.balanceOf(signers.alice.address);

      const enc2 = await fhevm.createEncryptedInput(sealPadAddress, signers.alice.address).add64(2500).encrypt();
      await sealPad.connect(signers.alice).contribute(0, enc2.handles[0], enc2.inputProof, []);
      expect(await payToken.balanceOf(signers.alice.address)).to.eq(balMid);
      expect((await sealPad.getSale(0)).participantCount).to.eq(1);
    });

    it("should support multiple participants", async function () {
      for (const s of [signers.alice, signers.bob, signers.charlie]) {
        await sealPad.connect(s).addDeposit(0, 2000);
        const enc = await fhevm.createEncryptedInput(sealPadAddress, s.address).add64(1500).encrypt();
        await sealPad.connect(s).contribute(0, enc.handles[0], enc.inputProof, []);
      }
      expect((await sealPad.getSale(0)).participantCount).to.eq(3);
    });
  });

  // ============================================================
  //                  BID (Dutch Auction)
  // ============================================================

  describe("bid — Dutch Auction", function () {
    beforeEach(async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
        makeDutchParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 7200,
          price: 500,
        }),
      );
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
    });

    it("should accept bid with user-chosen price", async function () {
      await sealPad.connect(signers.alice).addDeposit(0, 3000);
      const enc = await fhevm.createEncryptedInput(sealPadAddress, signers.alice.address).add64(2000).encrypt();
      await sealPad.connect(signers.alice).bid(0, 1200, enc.handles[0], enc.inputProof, []);

      expect(await sealPad.hasParticipated(0, signers.alice.address)).to.eq(true);
      expect(await sealPad.userBidPrice(0, signers.alice.address)).to.eq(1200);
    });

    it("should revert if bid price below floor", async function () {
      await sealPad.connect(signers.alice).addDeposit(0, 3000);
      const enc = await fhevm.createEncryptedInput(sealPadAddress, signers.alice.address).add64(2000).encrypt();
      await expect(
        sealPad.connect(signers.alice).bid(0, 400, enc.handles[0], enc.inputProof, []),
      ).to.be.revertedWithCustomError(sealPad, "PriceBelowFloor");
    });

    it("should allow updating bid price and amount", async function () {
      await sealPad.connect(signers.alice).addDeposit(0, 3000);

      const enc1 = await fhevm.createEncryptedInput(sealPadAddress, signers.alice.address).add64(1500).encrypt();
      await sealPad.connect(signers.alice).bid(0, 1000, enc1.handles[0], enc1.inputProof, []);
      expect(await sealPad.userBidPrice(0, signers.alice.address)).to.eq(1000);

      const enc2 = await fhevm.createEncryptedInput(sealPadAddress, signers.alice.address).add64(2500).encrypt();
      await sealPad.connect(signers.alice).bid(0, 1500, enc2.handles[0], enc2.inputProof, []);
      expect(await sealPad.userBidPrice(0, signers.alice.address)).to.eq(1500);
      expect((await sealPad.getSale(0)).participantCount).to.eq(1);
    });

    it("should support multiple bidders at different prices", async function () {
      await sealPad.connect(signers.alice).addDeposit(0, 3000);
      const encA = await fhevm.createEncryptedInput(sealPadAddress, signers.alice.address).add64(2000).encrypt();
      await sealPad.connect(signers.alice).bid(0, 2000, encA.handles[0], encA.inputProof, []);

      await sealPad.connect(signers.bob).addDeposit(0, 2000);
      const encB = await fhevm.createEncryptedInput(sealPadAddress, signers.bob.address).add64(1000).encrypt();
      await sealPad.connect(signers.bob).bid(0, 800, encB.handles[0], encB.inputProof, []);

      await sealPad.connect(signers.charlie).addDeposit(0, 2500);
      const encC = await fhevm.createEncryptedInput(sealPadAddress, signers.charlie.address).add64(1500).encrypt();
      await sealPad.connect(signers.charlie).bid(0, 1200, encC.handles[0], encC.inputProof, []);

      expect((await sealPad.getSale(0)).participantCount).to.eq(3);
      expect(await sealPad.userBidPrice(0, signers.alice.address)).to.eq(2000);
      expect(await sealPad.userBidPrice(0, signers.bob.address)).to.eq(800);
      expect(await sealPad.userBidPrice(0, signers.charlie.address)).to.eq(1200);
    });
  });

  // ============================================================
  //                     FINALIZE
  // ============================================================

  describe("finalize", function () {
    it("should fail sale if no participants", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
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
      await sealPad.finalize(0);
      expect((await sealPad.getSale(0)).status).to.eq(SaleStatus.Failed);
      expect((await saleToken.balanceOf(signers.creator.address)) - before).to.eq(saleAmount);
    });

    it("should enter Finalizing for Fixed Price", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      await sealPad.connect(signers.alice).addDeposit(0, 2000);
      const enc = await fhevm.createEncryptedInput(sealPadAddress, signers.alice.address).add64(1000).encrypt();
      await sealPad.connect(signers.alice).contribute(0, enc.handles[0], enc.inputProof, []);

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);

      await sealPad.finalize(0);
      expect((await sealPad.getSale(0)).status).to.eq(SaleStatus.Finalizing);
    });

    it("should enter Finalizing for Dutch Auction", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
        makeDutchParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      await sealPad.connect(signers.alice).addDeposit(0, 3000);
      const enc = await fhevm.createEncryptedInput(sealPadAddress, signers.alice.address).add64(2000).encrypt();
      await sealPad.connect(signers.alice).bid(0, 1000, enc.handles[0], enc.inputProof, []);

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);

      await sealPad.finalize(0);
      expect((await sealPad.getSale(0)).status).to.eq(SaleStatus.Finalizing);
    });

    it("should revert if sale not ended", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 7200,
        }),
      );
      await expect(sealPad.finalize(0)).to.be.revertedWithCustomError(sealPad, "SaleNotEnded");
    });
  });

  // ============================================================
  //                     WITHDRAW DEPOSIT
  // ============================================================

  describe("withdrawDeposit", function () {
    it("should allow withdrawal after failure", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 5,
        }),
      );
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      await sealPad.connect(signers.alice).addDeposit(0, 1000);

      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine", []);
      await sealPad.finalize(0);

      const before = await payToken.balanceOf(signers.alice.address);
      await sealPad.connect(signers.alice).withdrawDeposit(0);
      expect((await payToken.balanceOf(signers.alice.address)) - before).to.eq(1000);
    });

    it("should allow withdrawal when not participated", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 7200,
        }),
      );
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      await sealPad.connect(signers.alice).addDeposit(0, 1000);

      const before = await payToken.balanceOf(signers.alice.address);
      await sealPad.connect(signers.alice).withdrawDeposit(0);
      expect((await payToken.balanceOf(signers.alice.address)) - before).to.eq(1000);
    });

    it("should revert if participated and sale not finished", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 7200,
        }),
      );
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      await sealPad.connect(signers.alice).addDeposit(0, 2000);
      const enc = await fhevm.createEncryptedInput(sealPadAddress, signers.alice.address).add64(1000).encrypt();
      await sealPad.connect(signers.alice).contribute(0, enc.handles[0], enc.inputProof, []);

      await expect(sealPad.connect(signers.alice).withdrawDeposit(0)).to.be.revertedWithCustomError(
        sealPad,
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
      // 100 whole sale tokens, each costing 1 USDC raw (= 1e-6 USDC).
      const saleAmount6 = ethers.parseUnits("100", 6); // 100e6 raw
      const pricePerWholeToken = 1_000_000n; // 1 USDC per whole sale token
      await sixDecToken.mint(signers.creator.address, saleAmount6);
      await sixDecToken.connect(signers.creator).approve(sealPadAddress, saleAmount6);

      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
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
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      // Alice and Bob each buy 5 whole sale tokens (= 5 USDC raw of payment).
      const contribution = 5_000_000n;
      for (const s of [signers.alice, signers.bob]) {
        await sealPad.connect(s).addDeposit(0, contribution);
        const enc = await fhevm
          .createEncryptedInput(sealPadAddress, s.address)
          .add64(contribution)
          .encrypt();
        await sealPad.connect(s).contribute(0, enc.handles[0], enc.inputProof, []);
      }

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);
      await sealPad.finalize(0);

      const handles = [
        await sealPad.getTotalContributedHandle(0),
        await sealPad.getContributionHandle(0, signers.alice.address),
        await sealPad.getContributionHandle(0, signers.bob.address),
      ];
      const { values, proof } = await publicDecryptUint64(handles);
      await sealPad.settleFixed(0, values, proof);

      // Each should get 5 whole sale tokens = 5e6 raw, deposit fully spent.
      expect(await sealPad.allocations(0, signers.alice.address)).to.eq(5_000_000n);
      expect(await sealPad.allocations(0, signers.bob.address)).to.eq(5_000_000n);
      expect(await sealPad.deposits(0, signers.alice.address)).to.eq(0n);
      expect(await sealPad.deposits(0, signers.bob.address)).to.eq(0n);

      const sale = await sealPad.getSale(0);
      expect(sale.status).to.eq(SaleStatus.Settled);
      expect(sale.totalRaised).to.eq(10_000_000n);
      expect(sale.saleTokenScale).to.eq(10n ** 6n);
    });

    it("should settle fixed price from individual contributions when encrypted total wraps", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
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
        await sealPad.connect(s).addDeposit(0, 0, { value: ethers.parseEther("10") });
        const enc = await fhevm
          .createEncryptedInput(sealPadAddress, s.address)
          .add64(ethers.parseEther("10"))
          .encrypt();
        await sealPad.connect(s).contribute(0, enc.handles[0], enc.inputProof, []);
      }

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);
      await sealPad.finalize(0);

      const handles = [
        await sealPad.getTotalContributedHandle(0),
        await sealPad.getContributionHandle(0, signers.alice.address),
        await sealPad.getContributionHandle(0, signers.bob.address),
      ];
      const { values, proof } = await publicDecryptUint64(handles);
      await sealPad.settleFixed(0, values, proof);

      const sale = await sealPad.getSale(0);
      expect(sale.status).to.eq(SaleStatus.Settled);
      expect(sale.totalRaised >= ethers.parseEther("15")).to.eq(true);
      expect(sale.totalRaised <= UINT64_MAX).to.eq(true);
      expect((await sealPad.allocations(0, signers.alice.address)) > 0n).to.eq(true);
      expect((await sealPad.allocations(0, signers.bob.address)) > 0n).to.eq(true);
    });

    it("should allocate an overflowing Dutch clearing price level pro-rata", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
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
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      for (const s of [signers.alice, signers.bob]) {
        await sealPad.connect(s).addDeposit(0, 60);
        const enc = await fhevm.createEncryptedInput(sealPadAddress, s.address).add64(60).encrypt();
        await sealPad.connect(s).bid(0, 1, enc.handles[0], enc.inputProof, []);
      }

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);
      await sealPad.finalize(0);

      const handles = [
        await sealPad.getBidAmountHandle(0, signers.alice.address),
        await sealPad.getBidAmountHandle(0, signers.bob.address),
      ];
      const { values, proof } = await publicDecryptUint64(handles);
      await sealPad.settleDutch(0, values, proof);

      expect(await sealPad.allocations(0, signers.alice.address)).to.eq(ethers.parseEther("50"));
      expect(await sealPad.allocations(0, signers.bob.address)).to.eq(ethers.parseEther("50"));
      expect(await sealPad.deposits(0, signers.alice.address)).to.eq(10);
      expect(await sealPad.deposits(0, signers.bob.address)).to.eq(10);

      const sale = await sealPad.getSale(0);
      expect(sale.status).to.eq(SaleStatus.Settled);
      expect(sale.totalRaised).to.eq(100);
    });

    it("should cap Dutch settlement at hard cap", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
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
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      for (const s of [signers.alice, signers.bob]) {
        await sealPad.connect(s).addDeposit(0, 60);
        const enc = await fhevm.createEncryptedInput(sealPadAddress, s.address).add64(60).encrypt();
        await sealPad.connect(s).bid(0, 1, enc.handles[0], enc.inputProof, []);
      }

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);
      await sealPad.finalize(0);

      const handles = [
        await sealPad.getBidAmountHandle(0, signers.alice.address),
        await sealPad.getBidAmountHandle(0, signers.bob.address),
      ];
      const { values, proof } = await publicDecryptUint64(handles);
      await sealPad.settleDutch(0, values, proof);

      expect(await sealPad.allocations(0, signers.alice.address)).to.eq(ethers.parseEther("25"));
      expect(await sealPad.allocations(0, signers.bob.address)).to.eq(ethers.parseEther("25"));
      expect(await sealPad.deposits(0, signers.alice.address)).to.eq(35);
      expect(await sealPad.deposits(0, signers.bob.address)).to.eq(35);

      const sale = await sealPad.getSale(0);
      expect(sale.status).to.eq(SaleStatus.Settled);
      expect(sale.totalRaised).to.eq(50);
    });

    it("should settle Dutch bids whose raw sum exceeds uint64 max", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
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
        await sealPad.connect(s).addDeposit(0, 0, { value: ethers.parseEther("10") });
        const enc = await fhevm
          .createEncryptedInput(sealPadAddress, s.address)
          .add64(ethers.parseEther("10"))
          .encrypt();
        await sealPad.connect(s).bid(0, ethers.parseEther("1"), enc.handles[0], enc.inputProof, []);
      }

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);
      await sealPad.finalize(0);

      const handles = [
        await sealPad.getBidAmountHandle(0, signers.alice.address),
        await sealPad.getBidAmountHandle(0, signers.bob.address),
      ];
      const { values, proof } = await publicDecryptUint64(handles);
      await sealPad.settleDutch(0, values, proof);

      const sale = await sealPad.getSale(0);
      expect(sale.status).to.eq(SaleStatus.Settled);
      expect(sale.totalRaised >= ethers.parseEther("1")).to.eq(true);
      expect(sale.totalRaised <= UINT64_MAX).to.eq(true);
    });

    it("should fail Dutch settlement when actual uniform-price payment misses soft cap", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
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
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      await sealPad.connect(signers.alice).addDeposit(0, 100);
      const encAlice = await fhevm.createEncryptedInput(sealPadAddress, signers.alice.address).add64(100).encrypt();
      await sealPad.connect(signers.alice).bid(0, 2, encAlice.handles[0], encAlice.inputProof, []);

      await sealPad.connect(signers.bob).addDeposit(0, 60);
      const encBob = await fhevm.createEncryptedInput(sealPadAddress, signers.bob.address).add64(60).encrypt();
      await sealPad.connect(signers.bob).bid(0, 1, encBob.handles[0], encBob.inputProof, []);

      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);
      await sealPad.finalize(0);

      const handles = [
        await sealPad.getBidAmountHandle(0, signers.alice.address),
        await sealPad.getBidAmountHandle(0, signers.bob.address),
      ];
      const { values, proof } = await publicDecryptUint64(handles);
      const creatorBalanceBefore = await saleToken.balanceOf(signers.creator.address);
      await sealPad.settleDutch(0, values, proof);

      const sale = await sealPad.getSale(0);
      expect(sale.status).to.eq(SaleStatus.Failed);
      expect(await sealPad.deposits(0, signers.alice.address)).to.eq(100);
      expect(await sealPad.deposits(0, signers.bob.address)).to.eq(60);
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
      await sealPad.connect(signers.creator).createSale(
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

      await sealPad.connect(signers.alice).addDeposit(0, 0, { value: ethers.parseEther("0.5") });
      expect(await sealPad.deposits(0, signers.alice.address)).to.eq(ethers.parseEther("0.5"));
    });

    it("should place encrypted bid on ETH Dutch sale", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
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

      await sealPad.connect(signers.alice).addDeposit(0, 0, { value: ethers.parseEther("0.5") });

      const enc = await fhevm
        .createEncryptedInput(sealPadAddress, signers.alice.address)
        .add64(ethers.parseEther("0.3"))
        .encrypt();

      await sealPad.connect(signers.alice).bid(0, ethers.parseEther("0.001"), enc.handles[0], enc.inputProof, []);
      expect(await sealPad.hasParticipated(0, signers.alice.address)).to.eq(true);
      expect(await sealPad.userBidPrice(0, signers.alice.address)).to.eq(ethers.parseEther("0.001"));
    });
  });

  // ============================================================
  //                     CONSTANTS & VIEWS
  // ============================================================

  describe("constants & views", function () {
    it("should have correct MAX_PARTICIPANTS", async function () {
      expect(await sealPad.MAX_PARTICIPANTS()).to.eq(50);
    });

    it("should return 0 claimable when not settled", async function () {
      const now = await getBlockTimestamp();
      await sealPad.connect(signers.creator).createSale(
        makeFixedParams({
          saleToken: saleTokenAddress,
          payToken: payTokenAddress,
          startTime: now + 1,
          endTime: now + 3600,
        }),
      );
      expect(await sealPad.claimable(0, signers.alice.address)).to.eq(0);
    });
  });
});
