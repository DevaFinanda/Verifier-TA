import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { loadKeypairFromEnv } from '../utils/keyGenerator.js';
import * as fs from 'fs';
import * as path from 'path';
// Load real keypair from environment
function getDIDConfig() {
    const keypair = loadKeypairFromEnv();
    if (!keypair) {
        console.warn('⚠️  Verifier keys not found. Run: npm run setup');
        // Return placeholder config
        return {
            did: config.did.verifierId,
            publicKey: 'NOT_CONFIGURED',
            algorithm: 'EdDSA (Ed25519)',
            status: 'not_configured',
            createdAt: new Date(),
        };
    }
    return {
        did: config.did.verifierId,
        publicKey: keypair.publicKeyMultibase,
        algorithm: 'EdDSA (Ed25519)',
        status: 'active',
        createdAt: new Date(),
    };
}
// Initialize DID configuration
const didConfig = getDIDConfig();
// Mock endorsers
const endorsers = [
    {
        id: uuidv4(),
        name: 'BPJS Central Authority',
        did: 'did:web:202.155.132.71:bpjs-central-authority',
        status: 'verified',
    },
    {
        id: uuidv4(),
        name: 'Indonesian Ministry of Health',
        did: 'did:web:202.155.132.71:kemenkes-ri',
        status: 'verified',
    },
];
export const didService = {
    /**
     * Get DID configuration
     */
    getConfig() {
        return { ...didConfig };
    },
    /**
     * Get DID Document
     */
    getDIDDocument() {
        const didDocPath = path.join(process.cwd(), 'public', '.well-known', 'did.json');
        if (fs.existsSync(didDocPath)) {
            const content = fs.readFileSync(didDocPath, 'utf-8');
            return JSON.parse(content);
        }
        // Return minimal document if file doesn't exist
        const keypair = loadKeypairFromEnv();
        if (!keypair) {
            return {
                error: 'DID not configured. Run: npm run setup',
            };
        }
        return {
            '@context': ['https://www.w3.org/ns/did/v1'],
            id: config.did.verifierId,
            verificationMethod: [
                {
                    id: `${config.did.verifierId}#key-1`,
                    type: 'Ed25519VerificationKey2020',
                    controller: config.did.verifierId,
                    publicKeyMultibase: keypair.publicKeyMultibase,
                },
            ],
        };
    },
    /**
     * Get all endorsers
     */
    getEndorsers() {
        return [...endorsers];
    },
    /**
     * Get technical info
     */
    getTechnicalInfo() {
        return {
            didMethod: 'web (DID Web Method)',
            signatureAlgorithm: 'EdDSA (Ed25519)',
            communicationProtocol: 'DIDComm v2.0',
            credentialFormat: 'Verifiable Credential (W3C)',
            verificationProtocol: 'Zero Knowledge Proof (ZKP)',
            encryption: 'AES-256-GCM',
        };
    },
    /**
     * Resolve a DID
     */
    resolveDID(did) {
        // In production, this would resolve the DID from a registry
        if (did === config.did.verifierId) {
            return {
                did: didConfig.did,
                publicKey: didConfig.publicKey,
                status: didConfig.status,
            };
        }
        // Check endorsers
        const endorser = endorsers.find((e) => e.did === did);
        if (endorser) {
            return {
                did: endorser.did,
                publicKey: `ed25519_${endorser.id.replace(/-/g, '')}`,
                status: endorser.status,
            };
        }
        return null;
    },
    /**
     * Verify endorsement
     */
    verifyEndorsement(endorserDid) {
        const endorser = endorsers.find((e) => e.did === endorserDid);
        return endorser?.status === 'verified';
    },
};
//# sourceMappingURL=didService.js.map