/**
 * VP Token Validator Service
 *
 * Implements manual verification of VP Token sesuai alur di OID4VP-Verifier-Flow.md:
 *
 * 9 Langkah Validasi:
 *  1. Decode VP JWT header
 *  2. Resolve holder DID → ambil public key
 *  3. Verifikasi tanda tangan VP (holder's key)
 *  4. Cek nonce — anti-replay attack
 *  5. Decode VC JWT → ambil issuer DID
 *  6. Resolve issuer DID → ambil publik key
 *  7. Verifikasi tanda tangan VC (issuer's key)
 *  8. Validasi klaim VC (nbf, exp, tipe, holder binding)
 *  9. Ekstrak required claims
 *
 * Format yang didukung:
 *  - jwt_vc / jwt_vp : W3C VP JWT berisi VC JWT (holder sign VP, issuer sign VC)
 *  - jwt_vc_json      : alias legacy untuk W3C VP JWT
 *  - vc+sd-jwt    : SD-JWT dengan Key Binding JWT (format yang digunakan Credo-TS)
 *
 * Dependensi (sudah tersedia):
 *  - jsonwebtoken  : JWT decode (already installed)
 *  - Node.js crypto: Ed25519 signature verification (built-in, no extra package)
 *  - Credo Agent   : DID resolver via agent.dids.resolve(did)
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getCredoAgent, BPJS_PRESENTATION_DEFINITION } from '../credo-verifier.js';
import { getIssuerByDid } from '../config/trustedIssuers.js';
import { config } from '../config/index.js';
import { didCache } from '../utils/didCache.js';
import { resolveDidWithCache } from '../utils/didResolverWithCache.js';
import { validateDescriptorMap } from './descriptorValidationService.js';
import { enforceDisclosurePolicy, parseClaimKeysFromDefinition, verifierPolicy } from './policyEngine.js';
import { parseDisclosureToken, SdJwtDisclosureError, verifyDisclosures } from './sdJwtDisclosureService.js';
export class VPValidationError extends Error {
    step;
    constructor(message, step) {
        super(message);
        this.step = step;
        this.name = 'VPValidationError';
    }
}
const credentialStatusCache = new Map();
const CREDENTIAL_STATUS_CACHE_MS = 5 * 60 * 1000;
function buildOutcome(checks) {
    const reasonCodes = checks
        .filter((check) => !check.passed && check.reasonCode)
        .map((check) => check.reasonCode);
    const cryptographicVerified = !checks.some((check) => !check.passed
        && ['signature_vp', 'signature_vc', 'did_resolution_holder', 'did_resolution_issuer', 'algorithm_policy'].includes(check.name));
    const issuerTrusted = !checks.some((check) => !check.passed && check.name === 'issuer_trust');
    const statusValid = !checks.some((check) => !check.passed && check.name === 'credential_status');
    const claimValid = !checks.some((check) => !check.passed
        && ['mandatory_fields', 'credential_type', 'holder_binding', 'presentation_submission', 'audience', 'nonce'].includes(check.name));
    const failedLayer = resolveFailedLayer(reasonCodes);
    return {
        cryptographicVerified,
        issuerTrusted,
        statusValid,
        claimValid,
        overallVerified: checks.every((check) => check.passed),
        failedLayer,
        reasonCodes,
        checks,
    };
}
function addCredentialWarnings(checks, credentialSubject, warnings) {
    console.log('FINAL VALIDATION INPUT:', credentialSubject ?? null);
    if (!credentialSubject) {
        warnings.push('credentialSubject missing');
    }
    else {
        const nik = credentialSubject.nik;
        const noBPJS = credentialSubject.noBPJS;
        if (!nik)
            warnings.push('nik missing');
        if (typeof nik === 'string' && nik.length !== 16)
            warnings.push('nik length is not 16');
        if (!noBPJS)
            warnings.push('noBPJS missing');
    }
    if (warnings.length > 0) {
        console.warn('CREDENTIAL_CHECK warnings:', {
            step: 'CREDENTIAL_CHECK',
            reason: 'missing_field / invalid_format',
            warnings,
            data: credentialSubject ?? null,
        });
    }
    checks.push({
        name: 'credential_warnings',
        passed: true,
        message: warnings.length ? `Non-critical credential warnings: ${warnings.join(', ')}` : 'No non-critical credential warnings',
    });
}
function resolveFailedLayer(reasonCodes) {
    if (reasonCodes.length === 0)
        return null;
    if (reasonCodes.some((code) => ['invalid_request', 'missing_vp_token', 'missing_state'].includes(code)))
        return 'REQUEST';
    if (reasonCodes.some((code) => ['invalid_state', 'session_already_used', 'session_expired', 'replay_detected'].includes(code)))
        return 'SESSION';
    if (reasonCodes.some((code) => ['presentation_definition_mismatch', 'descriptor_path_invalid', 'descriptor_credential_mismatch'].includes(code)))
        return 'DESCRIPTOR';
    if (reasonCodes.some((code) => ['disclosure_hash_mismatch', 'disclosure_format_invalid'].includes(code)))
        return 'DISCLOSURE';
    if (reasonCodes.some((code) => ['invalid_proof', 'issuer_signature_invalid', 'unsupported_algorithm', 'key_binding_invalid'].includes(code)))
        return 'CRYPTOGRAPHIC';
    if (reasonCodes.some((code) => ['missing_required_claim', 'oversharing_detected', 'invalid_credential_structure', 'holder_binding_invalid', 'invalid_nonce', 'invalid_audience', 'nonce_missing_in_proof'].includes(code)))
        return 'POLICY';
    if (reasonCodes.includes('issuer_not_trusted'))
        return 'TRUST';
    if (reasonCodes.some((code) => ['credential_revoked', 'credential_suspended', 'credential_expired', 'credential_status_unavailable'].includes(code)))
        return 'STATUS';
    return 'PRESENTATION';
}
export function mapStepToReasonCode(step, message) {
    const stepOrMessage = `${step || ''} ${message || ''}`.toLowerCase();
    if (stepOrMessage.includes('descriptor_path'))
        return 'descriptor_path_invalid';
    if (stepOrMessage.includes('descriptor_credential'))
        return 'descriptor_credential_mismatch';
    if (stepOrMessage.includes('missing_required_claim'))
        return 'missing_required_claim';
    if (stepOrMessage.includes('oversharing'))
        return 'oversharing_detected';
    if (stepOrMessage.includes('disclosure_hash'))
        return 'disclosure_hash_mismatch';
    if (stepOrMessage.includes('disclosure_format'))
        return 'disclosure_format_invalid';
    if (stepOrMessage.includes('key_binding'))
        return 'key_binding_invalid';
    if (stepOrMessage.includes('replay'))
        return 'replay_detected';
    if (stepOrMessage.includes('nonce_missing_in_proof'))
        return 'nonce_missing_in_proof';
    if (stepOrMessage.includes('nonce'))
        return 'invalid_nonce';
    if (stepOrMessage.includes('aud'))
        return 'invalid_audience';
    if (stepOrMessage.includes('revok'))
        return 'credential_revoked';
    if (stepOrMessage.includes('suspend'))
        return 'credential_suspended';
    if (stepOrMessage.includes('expired') || stepOrMessage.includes('exp'))
        return 'credential_expired';
    if (stepOrMessage.includes('untrusted_issuer'))
        return 'issuer_not_trusted';
    if (stepOrMessage.includes('signature'))
        return 'issuer_signature_invalid';
    if (stepOrMessage.includes('holder_binding'))
        return 'holder_binding_invalid';
    if (stepOrMessage.includes('vc_type') || stepOrMessage.includes('presentation'))
        return 'presentation_definition_mismatch';
    if (stepOrMessage.includes('did_resolution') || stepOrMessage.includes('proof'))
        return 'invalid_proof';
    if (stepOrMessage.includes('algorithm'))
        return 'unsupported_algorithm';
    if (stepOrMessage.includes('credential_status'))
        return 'credential_status_unavailable';
    if (stepOrMessage.includes('credential_structure') || stepOrMessage.includes('mandatory')) {
        return 'invalid_credential_structure';
    }
    return 'unknown_error';
}
function parseCredentialStatus(responsePayload) {
    if (!responsePayload || typeof responsePayload !== 'object')
        return null;
    const payload = responsePayload;
    const directStatus = payload.status ?? payload.state ?? payload.credentialStatus;
    if (typeof directStatus === 'string')
        return directStatus.toUpperCase();
    if (directStatus && typeof directStatus === 'object') {
        const nested = directStatus;
        if (typeof nested.status === 'string')
            return nested.status.toUpperCase();
        if (typeof nested.state === 'string')
            return nested.state.toUpperCase();
    }
    return null;
}
async function fetchCredentialStatusOnline(statusId, issuerEndpoint) {
    const sources = [statusId];
    if (issuerEndpoint) {
        const base = issuerEndpoint.replace(/\/$/, '');
        sources.push(`${base}/api/credential-status?id=${encodeURIComponent(statusId)}`);
        sources.push(`${base}/credential-status?id=${encodeURIComponent(statusId)}`);
    }
    for (const source of sources) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
            const res = await fetch(source, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            });
            if (!res.ok)
                continue;
            const payload = (await res.json());
            const status = parseCredentialStatus(payload);
            if (status) {
                credentialStatusCache.set(statusId, { status, checkedAt: Date.now() });
                return status;
            }
        }
        catch {
            // try next source or fallback cache
        }
        finally {
            clearTimeout(timeout);
        }
    }
    const cached = credentialStatusCache.get(statusId);
    if (verifierPolicy.allowStatusCacheFallback && cached && Date.now() - cached.checkedAt <= CREDENTIAL_STATUS_CACHE_MS) {
        return cached.status;
    }
    throw new VPValidationError('Credential status endpoint tidak tersedia', 'CREDENTIAL_STATUS_UNAVAILABLE');
}
// ─── DID Resolver (via Credo agent) ──────────────────────────────────────────
/**
 * Ekstrak crypto.KeyObject dari satu verificationMethod DID Document.
 * Mendukung publicKeyJwk, publicKeyMultibase (did:key z-prefix), dan publicKeyBase58.
 */
