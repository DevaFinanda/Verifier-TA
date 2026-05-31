import { TrustedIssuer } from '../config/trustedIssuers.js';
interface DIDDocument {
    '@context': string | string[];
    id: string;
    verificationMethod?: Array<{
        id: string;
        type: string;
        controller: string;
        publicKeyMultibase?: string;
        publicKeyBase58?: string;
        publicKeyJwk?: any;
    }>;
    authentication?: string[];
    assertionMethod?: string[];
}
interface IssuerPublicKeyInfo {
    did: string;
    name: string;
    publicKey: string;
    keyType: string;
    verified: boolean;
    endpoint: string;
    lastFetched: Date;
}
export declare const issuerResolverService: {
    /**
     * Check if issuer server is reachable
     */
    checkServerHealth(issuerEndpoint: string): Promise<boolean>;
    /**
     * Fetch DID Document from issuer
     */
    fetchDIDDocument(issuerEndpoint: string, did: string): Promise<DIDDocument | null>;
    /**
     * Extract public key from DID Document
     */
    extractPublicKey(didDoc: DIDDocument): string | null;
    /**
     * Fetch public key directly from issuer endpoint
     */
    fetchPublicKeyDirect(issuerEndpoint: string): Promise<string | null>;
    /**
     * Resolve issuer and get public key
     * Supports DEMO mode: returns mock public key if issuer server is offline
     */
    resolveIssuer(did: string): Promise<IssuerPublicKeyInfo | null>;
    /**
     * Resolve all trusted issuers
     */
    resolveAllIssuers(): Promise<IssuerPublicKeyInfo[]>;
    /**
     * Get all issuers with their status
     */
    getAllIssuersStatus(): Promise<Array<TrustedIssuer>>;
    /**
     * Verify credential signature with issuer public key
     */
    verifyCredentialSignature(credentialDid: string, signature: string): Promise<boolean>;
};
export {};
//# sourceMappingURL=issuerResolverService.d.ts.map