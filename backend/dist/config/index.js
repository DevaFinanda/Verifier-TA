import dotenv from 'dotenv';
dotenv.config();
const verifierWebDomain = process.env.VERIFIER_DOMAIN || 'verifier.identia.my.id';
const verifierDid = process.env.DID_VERIFIER_ID || `did:web:${verifierWebDomain}`;
export const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3002', 10),
    jwt: {
        secret: process.env.JWT_SECRET || 'default-secret-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    corsOrigins: (process.env.CORS_ORIGIN || 'https://verifier.identia.my.id,http://localhost:3003,http://localhost:3004')
        .split(',')
        .map(origin => origin.trim()),
    databaseUrl: process.env.DATABASE_URL || '',
    did: {
        method: process.env.DID_METHOD || 'web',
        verifierId: verifierDid,
        // Domain used for did:web DID construction (without scheme)
        // e.g. 'verifier.identia.my.id' → did:web:verifier.identia.my.id
        domain: verifierDid,
        webDomain: verifierWebDomain,
        // DER-encoded hex keys from VERIFIER_PRIVATE_KEY / VERIFIER_PUBLIC_KEY env vars
        privateKeyHex: process.env.VERIFIER_PRIVATE_KEY || '',
        publicKeyHex: process.env.VERIFIER_PUBLIC_KEY || '',
    },
    oid4vp: {
        verifierBaseUrl: process.env.VERIFIER_BASE_URL || 'https://verifier.identia.my.id',
        verifierClientId: process.env.VERIFIER_CLIENT_ID || verifierDid,
        trustedIssuerDid: process.env.TRUSTED_ISSUER_DID || '',
        sessionTimeoutMinutes: parseInt(process.env.VERIFICATION_SESSION_TIMEOUT_MINUTES || '2', 10),
        nonceTtlSeconds: parseInt(process.env.OID4VP_NONCE_TTL_SECONDS || '120', 10),
        allowedAlgorithms: (process.env.OID4VP_ALLOWED_ALGORITHMS || 'EdDSA')
            .split(',')
            .map((alg) => alg.trim())
            .filter(Boolean),
        requireExactDisclosure: process.env.OID4VP_REQUIRE_EXACT_DISCLOSURE !== 'false',
        rejectOversharing: process.env.OID4VP_REJECT_OVERSHARING !== 'false',
        requireAudienceMatch: process.env.OID4VP_REQUIRE_AUDIENCE_MATCH !== 'false',
        requireNonceBinding: process.env.OID4VP_REQUIRE_NONCE_BINDING !== 'false',
        requireDescriptorMapValidation: process.env.OID4VP_REQUIRE_DESCRIPTOR_MAP !== 'false',
        requireKeyBindingForSdJwt: process.env.OID4VP_REQUIRE_SDJWT_KEY_BINDING !== 'false',
        verifyCredentialSignature: process.env.OID4VP_VERIFY_CREDENTIAL_SIGNATURE !== 'false',
        verifyPresentationSignature: process.env.OID4VP_VERIFY_PRESENTATION_SIGNATURE !== 'false',
        bypassCredoVerification: process.env.OID4VP_BYPASS_CREDO_VERIFICATION === 'true',
        allowStatusCacheFallback: process.env.OID4VP_ALLOW_STATUS_CACHE_FALLBACK !== 'false',
        maxClockSkewSeconds: parseInt(process.env.OID4VP_MAX_CLOCK_SKEW_SECONDS || '60', 10),
    },
};
//# sourceMappingURL=index.js.map