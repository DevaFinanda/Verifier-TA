import { config } from '../config/index.js';

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
export function generateDIDDocument(publicKeyMultibase: string): DIDDocument {
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
export function extractPublicKeyFromDIDDoc(didDoc: DIDDocument): string | null {
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
