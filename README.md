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

# Usage

Please ensure that `config.json` contains the desired network configuration and vaults.
Also, ensure that `STELLAR_ACCOUNT_SECRET_MAINNET` and `STELLAR_ACCOUNT_SECRET_TESTNET` are passed as environment variables.

## Environment variables:

### Mandatory

- `SLACK_WEB_HOOK_TOKEN` - Slack web hook token for error reporting.
- `STELLAR_ACCOUNT_SECRET_MAINNET` - Stellar account secret for mainnet.
- `STELLAR_ACCOUNT_SECRET_TESTNET` - Stellar account secret for testnet.
- `SUBSTRATE_SECRET_PHRASE` - Substrate account secret used by the service to submit transactions.

### Optional

- `PORT` - Port to run the service on. Defaults to `5000`.
- `RATE_LIMIT_WINDOW_MINUTES` - Rate limit window in minutes. Defaults to `1`.
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per rate limit window. Defaults to `60`.
- `RATE_LIMIT_NUMBER_OF_PROXIES` - Allowed number of proxies in front of the service. Defaults to `1`.

Install packages using `npm i` or yarn equivalent.
Run without transpiling with `npm run dev`.

To transpile to .js first and then run, use:

- `npm run build`
- `node ./dist/server.js`
