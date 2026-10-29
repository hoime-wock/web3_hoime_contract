// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Faucet
/// @notice Puppynet 原生 BONE 水龙头。
/// @dev 每个地址每 24 小时可以领取一次固定数量的 BONE；额度由 owner 调整，
///      owner 可以暂停领取、提取合约余额。每个地址领取次数不设上限。
contract Faucet is Ownable, Pausable, ReentrancyGuard {
    /// @notice 领取冷却时间，固定 24 小时
    uint256 public constant COOLDOWN = 24 hours;

    /// @notice 每次领取的数量（wei），默认 0.0001 BONE
    uint256 public claimAmount = 0.0001 ether;

    /// @notice 每个地址最后一次领取的时间戳，0 表示从未领取
    mapping(address => uint256) public lastClaimAt;

    event Funded(address indexed from, uint256 amount);
    event Claimed(address indexed to, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event ClaimAmountUpdated(uint256 oldAmount, uint256 newAmount);

    constructor() Ownable(msg.sender) {}

    /// @notice 向合约充值 BONE
    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    /// @notice 领取固定数量的 BONE
    function claim() external whenNotPaused nonReentrant {
        uint256 amount = claimAmount;
        require(amount > 0, "Faucet: claim disabled");
        require(address(this).balance >= amount, "Faucet: insufficient balance");

        uint256 lastClaim = lastClaimAt[msg.sender];
        require(
            lastClaim == 0 || block.timestamp >= lastClaim + COOLDOWN,
            "Faucet: cooldown active"
        );

        // 先更新状态，再进行外部转账（checks-effects-interactions）
        lastClaimAt[msg.sender] = block.timestamp;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Faucet: transfer failed");

        emit Claimed(msg.sender, amount);
    }

    /// @notice 修改每次领取的额度（仅 owner）；设为 0 可以暂停发放
    function setClaimAmount(uint256 newAmount) external onlyOwner {
        uint256 oldAmount = claimAmount;
        claimAmount = newAmount;

        emit ClaimAmountUpdated(oldAmount, newAmount);
    }

    /// @notice 暂停领取（仅 owner）
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice 恢复领取（仅 owner）
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice 提取合约内全部 BONE（仅 owner）
    /// @param to 接收地址，不能是零地址
    function withdraw(address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "Faucet: invalid recipient");

        uint256 amount = address(this).balance;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "Faucet: withdraw failed");

        emit Withdrawn(to, amount);
    }

    /// @notice 某地址当前是否可以领取
    function canClaim(address user) external view returns (bool) {
        if (paused() || claimAmount == 0 || address(this).balance < claimAmount) {
            return false;
        }

        uint256 lastClaim = lastClaimAt[user];
        return lastClaim == 0 || block.timestamp >= lastClaim + COOLDOWN;
    }
}
