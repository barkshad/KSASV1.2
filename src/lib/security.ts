/**
 * src/lib/security.ts
 * Anti-fraud validation for student check-in.
 * 
 * Implements 5 layers of protection:
 * 1. Device fingerprint binding
 * 2. One-time QR token consumption
 * 3. GPS proximity verification
 * 4. IP range validation
 * 5. Session-specific device lock
 */

import { db, doc, getDoc, setDoc, collection, query, where, getDocs } from './firebase';
import { collections } from './collections';

// ── Types ────────────────────────────────────────────────────────────────────
export interface CheckInSecurityContext {
  deviceFingerprint: string;
  latitude?: number | null;
  longitude?: number | null;
  ipAddress?: string;
}

export interface SessionSecurityConfig {
  /** Campus center latitude */
  campusLat?: number;
  /** Campus center longitude */
  campusLng?: number;
  /** Allowed radius in meters from campus center */
  allowedRadiusMeters?: number;
  /** Allowed IP prefixes (e.g., ["192.168.1.", "10.0.0."]) */
  allowedIpPrefixes?: string[];
  /** Whether to enforce GPS proximity */
  requireGps?: boolean;
  /** Whether to enforce IP range */
  requireIpRange?: boolean;
}

export interface SecurityValidationResult {
  allowed: boolean;
  error?: string;
  warnings?: string[];
}

// ── Default config (Kabarak University) ──────────────────────────────────────
const DEFAULT_SECURITY_CONFIG: SessionSecurityConfig = {
  campusLat: -0.3031,   // Kabarak University approximate coordinates
  campusLng: 35.9403,
  allowedRadiusMeters: 500,
  allowedIpPrefixes: [],  // Empty = no IP restriction
  requireGps: false,      // Optional — browsers may deny permission
  requireIpRange: false,  // Optional — only enforce if configured
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 1. Device Fingerprint Binding ────────────────────────────────────────────
async function validateDeviceFingerprint(
  sessionId: string,
  studentId: string,
  deviceFingerprint: string
): Promise<{ valid: boolean; error?: string }> {
  // Check if this student has checked in before with a different device
  const attendanceRef = collection(db, `${collections.SESSIONS}/${sessionId}/attendance`);
  const q = query(attendanceRef, where('studentId', '==', studentId));
  const snap = await getDocs(q);

  if (!snap.empty) {
    const existingDoc = snap.docs[0];
    const existingData = existingDoc.data();
    
    if (existingData.deviceFingerprint && existingData.deviceFingerprint !== deviceFingerprint) {
      return {
        valid: false,
        error: 'Device mismatch detected. You must use the same device you started with. If you switched devices, contact your lecturer.',
      };
    }
  }

  return { valid: true };
}

// ── 2. One-Time QR Token Consumption ─────────────────────────────────────────
async function validateAndConsumeToken(
  sessionId: string,
  token: string
): Promise<{ valid: boolean; error?: string }> {
  const consumedRef = doc(db, `${collections.SESSIONS}/${sessionId}/consumedTokens`, token);
  const consumedDoc = await getDoc(consumedRef);

  if (consumedDoc.exists()) {
    return {
      valid: false,
      error: 'This QR code has already been used. Ask your lecturer to refresh the QR code.',
    };
  }

  // Mark token as consumed
  await setDoc(consumedRef, {
    consumedAt: new Date().toISOString(),
    consumed: true,
  });

  return { valid: true };
}

// ── 3. GPS Proximity Verification ────────────────────────────────────────────
function validateGpsProximity(
  config: SessionSecurityConfig,
  latitude: number | null | undefined,
  longitude: number | null | undefined
): SecurityValidationResult {
  if (!config.requireGps) {
    if (latitude != null && longitude != null && config.campusLat && config.campusLng) {
      const distance = haversineDistance(latitude, longitude, config.campusLat, config.campusLng);
      const radius = config.allowedRadiusMeters || 500;
      
      if (distance > radius) {
        return {
          allowed: false,
          error: `You are ${Math.round(distance)}m away from campus. Check-in requires being within ${radius}m of the classroom.`,
        };
      }
    }
    return { allowed: true, warnings: ['GPS not provided — proximity check skipped'] };
  }

  // GPS is required
  if (latitude == null || longitude == null) {
    return {
      allowed: false,
      error: 'GPS location is required for check-in. Please enable location services and try again.',
    };
  }

  if (!config.campusLat || !config.campusLng) {
    return { allowed: true, warnings: ['Campus coordinates not configured'] };
  }

  const distance = haversineDistance(latitude, longitude, config.campusLat, config.campusLng);
  const radius = config.allowedRadiusMeters || 500;

  if (distance > radius) {
    return {
      allowed: false,
      error: `You are ${Math.round(distance)}m away from campus. You must be within ${radius}m to check in.`,
    };
  }

  return { allowed: true };
}

// ── 4. IP Range Validation ───────────────────────────────────────────────────
function validateIpRange(
  config: SessionSecurityConfig,
  ipAddress?: string
): SecurityValidationResult {
  if (!config.requireIpRange || !config.allowedIpPrefixes?.length) {
    return { allowed: true };
  }

  if (!ipAddress) {
    return {
      allowed: false,
      error: 'IP address could not be detected. Please check your network connection.',
    };
  }

  // Allow localhost for development
  if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress === 'localhost') {
    return { allowed: true, warnings: ['Development environment detected'] };
  }

  const matches = config.allowedIpPrefixes.some(prefix => ipAddress.startsWith(prefix));
  
  if (!matches) {
    return {
      allowed: false,
      error: `Your IP (${ipAddress}) is not on the campus network. Connect to the university WiFi to check in.`,
    };
  }

  return { allowed: true };
}

