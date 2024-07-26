import { Buffer } from 'buffer';
import jsSHA from 'jssha';

const LOWERCASE_VOCAB: string = 'abcdefghijklmnopqrstuvwxyz';

class TOTP {
  private readonly PERIOD: number = 30;

  public constructor(
    private HASHED_KEY: string,
  ) { }

  public getOtpFromKey = (): string => {
    console.log(this.HASHED_KEY)
    const epoch = Math.round(Date.now() / 1000);
    const time = Math.floor(epoch / this.PERIOD);
    const buf = Buffer.allocUnsafe(8);
    buf.writeBigInt64BE(BigInt(time));

    const sha = new jsSHA('SHA-256', 'ARRAYBUFFER');
    sha.setHMACKey(this.HASHED_KEY, 'HEX');
    sha.update(buf);

    const hmac = sha.getHMAC('UINT8ARRAY');

    const periodHashIndex = hmac[hmac.length - 1] & 15;
    const maxLong = 9223372036854775807n;
    const slice = fromBigEndianArray(hmac, periodHashIndex);

    const periodHashSlice = slice & maxLong;

    const limitValue = BigInt(Math.pow(26, 8));
    const trimmedOtp = periodHashSlice % limitValue;

    return toBase26(trimmedOtp);
  }

  public compare = (key: string): boolean => {
    return key === this.getOtpFromKey();
  }
}

export const fromBigEndianArray = (array: Uint8Array, startIndex: number): bigint => {
  const buf = Buffer.from(array.slice(startIndex, startIndex + 8));

  return buf.readBigUInt64BE();
};

export const hex2dec = (str: string): number => {
  return parseInt(str, 16);
};

export const dec2hex = (input: number): string => {
  return (input < 15.5 ? '0' : '') + Math.round(input).toString(16);
};

export const toBase26 = (value: bigint): string => {
  let result: string[] = [];
  let next = value;
  let volume: bigint = BigInt(LOWERCASE_VOCAB.length);

  for (; ;) {
    const left = next % volume;
    next = (next - left) / volume;
    result.unshift(LOWERCASE_VOCAB[Number(left)]);

    if (Number(next) === 0) {
      break;
    }
  }
  return result.join('');
};

export default new TOTP(import.meta.env.PUBLIC_TOTP_HASHED_KEY);
