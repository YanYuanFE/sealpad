# SealPad — Technical Design Document

> Confidential Token Sale Platform powered by Zama FHE
>
> Zama Developer Program — Mainnet Season 2 (Builder Track)

---

## 1. Problem Statement

当前链上 Launchpad（IDO/ICO）的核心问题：

1. **投入金额公开** — 所有人都能看到你买了多少，暴露财务信息和投资策略
2. **MEV 攻击** — 机器人抢跑交易，抬高 gas 或夹击普通用户
3. **鲸鱼操纵** — 大额参与者压制小额投资者，或利用信息优势调整策略
4. **机构无法参与** — 公开销售暴露机构的订单流和战略意图，迫使机构走场外私募
5. **价格发现失效** — 固定价格无法反映真实需求，经常导致上线即暴涨或暴跌

**SealPad 用 FHE 解决这些问题**: 投入金额全程加密，合约在密文上计算分配。支持密封荷兰式拍卖（Zama 自己代币销售使用的机制），实现链上首个隐私价格发现。

---

## 2. Product Overview

### 2.1 与 PrivacyPad（已获奖项目）的差异化

| 特性 | PrivacyPad | SealPad |
|------|-----------|---------|
| 销售模式 | 仅固定价格 | Fixed Price + **Dutch Auction** |
| 价格发现 | 无 | **密封荷兰式拍卖清算价机制** |
| 支付方式 | 仅 cWETH | **ETH + 任意 ERC-20**（独立存款池） |
| 超额认购 | 无处理 | **Overflow 按比例分配**（FHE 计算） |
| 白名单 | 不支持 | **Merkle Proof 白名单轮** |
| 代币释放 | 即时发放 | **Vesting 支持（Cliff + 线性释放）** |
| 隐私模型 | 需要先包装 cWETH | **独立存款池，无需额外包装** |
| 前端 | 基础 MVP | **完整产品级 UI** |

### 2.2 销售类型

| 类型 | 机制 | 定价方式 | 适用场景 |
|------|------|---------|---------|
| **Fixed Price** | 固定价格，先到先得 / 超额按比例 | 项目方设定 | 社区公平发射 |
| **Dutch Auction** | 密封出价，从高到低清算 | 市场决定清算价 | 高需求代币、机构参与 |

### 2.3 Dutch Auction 机制详解

Zama 自己的 $ZAMA 代币销售使用的模式：

```
价格区间: [$0.80, $0.90, $1.00, $1.10, $1.20]  ← 项目方设定（公开）
投入金额: [  🔒,    🔒,    🔒,    🔒,    🔒  ]  ← 每个价位的加密认购总额

结算过程:
  $1.20 区 → 解密总额 20,000 → 累计 20,000 / 供应 100,000
  $1.10 区 → 解密总额 35,000 → 累计 55,000 / 供应 100,000
  $1.00 区 → 解密总额 60,000 → 累计 115,000 > 供应 100,000 ← 清算价 = $1.00
  
结果:
  $1.20 出价者 → 全额分配，退还 ($1.20 - $1.00) × 分配数量
  $1.10 出价者 → 全额分配，退还 ($1.10 - $1.00) × 分配数量
  $1.00 出价者 → 按比例分配 (45,000/60,000 = 75%)，剩余退款
  $0.90 出价者 → 无分配，全额退款
  $0.80 出价者 → 无分配，全额退款
```

**隐私保证**: 价格区间公开（让用户选择），但每个用户在每个区间的投入金额是 FHE 加密的。只有最终清算价和总募集额公开。

---

## 3. User Flow

### 3.1 项目方：创建代币销售

```
1. 连接钱包
2. 选择销售类型: Fixed Price / Dutch Auction
3. 设置参数:
   - 代币合约地址 + 销售数量
   - 支付方式: ETH / ERC-20 地址
   - Fixed Price: 单价
   - Dutch Auction: 价格区间（最低价、最高价、区间数量）
   - Soft Cap / Hard Cap
   - 单人最大投入
   - 时间: 开始 / 结束
   - 白名单: Merkle Root（可选）
   - Vesting: Cliff 时间 + 线性释放周期（可选）
4. 授权代币转移 → 创建销售（代币锁入合约）
```

