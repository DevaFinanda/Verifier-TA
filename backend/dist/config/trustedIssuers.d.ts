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
export declare const getTrustedIssuers: () => Promise<TrustedIssuer[]>;
/**
 * Get issuer by DID from database
 */
export declare const getIssuerByDid: (did: string) => Promise<TrustedIssuer | null>;
/**
 * Add or update trusted issuer in database
 */
export declare const updateTrustedIssuer: (did: string, issuer: Partial<TrustedIssuer>) => Promise<void>;
/**
 * Verify issuer in database
 */
export declare const verifyIssuer: (did: string, publicKey: string) => Promise<void>;
//# sourceMappingURL=trustedIssuers.d.ts.map