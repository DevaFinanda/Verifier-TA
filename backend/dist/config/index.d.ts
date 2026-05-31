export declare const config: {
    nodeEnv: string;
    port: number;
    jwt: {
        secret: string;
        expiresIn: string;
    };
    corsOrigins: string[];
    databaseUrl: string;
    did: {
        method: string;
        verifierId: string;
        domain: string;
        webDomain: string;
        privateKeyHex: string;
        publicKeyHex: string;
    };
    oid4vp: {
        verifierBaseUrl: string;
        verifierClientId: string;
        trustedIssuerDid: string;
        sessionTimeoutMinutes: number;
        nonceTtlSeconds: number;
        allowedAlgorithms: string[];
        requireExactDisclosure: boolean;
        rejectOversharing: boolean;
        requireAudienceMatch: boolean;
        requireNonceBinding: boolean;
        requireDescriptorMapValidation: boolean;
        requireKeyBindingForSdJwt: boolean;
        verifyCredentialSignature: boolean;
        verifyPresentationSignature: boolean;
        bypassCredoVerification: boolean;
        allowStatusCacheFallback: boolean;
        maxClockSkewSeconds: number;
    };
};
//# sourceMappingURL=index.d.ts.map