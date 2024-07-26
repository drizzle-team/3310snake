import TOTP from './TOTP';

export interface TOTPAuth {
  c1: string,
  c2: string,
}

export const createAuthHeader = () => {
  const totpAuth: TOTPAuth = {
    c1: 'd1sa4a',
    c2: TOTP.getOtpFromKey(),
  };

  const header = `totally${JSON.stringify(totpAuth)}spice`;
  const reverseString = header.split('').reverse().join('');

  return reverseString;
};
