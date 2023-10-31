import { Keypair, StrKey } from 'stellar-sdk';


export function stellarHexToPublic(hexString: string): string {
    return StrKey.encodeEd25519PublicKey(hexToBuffer(hexString))
}

export function stellarPublicToHex(stellar_pk: string): string {
    let buffer = StrKey.decodeEd25519PublicKey(stellar_pk);
    return "0x".concat(bufferToHex(buffer))
}

export function hexToBuffer(hexString: string): Buffer {
    if (hexString.length % 2 !== 0) {
        throw new Error("The provided hex string has an odd length. It must have an even length.");
    }
    return Buffer.from(hexString.split('0x')[1], 'hex');
}

export function bufferToHex(buffer: Buffer): string {
    return buffer.toString('hex');
}