import { query } from './database.js';

export interface TrustedIssuer {
  did: string;
  name: string;
  publicKey?: string;
  endpoint: string;
  verified: boolean;
  lastUpdated?: Date;
}

/**
 * Get all trusted issuers from database
 */
export const getTrustedIssuers = async (): Promise<TrustedIssuer[]> => {
  const result = await query('SELECT did, name, public_key, endpoint, verified, last_updated FROM trusted_issuers');
  return result.rows.map((row: any) => ({
    did: row.did,
    name: row.name,
    publicKey: row.public_key || undefined,
    endpoint: row.endpoint,
    verified: row.verified,
    lastUpdated: row.last_updated || undefined,
  }));
};

/**
 * Get issuer by DID from database
 */
export const getIssuerByDid = async (did: string): Promise<TrustedIssuer | null> => {
  const result = await query(
    'SELECT did, name, public_key, endpoint, verified, last_updated FROM trusted_issuers WHERE did = $1',
    [did]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    did: row.did,
    name: row.name,
    publicKey: row.public_key || undefined,
    endpoint: row.endpoint,
    verified: row.verified,
    lastUpdated: row.last_updated || undefined,
  };
};

/**
 * Add or update trusted issuer in database
 */
export const updateTrustedIssuer = async (
  did: string,
  issuer: Partial<TrustedIssuer>
): Promise<void> => {
  const existing = await getIssuerByDid(did);
  if (existing) {
    await query(
      `UPDATE trusted_issuers SET name = COALESCE($1, name), public_key = COALESCE($2, public_key), endpoint = COALESCE($3, endpoint), verified = COALESCE($4, verified), last_updated = NOW() WHERE did = $5`,
      [issuer.name || null, issuer.publicKey || null, issuer.endpoint || null, issuer.verified ?? null, did]
    );
  } else {
    await query(
      `INSERT INTO trusted_issuers (did, name, public_key, endpoint, verified, last_updated) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [did, issuer.name || 'Unknown Issuer', issuer.publicKey || null, issuer.endpoint || '', issuer.verified ?? false]
    );
  }
};

/**
 * Verify issuer in database
 */
export const verifyIssuer = async (did: string, publicKey: string): Promise<void> => {
  await query(
    `UPDATE trusted_issuers SET public_key = $1, verified = true, last_updated = NOW() WHERE did = $2`,
    [publicKey, did]
  );
};
