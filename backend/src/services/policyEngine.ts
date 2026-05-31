import { config } from '../config/index.js';

export interface VerifierPolicy {
  requireExactDisclosure: boolean;
  rejectOversharing: boolean;
  allowedAlgorithms: string[];
  requireAudienceMatch: boolean;
  requireNonceBinding: boolean;
  requireDescriptorMapValidation: boolean;
  requireKeyBindingForSdJwt: boolean;
  allowStatusCacheFallback: boolean;
  maxClockSkewSeconds: number;
}

export const verifierPolicy: VerifierPolicy = {
  requireExactDisclosure: config.oid4vp.requireExactDisclosure,
  rejectOversharing: config.oid4vp.rejectOversharing,
  allowedAlgorithms: config.oid4vp.allowedAlgorithms,
  requireAudienceMatch: config.oid4vp.requireAudienceMatch,
  requireNonceBinding: config.oid4vp.requireNonceBinding,
  requireDescriptorMapValidation: config.oid4vp.requireDescriptorMapValidation,
  requireKeyBindingForSdJwt: config.oid4vp.requireKeyBindingForSdJwt,
  allowStatusCacheFallback: config.oid4vp.allowStatusCacheFallback,
  maxClockSkewSeconds: config.oid4vp.maxClockSkewSeconds,
};

export function parseClaimKeysFromDefinition(presentationDefinition: unknown): Set<string> {
  const required = new Set<string>();
  if (!presentationDefinition || typeof presentationDefinition !== 'object') {
    return required;
  }

  const pd = presentationDefinition as Record<string, unknown>;
  const descriptors = pd.input_descriptors as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(descriptors)) return required;

  for (const descriptor of descriptors) {
    const constraints = descriptor.constraints as Record<string, unknown> | undefined;
    const fields = constraints?.fields as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(fields)) continue;

    for (const field of fields) {
      const paths = field.path as string[] | undefined;
      if (!Array.isArray(paths)) continue;
      for (const path of paths) {
        const key = extractClaimKey(path);
        if (key) required.add(key);
      }
    }
  }

  return required;
}

export function enforceDisclosurePolicy(
  requiredClaimSet: Set<string>,
  disclosedClaims: Record<string, unknown>,
  policy: VerifierPolicy,
  mode: 'sd-jwt' | 'jwt-vc',
): { ok: boolean; missing: string[]; extras: string[] } {
  if (!policy.requireExactDisclosure) {
    return { ok: true, missing: [], extras: [] };
  }

  const disclosedKeys = new Set(Object.keys(disclosedClaims));
  const effectiveRequired = Array.from(requiredClaimSet).filter((key) => {
    if (mode === 'jwt-vc' && key === 'vct') return false;
    return true;
  });

  const missing = effectiveRequired.filter((key) => !disclosedKeys.has(key));
  const extras = Array.from(disclosedKeys).filter(
    (key) => !requiredClaimSet.has(key) && !['holderDID', 'issuerDID', 'issuedAt', 'expiresAt'].includes(key),
  );

  if (missing.length > 0) return { ok: false, missing, extras };
  if (policy.rejectOversharing && extras.length > 0) return { ok: false, missing, extras };

  return { ok: true, missing, extras };
}

function extractClaimKey(path: string): string | null {
  if (typeof path !== 'string') return null;

  // Examples:
  // $.holderName -> holderName
  // $.credentialSubject.nik -> nik
  // $.vp.verifiableCredential[0].credentialSubject.nik -> nik
  const clean = path.trim();
  if (!clean.startsWith('$.')) return null;

  const tokens = clean
    .slice(2)
    .split('.')
    .map((segment) => segment.replace(/\[\d+\]/g, ''))
    .filter(Boolean);

  if (tokens.length === 0) return null;
  return tokens[tokens.length - 1] || null;
}
