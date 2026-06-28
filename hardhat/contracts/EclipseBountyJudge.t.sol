// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {EclipseBountyJudge} from "./EclipseBountyJudge.sol";

contract EclipseBountyJudgeTest is Test {
    EclipseBountyJudge internal judge;

    address internal owner = address(0xA11CE);
    address internal alice = address(0xA1);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);

    uint256 internal commitEnds;
    uint256 internal revealEnds;

    function setUp() public {
        judge = new EclipseBountyJudge();
        vm.deal(owner, 100 ether);
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);
        vm.deal(carol, 1 ether);
        commitEnds = block.timestamp + 1 days;
        revealEnds = block.timestamp + 2 days;
    }

    function _create() internal returns (uint256 id) {
        vm.prank(owner);
        id = judge.createBounty{value: 5 ether}("Eclipse idea", "clarity + originality", commitEnds, revealEnds);
    }

    // abi.encode (matching the contract), NOT encodePacked.
    function _corona(string memory answer, bytes32 salt, address who, uint256 id) internal pure returns (bytes32) {
        return keccak256(abi.encode(answer, salt, who, id));
    }

    // ---- create ----

    function test_CreateBounty() public {
        uint256 id = _create();
        (address o,,, uint256 reward,,,,,,, uint256 winner,) = judge.getBounty(id);
        assertEq(o, owner);
        assertEq(reward, 5 ether);
        assertEq(winner, judge.NO_WINNER());
        assertEq(uint256(judge.phaseOf(id)), uint256(EclipseBountyJudge.Phase.Commit));
    }

    function test_RevertCreate_NoReward() public {
        vm.prank(owner);
        vm.expectRevert(EclipseBountyJudge.RewardRequired.selector);
        judge.createBounty{value: 0}("t", "r", commitEnds, revealEnds);
    }

    function test_RevertCreate_BadWindow() public {
        vm.prank(owner);
        vm.expectRevert(EclipseBountyJudge.BadWindow.selector);
        judge.createBounty{value: 1 ether}("t", "r", revealEnds, commitEnds);
    }

    function test_RevertCreate_DeadlineInPast() public {
        vm.warp(1000);
        vm.prank(owner);
        vm.expectRevert(EclipseBountyJudge.BadWindow.selector);
        judge.createBounty{value: 1 ether}("t", "r", 999, 2000);
    }

    // ---- commit ----

    function test_SubmitCommitment() public {
        uint256 id = _create();
        vm.prank(alice);
        judge.submitCommitment(id, _corona("a", bytes32(uint256(1)), alice, id));
        assertEq(judge.entryCount(id), 1);
    }

    function test_RevertCommit_Twice() public {
        uint256 id = _create();
        vm.startPrank(alice);
        judge.submitCommitment(id, _corona("a", bytes32(uint256(1)), alice, id));
        vm.expectRevert(EclipseBountyJudge.AlreadyEntered.selector);
        judge.submitCommitment(id, _corona("a", bytes32(uint256(1)), alice, id));
        vm.stopPrank();
    }

    function test_RevertCommit_AfterDeadline() public {
        uint256 id = _create();
        vm.warp(commitEnds + 1);
        vm.prank(alice);
        vm.expectRevert(EclipseBountyJudge.CommitsClosed.selector);
        judge.submitCommitment(id, _corona("a", bytes32(uint256(1)), alice, id));
    }

    function test_RevertCommit_Empty() public {
        uint256 id = _create();
        vm.prank(alice);
        vm.expectRevert(EclipseBountyJudge.EmptyCorona.selector);
        judge.submitCommitment(id, bytes32(0));
    }

    function test_RevertCommit_UnknownBounty() public {
        vm.prank(alice);
        vm.expectRevert(EclipseBountyJudge.UnknownBounty.selector);
        judge.submitCommitment(999, _corona("a", bytes32(uint256(1)), alice, 999));
    }

    // ---- reveal: valid ----

    function test_RevealValid() public {
        uint256 id = _create();
        bytes32 salt = bytes32(uint256(42));
        vm.prank(alice);
        judge.submitCommitment(id, _corona("the answer", salt, alice, id));
        vm.warp(commitEnds + 1);
        assertEq(uint256(judge.phaseOf(id)), uint256(EclipseBountyJudge.Phase.Reveal));
        vm.prank(alice);
        judge.revealAnswer(id, "the answer", salt);
        (,, bool revealed, string memory ans) = judge.getSubmission(id, 0);
        assertTrue(revealed);
        assertEq(ans, "the answer");
    }

    function test_AnswerHiddenBeforeReveal() public {
        uint256 id = _create();
        vm.prank(alice);
        judge.submitCommitment(id, _corona("secret answer", bytes32(uint256(9)), alice, id));
        (,, bool revealed, string memory ans) = judge.getSubmission(id, 0);
        assertFalse(revealed);
        assertEq(bytes(ans).length, 0);
    }

    // ---- reveal: invalid ----

    function test_RevertReveal_WrongAnswer() public {
        uint256 id = _create();
        bytes32 salt = bytes32(uint256(42));
        vm.prank(alice);
        judge.submitCommitment(id, _corona("the answer", salt, alice, id));
        vm.warp(commitEnds + 1);
        vm.prank(alice);
        vm.expectRevert(EclipseBountyJudge.CoronaMismatch.selector);
        judge.revealAnswer(id, "WRONG", salt);
    }

    function test_RevertReveal_WrongSalt() public {
        uint256 id = _create();
        vm.prank(alice);
        judge.submitCommitment(id, _corona("the answer", bytes32(uint256(42)), alice, id));
        vm.warp(commitEnds + 1);
        vm.prank(alice);
        vm.expectRevert(EclipseBountyJudge.CoronaMismatch.selector);
        judge.revealAnswer(id, "the answer", bytes32(uint256(99)));
    }

    function test_StolenCommitmentCannotBeRevealed() public {
        uint256 id = _create();
        bytes32 salt = bytes32(uint256(42));
        vm.prank(alice);
        judge.submitCommitment(id, _corona("the answer", salt, alice, id));
        vm.prank(bob);
        judge.submitCommitment(id, _corona("bob ans", salt, bob, id));
        vm.warp(commitEnds + 1);
        // bob cannot reveal alice's answer — sender is bound into the corona
        vm.prank(bob);
        vm.expectRevert(EclipseBountyJudge.CoronaMismatch.selector);
        judge.revealAnswer(id, "the answer", salt);
    }

    function test_RevertReveal_BeforeWindow() public {
        uint256 id = _create();
        bytes32 salt = bytes32(uint256(42));
        vm.prank(alice);
        judge.submitCommitment(id, _corona("the answer", salt, alice, id));
        vm.prank(alice);
        vm.expectRevert(EclipseBountyJudge.RevealNotOpen.selector);
        judge.revealAnswer(id, "the answer", salt);
    }

    function test_RevertReveal_AfterWindow() public {
        uint256 id = _create();
        bytes32 salt = bytes32(uint256(42));
        vm.prank(alice);
        judge.submitCommitment(id, _corona("the answer", salt, alice, id));
        vm.warp(revealEnds + 1);
        vm.prank(alice);
        vm.expectRevert(EclipseBountyJudge.RevealClosed.selector);
        judge.revealAnswer(id, "the answer", salt);
    }

    function test_RevertReveal_NoEntry() public {
        uint256 id = _create();
        vm.warp(commitEnds + 1);
        vm.prank(carol);
        vm.expectRevert(EclipseBountyJudge.NoEntry.selector);
        judge.revealAnswer(id, "x", bytes32(uint256(1)));
    }

    function test_RevertReveal_Twice() public {
        uint256 id = _create();
        bytes32 salt = bytes32(uint256(42));
        vm.prank(alice);
        judge.submitCommitment(id, _corona("the answer", salt, alice, id));
        vm.warp(commitEnds + 1);
        vm.startPrank(alice);
        judge.revealAnswer(id, "the answer", salt);
        vm.expectRevert(EclipseBountyJudge.AlreadyRevealed.selector);
        judge.revealAnswer(id, "the answer", salt);
        vm.stopPrank();
    }

    function test_RevertReveal_EmptyAnswer() public {
        uint256 id = _create();
        bytes32 salt = bytes32(uint256(42));
        vm.prank(alice);
        judge.submitCommitment(id, _corona("", salt, alice, id));
        vm.warp(commitEnds + 1);
        vm.prank(alice);
        vm.expectRevert(EclipseBountyJudge.BadAnswerLength.selector);
        judge.revealAnswer(id, "", salt);
    }

    // ---- judge & finalize ----

    function _twoRevealed() internal returns (uint256 id) {
        id = _create();
        bytes32 sa = bytes32(uint256(1));
        bytes32 sb = bytes32(uint256(2));
        vm.prank(alice);
        judge.submitCommitment(id, _corona("alice answer", sa, alice, id));
        vm.prank(bob);
        judge.submitCommitment(id, _corona("bob answer", sb, bob, id));
        vm.warp(commitEnds + 1);
        vm.prank(alice);
        judge.revealAnswer(id, "alice answer", sa);
        vm.prank(bob);
        judge.revealAnswer(id, "bob answer", sb);
    }

    function test_JudgeAll_NonRitualChain() public {
        uint256 id = _twoRevealed();
        vm.warp(revealEnds + 1);
        assertEq(uint256(judge.phaseOf(id)), uint256(EclipseBountyJudge.Phase.Judging));
        vm.prank(owner);
        judge.judgeAll(id, hex"");
        (,,,,,, bool judged,,,,,) = judge.getBounty(id);
        assertTrue(judged);
        assertEq(uint256(judge.phaseOf(id)), uint256(EclipseBountyJudge.Phase.Judged));
    }

    function test_RevertJudge_NotOwner() public {
        uint256 id = _twoRevealed();
        vm.warp(revealEnds + 1);
        vm.prank(alice);
        vm.expectRevert(EclipseBountyJudge.NotOwner.selector);
        judge.judgeAll(id, hex"");
    }

    function test_RevertJudge_BeforeRevealDeadline() public {
        uint256 id = _twoRevealed();
        vm.prank(owner);
        vm.expectRevert(EclipseBountyJudge.RevealNotFinished.selector);
        judge.judgeAll(id, hex"");
    }

    function test_RevertJudge_NoRevealed() public {
        uint256 id = _create();
        vm.prank(alice);
        judge.submitCommitment(id, _corona("x", bytes32(uint256(1)), alice, id));
        vm.warp(revealEnds + 1);
        vm.prank(owner);
        vm.expectRevert(EclipseBountyJudge.NoRevealedAnswers.selector);
        judge.judgeAll(id, hex"");
    }

    function test_RevertJudge_Twice() public {
        uint256 id = _twoRevealed();
        vm.warp(revealEnds + 1);
        vm.startPrank(owner);
        judge.judgeAll(id, hex"");
        vm.expectRevert(EclipseBountyJudge.AlreadyJudged.selector);
        judge.judgeAll(id, hex"");
        vm.stopPrank();
    }

    function test_Finalize_PaysWinner() public {
        uint256 id = _twoRevealed();
        vm.warp(revealEnds + 1);
        vm.prank(owner);
        judge.judgeAll(id, hex"");
        uint256 before = bob.balance;
        vm.prank(owner);
        judge.finalizeWinner(id, 1);
        assertEq(bob.balance, before + 5 ether);
        (,,,,,,, bool finalized,,, uint256 winner,) = judge.getBounty(id);
        assertTrue(finalized);
        assertEq(winner, 1);
        assertEq(uint256(judge.phaseOf(id)), uint256(EclipseBountyJudge.Phase.Finalized));
    }

    function test_RevertFinalize_BeforeJudge() public {
        uint256 id = _twoRevealed();
        vm.warp(revealEnds + 1);
        vm.prank(owner);
        vm.expectRevert(EclipseBountyJudge.NotJudged.selector);
        judge.finalizeWinner(id, 0);
    }

    function test_RevertFinalize_UnrevealedWinner() public {
        uint256 id = _create();
        bytes32 sa = bytes32(uint256(1));
        vm.prank(alice);
        judge.submitCommitment(id, _corona("alice answer", sa, alice, id));
        vm.prank(carol);
        judge.submitCommitment(id, _corona("carol", bytes32(uint256(9)), carol, id));
        vm.warp(commitEnds + 1);
        vm.prank(alice);
        judge.revealAnswer(id, "alice answer", sa);
        vm.warp(revealEnds + 1);
        vm.prank(owner);
        judge.judgeAll(id, hex"");
        vm.prank(owner);
        vm.expectRevert(EclipseBountyJudge.WinnerNotRevealed.selector);
        judge.finalizeWinner(id, 1); // carol never revealed
    }

    // ---- reclaim ----

    function test_ReclaimReward_WhenNoReveals() public {
        uint256 id = _create();
        vm.prank(alice);
        judge.submitCommitment(id, _corona("x", bytes32(uint256(1)), alice, id));
        vm.warp(revealEnds + 1);
        uint256 before = owner.balance;
        vm.prank(owner);
        judge.reclaimReward(id);
        assertEq(owner.balance, before + 5 ether);
        (,,,,,,, bool finalized,,,,) = judge.getBounty(id);
        assertTrue(finalized);
    }

    function test_RevertReclaim_WhenSomeoneRevealed() public {
        uint256 id = _twoRevealed();
        vm.warp(revealEnds + 1);
        vm.prank(owner);
        vm.expectRevert(EclipseBountyJudge.CannotReclaim.selector);
        judge.reclaimReward(id);
    }

    function test_RevertReclaim_BeforeRevealClose() public {
        uint256 id = _create();
        vm.prank(owner);
        vm.expectRevert(EclipseBountyJudge.CannotReclaim.selector);
        judge.reclaimReward(id);
    }

    // ---- helpers ----

    function test_ComputeCommitmentMatches() public view {
        bytes32 a = judge.computeCommitment("hello", bytes32(uint256(7)), alice, 1);
        bytes32 b = _corona("hello", bytes32(uint256(7)), alice, 1);
        assertEq(a, b);
    }

    function test_FullLifecycle() public {
        uint256 id = _twoRevealed();
        vm.warp(revealEnds + 1);
        vm.startPrank(owner);
        judge.judgeAll(id, hex"");
        judge.finalizeWinner(id, 0);
        vm.stopPrank();
        (,,,,,,, bool finalized,,, uint256 winner,) = judge.getBounty(id);
        assertTrue(finalized);
        assertEq(winner, 0);
    }
}
