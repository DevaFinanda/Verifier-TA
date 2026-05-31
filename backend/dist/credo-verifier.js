/**
 * Credo-TS Agent — OID4VP Verifier
 *
 * Initializes a Credo Agent with OpenId4VcModule for OID4VP verification.
 * The agent uses did:web backed by Askar-persistent KMS for signing
 * authorization requests and registers Express routes for the OID4VP protocol.
 */
import { Agent, LogLevel, ConsoleLogger, Kms, DidDocument, VerificationMethod, DidsModule, WebDidResolver, KeyDidResolver, JwkDidResolver, } from '@credo-ts/core';
import * as fs from 'fs';
import * as path from 'path';
import { agentDependencies, NodeKeyManagementService, NodeInMemoryKeyManagementStorage, } from '@credo-ts/node';
import { AskarModule } from '@credo-ts/askar';
import { askar } from '@openwallet-foundation/askar-nodejs';
import { OpenId4VcModule, OpenId4VcVerificationSessionState, OpenId4VcVerifierEvents, } from '@credo-ts/openid4vc';
import { config } from './config/index.js';
// ─── Constants ───────────────────────────────────────────────────────────────
const WALLET_ID = 'bpjs-verifier-wallet';
// ─── Module-level State (using globalThis to survive ESM dual-module loading) ─
const GLOBAL_KEY = '__credo_verifier_state__';
function getState() {
    if (!globalThis[GLOBAL_KEY]) {
        globalThis[GLOBAL_KEY] = {
            agent: null,
            verifierRecord: null,
            verifierDidUrl: null,
        };
    }
    return globalThis[GLOBAL_KEY];
}
// ─── Presentation Definition for BPJSHealthCredential ────────────────────────
export const BPJS_PRESENTATION_DEFINITION = {
    id: 'bpjs-credential-request',
    name: 'BPJS Health Credential Verification',
    purpose: 'Verifikasi credential kesehatan BPJS pasien',
    input_descriptors: [
        {
            id: 'bpjs-health-credential',
            name: 'BPJS Health Insurance Credential',
            purpose: 'Verify patient BPJS health insurance status',
            format: {
                jwt_vc: {
                    alg: ['EdDSA'],
                },
                jwt_vp: {
                    alg: ['EdDSA'],
                },
                jwt_vc_json: {
                    alg: ['EdDSA'],
                },
                'vc+sd-jwt': {
                    alg: ['EdDSA'],
                },
            },
            constraints: {
                fields: [
                    {
                        path: ['$.vc.type'],
                        filter: {
                            type: 'array',
                            contains: { const: 'KartuBPJSKesehatan' },
                        },
                    },
                ],
            },
        },
    ],
};
// ─── Initialize Credo Agent ──────────────────────────────────────────────────
export async function initCredoVerifier() {
    console.log('🔐 Initializing Credo-TS OID4VP Verifier Agent...');
    const baseUrl = config.oid4vp.verifierBaseUrl;
    // Create agent with OpenId4VcModule (combined module handles Express app internally)
    const agent = new Agent({
        dependencies: agentDependencies,
        config: {
            allowInsecureHttpUrls: true, // Allow HTTP for development
            logger: new ConsoleLogger(config.nodeEnv === 'development' ? LogLevel.warn : LogLevel.error),
        },
        modules: {
            askar: new AskarModule({
                askar: askar,
                store: {
                    id: WALLET_ID,
                    key: config.jwt.secret,
                },
                // enableKms: false — use NodeKeyManagementService instead
                // (Askar KMS has OKP/Ed25519 incompatibility in this version)
                enableKms: false,
            }),
            kms: new Kms.KeyManagementModule({
                backends: [
                    new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage()),
                ],
            }),
            // ── DID Resolvers — W3C standard resolvers untuk semua metode DID yang dipakai ──
            // did:key  → self-certifying, tidak butuh HTTP (holder wallet)
            // did:web  → fetch DID document dari VPS/trust anchor via HTTP
            // did:jwk  → embedded key dalam DID string
            dids: new DidsModule({
                resolvers: [
                    new KeyDidResolver(), // resolve did:key (holder & issuer jika pakai did:key)
                    new WebDidResolver(), // resolve did:web (issuer DID di VPS/trust anchor)
                    new JwkDidResolver(), // resolve did:jwk
                ],
            }),
            openId4Vc: new OpenId4VcModule({
                verifier: {
                    baseUrl: `${baseUrl}/oid4vp`,
                    // Do NOT override the authorization endpoint path.
                    // Credo embeds `response_uri` in its signed Authorization Request JWT.
                    // The Holder reads response_uri from the JWT and POSTs there.
                    // If we override the endpoint, response_uri in JWT won't match the actual route.
                },
            }),
        },
    });
    await agent.initialize();
    console.log('  ✅ Credo Agent initialized');
    // ── Create or retrieve verifier record ──
    const verifierApi = agent.modules.openId4Vc.verifier;
    const verifierRecord = await verifierApi.createVerifier({
        clientMetadata: {
            client_name: 'BPJS Health Verifier - RS Medika',
        },
    });
    getState().verifierRecord = verifierRecord;
    console.log('  ✅ Verifier record created by Credo:', verifierRecord.verifierId);
    // ── Use did:web with deterministic keys from .env ──
    // Keys (VERIFIER_PRIVATE_KEY + VERIFIER_PUBLIC_KEY) are DER-encoded Ed25519 keys
    // saved in .env. Importing them gives a deterministic did:web on every startup,
    // so the DID document is always the same even though KMS is in-memory.
    const didWebString = config.did.verifierId;
    const didWebKeyId = `${didWebString}#key-1`;
    // Extract raw 32-byte private key from DER hex (skip 16-byte DER header)
    // VERIFIER_PRIVATE_KEY DER format: 302e020100300506032b657004220420 + 32 bytes
    const privKeyDer = Buffer.from(config.did.privateKeyHex, 'hex');
    const rawPriv = privKeyDer.slice(16);
    // Extract raw 32-byte public key from DER hex (skip 12-byte DER header)
    // VERIFIER_PUBLIC_KEY DER format: 302a300506032b6570032100 + 32 bytes
    const pubKeyDer = Buffer.from(config.did.publicKeyHex, 'hex');
    const rawPub = pubKeyDer.slice(12);
    const privD = rawPriv.toString('base64url');
    const pubX = rawPub.toString('base64url');
    // Import key into in-memory KMS (NodeKeyManagementService)
    const importedKey = await agent.kms.importKey({
        privateJwk: {
            kty: 'OKP',
            crv: 'Ed25519',
            x: pubX,
            d: privD,
        },
    });
    console.log('  🔑 Persistent Ed25519 key imported, keyId:', importedKey.keyId);
    // Build the did:web DID document using the public JWK from the imported key
    const pubJwk = importedKey.publicJwk;
    const didDocument = new DidDocument({
        context: [
            'https://www.w3.org/ns/did/v1',
            'https://w3id.org/security/suites/jws-2020/v1',
        ],
        id: didWebString,
        verificationMethod: [
            new VerificationMethod({
                id: didWebKeyId,
                type: 'JsonWebKey2020',
                controller: didWebString,
                publicKeyJwk: pubJwk,
            }),
        ],
        authentication: [didWebKeyId],
        assertionMethod: [didWebKeyId],
    });
    // Import (or overwrite) the did:web record in Credo’s DID store
    // We use overwrite:true so re-linking the new KMS keyId on each restart works
    await agent.dids.import({
        did: didWebString,
        overwrite: true,
        didDocument,
        keys: [{
                kmsKeyId: importedKey.keyId,
                didDocumentRelativeKeyId: '#key-1',
            }],
    });
    console.log('  ✅ did:web imported/refreshed in Credo store:', didWebString);
    // Write DID document to disk so /.well-known/did.json always reflects current key
    const didDocumentPlain = {
        '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://w3id.org/security/suites/jws-2020/v1',
        ],
        id: didWebString,
        verificationMethod: [{
                id: didWebKeyId,
                type: 'JsonWebKey2020',
                controller: didWebString,
                publicKeyJwk: pubJwk,
            }],
        authentication: [didWebKeyId],
        assertionMethod: [didWebKeyId],
    };
    const wellKnownDir = path.join(process.cwd(), 'public', '.well-known');
    fs.mkdirSync(wellKnownDir, { recursive: true });
    fs.writeFileSync(path.join(wellKnownDir, 'did.json'), JSON.stringify(didDocumentPlain, null, 2));
    console.log('  💾 DID document written to disk (/.well-known/did.json)');
    getState().verifierDidUrl = didWebKeyId;
    console.log('  🔑 Verifier DID URL:', getState().verifierDidUrl);
    // ── Set up event listener for verification session state changes ──
    agent.events.on(OpenId4VcVerifierEvents.VerificationSessionStateChanged, async (event) => {
        const session = event.payload.verificationSession;
        const prevState = event.payload.previousState;
        console.log(`  📡 Verification session ${session.id}: ${prevState} → ${session.state}`);
        if (session.state === OpenId4VcVerificationSessionState.ResponseVerified) {
            console.log('  ✅ VP Token verified successfully for session:', session.id);
        }
        else if (session.state === OpenId4VcVerificationSessionState.Error) {
            console.log('  ❌ Verification error for session:', session.id, session.errorMessage);
        }
    });
    getState().agent = agent;
    // Get the Express app created by OpenId4VcModule
    const credoApp = agent.modules.openId4Vc.config.app;
    console.log('🔐 Credo-TS OID4VP Verifier ready!');
    console.log(`  📡 OID4VP endpoints mounted at: ${baseUrl}/oid4vp/${verifierRecord.verifierId}/`);
    return { credoApp };
}
// ─── Getters ─────────────────────────────────────────────────────────────────
export function getCredoAgent() {
    const state = getState();
    if (!state.agent) {
        throw new Error('Credo Agent not initialized. Call initCredoVerifier() first.');
    }
    return state.agent;
}
export function getVerifierApi() {
    const agent = getCredoAgent();
    return agent.modules.openId4Vc.verifier;
}
export function getVerifierRecord() {
    const state = getState();
    if (!state.verifierRecord) {
        throw new Error('Verifier record not initialized.');
    }
    return state.verifierRecord;
}
export function getVerifierDidUrl() {
    const state = getState();
    if (!state.verifierDidUrl) {
        throw new Error('Verifier DID URL not initialized.');
    }
    return state.verifierDidUrl;
}
// ─── Re-exports for convenience ──────────────────────────────────────────────
export { OpenId4VcVerificationSessionState, };
//# sourceMappingURL=credo-verifier.js.map