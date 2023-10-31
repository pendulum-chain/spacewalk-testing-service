import { DispatchError, EventRecord } from '@polkadot/types/interfaces';
import { IIssueExecution, IIssueRequest, IRedeemExecution, IRedeemRequest } from './event_types.js';
import { stellarHexToPublic } from '../stellar_service/convert.js';


export function parseEventIssueExecution(event: EventRecord): IIssueExecution {
    const rawEventData = JSON.parse(event.event.data.toString());
    const mappedData: IIssueExecution = {
        issue_id: rawEventData[0].toString(),
        requester: rawEventData[1].toString(),
        vault_id: {
            accountId: rawEventData[2].accountId.toString(),
            currencies: {
                collateral: {
                    XCM: parseInt(rawEventData[2].currencies.collateral.xcm.toString(), 10)
                },
                wrapped: {
                    Stellar: {
                        AlphaNum4: {
                            code: rawEventData[2].currencies.wrapped.stellar.alphaNum4.code.toString(),
                            issuer: stellarHexToPublic(rawEventData[2].currencies.wrapped.stellar.alphaNum4.issuer.toString())
                        }
                    }
                }
            }
        },
        amount: parseInt(rawEventData[3].toString(), 10),
        asset: {
            Stellar: {
                AlphaNum4: {
                    code: rawEventData[4].stellar.alphaNum4.code.toString(),
                    issuer: stellarHexToPublic(rawEventData[4].stellar.alphaNum4.issuer.toString())
                }
            }
        },
        fee: parseInt(rawEventData[5].toString(), 10),

    }
    return mappedData;
}

export function parseEventIssueRequest(event: EventRecord): IIssueRequest {
    const rawEventData = JSON.parse(event.event.data.toString());
    const mappedData: IIssueRequest = {
        issue_id: rawEventData[0].toString(),
        requester: rawEventData[1].toString(),
        amount: parseInt(rawEventData[2].toString(), 10),
        asset: {
            Stellar: {
                AlphaNum4: {
                    code: rawEventData[3].stellar.alphaNum4.code.toString(),
                    issuer: stellarHexToPublic(rawEventData[3].stellar.alphaNum4.issuer.toString())
                }
            }
        },
        fee: parseInt(rawEventData[4].toString(), 10),
        griefing_collateral: parseInt(rawEventData[5].toString(), 10),
        vault_id: {
            accountId: rawEventData[6].accountId.toString(),
            currencies: {
                collateral: {
                    XCM: parseInt(rawEventData[6].currencies.collateral.xcm.toString(), 10)
                },
                wrapped: {
                    Stellar: {
                        AlphaNum4: {
                            code: rawEventData[6].currencies.wrapped.stellar.alphaNum4.code.toString(),
                            issuer: stellarHexToPublic(rawEventData[6].currencies.wrapped.stellar.alphaNum4.issuer.toString())
                        }
                    }
                }
            }
        },
        vault_stellar_public_key: stellarHexToPublic(rawEventData[7].toString())
    };
    return mappedData;
}


export function parseEventRedeemRequest(event: EventRecord): IRedeemRequest {
    const rawEventData = JSON.parse(event.event.data.toString());
    const mappedData: IRedeemRequest = {
        redeem_id: rawEventData[0].toString(),
        redeemer: rawEventData[1].toString(),
        vault_id: {
            accountId: rawEventData[2].accountId.toString(),
            currencies: {
                collateral: {
                    XCM: parseInt(rawEventData[2].currencies.collateral.xcm.toString(), 10)
                },
                wrapped: {
                    Stellar: {
                        AlphaNum4: {
                            code: rawEventData[2].currencies.wrapped.stellar.alphaNum4.code.toString(),
                            issuer: stellarHexToPublic(rawEventData[2].currencies.wrapped.stellar.alphaNum4.issuer.toString())
                        }
                    }
                }
            }
        },
        amount: parseInt(rawEventData[3].toString(), 10),
        asset: {
            Stellar: {
                AlphaNum4: {
                    code: rawEventData[4].stellar.alphaNum4.code.toString(),
                    issuer: stellarHexToPublic(rawEventData[4].stellar.alphaNum4.issuer.toString())
                }
            }
        },
        fee: parseInt(rawEventData[5].toString(), 10),
        premium: parseInt(rawEventData[6].toString(), 10),
        stellar_address: stellarHexToPublic(rawEventData[7].toString()),
        transfer_fee: parseInt(rawEventData[8].toString(), 10),
    };
    return mappedData;
}

export function parseEventRedeemExecution(event: EventRecord): IRedeemExecution {
    const rawEventData = JSON.parse(event.event.data.toString());
    const mappedData: IRedeemExecution = {
        redeem_id: rawEventData[0].toString(),
        redeemer: rawEventData[1].toString(),
        vault_id: {
            accountId: rawEventData[2].accountId.toString(),
            currencies: {
                collateral: {
                    XCM: parseInt(rawEventData[2].currencies.collateral.xcm.toString(), 10)
                },
                wrapped: {
                    Stellar: {
                        AlphaNum4: {
                            code: rawEventData[2].currencies.wrapped.stellar.alphaNum4.code.toString(),
                            issuer: stellarHexToPublic(rawEventData[2].currencies.wrapped.stellar.alphaNum4.issuer.toString())
                        }
                    }
                }
            }
        },
        amount: parseInt(rawEventData[3].toString(), 10),
        asset: {
            Stellar: {
                AlphaNum4: {
                    code: rawEventData[4].stellar.alphaNum4.code.toString(),
                    issuer: stellarHexToPublic(rawEventData[4].stellar.alphaNum4.issuer.toString())
                }
            }
        },
        fee: parseInt(rawEventData[5].toString(), 10),
        transfer_fee: parseInt(rawEventData[6].toString(), 10),
    };
    return mappedData;
}

