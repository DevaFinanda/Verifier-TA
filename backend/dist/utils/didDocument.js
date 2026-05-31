import { config } from '../config/index.js';
/**
 * Generate DID Document for Verifier
 */
export function generateDIDDocument(publicKeyMultibase) {
    const verifierDID = config.did.verifierId;
    const keyId = `${verifierDID}#key-1`;
    const verifierBaseUrl = config.oid4vp.verifierBaseUrl.replace(/\/$/, '');
    return {
        '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://w3id.org/security/suites/ed25519-2020/v1',
        ],
        id: verifierDID,
        verificationMethod: [
            {
                id: keyId,
                type: 'Ed25519VerificationKey2020',
                controller: verifierDID,
                publicKeyMultibase: publicKeyMultibase,
            },
        ],
        authentication: [keyId],
        assertionMethod: [keyId],
        service: [
            {
                id: `${verifierDID}#verification-service`,
                type: 'VerificationService',
                serviceEndpoint: `${verifierBaseUrl}/api/verify`,
            },
        ],
    };
}
/**
 * Extract public key from DID Document
 */
export function extractPublicKeyFromDIDDoc(didDoc) {
    if (!didDoc.verificationMethod || didDoc.verificationMethod.length === 0) {
        return null;
    }
    const verificationMethod = didDoc.verificationMethod[0];
    if (verificationMethod.publicKeyMultibase) {
        return verificationMethod.publicKeyMultibase;
    }
    if (verificationMethod.publicKeyBase58) {
        return `z${verificationMethod.publicKeyBase58}`;
    }
    return null;
}
//# sourceMappingURL=didDocument.js.map