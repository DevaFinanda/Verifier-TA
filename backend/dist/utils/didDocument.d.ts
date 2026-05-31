export interface DIDDocument {
    '@context': string | string[];
    id: string;
    verificationMethod: Array<{
        id: string;
        type: string;
        controller: string;
        publicKeyMultibase?: string;
        publicKeyBase58?: string;
    }>;
    authentication: string[];
    assertionMethod: string[];
    service?: Array<{
        id: string;
        type: string;
        serviceEndpoint: string;
    }>;
}
/**
 * Generate DID Document for Verifier
 */
export declare function generateDIDDocument(publicKeyMultibase: string): DIDDocument;
/**
 * Extract public key from DID Document
 */
export declare function extractPublicKeyFromDIDDoc(didDoc: DIDDocument): string | null;
//# sourceMappingURL=didDocument.d.ts.map