### 3.2 投资者：参与认购

```
Fixed Price 模式:
  1. 查看销售详情（代币信息、价格、剩余额度）
  2. 存入保证金（公开金额，设置上限）
  3. 提交加密认购金额 → FHE 加密 → 链上不可见
  4. 可随时更新认购金额（无资金移动，无链上痕迹）

Dutch Auction 模式:
  1. 查看销售详情 + 价格区间
  2. 存入保证金
  3. 选择价格区间 + 提交加密认购金额
  4. 可在不同价格区间分散出价
```

### 3.3 结算

```
Fixed Price:
  1. 到期后触发 Finalize
  2. FHE 计算总认购额
  3. 如未超额: 全额分配
  4. 如超额（Overflow）: FHE 按比例计算每人分配
  5. KMS 解密 → 执行分配 + 退款

Dutch Auction:
  1. 到期后触发 Finalize
  2. 请求解密各价格区间的加密总额
  3. 从最高价向下累加，确定清算价
  4. 提交清算价 + KMS 证明到链上
  5. 合约验证 → 计算每人分配 → 执行分配 + 退款
```

### 3.4 代币领取

```
无 Vesting: 结算后直接 claim
有 Vesting:
  Cliff 期间: 不可领取
  Cliff 之后: 按线性比例 claim，可多次 claim
  全额解锁后: claim 剩余全部
```

---

## 4. Smart Contract Architecture

### 4.1 合约结构

```
contracts/
├── SealPad.sol                  # 主合约：销售生命周期管理
├── SealPadDutch.sol             # Dutch Auction 结算逻辑（库）
├── SealPadVesting.sol           # Vesting 管理
├── mocks/
│   ├── MockERC20.sol            # 测试用 ERC-20
│   └── MockToken.sol            # 测试用销售代币
```

### 4.2 数据结构

```solidity
enum SaleType { FixedPrice, DutchAuction }
enum SaleStatus { Active, Finalizing, Settled, Failed, Cancelled }

struct Sale {
    address creator;
    // 销售代币
    address saleToken;
    uint256 saleAmount;           // 总销售数量
    // 支付
    address payToken;             // address(0) = ETH
    // 销售类型
    SaleType saleType;
    uint64 fixedPrice;            // FixedPrice 模式的单价
    // Dutch Auction 参数
    uint64 priceMin;              // 最低价格
    uint64 priceMax;              // 最高价格
    uint8 tierCount;              // 价格区间数量（最多 20）
    // 限制
    uint64 softCap;               // 最低募资额（payToken 单位）
    uint64 hardCap;               // 最高募资额
    uint64 maxPerUser;            // 单人最大投入
    // 时间
    uint64 startTime;
    uint64 endTime;
    // 白名单
    bytes32 whitelistRoot;        // Merkle root, bytes32(0) = 无白名单
    // Vesting
    uint64 cliffDuration;         // Cliff 秒数, 0 = 无 vesting
    uint64 vestingDuration;       // 线性释放秒数
    // 状态
    SaleStatus status;
    uint64 clearingPrice;         // 结算后填入
    uint64 totalRaised;           // 结算后填入
    uint8 bidCount;
}
```

### 4.3 存储结构

```solidity
// 销售数据
mapping(uint256 => Sale) public sales;
uint256 public nextSaleId;

// 独立存款池（同 SealBid 设计）
mapping(uint256 => mapping(address => uint64)) public deposits;

// Fixed Price: 加密认购额
mapping(uint256 => mapping(address => euint64)) internal _contributions;
mapping(uint256 => euint64) internal _totalContributed;

// Dutch Auction: 每个价格区间的加密认购额
// saleId => tierIndex => user => encrypted amount
mapping(uint256 => mapping(uint8 => mapping(address => euint64))) internal _tierBids;
// saleId => tierIndex => encrypted tier total
mapping(uint256 => mapping(uint8 => euint64)) internal _tierTotals;

// 参与者列表
mapping(uint256 => address[]) internal _participants;
mapping(uint256 => mapping(address => bool)) public hasParticipated;

// Vesting 领取记录
mapping(uint256 => mapping(address => uint256)) public claimed;

// 结算后的明文分配结果
mapping(uint256 => mapping(address => uint64)) public allocations;
mapping(uint256 => mapping(address => uint64)) public refunds;
```

