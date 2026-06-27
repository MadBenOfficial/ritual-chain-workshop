// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AIJudge} from "./AIJudge.sol";

contract AIJudgeTest is Test {
    AIJudge internal judge;

    address internal owner = address(0xA11CE);
    address internal alice = address(0xA1);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);

    uint256 internal submitEnds;
    uint256 internal revealEnds;

    function setUp() public {
        judge = new AIJudge();
        vm.deal(owner, 100 ether);
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);
        vm.deal(carol, 1 ether);
        submitEnds = block.timestamp + 1 days;
        revealEnds = block.timestamp + 2 days;
    }

    function _create() internal returns (uint256 id) {
        vm.prank(owner);
        id = judge.createBounty{value: 5 ether}("Best idea", "clarity + originality", submitEnds, revealEnds);
    }

    function _commit(string memory answer, bytes32 salt, address who, uint256 id) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(answer, salt, who, id));
    }

    // ---- create ----

    function test_CreateBounty() public {
        uint256 id = _create();
        (address o,,, uint256 reward,,,,,,, uint256 winner,) = judge.getBounty(id);
        assertEq(o, owner);
        assertEq(reward, 5 ether);
        assertEq(winner, type(uint256).max);
    }

    function test_RevertCreate_NoReward() public {
        vm.prank(owner);
        vm.expectRevert("reward required");
        judge.createBounty{value: 0}("t", "r", submitEnds, revealEnds);
    }

    function test_RevertCreate_BadDeadlines() public {
        vm.prank(owner);
        vm.expectRevert("reveal must follow submission");
        judge.createBounty{value: 1 ether}("t", "r", revealEnds, submitEnds);
    }

    // ---- commit ----

    function test_SubmitCommitment() public {
        uint256 id = _create();
        vm.prank(alice);
        judge.submitCommitment(id, _commit("a", bytes32(uint256(1)), alice, id));
        assertEq(judge.submissionCount(id), 1);
    }

    function test_RevertCommit_Twice() public {
        uint256 id = _create();
        vm.startPrank(alice);
        judge.submitCommitment(id, _commit("a", bytes32(uint256(1)), alice, id));
        vm.expectRevert("already committed");
        judge.submitCommitment(id, _commit("a", bytes32(uint256(1)), alice, id));
        vm.stopPrank();
    }

    function test_RevertCommit_AfterDeadline() public {
        uint256 id = _create();
        vm.warp(submitEnds + 1);
        vm.prank(alice);
        vm.expectRevert("submissions closed");
        judge.submitCommitment(id, _commit("a", bytes32(uint256(1)), alice, id));
    }

    function test_RevertCommit_Empty() public {
        uint256 id = _create();
        vm.prank(alice);
        vm.expectRevert("empty commitment");
        judge.submitCommitment(id, bytes32(0));
    }

    // ---- reveal: valid ----

    function test_RevealValid() public {
        uint256 id = _create();
        bytes32 salt = bytes32(uint256(42));
        vm.prank(alice);
        judge.submitCommitment(id, _commit("the answer", salt, alice, id));
        vm.warp(submitEnds + 1);
        vm.prank(alice);
        judge.revealAnswer(id, "the answer", salt);
        (,, bool revealed, string memory ans) = judge.getSubmission(id, 0);
        assertTrue(revealed);
        assertEq(ans, "the answer");
    }

    /// @notice Before reveal, the stored answer is empty for everyone — proving
    ///         the commit phase hides the content.
    function test_AnswerHiddenBeforeReveal() public {
        uint256 id = _create();
        vm.prank(alice);
        judge.submitCommitment(id, _commit("secret answer", bytes32(uint256(9)), alice, id));
        (,, bool revealed, string memory ans) = judge.getSubmission(id, 0);
        assertFalse(revealed);
        assertEq(bytes(ans).length, 0);
    }

    // ---- reveal: invalid ----

    function test_RevertReveal_WrongAnswer() public {
        uint256 id = _create();
        bytes32 salt = bytes32(uint256(42));
        vm.prank(alice);
        judge.submitCommitment(id, _commit("the answer", salt, alice, id));
        vm.warp(submitEnds + 1);
        vm.prank(alice);
        vm.expectRevert("commitment mismatch");
        judge.revealAnswer(id, "WRONG", salt);
    }

    function test_RevertReveal_WrongSalt() public {
        uint256 id = _create();
        vm.prank(alice);
        judge.submitCommitment(id, _commit("the answer", bytes32(uint256(42)), alice, id));
        vm.warp(submitEnds + 1);
        vm.prank(alice);
        vm.expectRevert("commitment mismatch");
        judge.revealAnswer(id, "the answer", bytes32(uint256(99)));
    }

    function test_RevertReveal_WrongSender() public {
        uint256 id = _create();
        bytes32 salt = bytes32(uint256(42));
        vm.prank(alice);
        judge.submitCommitment(id, _commit("the answer", salt, alice, id));
        vm.prank(bob);
        judge.submitCommitment(id, _commit("bob ans", salt, bob, id));
        vm.warp(submitEnds + 1);
        // bob cannot reveal alice's answer (sender is bound into the hash)
        vm.prank(bob);
        vm.expectRevert("commitment mismatch");
        judge.revealAnswer(id, "the answer", salt);
    }

    function test_RevertReveal_BeforeWindow() public {
        uint256 id = _create();
        bytes32 salt = bytes32(uint256(42));
        vm.prank(alice);
        judge.submitCommitment(id, _commit("the answer", salt, alice, id));
        vm.prank(alice);
        vm.expectRevert("reveal not open");
        judge.revealAnswer(id, "the answer", salt);
    }

    function test_RevertReveal_AfterWindow() public {
        uint256 id = _create();
        bytes32 salt = bytes32(uint256(42));
        vm.prank(alice);
        judge.submitCommitment(id, _commit("the answer", salt, alice, id));
        vm.warp(revealEnds + 1);
        vm.prank(alice);
        vm.expectRevert("reveal closed");
        judge.revealAnswer(id, "the answer", salt);
    }

    function test_RevertReveal_NoCommitment() public {
        uint256 id = _create();
        vm.warp(submitEnds + 1);
        vm.prank(carol);
        vm.expectRevert("no commitment");
        judge.revealAnswer(id, "x", bytes32(uint256(1)));
    }

    function test_RevertReveal_Twice() public {
        uint256 id = _create();
        bytes32 salt = bytes32(uint256(42));
        vm.prank(alice);
        judge.submitCommitment(id, _commit("the answer", salt, alice, id));
        vm.warp(submitEnds + 1);
        vm.startPrank(alice);
        judge.revealAnswer(id, "the answer", salt);
        vm.expectRevert("already revealed");
        judge.revealAnswer(id, "the answer", salt);
        vm.stopPrank();
    }

    // ---- judge & finalize ----

    function _twoRevealed() internal returns (uint256 id) {
        id = _create();
        bytes32 sa = bytes32(uint256(1));
        bytes32 sb = bytes32(uint256(2));
        vm.prank(alice);
        judge.submitCommitment(id, _commit("alice answer", sa, alice, id));
        vm.prank(bob);
        judge.submitCommitment(id, _commit("bob answer", sb, bob, id));
        vm.warp(submitEnds + 1);
        vm.prank(alice);
        judge.revealAnswer(id, "alice answer", sa);
        vm.prank(bob);
        judge.revealAnswer(id, "bob answer", sb);
    }

    function test_JudgeAll_NonRitualChain() public {
        uint256 id = _twoRevealed();
        vm.warp(revealEnds + 1);
        vm.prank(owner);
        judge.judgeAll(id, hex"");
        (,,,,,, bool judged,,,,,) = judge.getBounty(id);
        assertTrue(judged);
    }

    function test_RevertJudge_NotOwner() public {
        uint256 id = _twoRevealed();
        vm.warp(revealEnds + 1);
        vm.prank(alice);
        vm.expectRevert("not bounty owner");
        judge.judgeAll(id, hex"");
    }

    function test_RevertJudge_BeforeRevealDeadline() public {
        uint256 id = _twoRevealed();
        vm.prank(owner);
        vm.expectRevert("reveal not finished");
        judge.judgeAll(id, hex"");
    }

    function test_RevertJudge_NoRevealed() public {
        uint256 id = _create();
        vm.prank(alice);
        judge.submitCommitment(id, _commit("x", bytes32(uint256(1)), alice, id));
        vm.warp(revealEnds + 1);
        vm.prank(owner);
        vm.expectRevert("no revealed answers");
        judge.judgeAll(id, hex"");
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
    }

    function test_RevertFinalize_BeforeJudge() public {
        uint256 id = _twoRevealed();
        vm.warp(revealEnds + 1);
        vm.prank(owner);
        vm.expectRevert("not judged yet");
        judge.finalizeWinner(id, 0);
    }

    function test_RevertFinalize_UnrevealedWinner() public {
        uint256 id = _create();
        bytes32 sa = bytes32(uint256(1));
        vm.prank(alice);
        judge.submitCommitment(id, _commit("alice answer", sa, alice, id));
        vm.prank(carol);
        judge.submitCommitment(id, _commit("carol", bytes32(uint256(9)), carol, id));
        vm.warp(submitEnds + 1);
        vm.prank(alice);
        judge.revealAnswer(id, "alice answer", sa);
        vm.warp(revealEnds + 1);
        vm.prank(owner);
        judge.judgeAll(id, hex"");
        vm.prank(owner);
        vm.expectRevert("winner not revealed");
        judge.finalizeWinner(id, 1); // carol never revealed
    }

    function test_FullLifecycle() public {
        uint256 id = _twoRevealed();
        vm.warp(revealEnds + 1);
        vm.startPrank(owner);
        judge.judgeAll(id, hex"");
        judge.setVerdictReference(id, "ipfs://bundle", keccak256("bundle"));
        judge.finalizeWinner(id, 0);
        vm.stopPrank();
        (,,,,,,, bool finalized,,, uint256 winner,) = judge.getBounty(id);
        assertTrue(finalized);
        assertEq(winner, 0);
        (string memory ref,) = judge.getVerdictReference(id);
        assertEq(ref, "ipfs://bundle");
    }

    function test_ComputeCommitmentMatches() public view {
        bytes32 a = judge.computeCommitment("hello", bytes32(uint256(7)), alice, 1);
        bytes32 b = _commit("hello", bytes32(uint256(7)), alice, 1);
        assertEq(a, b);
    }
}
