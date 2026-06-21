import * as OTPAuth from 'otpauth';

export function generateSessionTOTPSecret(): string {
  // Generate a cryptographically secure random base32 string
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

export function getCurrentTOTP(secretBase32: string): string {
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 5,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.generate();
}

export function validateTOTP(secretBase32: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 5,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  
  // Validates token with 1 period tolerance (~10s drift)
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}