### 4.4 核心函数

```solidity
// ==================== 项目方操作 ====================

/// @notice 创建代币销售，将代币锁入合约
function createSale(
    address saleToken,
    uint256 saleAmount,
    address payToken,
    SaleType saleType,
    uint64 fixedPrice,          // FixedPrice 时使用
    uint64 priceMin,            // DutchAuction 时使用
    uint64 priceMax,
    uint8 tierCount,
    uint64 softCap,
    uint64 hardCap,
    uint64 maxPerUser,
    uint64 startTime,
    uint64 endTime,
    bytes32 whitelistRoot,
    uint64 cliffDuration,
    uint64 vestingDuration
) external returns (uint256 saleId);

/// @notice 取消销售（仅在无人参与时）
function cancelSale(uint256 saleId) external;

// ==================== 投资者操作 ====================

/// @notice 存入保证金（公开金额，上限）
function addDeposit(uint256 saleId, uint64 amount) external payable;

/// @notice 提取保证金（结算后 / 取消后）
function withdrawDeposit(uint256 saleId) external;

/// @notice Fixed Price: 提交加密认购金额
function contribute(
    uint256 saleId,
    bytes32 encAmount,
    bytes calldata inputProof
) external;

/// @notice Dutch Auction: 在指定价格区间提交加密认购金额
function bidAtTier(
    uint256 saleId,
    uint8 tierIndex,
    bytes32 encAmount,
    bytes calldata inputProof
) external;

/// @notice 领取已分配的代币（含 Vesting 计算）
function claim(uint256 saleId) external;

// ==================== 结算 ====================

/// @notice Fixed Price: 触发结算
function finalizeFixed(uint256 saleId) external;

/// @notice Dutch Auction: 触发结算（请求解密各区间总额）
function finalizeDutch(uint256 saleId) external;

/// @notice Dutch Auction: 提交清算结果 + KMS 证明
function settleDutch(
    uint256 saleId,
    uint8 clearingTierIndex,
    uint64[] calldata decryptedTierTotals,
    bytes calldata decryptionProof
) external;

/// @notice Fixed Price: 提交结算结果 + KMS 证明
function settleFixed(
    uint256 saleId,
    uint64 decryptedTotal,
    bytes calldata decryptionProof
) external;
```

---

## 5. FHE 核心算法

### 5.1 Fixed Price — 认购 + Overflow

```solidity
function contribute(uint256 saleId, bytes32 encAmount, bytes calldata inputProof) external {
    Sale storage sale = sales[saleId];
    require(sale.status == SaleStatus.Active);
    require(block.timestamp >= sale.startTime && block.timestamp <= sale.endTime);

    // 白名单检查（如有）
    // ...

    euint64 amount = FHE.fromExternal(encAmount, inputProof);

    // 加密认购额不超过存款
    uint64 userDeposit = deposits[saleId][msg.sender];
    amount = FHE.min(amount, FHE.asEuint64(userDeposit));

    // 加密认购额不超过单人上限
    amount = FHE.min(amount, FHE.asEuint64(sale.maxPerUser));

    // 更新或创建认购
    _contributions[saleId][msg.sender] = amount;
    FHE.allowThis(amount);
    FHE.allow(amount, msg.sender);  // 允许用户自解密

    // 重新计算加密总额（简单累加，结算时处理 overflow）
    // 注：更新认购时需要先减旧值再加新值
    _totalContributed[saleId] = FHE.add(
        FHE.sub(_totalContributed[saleId], _oldContribution),
        amount
    );
    FHE.allowThis(_totalContributed[saleId]);

    if (!hasParticipated[saleId][msg.sender]) {
        _participants[saleId].push(msg.sender);
        hasParticipated[saleId][msg.sender] = true;
    }
}
```

