export enum TestStage {
  TEST_INITIATED = "test_initiated",
  REQUEST_ISSUE_COMPLETED = "request_issue_completed",
  STELLAR_PAYMENT_COMPLETED = "stellar_payment_completed",
  ISSUE_COMPLETED = "issue_completed",
  REQUEST_REDEEM_COMPLETED = "request_redeem_completed",
  REDEEM_COMPLETED = "redeem_completed",
}

// Map stage to explanation
export const stageExplanation: { [key in TestStage]: string } = {
  [TestStage.TEST_INITIATED]:
    "Test initiated. Waiting for issue to be requested.",
  [TestStage.REQUEST_ISSUE_COMPLETED]:
    "Requesting issue completed. Waiting for execution of Stellar payment.",
  [TestStage.STELLAR_PAYMENT_COMPLETED]:
    "Stellar payment completed. Waiting for issue to be completed by vault.",
  [TestStage.ISSUE_COMPLETED]:
    "Issue completed. Waiting for redeem to be requested.",
  [TestStage.REQUEST_REDEEM_COMPLETED]:
    "Requesting redeem completed. Waiting for redeem to be completed by vault.",
  [TestStage.REDEEM_COMPLETED]: "Redeem completed, test finished.",
};
