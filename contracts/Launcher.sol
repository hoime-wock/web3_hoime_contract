// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MyToken} from "./MyToken.sol";

/// @title Launcher
/// @notice 付费创建 ERC20 代币的工厂合约，创建者可自定义名称、符号、总量和精度。
contract Launcher is Ownable, ReentrancyGuard {
    /// @notice 创建代币所需支付的费用（wei）
    uint256 public cost;

    /// @dev 记录每个用户创建的代币地址
    mapping(address => address[]) private _userTokens;

    /// @param user 付款人
    /// @param cost 本次创建实际收取的费用
    /// @param value 本次调用实际发送的 ETH（cost + 退还的找零）
    event Pay(address indexed user, uint256 cost, uint256 value);
    event Refund(address indexed to, uint256 amount);
    event TokenCreate(address indexed user, address indexed token);
    event Withdrawals(address indexed owner, address indexed to, uint256 amount);
    event UpdateCost(address indexed user, uint256 oldCost, uint256 newCost);

    constructor() Ownable(msg.sender) {
        cost = 2 * 10**18;
    }

    /// @notice 支付费用并创建代币，多余 ETH 自动退还
    /// @dev 先写入状态，再进行外部退款调用（checks-effects-interactions）
    function createToken(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint8 decimals_
    ) external payable nonReentrant returns (address) {
        require(msg.value >= cost, "Launcher: insufficient fee");
        require(decimals_ <= 18, "Launcher: decimals too large");

        uint256 excess = msg.value - cost;
        emit Pay(msg.sender, cost, msg.value);

        MyToken token = new MyToken(
            msg.sender,
            name_,
            symbol_,
            totalSupply_,
            decimals_
        );
        address tokenAddr = address(token);

        // 先记录状态，避免未来的改动在退款外部调用之后留下重入窗口
        _userTokens[msg.sender].push(tokenAddr);

        if (excess > 0) {
            (bool ok, ) = payable(msg.sender).call{value: excess}("");
            require(ok, "Launcher: refund failed");
            emit Refund(msg.sender, excess);
        }

        emit TokenCreate(msg.sender, tokenAddr);

        return tokenAddr;
    }

    /// @notice 提取合约中全部 ETH（仅 owner）
    /// @param to 接收地址，不能是零地址
    function withdraw(address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "Launcher: invalid recipient");

        uint256 amount = address(this).balance;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "Launcher: withdraw failed");

        emit Withdrawals(msg.sender, to, amount);
    }

    /// @notice 更新创建费用（仅 owner），不允许设为 0
    function setCost(uint256 newCost) external onlyOwner {
        require(newCost > 0, "Launcher: cost must be > 0");

        uint256 oldCost = cost;
        cost = newCost;

        emit UpdateCost(msg.sender, oldCost, newCost);
    }

    /// @notice 分页查询某用户创建的全部代币地址
    /// @param user 用户地址
    /// @param offset 起始下标
    /// @param limit 本次最多返回的数量
    function getUserTokens(
        address user,
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory) {
        address[] storage list = _userTokens[user];
        uint256 len = list.length;

        if (offset >= len || limit == 0) {
            return new address[](0);
        }

        // 先算剩余数量再取较小值，避免 offset + limit 溢出
        uint256 remaining = len - offset;
        uint256 count = limit < remaining ? limit : remaining;

        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = list[offset + i];
        }

        return result;
    }

    /// @notice 查询某用户创建代币的总数量
    function getUserTokenCount(address user) external view returns (uint256) {
        return _userTokens[user].length;
    }
}
