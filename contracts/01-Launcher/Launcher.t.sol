// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Launcher} from "./Launcher.sol";
import {MyToken} from "./MyToken.sol";

contract LauncherTest is Test {
    Launcher internal launcher;
    address internal owner;
    address internal alice;
    address internal bob;

    uint256 internal constant INITIAL_COST = 2 ether;

    event Pay(address indexed user, uint256 cost, uint256 value);
    event Refund(address indexed to, uint256 amount);
    event TokenCreate(address indexed user, address indexed token);
    event Withdrawals(address indexed owner, address indexed to, uint256 amount);
    event UpdateCost(address indexed user, uint256 oldCost, uint256 newCost);

    function setUp() public {
        owner = address(this);
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        launcher = new Launcher();

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    /* ------------------------------------------------------------------ */
    /*                              constructor                            */
    /* ------------------------------------------------------------------ */

    function test_Constructor_SetsOwnerAndCost() public view {
        assertEq(launcher.owner(), owner);
        assertEq(launcher.cost(), INITIAL_COST);
    }

    /* ------------------------------------------------------------------ */
    /*                             createToken                             */
    /* ------------------------------------------------------------------ */

    function test_CreateToken_MintsToCreator() public {
        vm.prank(alice);
        address tokenAddr = launcher.createToken{value: INITIAL_COST}(
            "Alice Token",
            "ALICE",
            1_000_000,
            18
        );

        MyToken token = MyToken(tokenAddr);

        assertEq(token.name(), "Alice Token");
        assertEq(token.symbol(), "ALICE");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 1_000_000 * 10 ** 18);
        assertEq(token.balanceOf(alice), 1_000_000 * 10 ** 18);

        assertEq(launcher.getUserTokenCount(alice), 1);
        assertEq(address(launcher).balance, INITIAL_COST);
    }

    function test_CreateToken_SupportsCustomDecimals() public {
        vm.prank(alice);
        address tokenAddr = launcher.createToken{value: INITIAL_COST}(
            "Zero Decimals",
            "ZERO",
            100,
            0
        );

        MyToken token = MyToken(tokenAddr);

        assertEq(token.decimals(), 0);
        assertEq(token.totalSupply(), 100);
        assertEq(token.balanceOf(alice), 100);
    }

    function test_CreateToken_RefundsExcess() public {
        vm.deal(alice, 5 ether);

        vm.prank(alice);
        launcher.createToken{value: 5 ether}("A", "A", 1_000, 18);

        // 实际只花掉 cost（5 - 2 = 3 ether 留在手里）
        assertEq(alice.balance, 3 ether);
        assertEq(address(launcher).balance, INITIAL_COST);
    }

    function testFuzz_CreateToken_RefundsAllExcess(uint96 extra) public {
        uint256 value = INITIAL_COST + uint256(extra);
        vm.deal(alice, value);

        vm.prank(alice);
        launcher.createToken{value: value}("A", "A", 1, 18);

        assertEq(address(launcher).balance, INITIAL_COST);
        assertEq(alice.balance, uint256(extra));
    }

    function test_CreateToken_EmitsPayAndTokenCreate() public {
        address predicted = vm.computeCreateAddress(address(launcher), 1);

        vm.expectEmit(true, false, false, true, address(launcher));
        emit Pay(alice, INITIAL_COST, INITIAL_COST);

        vm.expectEmit(true, true, false, true, address(launcher));
        emit TokenCreate(alice, predicted);

        vm.prank(alice);
        launcher.createToken{value: INITIAL_COST}("A", "A", 1, 18);
    }

    function test_CreateToken_EmitsRefund() public {
        vm.expectEmit(true, false, false, true, address(launcher));
        emit Pay(alice, INITIAL_COST, 5 ether);

        vm.expectEmit(true, false, false, true, address(launcher));
        emit Refund(alice, 3 ether);

        vm.prank(alice);
        launcher.createToken{value: 5 ether}("A", "A", 1, 18);
    }

    function test_CreateToken_RevertsWhen_FeeTooLow() public {
        vm.prank(alice);
        vm.expectRevert("Launcher: insufficient fee");
        launcher.createToken{value: INITIAL_COST - 1}("A", "A", 1, 18);
    }

    function test_CreateToken_RevertsWhen_DecimalsTooLarge() public {
        vm.prank(alice);
        vm.expectRevert("Launcher: decimals too large");
        launcher.createToken{value: INITIAL_COST}("A", "A", 1, 19);
    }

    function test_CreateToken_RevertsWhen_SupplyIsZero() public {
        vm.prank(alice);
        vm.expectRevert("MyToken: total supply is zero");
        launcher.createToken{value: INITIAL_COST}("A", "A", 0, 18);
    }

    function test_CreateToken_RevertsWhen_FeeNotSent() public {
        vm.prank(alice);
        vm.expectRevert("Launcher: insufficient fee");
        launcher.createToken("A", "A", 1, 18);
    }

    /* ------------------------------------------------------------------ */
    /*                            getUserTokens                            */
    /* ------------------------------------------------------------------ */

    function test_GetUserTokens_Pagination() public {
        address[] memory created = _createThreeTokens(alice);

        address[] memory all = launcher.getUserTokens(alice, 0, 10);
        assertEq(all.length, 3);
        assertEq(all[0], created[0]);
        assertEq(all[1], created[1]);
        assertEq(all[2], created[2]);

        address[] memory page = launcher.getUserTokens(alice, 1, 1);
        assertEq(page.length, 1);
        assertEq(page[0], created[1]);

        address[] memory tail = launcher.getUserTokens(alice, 2, 10);
        assertEq(tail.length, 1);
        assertEq(tail[0], created[2]);
    }

    function test_GetUserTokens_ReturnsEmptyForInvalidRange() public {
        _createThreeTokens(alice);

        assertEq(launcher.getUserTokens(alice, 3, 10).length, 0);
        assertEq(launcher.getUserTokens(alice, 0, 0).length, 0);
        assertEq(launcher.getUserTokens(bob, 0, 10).length, 0);
    }

    function test_GetUserTokens_ClampsOversizedLimit() public {
        _createThreeTokens(alice);

        // 修复前 offset + limit 会溢出并 revert
        address[] memory tokens = launcher.getUserTokens(
            alice,
            1,
            type(uint256).max
        );

        assertEq(tokens.length, 2);
    }

    function test_GetUserTokenCount_IsPerUser() public {
        _createThreeTokens(alice);

        vm.prank(bob);
        launcher.createToken{value: INITIAL_COST}("B", "B", 1, 18);

        assertEq(launcher.getUserTokenCount(alice), 3);
        assertEq(launcher.getUserTokenCount(bob), 1);
    }

    /* ------------------------------------------------------------------ */
    /*                               setCost                               */
    /* ------------------------------------------------------------------ */

    function test_SetCost_UpdatesCostAndEmitsEvent() public {
        vm.expectEmit(true, false, false, true, address(launcher));
        emit UpdateCost(owner, INITIAL_COST, 3 ether);

        launcher.setCost(3 ether);

        assertEq(launcher.cost(), 3 ether);
    }

    function test_SetCost_RevertsWhen_NotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        launcher.setCost(1 ether);
    }

    function test_SetCost_RevertsWhen_Zero() public {
        vm.expectRevert("Launcher: cost must be > 0");
        launcher.setCost(0);
    }

    /* ------------------------------------------------------------------ */
    /*                              withdraw                              */
    /* ------------------------------------------------------------------ */

    function test_Withdraw_SendsBalanceToRecipient() public {
        vm.prank(alice);
        launcher.createToken{value: INITIAL_COST}("A", "A", 1, 18);

        address payable recipient = payable(makeAddr("recipient"));
        uint256 amount = address(launcher).balance;

        vm.expectEmit(true, true, false, true, address(launcher));
        emit Withdrawals(owner, recipient, amount);

        launcher.withdraw(recipient);

        assertEq(address(launcher).balance, 0);
        assertEq(recipient.balance, amount);
    }

    function test_Withdraw_RevertsWhen_NotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        launcher.withdraw(payable(alice));
    }

    function test_Withdraw_RevertsWhen_ZeroAddress() public {
        vm.expectRevert("Launcher: invalid recipient");
        launcher.withdraw(payable(address(0)));
    }

    /* ------------------------------------------------------------------ */
    /*                               helpers                              */
    /* ------------------------------------------------------------------ */

    function _createThreeTokens(address user) internal returns (address[] memory) {
        address[] memory tokens = new address[](3);

        vm.startPrank(user);
        tokens[0] = launcher.createToken{value: INITIAL_COST}("T1", "T1", 1, 18);
        tokens[1] = launcher.createToken{value: INITIAL_COST}("T2", "T2", 1, 18);
        tokens[2] = launcher.createToken{value: INITIAL_COST}("T3", "T3", 1, 18);
        vm.stopPrank();

        return tokens;
    }
}
