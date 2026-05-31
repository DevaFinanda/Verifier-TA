import { DIDConfig, Endorser } from '../types/index.js';
export declare const didService: {
    /**
     * Get DID configuration
     */
    getConfig(): DIDConfig;
    /**
     * Get DID Document
     */
    getDIDDocument(): any;
    /**
     * Get all endorsers
     */
    getEndorsers(): Endorser[];
    /**
     * Get technical info
     */
    getTechnicalInfo(): {
        didMethod: string;
        signatureAlgorithm: string;
        communicationProtocol: string;
        credentialFormat: string;
        verificationProtocol: string;
        encryption: string;
    };
    /**
     * Resolve a DID
     */
    resolveDID(did: string): {
        did: string;
        publicKey: string;
        status: string;
    } | null;
    /**
     * Verify endorsement
     */
    verifyEndorsement(endorserDid: string): boolean;
};
//# sourceMappingURL=didService.d.ts.map