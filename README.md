# spacewalk-testing-service
This service allows for testing the issue/redeem of a given set of [Spacewalk](https://github.com/pendulum-chain/spacewalk) vaults. 

The service will periodically iterate throughout all vaults and networks defined in the `config.json` file and initiate an issue to the corresponding network, after which it will perform the redeem of the issued tokens back to Stellar, to test the full cycle.

## Issue
First the issue request is performed and confirmed in the block, then the corresponding issue tokens will be payed to the vault operator's Stellar account.

Once the payment is confirmed, it is up to the vault to execute the issuance of tokens, which the service will detect via chain events.

Only when the issuance is executed, the service will start the redeem of the newly minted tokens.

## Redeem
Right after the confirmation of the issuance, a redeem request is made with `amount` equal to the number of tokens issued in the previous step (issue request amount - fees).

If confirmed, the service will start listening to the execution of the redeem. Once the event is emitted, the balance of the Stellar account should reflect the redeemed amount.

## Error Reporting
If in any of the afteromentioned steps the service encounters an error or deviation of the expected events (Abnormal delay, incorrect sums, etc), it will report via Slack API the problem.