function extractKeyFromVM(vm, did) {
    // Case 1: publicKeyJwk (OKP Ed25519 / JsonWebKey2020)
    if (vm.publicKeyJwk) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return crypto.createPublicKey({ format: 'jwk', key: vm.publicKeyJwk });
    }
    // Case 2: publicKeyMultibase (did:key — z prefix = base58btc)
    // Format: z + base58btc( 0xed 0x01 + 32-byte Ed25519 raw public key )
    if (typeof vm.publicKeyMultibase === 'string' && vm.publicKeyMultibase.startsWith('z')) {
        const rawKey = base58Decode(vm.publicKeyMultibase.slice(1)).slice(2); // skip 0xed 0x01 multicodec prefix
        return crypto.createPublicKey({
            key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(rawKey).toString('base64url') },
            format: 'jwk',
        });
    }
    // Case 3: publicKeyBase58 (Ed25519VerificationKey2018 — format lama W3C)
    if (typeof vm.publicKeyBase58 === 'string') {
        const rawKey = base58Decode(vm.publicKeyBase58);
        return crypto.createPublicKey({
            key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(rawKey).toString('base64url') },
            format: 'jwk',
        });
    }
    throw new VPValidationError(`Format public key tidak dikenali di DID: ${did}`, 'DID_RESOLUTION');
}
/**
 * Cari verificationMethod di DID Document yang cocok dengan `kid`.
 * Gunakan exact match pada field `id`, lalu fallback ke kecocokan fragmen (#key-id).
 * Jika kid disediakan namun tidak cocok, verification harus gagal.
 */
function findVerificationMethodByKid(vms, kid) {
    if (kid) {
        // Exact match: VM id === kid (e.g. "did:web:202.155.132.71#key-1")
        const exact = vms.find(vm => vm.id === kid);
        if (exact)
            return exact;
        // Fragment-only match: cari VM yang id-nya berakhir dengan "#<fragment>"
        const fragment = kid.includes('#') ? kid.split('#')[1] : undefined;
        if (fragment) {
            const byFragment = vms.find(vm => typeof vm.id === 'string' && vm.id.endsWith(`#${fragment}`));
            if (byFragment)
                return byFragment;
        }
        throw new VPValidationError(`Verification method dengan kid="${kid}" tidak ditemukan`, 'KID_MISMATCH');
    }
    return vms[0];
}
/**
 * Resolve DID Document dan kembalikan crypto.KeyObject Ed25519.
 *
 * Urutan resolusi dengan cache berlapis:
 *  1. Credo Agent    — resolver bawaan (KeyDidResolver, WebDidResolver, JwkDidResolver)
 *                      → jika berhasil, DID Document disimpan ke cache lokal
 *  2. Cache + Network — resolveDidWithCache() menangani:
 *                       a. Cache hit (TTL valid)     → "DID loaded from cache"
 *                       b. Network fetch berhasil    → "DID resolved from network"
 *                       c. Network down, stale cache → "DID fallback from cache"
 *
 * @param did  DID issuer/holder (e.g. "did:web:202.155.132.71")
 * @param kid  Key ID dari JWT header — untuk memilih verificationMethod yang tepat
 */