### 5.2 Fixed Price — 结算（Overflow 按比例分配）

```solidity
function finalizeFixed(uint256 saleId) external {
    Sale storage sale = sales[saleId];
    require(sale.status == SaleStatus.Active);
    require(block.timestamp > sale.endTime);

    sale.status = SaleStatus.Finalizing;

    // 请求解密总认购额
    euint64 total = _totalContributed[saleId];
    FHE.makePubliclyDecryptable(total);

    // → 等待 KMS 解密回调
}

function settleFixed(uint256 saleId, uint64 decryptedTotal, bytes calldata proof) external {
    Sale storage sale = sales[saleId];
    FHE.checkSignatures(..., proof);

    if (decryptedTotal < sale.softCap) {
        // 未达 Soft Cap → 失败
        sale.status = SaleStatus.Failed;
        return;
    }

    sale.totalRaised = decryptedTotal;
    uint64 effectiveTotal = decryptedTotal > sale.hardCap ? sale.hardCap : decryptedTotal;
    bool isOverflow = decryptedTotal > sale.hardCap;

    sale.status = SaleStatus.Settled;
    sale.clearingPrice = sale.fixedPrice;

    // 如果超额认购，需要解密每个人的认购额来按比例分配
    // 请求解密所有参与者的认购额
    if (isOverflow) {
        // 请求解密全部参与者认购额 → 二次结算
        _requestParticipantDecryption(saleId);
    } else {
        // 未超额：每人全额分配
        _settleFullAllocation(saleId);
    }
}
```

### 5.3 Dutch Auction — 出价

```solidity
function bidAtTier(
    uint256 saleId,
    uint8 tierIndex,
    bytes32 encAmount,
    bytes calldata inputProof
) external {
    Sale storage sale = sales[saleId];
    require(sale.saleType == SaleType.DutchAuction);
    require(tierIndex < sale.tierCount);

    euint64 amount = FHE.fromExternal(encAmount, inputProof);

    // 加密金额不超过存款
    uint64 userDeposit = deposits[saleId][msg.sender];
    amount = FHE.min(amount, FHE.asEuint64(userDeposit));

    // 减去旧值（如果有），加上新值
    euint64 oldBid = _tierBids[saleId][tierIndex][msg.sender];
    _tierTotals[saleId][tierIndex] = FHE.add(
        FHE.sub(_tierTotals[saleId][tierIndex], oldBid),
        amount
    );

    _tierBids[saleId][tierIndex][msg.sender] = amount;
    FHE.allowThis(amount);
    FHE.allow(amount, msg.sender);
    FHE.allowThis(_tierTotals[saleId][tierIndex]);

    if (!hasParticipated[saleId][msg.sender]) {
        _participants[saleId].push(msg.sender);
        hasParticipated[saleId][msg.sender] = true;
    }
}
```

### 5.4 Dutch Auction — 结算

