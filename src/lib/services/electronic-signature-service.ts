/**
 * Electronic Signature Service
 *
 * Implements 21 CFR Part 11 compliant electronic signature functionality:
 * - Password verification before signing
 * - Signature hash generation for tamper detection
 * - Meaning/intent capture for each signature
 * - Audit trail with timestamp, IP, and user agent
 *
 * Used for:
 * - Line clearance verification (FR-062)
 * - Label verification witness (FR-065)
 * - QC disposition approval (FR-067)
 */

import { createHash } from 'crypto';
import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export interface SignatureRequest {
  entityType: string;
  entityId: number;
  action: string;
  userId: number;
  password: string;
  meaning: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SignatureResult {
  success: boolean;
  signatureId?: number;
  error?: string;
  signature?: ElectronicSignatureRecord;
}

export interface ElectronicSignatureRecord {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  userId: number;
  username: string;
  fullName: string;
  title?: string;
  signedAt: string | Date;
  meaning: string;
  passwordVerified: boolean;
  signatureHash: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string | Date;
}

/**
 * Generate a SHA-256 hash for signature verification
 */
function generateSignatureHash(data: {
  entityType: string;
  entityId: number;
  action: string;
  userId: number;
  username: string;
  signedAt: string;
  meaning: string;
}): string {
  const hashInput = JSON.stringify({
    entityType: data.entityType,
    entityId: data.entityId,
    action: data.action,
    userId: data.userId,
    username: data.username,
    signedAt: data.signedAt,
    meaning: data.meaning,
  });

  return createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Verify user password for electronic signature
 */
async function verifyPassword(userId: number, password: string): Promise<boolean> {
  const usersTable = getTableRef('users');

  const users = await executeDbOperation(async (db) => {
    return db
      .select({
        id: usersTable.id,
        password: usersTable.password,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
  });

  if (users.length === 0) {
    return false;
  }

  const user = users[0];
  return await bcrypt.compare(password, user.password);
}

/**
 * Get user details for signature
 */
async function getUserDetails(userId: number): Promise<{
  username: string;
  fullName: string;
  title?: string;
} | null> {
  const usersTable = getTableRef('users');

  const users = await executeDbOperation(async (db) => {
    return db
      .select({
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        department: usersTable.department,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
  });

  if (users.length === 0) {
    return null;
  }

  const user = users[0];
  return {
    username: user.email,
    fullName: user.name,
    title: user.department ? `${user.role} - ${user.department}` : user.role,
  };
}

/**
 * Create an electronic signature with password verification
 *
 * @param request - The signature request details
 * @returns SignatureResult with success status and signature ID if successful
 */
export async function createElectronicSignature(
  request: SignatureRequest
): Promise<SignatureResult> {
  // Verify password
  const passwordValid = await verifyPassword(request.userId, request.password);
  if (!passwordValid) {
    return {
      success: false,
      error: 'Invalid password. Please re-enter your password to sign.',
    };
  }

  // Get user details
  const userDetails = await getUserDetails(request.userId);
  if (!userDetails) {
    return {
      success: false,
      error: 'User not found.',
    };
  }

  const signedAt = getNow();
  const signedAtStr = typeof signedAt === 'string' ? signedAt : signedAt.toISOString();

  // Generate signature hash
  const signatureHash = generateSignatureHash({
    entityType: request.entityType,
    entityId: request.entityId,
    action: request.action,
    userId: request.userId,
    username: userDetails.username,
    signedAt: signedAtStr,
    meaning: request.meaning,
  });

  // Create signature record
  const signaturesTable = getTableRef('electronicSignatures');

  const signatureData = {
    entityType: request.entityType,
    entityId: request.entityId,
    action: request.action,
    userId: request.userId,
    username: userDetails.username,
    fullName: userDetails.fullName,
    title: userDetails.title,
    signedAt: signedAt,
    meaning: request.meaning,
    passwordVerified: true,
    signatureHash: signatureHash,
    ipAddress: request.ipAddress || null,
    userAgent: request.userAgent || null,
    createdAt: getNow(),
  };

  const result = await executeDbOperation(async (db) => {
    return db.insert(signaturesTable).values(signatureData);
  });
  const signatureId = getInsertId(result);

  return {
    success: true,
    signatureId,
    signature: {
      id: signatureId,
      ...signatureData,
    } as ElectronicSignatureRecord,
  };
}

/**
 * Get signatures for an entity
 */
export async function getSignaturesForEntity(
  entityType: string,
  entityId: number
): Promise<ElectronicSignatureRecord[]> {
  const signaturesTable = getTableRef('electronicSignatures');

  const signatures = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(signaturesTable)
      .where(eq(signaturesTable.entityType, entityType))
      .where(eq(signaturesTable.entityId, entityId))
      .orderBy(signaturesTable.signedAt);
  });

  return signatures as ElectronicSignatureRecord[];
}

/**
 * Verify a signature hash for tamper detection
 */
export async function verifySignatureIntegrity(
  signatureId: number
): Promise<{ valid: boolean; error?: string }> {
  const signaturesTable = getTableRef('electronicSignatures');

  const signatures = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(signaturesTable)
      .where(eq(signaturesTable.id, signatureId))
      .limit(1);
  });

  if (signatures.length === 0) {
    return { valid: false, error: 'Signature not found.' };
  }

  const signature = signatures[0];
  const signedAtStr = typeof signature.signedAt === 'string'
    ? signature.signedAt
    : signature.signedAt.toISOString();

  // Recalculate hash
  const expectedHash = generateSignatureHash({
    entityType: signature.entityType,
    entityId: signature.entityId,
    action: signature.action,
    userId: signature.userId,
    username: signature.username,
    signedAt: signedAtStr,
    meaning: signature.meaning,
  });

  if (signature.signatureHash !== expectedHash) {
    return { valid: false, error: 'Signature has been tampered with.' };
  }

  return { valid: true };
}

/**
 * Get a single signature by ID
 */
export async function getSignatureById(
  signatureId: number
): Promise<ElectronicSignatureRecord | null> {
  const signaturesTable = getTableRef('electronicSignatures');

  const signatures = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(signaturesTable)
      .where(eq(signaturesTable.id, signatureId))
      .limit(1);
  });

  return signatures.length > 0 ? (signatures[0] as ElectronicSignatureRecord) : null;
}