// ── 5. Session Device Lock ───────────────────────────────────────────────────
async function validateSessionDeviceLock(
  sessionId: string,
  studentId: string,
  deviceFingerprint: string
): Promise<{ valid: boolean; error?: string }> {
  // Check if any other student has used this device for this session
  const attendanceRef = collection(db, `${collections.SESSIONS}/${sessionId}/attendance`);
  const q = query(attendanceRef, where('deviceFingerprint', '==', deviceFingerprint));
  const snap = await getDocs(q);

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.studentId !== studentId) {
      return {
        valid: false,
        error: 'This device has already been used by another student for this session. One device per student per session.',
      };
    }
  }

  return { valid: true };
}

// ── Main Validation Pipeline ─────────────────────────────────────────────────
export async function validateCheckIn(
  sessionId: string,
  studentId: string,
  token: string,
  securityContext: CheckInSecurityContext,
  sessionConfig?: Partial<SessionSecurityConfig>
): Promise<SecurityValidationResult> {
  const config = { ...DEFAULT_SECURITY_CONFIG, ...sessionConfig };
  const warnings: string[] = [];

  // Layer 2: Token consumption (must be first — prevents replay attacks)
  const tokenResult = await validateAndConsumeToken(sessionId, token);
  if (!tokenResult.valid) {
    return { allowed: false, error: tokenResult.error };
  }

  // Layer 5: Session device lock (one device per student per session)
  const deviceLockResult = await validateSessionDeviceLock(sessionId, studentId, securityContext.deviceFingerprint);
  if (!deviceLockResult.valid) {
    return { allowed: false, error: deviceLockResult.error };
  }

  // Layer 1: Device fingerprint binding
  const fingerprintResult = await validateDeviceFingerprint(sessionId, studentId, securityContext.deviceFingerprint);
  if (!fingerprintResult.valid) {
    return { allowed: false, error: fingerprintResult.error };
  }

  // Layer 3: GPS proximity
  const gpsResult = validateGpsProximity(config, securityContext.latitude, securityContext.longitude);
  if (!gpsResult.allowed) {
    return { allowed: false, error: gpsResult.error };
  }
  if (gpsResult.warnings) warnings.push(...gpsResult.warnings);

  // Layer 4: IP range
  const ipResult = validateIpRange(config, securityContext.ipAddress);
  if (!ipResult.allowed) {
    return { allowed: false, error: ipResult.error };
  }
  if (ipResult.warnings) warnings.push(...ipResult.warnings);

  return { allowed: true, warnings: warnings.length > 0 ? warnings : undefined };
}