```solidity
function finalizeDutch(uint256 saleId) external {
    Sale storage sale = sales[saleId];
    require(block.timestamp > sale.endTime);

    sale.status = SaleStatus.Finalizing;

    // 请求解密所有价格区间的加密总额
    for (uint8 i = 0; i < sale.tierCount; i++) {
        FHE.makePubliclyDecryptable(_tierTotals[saleId][i]);
    }
    // → KMS 解密所有区间总额
}

function settleDutch(
    uint256 saleId,
    uint64[] calldata decryptedTierTotals,
    bytes calldata proof
) external {
    Sale storage sale = sales[saleId];
    FHE.checkSignatures(..., proof);

    // 从最高价区间向下累加，找到清算价
    uint64 accumulated = 0;
    uint64 tokensPerPayUnit = sale.saleAmount / sale.hardCap; // 简化
    uint8 clearingTier = sale.tierCount; // 无有效区间

    for (uint8 i = sale.tierCount; i > 0; i--) {
        uint8 idx = i - 1; // 从最高价开始
        accumulated += decryptedTierTotals[idx];
        if (accumulated >= sale.hardCap) {
            clearingTier = idx;
            break;
        }
    }

    // 检查是否达到 soft cap
    if (accumulated < sale.softCap) {
        sale.status = SaleStatus.Failed;
        return;
    }

    // 设置清算价
    uint64 tierStep = (sale.priceMax - sale.priceMin) / (sale.tierCount - 1);
    sale.clearingPrice = sale.priceMin + clearingTier * tierStep;
    sale.totalRaised = accumulated > sale.hardCap ? sale.hardCap : accumulated;
    sale.status = SaleStatus.Settled;

    // 请求解密清算区间内每个人的认购额（用于按比例分配）
    // 清算价以上的区间：全额分配（直接按区间总额）
    // 清算价区间：可能按比例
    _requestTierParticipantDecryption(saleId, clearingTier);
}
```

### 5.5 价格区间计算

```solidity
/// @notice 获取指定区间的价格
function getTierPrice(uint256 saleId, uint8 tierIndex) public view returns (uint64) {
    Sale storage sale = sales[saleId];
    if (sale.tierCount == 1) return sale.priceMin;
    uint64 step = (sale.priceMax - sale.priceMin) / (sale.tierCount - 1);
    return sale.priceMin + uint64(tierIndex) * step;
}
```

---

## 6. FHE 操作总结

| 操作 | 用途 |
|------|------|
| `FHE.fromExternal` | 导入用户加密认购金额 |
| `FHE.min` | 认购额不超过存款 / 不超过单人上限 |
| `FHE.add` | 累加区间总额 / 总认购额 |
| `FHE.sub` | 更新认购时减去旧值 |
| `FHE.asEuint64` | 创建加密常量 |
| `FHE.allowThis` | 授权合约操作密文 |
| `FHE.allow` | 授权用户自解密 |
| `FHE.makePubliclyDecryptable` | 标记结果待 KMS 解密 |
| `FHE.checkSignatures` | 验证 KMS 解密证明 |

---

## 7. 保证金管理（独立存款池）

与 SealBid 相同的设计，解决 PrivacyPad 需要包装 cWETH 的复杂性：

```
存款（公开）→ 设置认购上限
认购（加密）→ 实际投入金额不可见
更新认购 → 无资金移动，链上无痕迹
```

### 7.1 为什么不用 cWETH

| | cWETH 方案 (PrivacyPad) | 独立存款池 (SealPad) |
|--|------------------------|---------------------|
| 用户体验 | 需要先 wrap ETH → cWETH | 直接存 ETH/ERC-20 |
| 操作步数 | 3 步（wrap → approve → purchase） | 2 步（deposit → bid） |
| 隐私效果 | wrap 金额公开，效果有限 | deposit 金额公开，效果相同 |
| 合约复杂度 | 需要额外 cWETH/cToken 合约 | 无额外合约 |

### 7.2 存款 + 认购流程

```solidity
function addDeposit(uint256 saleId, uint64 amount) external payable {
    Sale storage sale = sales[saleId];
    require(sale.status == SaleStatus.Active);

    if (sale.payToken == address(0)) {
        // ETH
        require(msg.value == amount);
    } else {
        // ERC-20
        IERC20(sale.payToken).safeTransferFrom(msg.sender, address(this), amount);
    }

    deposits[saleId][msg.sender] += amount;
    emit DepositAdded(saleId, msg.sender, amount);
}
```

---

## 8. Vesting

### 8.1 设计

```solidity
struct VestingConfig {
    uint64 cliffDuration;     // cliff 秒数（从结算时间算起）
    uint64 vestingDuration;   // 线性释放秒数（从 cliff 结束后算起）
}

// cliffDuration = 0 && vestingDuration = 0 → 即时发放
// cliffDuration = 30 days, vestingDuration = 180 days
//   → 结算后 30 天内不可领取
//   → 第 31 天开始线性释放，180 天内释放完毕
```

