#!/usr/bin/env bash
RPC=https://rpc.ritualfoundation.org
W=0x0fBC37b2472d45b9465BB1741CA7aDCDD81707D4
{
NOW=$(cast block-number --rpc-url $RPC)
echo "scanning up to block $NOW"
declare -A EV
EV[BountyCreated]='BountyCreated(uint256,address,string,uint256,uint256,uint256)'
EV[CommitmentSubmitted]='CommitmentSubmitted(uint256,uint256,address,bytes32)'
EV[AnswerRevealed]='AnswerRevealed(uint256,uint256,address)'
EV[AllAnswersJudged]='AllAnswersJudged(uint256,bytes)'
EV[WinnerFinalized]='WinnerFinalized(uint256,uint256,address,uint256)'
for name in BountyCreated CommitmentSubmitted AnswerRevealed AllAnswersJudged WinnerFinalized; do
  TOPIC=$(cast keccak "${EV[$name]}")
  echo "=== $name ==="
  FROM=$((NOW - 30000))
  R=$(cast logs --from-block $FROM --to-block $NOW --address $W $TOPIC --rpc-url $RPC 2>&1)
  BLK=$(echo "$R" | grep 'blockNumber' | head -1 | awk '{print $2}')
  TXH=$(echo "$R" | grep 'transactionHash' | head -1 | awk '{print $2}')
  if [ -n "$BLK" ]; then
    TS=$(cast block $BLK --rpc-url $RPC | grep -E '^timestamp' | awk '{print $2}')
    echo "  block=$BLK tx=$TXH ts_ms=$TS"
  else
    echo "  (not found in range)"
  fi
done
} > txs-out.txt 2>&1
