// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MyToken
/// @notice 固定供应量的 ERC20 代币，支持自定义精度，部署后没有任何 owner 权限。
contract MyToken is ERC20 {
    uint8 private immutable _customDecimals;

    /// @param initialOwner 代币初始持有者（由工厂传入，即创建者）
    /// @param name_        代币名称
    /// @param symbol_      代币符号
    /// @param totalSupply_ 代币数量（未乘精度，构造时乘 10**decimals_）
    /// @param decimals_    精度，限制 <= 18，避免 10**decimals_ 溢出
    constructor(
        address initialOwner,
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        require(decimals_ <= 18, "MyToken: decimals too large");
        require(totalSupply_ > 0, "MyToken: total supply is zero");

        _customDecimals = decimals_;
        _mint(initialOwner, totalSupply_ * 10 ** decimals_);
    }

    /// @dev 重写 decimals() 以支持自定义精度（OZ v5 构造函数不接收 decimals）
    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }
}
