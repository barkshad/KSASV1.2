import * as OTPAuth from 'otpauth';

const TOTP_PERIOD = 5;
const TOTP_WINDOW = 10;

export function generateSessionTOTPSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

export function getCurrentTOTP(secretBase32: string): string {
  if (!secretBase32) {
    console.error('[TOTP] Cannot generate token: missing secret');
    return '';
  }
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.generate();
}

export function validateTOTP(secretBase32: string, token: string): boolean {
  if (!secretBase32 || !token) {
    console.error('[TOTP] Validation failed: missing secret or token', {
      hasSecret: !!secretBase32,
      hasToken: !!token,
    });
    return false;
  }

  const now = Date.now();
  const currentStep = Math.floor(now / (TOTP_PERIOD * 1000));
  const tokenStr = String(token).trim();

  console.log('[TOTP] Validation attempt', {
    currentTime: new Date(now).toISOString(),
    currentStep,
    period: TOTP_PERIOD,
    window: TOTP_WINDOW,
    totalDriftTolerance: `${TOTP_WINDOW * TOTP_PERIOD * 2}s`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    tokenReceived: tokenStr,
    tokenLength: tokenStr.length,
  });

  let totp: OTPAuth.TOTP;
  try {
    totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: TOTP_PERIOD,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    });
  } catch (err) {
    console.error('[TOTP] Failed to create TOTP instance from secret', {
      secretPrefix: secretBase32?.substring(0, 4) + '...',
      error: err instanceof Error ? err.message : err,
    });
    return false;
  }

  const delta = totp.validate({ token: tokenStr, window: TOTP_WINDOW });

  if (delta !== null) {
    console.log('[TOTP] Validation SUCCESS', { delta, driftSeconds: delta * TOTP_PERIOD });
    return true;
  }

  // — validation failed — collect diagnostics
  const expectedTokens: string[] = [];
  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    const stepTimestamp = (currentStep + i) * TOTP_PERIOD * 1000;
    expectedTokens.push(totp.generate({ timestamp: stepTimestamp }));
  }

  console.error('[TOTP] Validation FAILED', {
    receivedToken: tokenStr,
    currentStep,
    window: TOTP_WINDOW,
    period: TOTP_PERIOD,
    firstExpectedTokens: expectedTokens.slice(0, 5),
    lastExpectedTokens: expectedTokens.slice(-5),
    secretPrefix: secretBase32.substring(0, 4) + '...',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    deviceTimeISO: new Date(now).toISOString(),
  });

  return false;
}