async function resolveDIDPublicKey(did, kid) {
    // ── Path 1: Credo agent (standard DID resolver) ──────────────────────────
    try {
        const agent = getCredoAgent();
        const result = await agent.dids.resolve(did);
        console.log('DID RESOLUTION:', {
            did,
            kid: kid ?? null,
            source: 'credo',
            didDocumentFound: Boolean(result.didDocument),
            didResolutionMetadata: result.didResolutionMetadata,
            didDocumentMetadata: result.didDocumentMetadata,
        });
        if (result.didDocument) {
            const vms = result.didDocument.verificationMethod;
            if (!vms || vms.length === 0) {
                throw new VPValidationError(`Tidak ada verification method di DID: ${did}`, 'DID_RESOLUTION');
            }
            // Simpan ke cache → tersedia sebagai fallback jika server down nanti
            await didCache.init();
            await didCache.set(did, result.didDocument);
            const vm = findVerificationMethodByKid(vms, kid);
            console.log('DID RESOLUTION:', {
                did,
                kid: kid ?? null,
                verificationMethodId: vm.id ?? null,
                publicKeyJwk: vm.publicKeyJwk ?? null,
                publicKeyMultibase: vm.publicKeyMultibase ?? null,
                publicKeyBase58: vm.publicKeyBase58 ?? null,
            });
            return extractKeyFromVM(vm, did);
        }
    }
    catch (credoErr) {
        if (credoErr instanceof VPValidationError)
            throw credoErr;
        if (did.startsWith('did:web:')) {
            console.warn(`⚠️  Credo DID resolver gagal untuk ${did}: ${credoErr.message}`);
        }
        else {
            throw new VPValidationError(`DID resolution gagal untuk ${did}: ${credoErr.message}`, 'DID_RESOLUTION');
        }
    }
    if (did.startsWith('did:web:')) {
        // ── Path 2 & 3: Cache-backed resolution (network + stale fallback) ───────
        // resolveDidWithCache menangani: cache hit → network → stale fallback
        try {
            const didDoc = await resolveDidWithCache(did);
            console.log('DID RESOLUTION:', {
                did,
                kid: kid ?? null,
                source: 'cache/network-fallback',
                didDocumentFound: Boolean(didDoc),
            });
            const vms = didDoc.verificationMethod;
            if (!vms?.length) {
                throw new VPValidationError(`Tidak ada verification method di DID: ${did}`, 'DID_RESOLUTION');
            }
            // Periksa assertionMethod (W3C spec)
            if (kid && didDoc.assertionMethod?.length) {
                const assertions = didDoc.assertionMethod;
                const inAssert = assertions.some(am => am === kid || (typeof am === 'object' && am.id === kid));
                if (!inAssert) {
                    console.warn(`⚠️  kid="${kid}" tidak ditemukan di assertionMethod DID Document`);
                }
            }
            const vm = findVerificationMethodByKid(vms, kid);
            console.log('DID RESOLUTION:', {
                did,
                kid: kid ?? null,
                verificationMethodId: vm.id ?? null,
                publicKeyJwk: vm.publicKeyJwk ?? null,
                publicKeyMultibase: vm.publicKeyMultibase ?? null,
                publicKeyBase58: vm.publicKeyBase58 ?? null,
            });
            return extractKeyFromVM(vm, did);
        }
        catch (resolveErr) {
            if (resolveErr instanceof VPValidationError)
                throw resolveErr;
            throw new VPValidationError(`DID resolution gagal untuk ${did}: ${resolveErr.message}`, 'DID_RESOLUTION');
        }
    }
    throw new VPValidationError(`Tidak dapat resolve DID: ${did}`, 'DID_RESOLUTION');
}
// ─── Base58 Decoder (tanpa dependensi eksternal) ─────────────────────────────
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Decode(str) {
    let num = BigInt(0);
    for (const ch of str) {
        const idx = BASE58_ALPHABET.indexOf(ch);
        if (idx < 0)
            throw new VPValidationError(`Karakter base58 tidak valid: ${ch}`, 'BASE58');
        num = num * BigInt(58) + BigInt(idx);
    }
    const hex = num.toString(16).padStart(2, '0');
    return new Uint8Array(Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex'));
}
// ─── JWT Ed25519 Signature Verifier ──────────────────────────────────────────
/**
 * Verifikasi tanda tangan Ed25519 pada JWT menggunakan Node.js crypto.
 * Returns decoded payload jika valid, throw VPValidationError jika tidak.
 */
async function verifyJWTSignature(token, publicKey, context) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new VPValidationError('Format JWT tidak valid (harus 3 bagian)', 'JWT_FORMAT');
    }
    const [headerB64, payloadB64, signatureB64] = parts;
    const message = Buffer.from(`${headerB64}.${payloadB64}`);
    const signature = Buffer.from(signatureB64, 'base64url');
    console.log(`SIGNATURE ${context.step}:`, {
        kid: context.kid ?? null,
        keyType: publicKey.asymmetricKeyType,
        keyExport: (() => {
            try {
                return publicKey.export({ format: 'jwk' });
            }
            catch {
                return null;
            }
        })(),
    });
    const isValid = crypto.verify(null, message, publicKey, signature);
    console.log(`SIGNATURE ${context.step}:`, {
        verified: isValid,
    });
    if (!isValid) {
        throw new VPValidationError('Verifikasi tanda tangan JWT gagal', 'SIGNATURE_INVALID');
    }
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    return JSON.parse(payloadJson);
}
// ─── Format Detection ─────────────────────────────────────────────────────────
function detectFormat(vpToken, hintedFormat) {
    if (vpToken.includes('~'))
        return 'sd-jwt';
    const normalizedHint = normalizeFormatHint(hintedFormat);
    if (normalizedHint === 'jwt_vc' || normalizedHint === 'jwt_vp' || normalizedHint === 'jwt_vc_json') {
        return 'jwt_vc';
    }
    return 'jwt_vc';
}
function normalizeFormatHint(format) {
    if (!format)
        return null;
    return format.trim().toLowerCase();
}
function getSubmissionFormatHint(presentationSubmission) {
    const normalizedSubmission = normalizePresentationSubmission(presentationSubmission);
    if (!normalizedSubmission || typeof normalizedSubmission !== 'object')
        return undefined;
    const descriptorMap = normalizedSubmission.descriptor_map;
    if (!Array.isArray(descriptorMap) || descriptorMap.length === 0)
        return undefined;
    const first = descriptorMap[0];
    if (!first || typeof first !== 'object')
        return undefined;
    const format = first.format;
    return typeof format === 'string' ? format : undefined;
}
function normalizePresentationSubmission(presentationSubmission) {
    if (typeof presentationSubmission !== 'string')
        return presentationSubmission;
    try {
        return JSON.parse(presentationSubmission);
    }
    catch {
        return presentationSubmission;
    }
}
function normalizeDomain(didOrDomain) {
    if (!didOrDomain)
        return '';
    const noScheme = didOrDomain.replace(/^https?:\/\//i, '');
    const noDidPrefix = noScheme.startsWith('did:web:') ? noScheme.slice('did:web:'.length) : noScheme;
    return noDidPrefix.split('/')[0].trim().toLowerCase();
}
function audienceMatchesExpected(aud, expectedValues) {
    if (typeof aud !== 'string')
        return false;
    const normalizedAud = normalizeDomain(aud);
    return expectedValues.some((expected) => aud === expected || normalizedAud === normalizeDomain(expected));
}
function extractCredentialSubjectFromJwtPayload(vcPayload) {
    const nested = vcPayload.vc?.credentialSubject;
    if (nested && typeof nested === 'object')
        return nested;
    const direct = vcPayload.credentialSubject;
    if (direct && typeof direct === 'object')
        return direct;
    return undefined;
}
function parseSdJwt(sdJwt) {
    const parts = sdJwt.split('~');
    const issuerJwt = parts[0];
    let kbJwt = null;
    const disclosureTokens = [];
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (!part)
            continue;
        if (part.includes('.')) {
            kbJwt = part; // Key Binding JWT has dots
        }
        else {
            disclosureTokens.push(part);
        }
    }
    return { issuerJwt, kbJwt, disclosureTokens };
}
// ─── Main Entry Point ─────────────────────────────────────────────────────────
/**
 * Verifikasi VP Token sesuai flow MD — mendukung jwt_vc_json dan vc+sd-jwt.
 *
 * @param vpToken              String VP Token dari holder wallet
 * @param expectedNonce        Nonce dari sesi verifikasi yang dibuat verifier
 * @param presentationSubmission  (opsional) descriptor mapping
 */
