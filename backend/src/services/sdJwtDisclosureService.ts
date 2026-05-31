import crypto from 'crypto';
import type { VerificationReasonCode } from '../types/verification.js';

export class SdJwtDisclosureError extends Error {
  constructor(message: string, public step?: string) {
    super(message);
    this.name = 'SdJwtDisclosureError';
  }
}

export interface ParsedDisclosure {
  encoded: string;
  rawJson: string;
  salt: string;
  key: string;
  value: unknown;
}

export interface DisclosureVerificationResult {
  ok: boolean;
  reasonCodes: VerificationReasonCode[];
  claims: Record<string, unknown>;
}

export function parseDisclosureToken(encodedDisclosure: string): ParsedDisclosure {
  const rawJson = Buffer.from(encodedDisclosure, 'base64url').toString('utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new SdJwtDisclosureError('Disclosure SD-JWT tidak valid JSON', 'DISCLOSURE_FORMAT_INVALID');
  }

  if (!Array.isArray(parsed) || parsed.length !== 3) {
    throw new SdJwtDisclosureError('Disclosure SD-JWT harus [salt,key,value]', 'DISCLOSURE_FORMAT_INVALID');
  }

  const [salt, key, value] = parsed;
  if (typeof salt !== 'string' || typeof key !== 'string') {
    throw new SdJwtDisclosureError('Disclosure SD-JWT salt/key tidak valid', 'DISCLOSURE_FORMAT_INVALID');
  }

  return {
    encoded: encodedDisclosure,
    rawJson,
    salt,
    key,
    value,
  };
}

export function verifyDisclosures(
  issuerPayload: Record<string, unknown>,
  disclosures: ParsedDisclosure[],
): DisclosureVerificationResult {
  const reasonCodes: VerificationReasonCode[] = [];
  const claims: Record<string, unknown> = {};

  const digestAlg = normalizeDigestAlgorithm(String(issuerPayload._sd_alg || 'sha-256'));
  const expectedDigests = new Set(
    Array.isArray(issuerPayload._sd)
      ? issuerPayload._sd.filter((entry): entry is string => typeof entry === 'string')
      : [],
  );

  if (expectedDigests.size === 0 && disclosures.length > 0) {
    return {
      ok: false,
      reasonCodes: ['disclosure_hash_mismatch'],
      claims: {},
    };
  }

  for (const disclosure of disclosures) {
    const digest = computeDisclosureDigest(disclosure.rawJson, digestAlg);
    if (!expectedDigests.has(digest)) {
      reasonCodes.push('disclosure_hash_mismatch');
      continue;
    }

    claims[disclosure.key] = disclosure.value;
  }

  return {
    ok: reasonCodes.length === 0,
    reasonCodes: Array.from(new Set(reasonCodes)),
    claims,
  };
}

function normalizeDigestAlgorithm(sdAlg: string): 'sha256' | 'sha384' | 'sha512' {
  const normalized = sdAlg.toLowerCase();
  if (normalized === 'sha-256' || normalized === 'sha256') return 'sha256';
  if (normalized === 'sha-384' || normalized === 'sha384') return 'sha384';
  if (normalized === 'sha-512' || normalized === 'sha512') return 'sha512';
  throw new SdJwtDisclosureError(`_sd_alg tidak didukung: ${sdAlg}`, 'DISCLOSURE_HASH_MISMATCH');
}

function computeDisclosureDigest(rawJson: string, alg: 'sha256' | 'sha384' | 'sha512'): string {
  const digest = crypto.createHash(alg).update(rawJson, 'utf8').digest();
  return Buffer.from(digest).toString('base64url');
}
