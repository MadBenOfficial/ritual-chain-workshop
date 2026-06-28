import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("EclipseBountyJudgeModule", (m) => {
  const judge = m.contract("EclipseBountyJudge");
  return { judge };
});