export async function verifyVPToken(vpToken, expectedNonce, presentationSubmission, presentationDefinition = BPJS_PRESENTATION_DEFINITION) {
    const submissionFormat = getSubmissionFormatHint(presentationSubmission);
    const format = detectFormat(vpToken, submissionFormat);
    console.log(`  🔍 VP Token format detected: ${format}`);
    if (submissionFormat) {
        console.log(`  🔍 presentation_submission.format: ${submissionFormat}`);
    }
    if (format === 'sd-jwt') {
        return verifySDJwtVP(vpToken, expectedNonce, presentationSubmission, presentationDefinition);
    }
    return verifyJwtVcVP(vpToken, expectedNonce, presentationSubmission, presentationDefinition);
}
export async function verifyPresentation(vpToken, expectedNonce, presentationSubmission, presentationDefinition = BPJS_PRESENTATION_DEFINITION) {
    return verifyVPToken(vpToken, expectedNonce, presentationSubmission, presentationDefinition);
}
// ─── Path A: jwt_vc_json (W3C VP JWT) ────────────────────────────────────────
async function verifyJwtVcVP(vpToken, expectedNonce, presentationSubmission, presentationDefinition = BPJS_PRESENTATION_DEFINITION) {
    const checks = [];
    const verifyPresentationSignature = config.oid4vp.verifyPresentationSignature;
    const verifyCredentialSignature = config.oid4vp.verifyCredentialSignature;
    // ── STEP 1: Decode VP JWT header ──
    const rawDecoded = jwt.decode(vpToken, { complete: true });
    if (!rawDecoded)
        throw new VPValidationError('Tidak dapat decode VP JWT', 'STEP1_DECODE');
    if (!verifierPolicy.allowedAlgorithms.includes(rawDecoded.header.alg)) {
        throw new VPValidationError(`Algoritma tidak diizinkan: ${rawDecoded.header.alg}`, 'ALGORITHM_POLICY');
    }
    checks.push({ name: 'algorithm_policy', passed: true, message: 'VP algorithm is allowed' });
    // Ambil kid dari header VP JWT (e.g. "did:web:202.155.132.71#key-1")
    const vpKid = rawDecoded.header.kid;
    const vpPayloadRaw = rawDecoded.payload;
    // ── STEP 2: Resolve holder DID → ambil public key ──
    const holderDID = vpPayloadRaw.iss;
    if (!holderDID?.startsWith('did:')) {
        throw new VPValidationError('VP JWT tidak memiliki issuer DID yang valid', 'STEP2_HOLDER_DID');
    }
    let holderPublicKey = null;
    if (verifyPresentationSignature) {
        holderPublicKey = await resolveDIDPublicKey(holderDID, vpKid);
        checks.push({ name: 'did_resolution_holder', passed: true, message: 'Holder DID resolved' });
    }
    else {
        console.log('SIGNATURE VP:', { skipped: true, reason: 'verifyPresentationSignature=false' });
        checks.push({ name: 'did_resolution_holder', passed: true, message: 'Holder DID resolution skipped by debug mode' });
    }
    // ── STEP 3: Verifikasi tanda tangan VP (holder's key) ──
    const vpPayload = verifyPresentationSignature && holderPublicKey
        ? await verifyJWTSignature(vpToken, holderPublicKey, { step: 'VP', kid: typeof vpKid === 'string' ? vpKid : undefined })
        : rawDecoded.payload;
    checks.push({
        name: 'signature_vp',
        passed: true,
        message: verifyPresentationSignature ? 'VP signature valid' : 'VP signature check skipped by debug mode',
    });
    // ── STEP 4: Cek nonce — anti-replay attack ──
    console.log('EXPECTED NONCE:', expectedNonce);
    console.log('VP NONCE:', vpPayload.nonce);
    if (verifierPolicy.requireNonceBinding && typeof vpPayload.nonce !== 'string') {
        throw new VPValidationError('Nonce tidak ditemukan pada VP proof', 'NONCE_MISSING_IN_PROOF');
    }
    if (vpPayload.nonce !== expectedNonce) {
        throw new VPValidationError(`Nonce tidak cocok: expected=${expectedNonce}, got=${vpPayload.nonce}`, 'STEP4_NONCE_MISMATCH');
    }
    checks.push({ name: 'nonce', passed: true, message: 'Nonce matches request' });
    // ── STEP 4b: Cek audience ──
    // VP audience harus verifier client_id — opsional jika tidak disertakan wallet
    // (tidak throw, hanya log)
    if (verifierPolicy.requireAudienceMatch) {
        const expectedAudience = config.oid4vp.verifierClientId;
        const expectedCandidates = [expectedAudience, config.did.verifierId];
        if (!audienceMatchesExpected(vpPayload.aud, expectedCandidates)) {
            throw new VPValidationError(`Audience tidak valid: expected=${expectedAudience}, got=${String(vpPayload.aud)}`, 'STEP4_AUDIENCE_MISMATCH');
        }
        checks.push({ name: 'audience', passed: true, message: 'Audience matches verifier client_id' });
    }
    else {
        checks.push({ name: 'audience', passed: true, message: 'Audience check skipped by policy' });
    }
    // ── STEP 4c: Ekstrak VP → ambil VC JWT ──
    const vp = vpPayload.vp;
    const vcArray = vp?.verifiableCredential;
    if (!vcArray?.length) {
        throw new VPValidationError('VP tidak mengandung Verifiable Credential', 'STEP4_NO_VC');
    }
    if (verifierPolicy.requireDescriptorMapValidation) {
        const descriptorResult = validateDescriptorMap(presentationDefinition, presentationSubmission, vpPayload);
        console.log('PD MATCH:', descriptorResult);
        if (!descriptorResult.ok) {
            const firstReason = descriptorResult.reasonCodes[0] || 'presentation_definition_mismatch';
            throw new VPValidationError('Descriptor map tidak valid terhadap presentation definition', firstReason.toUpperCase());
        }
        checks.push({ name: 'presentation_submission', passed: true, message: 'Descriptor map valid' });
    }
    else {
        checks.push({ name: 'presentation_submission', passed: true, message: 'Descriptor validation skipped by policy' });
    }
    const vcJwt = vcArray[0];
    // ── STEP 5: Decode VC JWT → ambil issuer DID dan kid ──
    const rawVC = jwt.decode(vcJwt, { complete: true });
    if (!rawVC)
        throw new VPValidationError('Tidak dapat decode VC JWT', 'STEP5_VC_DECODE');
    if (!verifierPolicy.allowedAlgorithms.includes(rawVC.header.alg)) {
        throw new VPValidationError(`Algoritma VC tidak diizinkan: ${rawVC.header.alg}`, 'ALGORITHM_POLICY');
    }
    // Ambil kid dari header VC JWT untuk menemukan kunci issuer yang tepat
    const vcKid = rawVC.header.kid;
    const vcPayloadRaw = rawVC.payload;
    const issuerDID = vcPayloadRaw.iss;
    if (!issuerDID?.startsWith('did:')) {
        throw new VPValidationError('VC tidak memiliki issuer DID yang valid', 'STEP5_ISSUER_DID');
    }
    // ── STEP 5.5: Verifikasi issuer terdaftar di trust anchor (W3C Trust Model) ──
    // Verifier WAJIB menolak VC dari issuer yang tidak dikenal — DIF/OID4VP requirement
    const trustedIssuerRecord = await getIssuerByDid(issuerDID);
    if (!trustedIssuerRecord) {
        throw new VPValidationError(`Issuer tidak terdaftar sebagai trusted issuer: ${issuerDID}`, 'STEP5_UNTRUSTED_ISSUER');
    }
    console.log(`  ✅ Issuer terverifikasi di trust anchor: ${trustedIssuerRecord.name}`);
    checks.push({ name: 'issuer_trust', passed: true, message: 'Issuer is in trusted whitelist' });
    // ── STEP 6: Resolve issuer DID → ambil public key (gunakan kid dari header VC JWT) ──
    let issuerPublicKey = null;
    if (verifyCredentialSignature) {
        issuerPublicKey = await resolveDIDPublicKey(issuerDID, vcKid);
        checks.push({ name: 'did_resolution_issuer', passed: true, message: 'Issuer DID resolved' });
    }
    else {
        console.log('SIGNATURE VC:', { skipped: true, reason: 'verifyCredentialSignature=false' });
        checks.push({ name: 'did_resolution_issuer', passed: true, message: 'Issuer DID resolution skipped by debug mode' });
    }
    // ── STEP 7: Verifikasi tanda tangan VC (issuer's key) ──
    const vcPayload = verifyCredentialSignature && issuerPublicKey
        ? await verifyJWTSignature(vcJwt, issuerPublicKey, { step: 'VC', kid: typeof vcKid === 'string' ? vcKid : undefined })
        : vcPayloadRaw;
    checks.push({
        name: 'signature_vc',
        passed: true,
        message: verifyCredentialSignature ? 'VC signature valid' : 'VC signature check skipped by debug mode',
    });
    // ── STEP 8: Validasi klaim VC ──
    const now = Math.floor(Date.now() / 1000);
    const skew = verifierPolicy.maxClockSkewSeconds;
    if (typeof vcPayload.nbf === 'number' && vcPayload.nbf > now + skew) {
        throw new VPValidationError('VC belum berlaku (nbf belum tercapai)', 'STEP8_NBF');
    }
    if (typeof vcPayload.exp === 'number' && vcPayload.exp < now - skew) {
        throw new VPValidationError('VC sudah kadaluarsa (exp)', 'STEP8_EXPIRED');
    }
    checks.push({ name: 'time_window', passed: true, message: 'VC nbf/exp valid' });
    if (typeof vpPayload.exp === 'number' && vpPayload.exp < now - skew) {
        throw new VPValidationError('VP sudah kadaluarsa (exp)', 'STEP8_VP_EXPIRED');
    }
    if (typeof vpPayload.sub === 'string' && !vpPayload.sub.startsWith('did:')) {
        throw new VPValidationError('VP sub tidak valid (harus DID)', 'STEP8_VP_SUB_INVALID');
    }
    checks.push({ name: 'vp_claims', passed: true, message: 'VP exp/iss/sub valid' });
    const vc = vcPayload.vc ?? vcPayload;
    const typeRaw = vc?.type;
    const typeArr = Array.isArray(typeRaw) ? typeRaw : (typeof typeRaw === 'string' ? [typeRaw] : undefined);
    const acceptedTypes = ['BPJSHealthCredential', 'KartuBPJSKesehatan', 'IdentityCredential', 'VerifiableCredential'];
    if (!typeArr?.some(t => acceptedTypes.includes(t))) {
        throw new VPValidationError(`Tipe VC tidak dikenali: ${typeArr?.join(', ')}`, 'STEP8_VC_TYPE');
    }
    checks.push({ name: 'credential_type', passed: true, message: 'Credential type accepted' });
    // Holder binding: sub di VC harus sama dengan iss di VP
    if (vcPayload.sub && vcPayload.sub !== holderDID) {
        throw new VPValidationError(`Holder binding gagal: VC sub=${vcPayload.sub} ≠ VP iss=${holderDID}`, 'STEP8_HOLDER_BINDING');
    }
    checks.push({ name: 'holder_binding', passed: true, message: 'Holder binding valid' });
    // Mandatory structure validation
    const credentialStatus = vc?.credentialStatus;
    const subject = extractCredentialSubjectFromJwtPayload(vcPayload);
    const credentialWarnings = [];
    if (!issuerDID)
        credentialWarnings.push('issuer DID missing');
    if (!subject?.id)
        credentialWarnings.push('credentialSubject.id missing');
    if (!vcPayload.nbf && !vcPayload.iat)
        credentialWarnings.push('issued-at timestamp missing');
    if (!vcPayload.exp)
        credentialWarnings.push('expiration timestamp missing');
    if (!typeArr?.length)
        credentialWarnings.push('credential type missing');
    if (!credentialStatus?.id)
        credentialWarnings.push('credentialStatus.id missing');
    addCredentialWarnings(checks, subject, credentialWarnings);
    checks.push({ name: 'mandatory_fields', passed: true, message: 'Mandatory VC fields checked flexibly' });
    if (credentialStatus?.id) {
        const statusValue = await fetchCredentialStatusOnline(String(credentialStatus.id), trustedIssuerRecord.endpoint);
        if (statusValue === 'REVOKED') {
            throw new VPValidationError('Credential telah direvoke', 'CREDENTIAL_STATUS_REVOKED');
        }
        if (statusValue === 'SUSPENDED') {
            throw new VPValidationError('Credential sedang disuspend', 'CREDENTIAL_STATUS_SUSPENDED');
        }
        if (statusValue === 'EXPIRED') {
            throw new VPValidationError('Credential status endpoint menyatakan expired', 'CREDENTIAL_STATUS_EXPIRED');
        }
        checks.push({ name: 'credential_status', passed: true, message: `Credential status is ${statusValue}` });
    }
    else {
        checks.push({ name: 'credential_status', passed: true, message: 'Credential status check skipped: status id not provided' });
    }
    // ── STEP 9: Ekstrak required claims ──
    const subjectForClaims = extractCredentialSubjectFromJwtPayload(vcPayload);
    if (!subjectForClaims)
        throw new VPValidationError('VC tidak memiliki credentialSubject', 'STEP9_NO_SUBJECT');
    const claims = {
        holderDID,
        issuerDID,
        holderName: (subjectForClaims.holderName ?? subjectForClaims.nama ?? subjectForClaims.name),
        noBPJS: subjectForClaims.noBPJS,
        nik: subjectForClaims.nik,
        tanggalLahir: (subjectForClaims.tanggalLahir ?? subjectForClaims.tanggal_lahir),
        statusKepesertaan: subjectForClaims.statusKepesertaan,
        issuedAt: vcPayload.nbf,
        expiresAt: vcPayload.exp,
    };
    const requiredClaimSet = parseClaimKeysFromDefinition(presentationDefinition);
    const disclosurePolicy = enforceDisclosurePolicy(requiredClaimSet, subjectForClaims, verifierPolicy, 'jwt-vc');
    if (!disclosurePolicy.ok) {
        console.warn('CREDENTIAL_CHECK warnings:', {
            step: 'CREDENTIAL_CHECK',
            reason: 'missing_field / invalid_format',
            missing: disclosurePolicy.missing,
            extras: disclosurePolicy.extras,
            data: subjectForClaims,
        });
    }
    checks.push({
        name: 'claim_policy',
        passed: true,
        message: disclosurePolicy.ok
            ? 'Disclosure policy passed for JWT VC fallback'
            : `Disclosure policy warnings: missing=${disclosurePolicy.missing.join(',') || '-'} extras=${disclosurePolicy.extras.join(',') || '-'}`,
    });
    return { claims, outcome: buildOutcome(checks) };
}
// ─── Path B: vc+sd-jwt (SD-JWT VP Token) ─────────────────────────────────────
async function verifySDJwtVP(sdJwtVP, expectedNonce, presentationSubmission, presentationDefinition = BPJS_PRESENTATION_DEFINITION) {
    const checks = [];
    const verifyPresentationSignature = config.oid4vp.verifyPresentationSignature;
    const verifyCredentialSignature = config.oid4vp.verifyCredentialSignature;
    const { issuerJwt, kbJwt, disclosureTokens } = parseSdJwt(sdJwtVP);
    const syntheticVpPayload = {
        vp: {
            verifiableCredential: [sdJwtVP],
        },
    };
    if (verifierPolicy.requireDescriptorMapValidation) {
        const descriptorResult = validateDescriptorMap(presentationDefinition, presentationSubmission, syntheticVpPayload);
        console.log('PD MATCH:', descriptorResult);
        if (!descriptorResult.ok) {
            const firstReason = descriptorResult.reasonCodes[0] || 'presentation_definition_mismatch';
            throw new VPValidationError('Descriptor map tidak valid terhadap presentation definition', firstReason.toUpperCase());
        }
        checks.push({ name: 'presentation_submission', passed: true, message: 'Descriptor map valid' });
    }
    else {
        checks.push({ name: 'presentation_submission', passed: true, message: 'Descriptor validation skipped by policy' });
    }
    // ── STEP 5: Decode issuer JWT → ambil issuer DID dan kid ──
    const rawIssuer = jwt.decode(issuerJwt, { complete: true });
    if (!rawIssuer)
        throw new VPValidationError('Tidak dapat decode SD-JWT issuer part', 'SD_JWT_DECODE');
    if (!verifierPolicy.allowedAlgorithms.includes(rawIssuer.header.alg)) {
        throw new VPValidationError(`Algoritma SD-JWT tidak diizinkan: ${rawIssuer.header.alg}`, 'ALGORITHM_POLICY');
    }
    checks.push({ name: 'algorithm_policy', passed: true, message: 'SD-JWT algorithm is allowed' });
    // Ambil kid dari header issuer JWT untuk menemukan kunci issuer yang tepat
    const issuerKid = rawIssuer.header.kid;
    const issuerPayloadRaw = rawIssuer.payload;
    const issuerDID = issuerPayloadRaw.iss;
    if (!issuerDID?.startsWith('did:')) {
        throw new VPValidationError('SD-JWT tidak memiliki issuer DID yang valid', 'SD_ISSUER_DID');
    }
    // ── STEP 5.5: Verifikasi issuer terdaftar di trust anchor (W3C Trust Model) ──
    const trustedIssuerRecord = await getIssuerByDid(issuerDID);
    if (!trustedIssuerRecord) {
        throw new VPValidationError(`Issuer tidak terdaftar sebagai trusted issuer: ${issuerDID}`, 'SD_UNTRUSTED_ISSUER');
    }
    console.log(`  ✅ Issuer terverifikasi di trust anchor: ${trustedIssuerRecord.name}`);
    checks.push({ name: 'issuer_trust', passed: true, message: 'Issuer is in trusted whitelist' });
    // ── STEP 6 & 7: Resolve issuer DID → verifikasi tanda tangan issuer (gunakan kid dari header) ──
    let issuerPayload = issuerPayloadRaw;
    if (verifyCredentialSignature) {
        const issuerPublicKey = await resolveDIDPublicKey(issuerDID, issuerKid);
        checks.push({ name: 'did_resolution_issuer', passed: true, message: 'Issuer DID resolved' });
        issuerPayload = await verifyJWTSignature(issuerJwt, issuerPublicKey, { step: 'VC', kid: typeof issuerKid === 'string' ? issuerKid : undefined });
        checks.push({ name: 'signature_vc', passed: true, message: 'Issuer SD-JWT signature valid' });
    }
    else {
        console.log('SIGNATURE VC:', { skipped: true, reason: 'verifyCredentialSignature=false' });
        checks.push({ name: 'did_resolution_issuer', passed: true, message: 'Issuer DID resolution skipped by debug mode' });
        checks.push({ name: 'signature_vc', passed: true, message: 'Issuer SD-JWT signature skipped by debug mode' });
    }
    // ── STEP 8: Validasi klaim temporal ──
    const now = Math.floor(Date.now() / 1000);
    const skew = verifierPolicy.maxClockSkewSeconds;
    if (typeof issuerPayload.nbf === 'number' && issuerPayload.nbf > now + skew) {
        throw new VPValidationError('SD-JWT belum berlaku (nbf)', 'SD_NBF');
    }
    if (typeof issuerPayload.exp === 'number' && issuerPayload.exp < now - skew) {
        throw new VPValidationError('SD-JWT sudah kadaluarsa (exp)', 'SD_EXPIRED');
    }
    checks.push({ name: 'time_window', passed: true, message: 'SD-JWT nbf/exp valid' });
    // ── Holder binding via Key Binding JWT ──
    let holderDID = issuerPayload.sub || '';
    if (kbJwt) {
        const rawKB = jwt.decode(kbJwt, { complete: true });
        if (rawKB) {
            const kbPayload = rawKB.payload;
            // Ambil kid dari header KB-JWT untuk menemukan kunci holder yang tepat
            const kbKid = rawKB.header.kid;
            // Extract holder DID from KB-JWT iss
            const kbIss = kbPayload.iss;
            if (kbIss?.startsWith('did:'))
                holderDID = kbIss;
            // ── STEP 4: Cek nonce di KB-JWT (anti-replay) ──
            const kbNonce = kbPayload.nonce;
            console.log('EXPECTED NONCE:', expectedNonce);
            console.log('VP NONCE:', kbNonce ?? null);
            if (verifierPolicy.requireNonceBinding && !kbNonce) {
                throw new VPValidationError('Nonce tidak ditemukan pada key-binding proof', 'NONCE_MISSING_IN_PROOF');
            }
            if (kbNonce && kbNonce !== expectedNonce) {
                throw new VPValidationError(`Nonce tidak cocok di KB-JWT: expected=${expectedNonce}, got=${kbNonce}`, 'SD_NONCE_MISMATCH');
            }
            checks.push({ name: 'nonce', passed: true, message: 'Nonce matches key-binding JWT' });
            if (verifierPolicy.requireAudienceMatch) {
                const expectedAudience = config.oid4vp.verifierClientId;
                const expectedCandidates = [expectedAudience, config.did.verifierId];
                if (!audienceMatchesExpected(kbPayload.aud, expectedCandidates)) {
                    throw new VPValidationError(`Audience KB-JWT tidak valid: expected=${expectedAudience}, got=${String(kbPayload.aud)}`, 'STEP4_AUDIENCE_MISMATCH');
                }
                checks.push({ name: 'audience', passed: true, message: 'Audience matches verifier client_id' });
            }
            else {
                checks.push({ name: 'audience', passed: true, message: 'Audience check skipped by policy' });
            }
            // ── STEP 3: Verifikasi tanda tangan KB-JWT (holder's key) ──
            if (verifyPresentationSignature && holderDID.startsWith('did:')) {
                const holderPublicKey = await resolveDIDPublicKey(holderDID, kbKid);
                checks.push({ name: 'did_resolution_holder', passed: true, message: 'Holder DID resolved' });
                await verifyJWTSignature(kbJwt, holderPublicKey, { step: 'KB', kid: kbKid });
                checks.push({ name: 'signature_vp', passed: true, message: 'Key-binding signature valid' });
            }
            else if (!verifyPresentationSignature) {
                console.log('SIGNATURE VP:', { skipped: true, reason: 'verifyPresentationSignature=false' });
                checks.push({ name: 'did_resolution_holder', passed: true, message: 'Holder DID resolution skipped by debug mode' });
                checks.push({ name: 'signature_vp', passed: true, message: 'Key-binding signature skipped by debug mode' });
            }
        }
    }
    else {
        if (verifierPolicy.requireKeyBindingForSdJwt) {
            throw new VPValidationError('Key binding JWT wajib untuk SD-JWT', 'KEY_BINDING_INVALID');
        }
        // Tidak ada KB-JWT — cek nonce di issuer payload (beberapa wallet embed di sini)
        const embeddedNonce = issuerPayload.nonce;
        console.log('EXPECTED NONCE:', expectedNonce);
        console.log('VP NONCE:', embeddedNonce ?? null);
        if (verifierPolicy.requireNonceBinding && !embeddedNonce) {
            throw new VPValidationError('Nonce tidak ditemukan pada SD-JWT proof', 'NONCE_MISSING_IN_PROOF');
        }
        if (embeddedNonce && embeddedNonce !== expectedNonce) {
            throw new VPValidationError(`Nonce tidak cocok: expected=${expectedNonce}, got=${embeddedNonce}`, 'SD_NONCE_MISMATCH');
        }
        checks.push({ name: 'nonce', passed: true, message: 'Nonce matches embedded SD-JWT nonce' });
    }
    const hasStatusField = typeof issuerPayload.credentialStatus === 'string'
        || typeof issuerPayload.credentialStatusId === 'string';
    const credentialWarnings = [];
    if (!issuerPayload.iss)
        credentialWarnings.push('issuer DID missing');
    if (!holderDID)
        credentialWarnings.push('holder DID missing');
    if (!issuerPayload.nbf && !issuerPayload.iat)
        credentialWarnings.push('issued-at timestamp missing');
    if (!issuerPayload.exp)
        credentialWarnings.push('expiration timestamp missing');
    if (!hasStatusField)
        credentialWarnings.push('credential status field missing');
    checks.push({ name: 'mandatory_fields', passed: true, message: 'Mandatory SD-JWT fields checked flexibly' });
    // ── STEP 9: Ekstrak disclosed claims dari disclosures ──
    const disclosedClaims = {};
    // Juga ambil top-level claims dari issuer payload (tidak di-_sd)
    const metaKeys = new Set(['iss', 'sub', 'iat', 'exp', 'nbf', 'jti', 'vct', 'cnf', '_sd', '_sd_alg', 'nonce']);
    for (const [key, val] of Object.entries(issuerPayload)) {
        if (!metaKeys.has(key))
            disclosedClaims[key] = val;
    }
    // Full SD-JWT disclosure verification: recompute digest and match against _sd entries.
    let parsedDisclosures;
    try {
        parsedDisclosures = disclosureTokens.map((token) => parseDisclosureToken(token));
    }
    catch (error) {
        if (error instanceof SdJwtDisclosureError) {
            throw new VPValidationError(error.message, error.step);
        }
        throw error;
    }
    const disclosureVerification = verifyDisclosures(issuerPayload, parsedDisclosures);
    if (!disclosureVerification.ok) {
        throw new VPValidationError('Hash disclosure SD-JWT tidak valid', 'DISCLOSURE_HASH_MISMATCH');
    }
    checks.push({ name: 'disclosure_integrity', passed: true, message: 'Disclosure digest verification passed' });
    Object.assign(disclosedClaims, disclosureVerification.claims);
    addCredentialWarnings(checks, disclosedClaims, credentialWarnings);
    const claims = {
        holderDID,
        issuerDID,
        holderName: (disclosedClaims.holderName ?? disclosedClaims.nama),
        noBPJS: disclosedClaims.noBPJS,
        nik: disclosedClaims.nik,
        tanggalLahir: (disclosedClaims.tanggalLahir ?? disclosedClaims.tanggal_lahir),
        statusKepesertaan: disclosedClaims.statusKepesertaan,
        issuedAt: issuerPayload.nbf,
        expiresAt: issuerPayload.exp,
        ...disclosedClaims,
    };
    const statusId = (claims.credentialStatusId ?? claims.credentialStatus);
    if (statusId) {
        const statusValue = await fetchCredentialStatusOnline(statusId, trustedIssuerRecord.endpoint);
        if (statusValue === 'REVOKED') {
            throw new VPValidationError('Credential telah direvoke', 'CREDENTIAL_STATUS_REVOKED');
        }
        if (statusValue === 'SUSPENDED') {
            throw new VPValidationError('Credential sedang disuspend', 'CREDENTIAL_STATUS_SUSPENDED');
        }
        if (statusValue === 'EXPIRED') {
            throw new VPValidationError('Credential status endpoint menyatakan expired', 'CREDENTIAL_STATUS_EXPIRED');
        }
        checks.push({ name: 'credential_status', passed: true, message: `Credential status is ${statusValue}` });
    }
    const requiredClaimSet = parseClaimKeysFromDefinition(presentationDefinition);
    const disclosurePolicy = enforceDisclosurePolicy(requiredClaimSet, disclosedClaims, verifierPolicy, 'sd-jwt');
    if (!disclosurePolicy.ok) {
        console.warn('CREDENTIAL_CHECK warnings:', {
            step: 'CREDENTIAL_CHECK',
            reason: 'missing_field / invalid_format',
            missing: disclosurePolicy.missing,
            extras: disclosurePolicy.extras,
            data: disclosedClaims,
        });
    }
    checks.push({
        name: 'claim_policy',
        passed: true,
        message: disclosurePolicy.ok
            ? 'Disclosure policy passed for SD-JWT'
            : `Disclosure policy warnings: missing=${disclosurePolicy.missing.join(',') || '-'} extras=${disclosurePolicy.extras.join(',') || '-'}`,
    });
    return { claims, outcome: buildOutcome(checks) };
}
//# sourceMappingURL=vpValidatorService.js.map