### 8.2 Claim 计算

```solidity
function claimable(uint256 saleId, address user) public view returns (uint256) {
    Sale storage sale = sales[saleId];
    uint256 allocation = allocations[saleId][user]; // 结算后的明文分配
    if (allocation == 0) return 0;

    uint64 settledAt = sale.settledAt;
    uint64 cliffEnd = settledAt + sale.cliffDuration;
    uint64 vestEnd = cliffEnd + sale.vestingDuration;

    if (sale.vestingDuration == 0) {
        // 无 vesting，全额可领
        return allocation - claimed[saleId][user];
    }

    if (block.timestamp < cliffEnd) return 0;

    uint256 vested;
    if (block.timestamp >= vestEnd) {
        vested = allocation;
    } else {
        uint256 elapsed = block.timestamp - cliffEnd;
        vested = (allocation * elapsed) / sale.vestingDuration;
    }

    return vested - claimed[saleId][user];
}

function claim(uint256 saleId) external {
    uint256 amount = claimable(saleId, msg.sender);
    require(amount > 0, "Nothing to claim");

    claimed[saleId][msg.sender] += amount;
    IERC20(sales[saleId].saleToken).safeTransfer(msg.sender, amount);

    emit Claimed(saleId, msg.sender, amount);
}
```

---

## 9. 白名单

Merkle Proof 白名单，gas 高效：

```solidity
function _verifyWhitelist(
    uint256 saleId,
    address user,
    bytes32[] calldata merkleProof
) internal view returns (bool) {
    bytes32 root = sales[saleId].whitelistRoot;
    if (root == bytes32(0)) return true; // 无白名单限制

    bytes32 leaf = keccak256(abi.encodePacked(user));
    return MerkleProof.verify(merkleProof, root, leaf);
}
```

项目方可以设置两轮：
1. **白名单轮** — 提前开始，限定地址参与
2. **公开轮** — 白名单轮结束后自动开放

实现方式：两个独立的 Sale，共享同一个 saleToken 池。

---

## 10. 隐私模型

| 数据 | 可见性 |
|------|--------|
| 销售参数（代币、价格、时间、上限） | 公开 |
| 存款金额 | **公开**（设置认购上限） |
| 加密认购金额 | **私密** — FHE 加密 |
| 认购更新 | **不可见** — 无资金移动 |
| Dutch Auction 选择的价格区间 | 公开（用户选择哪个 tier） |
| 每个价格区间的总认购额 | **私密**（结算前）→ 公开（结算后仅公开区间总额） |
| 个人认购金额 | **永不公开**（除非超额需按比例分配时解密） |
| 最终清算价 + 总募资额 | 结算后公开 |
| 个人分配数量 | 结算后个人可查 |

---

## 11. Frontend Architecture

### 11.1 技术栈

```
Build:        Vite 6 + TypeScript
Framework:    React 19
UI:           shadcn/ui + Tailwind CSS 4
Wallet:       wagmi v2 + RainbowKit
FHE SDK:      @zama-fhe/relayer-sdk
Contract:     viem
Routing:      react-router-dom v7
```

### 11.2 页面结构

```
app/
├── Landing.tsx                  # 营销首页
├── Home.tsx                     # 销售列表 + 筛选
├── CreateSale.tsx               # 创建销售向导
├── SaleDetail.tsx               # 销售详情 + 存款 + 认购 + 结算
├── MyActivity.tsx               # 我创建的 / 我参与的
└── Claim.tsx                    # 代币领取 + Vesting 进度
```

### 11.3 核心页面

**销售列表**
```
┌──────────────────────────────────────────────┐
│  SealPad — Confidential Token Sales          │
├──────────────────────────────────────────────┤
│  [All] [Live] [Upcoming] [Ended]             │
├──────┬──────────┬────────┬──────┬────────────┤
│Token │ Type     │ Price  │Users │ Status     │
├──────┼──────────┼────────┼──────┼────────────┤
│ ZAMA │ Dutch    │$0.8-1.2│ 42 🔒│ Live 2h    │
│ MOON │ Fixed    │ 0.1 ETH│ 18 🔒│ Live 45m   │
│ STAR │ Dutch    │$1-$5   │128 🔒│ Settling   │
│ TEST │ Fixed    │ 50 USDC│  8 🔒│ Ended ✓    │
└──────┴──────────┴────────┴──────┴────────────┘
```

**Dutch Auction 详情页**
```
┌──────────────────────────────────────────────┐
│  ZAMA Token Sale — Dutch Auction             │
├──────────────────────────────────────────────┤
│  Token: ZAMA (0x3f...a2)                     │
│  Supply: 1,000,000 ZAMA                      │
│  Price Range: $0.80 — $1.20                  │
│  Hard Cap: $500,000                          │
│  Ends: Apr 20 18:00 UTC                      │
│  Participants: 42 sealed 🔒                  │
├──────────────────────────────────────────────┤
│  Price Tiers                                 │
│  $1.20  ████████░░░░  🔒 encrypted           │
│  $1.10  ████████████  🔒 encrypted           │
│  $1.00  ██████░░░░░░  🔒 encrypted           │
│  $0.90  ████░░░░░░░░  🔒 encrypted           │
│  $0.80  ██░░░░░░░░░░  🔒 encrypted           │
├──────────────────────────────────────────────┤
│  Step 1: Deposit                             │
│  Your deposit: 1,000 USDC                    │
│  Amount: [________] [Add Deposit]            │
├──────────────────────────────────────────────┤
│  Step 2: Bid at Price Tier                   │
│  Select tier: [$0.80] [$0.90] [$1.00] ...   │
│  Amount: [________] USDC                     │
│  [Encrypt & Submit Bid]                      │
└──────────────────────────────────────────────┘
```

---

## 12. Security

- `ReentrancyGuard` 所有状态变更函数
- `SafeERC20` 所有代币转账
- FHE 认购额 capped at deposit: `FHE.min(amount, deposit)`
- KMS 解密证明链上验证: `FHE.checkSignatures`
- 白名单 Merkle Proof 防伪造
- MAX_PARTICIPANTS 限制防 gas 耗尽
- Vesting 的 claim 使用 pull 模式（用户主动领取）

---

## 13. Development Plan

### Phase 1: 合约核心

- [ ] 项目初始化（fhevm-hardhat-template）
- [ ] `SealPad.sol` — 销售创建、存款、取消
- [ ] Fixed Price 认购 + 结算逻辑
- [ ] Dutch Auction 出价 + 结算逻辑
- [ ] Vesting 领取逻辑
- [ ] 白名单验证
- [ ] 单元测试（mock FHE）

### Phase 2: 前端

- [ ] 项目搭建（Vite + React + wagmi + shadcn/ui）
- [ ] Landing 页
- [ ] 销售列表页
- [ ] 创建销售向导
- [ ] 销售详情页（存款 + 认购 + 结算）
- [ ] Claim 页面 + Vesting 进度条
- [ ] My Activity 页面

### Phase 3: 部署 & Demo

- [ ] 部署到 Ethereum Sepolia
- [ ] 端到端测试
- [ ] 录制 Demo 视频
- [ ] 编写 README + 提交

---

## 14. Key Metrics

| 指标 | 目标值 |
|------|--------|
| 合约代码量 | ~600 行 Solidity |
| FHE 操作种类 | 6 种 (fromExternal, min, add, sub, asEuint64, allowThis/allow) |
| 最大参与者数 | 50（Fixed Price）/ 20 per tier（Dutch） |
| Dutch Auction 最大区间数 | 20 |
| KMS 解密次数/每次结算 | 1（Fixed）/ tierCount（Dutch） |
| 前端页面数 | 6 |
