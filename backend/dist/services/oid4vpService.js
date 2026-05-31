/**
 * OID4VP Verification Service
 *
 * Handles verification sessions using Credo-TS OID4VP module.
 * Manages session lifecycle: create â†’ poll â†’ complete.
 * Saves results to PostgreSQL for audit/history.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { config } from '../config/index.js';
import { getVerifierRecord, getVerifierDidUrl, getVerifierApi, BPJS_PRESENTATION_DEFINITION, OpenId4VcVerificationSessionState, } from '../credo-verifier.js';
// Removed VerifiedAuthorizationResponseByState as it is no longer used
const hostedAuthorizationRequestJwtByRequestId = new Map();
function createVerifierPrivateKey() {
    return crypto.createPrivateKey({
        key: Buffer.from(config.did.privateKeyHex, 'hex'),
        format: 'der',
        type: 'pkcs8',
    });
}
function decodeJwtPayload(token) {
    const payloadB64 = token.trim().split('.')[1];
    if (!payloadB64) {
        throw new Error('JWT payload is missing');
    }
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
}
function decodeJwtComplete(token) {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
        throw new Error('JWT cannot be decoded');
    }
    return decoded;
}
function extractAuthorizationRequestId(requestUri) {
    const match = /\/authorization-requests\/([^/?#]+)/.exec(requestUri);
    return match?.[1] ?? null;
}
function patchAuthorizationRequestJwt(originalJwt, expectedClientId, didUrl) {
    const { header, payload } = decodeJwtComplete(originalJwt);
    const patchedPayload = {
        ...payload,
        iss: expectedClientId,
        client_id: expectedClientId,
    };
    const patchedHeader = {
        ...header,
        alg: 'EdDSA',
        typ: 'JWT',
        kid: didUrl,
    };
    const headerB64 = Buffer.from(JSON.stringify(patchedHeader)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(patchedPayload)).toString('base64url');
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = crypto.sign(null, Buffer.from(signingInput), createVerifierPrivateKey()).toString('base64url');
    return `${signingInput}.${signature}`;
}
function normalizePresentationSubmission(value) {
    if (typeof value !== 'string')
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
}
function getFirstProof(vp) {
    const proof = vp?.proof;
    if (Array.isArray(proof)) {
        const first = proof[0];
        return first && typeof first === 'object' ? first : null;
    }
    return proof && typeof proof === 'object' ? proof : null;
}
function buildVpDebugSummary(vpToken, presentationSubmission) {
    if (vpToken.includes('~')) {
        const parts = vpToken.split('~').filter(Boolean);
        const issuerJwt = parts[0];
        const kbJwt = parts.find((part, index) => index > 0 && part.includes('.')) ?? null;
        const issuer = decodeJwtComplete(issuerJwt);
        const kb = kbJwt ? decodeJwtComplete(kbJwt) : null;
        return {
            format: 'vc+sd-jwt',
            rawVpToken: vpToken,
            presentationSubmission: normalizePresentationSubmission(presentationSubmission),
            issuerJwt: issuer,
            kbJwt: kb,
            holderDid: kb?.payload.iss ?? issuer.payload.sub ?? null,
            issuerDid: issuer.payload.iss ?? null,
            challenge: kb?.payload.nonce ?? issuer.payload.nonce ?? null,
            domain: kb?.payload.aud ?? issuer.payload.aud ?? null,
        };
    }
    const decoded = decodeJwtComplete(vpToken);
    const vp = decoded.payload.vp && typeof decoded.payload.vp === 'object'
        ? decoded.payload.vp
        : undefined;
    const proof = getFirstProof(vp);
    return {
        format: 'jwt_vp',
        rawVpToken: vpToken,
        presentationSubmission: normalizePresentationSubmission(presentationSubmission),
        header: decoded.header,
        payload: decoded.payload,
        holderDid: decoded.payload.iss ?? null,
        challenge: proof?.challenge ?? decoded.payload.nonce ?? null,
        domain: proof?.domain ?? decoded.payload.aud ?? null,
        proof,
    };
}
function normalizeDomain(didOrDomain) {
    if (!didOrDomain)
        return '';
    const noScheme = didOrDomain.replace(/^https?:\/\//i, '');
    const noDidPrefix = noScheme.startsWith('did:web:') ? noScheme.slice('did:web:'.length) : noScheme;
    return noDidPrefix.split('/')[0].trim().toLowerCase();
}
function extractCredentialField(vcPayload, fieldName) {
    const nested = vcPayload.vc?.credentialSubject;
    const direct = vcPayload.credentialSubject;
    return nested?.[fieldName] ?? direct?.[fieldName] ?? null;
}
function extractClaimsFromJwtVpToken(vpToken) {
    try {
        const vpPayload = decodeJwtPayload(vpToken);
        const vp = vpPayload.vp;
        const vcToken = vp?.verifiableCredential?.[0];
        if (typeof vcToken !== 'string')
            return {};
        const vcPayload = decodeJwtPayload(vcToken);
        const fieldNames = ['holderName', 'noBPJS', 'nik', 'tanggalLahir', 'tanggal_lahir'];
        const claims = {};
        for (const fieldName of fieldNames) {
            const value = extractCredentialField(vcPayload, fieldName);
            if (value !== null && value !== undefined && value !== '') {
                claims[fieldName] = value;
            }
        }
        return claims;
    }
    catch (error) {
        console.warn('⚠️ Failed to extract jwt_vc_json claims:', error.message);
        return {};
    }
}
function logVpDebug(vpToken) {
    if (process.env.NODE_ENV === 'production')
        return;
    try {
        const vpPayload = decodeJwtPayload(vpToken);
        const vcToken = vpPayload.vp?.verifiableCredential?.[0];
        if (typeof vcToken !== 'string')
            return;
        const vcPayload = decodeJwtPayload(vcToken);
        const credentialSubject = vcPayload.vc?.credentialSubject
            ?? vcPayload.credentialSubject
            ?? null;
        const vcType = vcPayload.vc?.type
            ?? vcPayload.type
            ?? null;
        console.log('🔍 [VP DEBUG] VC credentialSubject:', JSON.stringify(credentialSubject, null, 2));
        console.log('🔍 [VP DEBUG] aud:', vpPayload.aud);
        console.log('🔍 [VP DEBUG] VC type:', vcType);
    }
    catch (error) {
        console.error('❌ [VP DEBUG] Failed to decode for logging:', error);
    }
}
// â”€â”€â”€ Service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const oid4vpService = {
    /**
     * Start a new OID4VP verification session.
     * Creates an authorization request via Credo-TS and saves session to DB.
     */
    async startVerification() {
        const verifierApi = getVerifierApi();
        const verifier = getVerifierRecord();
        const didUrl = getVerifierDidUrl();
        // Ensure the verifier record referenced by this process still exists in Credo storage.
        await verifierApi.getVerifierByVerifierId(verifier.verifierId);
        // Create authorization request via Credo-TS
        const { authorizationRequest, verificationSession } = await verifierApi.createAuthorizationRequest({
            verifierId: verifier.verifierId,
            requestSigner: {
                method: 'did',
                didUrl: didUrl,
            },
            presentationExchange: {
                definition: BPJS_PRESENTATION_DEFINITION,
            },
            responseMode: 'direct_post',
            version: 'v1.draft24',
        });
        const expiresAt = new Date(Date.now() + config.oid4vp.sessionTimeoutMinutes * 60 * 1000);
        const nonceExpiresAt = new Date(Date.now() + config.oid4vp.nonceTtlSeconds * 1000);
        // â”€â”€ Extract the REAL nonce from Credo's signed Request Object JWT â”€â”€
        // Credo embeds a nonce into the Authorization Request JWT it signs.
        // We must store THAT nonce, not a random one, so our manual /callback
        // fallback can validate it correctly (anti-replay, OID4VP Â§5.2).
        let nonce = null;
        let state = null;
        let responseUri = null;
        let hasPresentationDefinition = false;
        // Parse openid4vp:// deep link to get client_id and request_uri
        const qrParams = new URLSearchParams(authorizationRequest.replace(/^openid4vp:\/\/\?/, ''));
        const clientId = qrParams.get('client_id');
        const requestUriFromAuthRequest = qrParams.get('request_uri');
        const expectedClientId = config.oid4vp.verifierClientId;
        if (!clientId) {
            throw new Error('Authorization Request is missing client_id');
        }
        console.log(`  client_id in authRequest: ${clientId}`);
        console.log(`  Expected client_id: ${expectedClientId}`);
        if (clientId !== expectedClientId) {
            console.warn(`  client_id mismatch! Request=${clientId}, Expected=${expectedClientId}`);
        }
        if (!requestUriFromAuthRequest) {
            throw new Error('Authorization Request is missing request_uri');
        }
        try {
            const requestUri = requestUriFromAuthRequest;
            const requestId = extractAuthorizationRequestId(requestUri);
            const localUri = requestUri.replace(config.oid4vp.verifierBaseUrl, `http://localhost:${config.port}`);
            const jwtRes = await fetch(localUri, {
                headers: { Accept: 'application/oauth-authz-req+jwt, application/jwt, */*' },
            });
            if (!jwtRes.ok) {
                throw new Error(`Request Object fetch failed with status ${jwtRes.status}`);
            }
            const reqJwt = await jwtRes.text();
            const originalPayload = decodeJwtPayload(reqJwt);
            const shouldPatchIssuer = typeof originalPayload.iss !== 'string' || originalPayload.iss !== expectedClientId;
            const effectiveJwt = shouldPatchIssuer
                ? patchAuthorizationRequestJwt(reqJwt, expectedClientId, didUrl)
                : reqJwt;
            const payload = decodeJwtPayload(effectiveJwt);
            if (requestId) {
                hostedAuthorizationRequestJwtByRequestId.set(requestId, effectiveJwt);
            }
            console.log('  Authorization Request JWT payload fields:');
            console.log('     iss:', payload.iss);
            console.log('     aud:', payload.aud);
            console.log('     client_id:', payload.client_id);
            console.log('     nonce:', payload.nonce);
            console.log('     state:', payload.state);
            console.log('     response_uri:', payload.response_uri);
            console.log('     response_mode:', payload.response_mode);
            if (shouldPatchIssuer) {
                console.log(`  Patched Authorization Request JWT issuer to match client_id: ${expectedClientId}`);
            }
            if (typeof payload.nonce === 'string') {
                nonce = payload.nonce;
            }
            if (typeof payload.state === 'string') {
                state = payload.state;
            }
            if (typeof payload.response_uri === 'string') {
                responseUri = payload.response_uri;
            }
            hasPresentationDefinition =
                typeof payload.presentation_definition === 'object' && payload.presentation_definition !== null;
        }
        catch (err) {
            throw new Error(`Could not extract nonce from Request Object: ${err.message}`);
        }
        if (!nonce) {
            throw new Error('Authorization Request JWT does not include nonce');
        }
        if (!state) {
            throw new Error('Authorization Request JWT does not include state');
        }
        if (!responseUri) {
            throw new Error('Authorization Request JWT does not include response_uri');
        }
        if (!hasPresentationDefinition) {
            throw new Error('Authorization Request JWT does not include presentation_definition');
        }
        // Save session to PostgreSQL for audit/tracking
        await query(`INSERT INTO verification_sessions (id, status, requested_at, expires_at, nonce, nonce_expires_at, state, qr_url)
       VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7)`, [verificationSession.id, 'PENDING', expiresAt, nonce, nonceExpiresAt, state, authorizationRequest]);
        console.log('ðŸ“‹ OID4VP session created:', verificationSession.id);
        console.log('  ðŸ”‘ Nonce:', nonce);
        console.log('  ðŸ”‘ State:', state);
        console.log('  ðŸ”— Authorization Request URL:', authorizationRequest);
        return {
            verificationId: verificationSession.id,
            requestUri: requestUriFromAuthRequest,
            deepLink: `openid-vc://?request_uri=${encodeURIComponent(requestUriFromAuthRequest)}`,
            qrUrl: authorizationRequest,
            sessionId: verificationSession.id,
            expiresAt,
            nonce,
            state,
        };
    },
    // verifyAuthorizationResponseByState removed, handled internally by Credo-TS
    /**
     * Get the current result of a verification session.
     * Checks Credo-TS session state and syncs with DB.
     */
    async getVerificationResult(sessionId) {
        const verifierApi = getVerifierApi();
        // Check if session exists in our DB first
        const dbResult = await query('SELECT id, status, completed_at, holder_did, disclosed_claims, error, reason_codes, verification_details FROM verification_sessions WHERE id = $1', [sessionId]);
        if (dbResult.rows.length === 0) {
            throw new Error('Verification session not found');
        }
        const dbSession = dbResult.rows[0];
        // If already completed in DB, return cached result
        if (dbSession.status === 'SUCCESS' || dbSession.status === 'FAILED') {
            return {
                status: dbSession.status,
                claims: dbSession.disclosed_claims || null,
                holderDid: dbSession.holder_did || null,
                error: dbSession.error || null,
                reasonCodes: dbSession.reason_codes || [],
                verificationDetails: dbSession.verification_details || null,
                completedAt: dbSession.completed_at || null,
            };
        }
        // Check expiry
        const expiresResult = await query('SELECT expires_at FROM verification_sessions WHERE id = $1', [sessionId]);
        if (expiresResult.rows.length > 0) {
            const expiresAt = new Date(expiresResult.rows[0].expires_at);
            if (expiresAt < new Date()) {
                await query('UPDATE verification_sessions SET status = $1 WHERE id = $2', ['EXPIRED', sessionId]);
                return {
                    status: 'EXPIRED',
                    claims: null,
                    holderDid: null,
                    error: 'Session expired',
                    reasonCodes: ['session_expired'],
                    verificationDetails: null,
                    completedAt: null,
                };
            }
        }
        // Check Credo session state
        try {
            const credoSession = await verifierApi.getVerificationSessionById(sessionId);
            if (credoSession.state === OpenId4VcVerificationSessionState.ResponseVerified) {
                // Get verified response with extracted claims
                const verified = await verifierApi.getVerifiedAuthorizationResponse(sessionId);
                // Extract disclosed claims from the presentation
                let disclosedClaims = {};
                let holderDid = null;
                if (verified.presentationExchange) {
                    const presentations = verified.presentationExchange.presentations;
                    if (presentations && presentations.length > 0) {
                        const presentation = presentations[0];
                        // For SD-JWT VC, the presentation is a compact SD-JWT string
                        // We need to extract the disclosed claims
                        if (typeof presentation === 'string') {
                            // SD-JWT format: header.payload.signature~disclosure1~disclosure2~...~kb-jwt
                            disclosedClaims = parseSdJwtClaims(presentation);
                        }
                        else if (typeof presentation === 'object' && presentation !== null) {
                            // JSON-LD VP format
                            const vp = presentation;
                            const vc = vp.verifiableCredential?.[0];
                            if (vc?.credentialSubject) {
                                disclosedClaims = vc.credentialSubject;
                                holderDid = vc.credentialSubject?.id || null;
                            }
                            else if (typeof vp === 'object') {
                                // Try to extract from the presentation directly
                                disclosedClaims = extractClaimsFromPresentation(vp);
                            }
                        }
                    }
                }
                // Update DB with success
                await query(`UPDATE verification_sessions 
           SET status = 'SUCCESS', completed_at = NOW(), holder_did = $1, disclosed_claims = $2
           WHERE id = $3`, [holderDid, JSON.stringify(disclosedClaims), sessionId]);
                // Also save to verification_logs for history compatibility
                await this.saveToVerificationLog(sessionId, disclosedClaims);
                return {
                    status: 'SUCCESS',
                    claims: disclosedClaims,
                    holderDid,
                    error: null,
                    reasonCodes: [],
                    verificationDetails: null,
                    completedAt: new Date(),
                };
            }
            if (credoSession.state === OpenId4VcVerificationSessionState.Error) {
                const errorMsg = credoSession.errorMessage || 'Verification failed';
                await query(`UPDATE verification_sessions SET status = 'FAILED', completed_at = NOW(), error = $1 WHERE id = $2`, [errorMsg, sessionId]);
                return {
                    status: 'FAILED',
                    claims: null,
                    holderDid: null,
                    error: errorMsg,
                    reasonCodes: ['unknown_error'],
                    verificationDetails: null,
                    completedAt: new Date(),
                };
            }
            // Still pending (RequestCreated or RequestUriRetrieved)
            return {
                status: 'PENDING',
                claims: null,
                holderDid: null,
                error: null,
                reasonCodes: [],
                verificationDetails: null,
                completedAt: null,
            };
        }
        catch (err) {
            console.error('Error checking Credo session:', err);
            return {
                status: 'PENDING',
                claims: null,
                holderDid: null,
                error: null,
                reasonCodes: [],
                verificationDetails: null,
                completedAt: null,
            };
        }
    },
    /**
     * Get all verification sessions (for admin view).
     */
    async getSessions(page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        const countResult = await query('SELECT COUNT(*) FROM verification_sessions');
        const total = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(total / limit);
        const dataResult = await query(`SELECT id, status, requested_at, completed_at, holder_did, disclosed_claims, raw_vp_token, error, expires_at, nonce, nonce_expires_at, state, used_at, reason_codes, verification_details, qr_url
       FROM verification_sessions
       ORDER BY requested_at DESC
       LIMIT $1 OFFSET $2`, [limit, offset]);
        const sessions = dataResult.rows.map((row) => ({
            id: row.id,
            status: row.status,
            requestedAt: row.requested_at,
            completedAt: row.completed_at,
            holderDid: row.holder_did,
            disclosedClaims: row.disclosed_claims,
            rawVpToken: row.raw_vp_token,
            error: row.error,
            expiresAt: row.expires_at,
            nonce: row.nonce ?? null,
            nonceExpiresAt: row.nonce_expires_at ?? null,
            state: row.state ?? null,
            usedAt: row.used_at ?? null,
            reasonCodes: row.reason_codes ?? [],
            verificationDetails: row.verification_details ?? null,
            qrUrl: row.qr_url ?? null,
        }));
        return { sessions, total, page, totalPages };
    },
    /**
     * Save verification result to the legacy verification_logs table.
     */
    async saveToVerificationLog(sessionId, claims) {
        try {
            const logId = uuidv4();
            const nama = claims.holderName || claims.nama || 'Unknown';
            const requestId = `OID4VP-${sessionId.substring(0, 8)}`;
            await query(`INSERT INTO verification_logs (id, request_id, waktu, nama_pasien, tujuan_poli, status, verifier_id)
         VALUES ($1, $2, NOW(), $3, $4, $5, $6)`, [logId, requestId, nama, 'OID4VP Verification', 'success', 'oid4vp-credo']);
        }
        catch (err) {
            console.warn('âš ï¸ Failed to save to verification_logs:', err);
        }
    },
    // â”€â”€â”€ Helpers sesuai OID4VP-Verifier-Flow.md â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    /**
     * Cari sesi berdasarkan state token (untuk request_uri pattern & callback).
     */
    async getSessionByState(state) {
        const result = await query('SELECT id, nonce, nonce_expires_at, status, expires_at, used_at, qr_url, state FROM verification_sessions WHERE state = $1', [state]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            id: row.id,
            nonce: row.nonce ?? null,
            nonceExpiresAt: row.nonce_expires_at ? new Date(row.nonce_expires_at) : null,
            status: row.status,
            expiresAt: new Date(row.expires_at),
            usedAt: row.used_at ? new Date(row.used_at) : null,
            qrUrl: row.qr_url ?? null,
            state: row.state,
        };
    },
    /**
     * Poll status verifikasi berdasarkan state (alternatif dari /result/:sessionId).
     * Sesuai Step 5 MD: GET /api/verify/status/:state
     */
    async getVerificationStatusByState(state) {
        const result = await query('SELECT id FROM verification_sessions WHERE state = $1', [state]);
        if (result.rows.length === 0)
            throw new Error('Verification session not found');
        return this.getVerificationResult(result.rows[0].id);
    },
    getHostedAuthorizationRequestJwt(requestId) {
        return hostedAuthorizationRequestJwtByRequestId.get(requestId) ?? null;
    },
    async inspectIncomingAuthorizationResponse(payload) {
        const issues = [];
        if (!payload || typeof payload !== 'object') {
            return { ok: false, issues: ['authorization_response_payload_missing'], summary: null };
        }
        const body = payload;
        const vpToken = typeof body.vp_token === 'string' ? body.vp_token : null;
        const state = typeof body.state === 'string' ? body.state : null;
        const presentationSubmission = body.presentation_submission;
        if (!vpToken) {
            return { ok: false, issues: ['vp_token_missing'], summary: null };
        }
        logVpDebug(vpToken);
        if (!state) {
            return { ok: false, issues: ['state_missing'], summary: buildVpDebugSummary(vpToken, presentationSubmission) };
        }
        const session = await this.getSessionByState(state);
        if (!session) {
            return { ok: false, issues: ['state_unknown'], summary: buildVpDebugSummary(vpToken, presentationSubmission) };
        }
        const summary = buildVpDebugSummary(vpToken, presentationSubmission);
        const challenge = typeof summary.challenge === 'string' ? summary.challenge : null;
        const domain = typeof summary.domain === 'string' ? summary.domain : null;
        const expectedDomain = config.oid4vp.verifierClientId;
        const expectedAudience = config.did.verifierId;
        if (session.nonce && challenge && challenge !== session.nonce) {
            issues.push('nonce_mismatch');
        }
        if (!challenge) {
            issues.push('nonce_missing_in_vp_proof');
        }
        if (domain) {
            const normalizedDomain = normalizeDomain(domain);
            const acceptedDomain = normalizedDomain === normalizeDomain(expectedDomain)
                || normalizedDomain === normalizeDomain(expectedAudience);
            if (!acceptedDomain)
                issues.push('domain_mismatch');
        }
        else {
            issues.push('domain_missing_in_vp_proof');
        }
        const issuerJwtObj = summary.issuerJwt && typeof summary.issuerJwt === 'object'
            ? summary.issuerJwt
            : null;
        const issuerPayload = issuerJwtObj?.payload && typeof issuerJwtObj.payload === 'object'
            ? issuerJwtObj.payload
            : null;
        const credentialType = typeof summary.format === 'string' && summary.format === 'vc+sd-jwt'
            ? issuerPayload?.vct
            : null;
        if (credentialType && credentialType !== 'BPJSHealthCredential') {
            issues.push('credential_type_mismatch');
        }
        const disclosedClaims = vpToken.includes('~')
            ? parseSdJwtClaims(vpToken)
            : extractClaimsFromJwtVpToken(vpToken);
        const requiredFields = ['holderName', 'noBPJS', 'nik', 'tanggalLahir'];
        for (const key of requiredFields) {
            if (!(key in disclosedClaims) && !(key === 'tanggalLahir' && 'tanggal_lahir' in disclosedClaims)) {
                issues.push(`required_field_missing:${key}`);
            }
        }
        return {
            ok: issues.length === 0,
            issues,
            summary,
            expected: { nonce: session.nonce, domain: expectedDomain },
        };
    },
    /**
     * Tandai sesi sebagai SUCCESS setelah VP Token divalidasi manual.
     */
    async markSuccess(sessionId, claims, holderDid, rawVpToken, verificationDetails) {
        const vpTokenHash = rawVpToken
            ? crypto.createHash('sha256').update(rawVpToken).digest('hex')
            : null;
        await query(`UPDATE verification_sessions
        SET status = 'SUCCESS', completed_at = NOW(), used_at = NOW(), nonce = NULL, holder_did = $1, disclosed_claims = $2, raw_vp_token = $3, verification_details = $4, reason_codes = '[]'::jsonb
       WHERE id = $5`, [holderDid, JSON.stringify(claims), vpTokenHash, verificationDetails ? JSON.stringify(verificationDetails) : null, sessionId]);
        await this.saveToVerificationLog(sessionId, claims);
    },
    /**
     * Tandai sesi sebagai FAILED.
     */
    async markFailed(sessionId, errorMsg, reasonCodes = ['unknown_error']) {
        await query(`UPDATE verification_sessions SET status = 'FAILED', completed_at = NOW(), used_at = NOW(), error = $1, reason_codes = $2::jsonb WHERE id = $3`, [errorMsg, JSON.stringify(reasonCodes), sessionId]);
    },
    /**
     * Tandai sesi sebagai EXPIRED.
     */
    async markExpired(sessionId) {
        await query(`UPDATE verification_sessions SET status = 'EXPIRED', completed_at = NOW(), used_at = NOW(), nonce = NULL, reason_codes = '["session_expired"]'::jsonb WHERE id = $1`, [sessionId]);
    },
};
// â”€â”€â”€ Helper Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Parse claims from an SD-JWT VP Token string.
 * SD-JWT format: header.payload.signature~disclosure1~disclosure2~...~kb-jwt
 */
function parseSdJwtClaims(sdJwt) {
    try {
        const parts = sdJwt.split('~');
        // The first part is the main JWT (header.payload.signature)
        const jwtParts = parts[0].split('.');
        if (jwtParts.length < 2)
            return {};
        // Decode the JWT payload
        const payloadBase64 = jwtParts[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        // Extract non-metadata claims
        const claims = {};
        const metadataKeys = new Set([
            'iss', 'sub', 'iat', 'exp', 'nbf', 'jti', 'vct',
            'cnf', '_sd', '_sd_alg', 'status',
        ]);
        for (const [key, value] of Object.entries(payload)) {
            if (!metadataKeys.has(key)) {
                claims[key] = value;
            }
        }
        // Parse selective disclosures
        // Each disclosure is base64url-encoded: [salt, key, value]
        for (let i = 1; i < parts.length; i++) {
            const disclosure = parts[i];
            if (!disclosure || disclosure.includes('.'))
                continue; // Skip KB-JWT
            try {
                const decoded = Buffer.from(disclosure, 'base64url').toString('utf-8');
                const parsed = JSON.parse(decoded);
                if (Array.isArray(parsed) && parsed.length === 3) {
                    const [_salt, key, value] = parsed;
                    claims[key] = value;
                }
            }
            catch {
                // Skip invalid disclosures
            }
        }
        return claims;
    }
    catch (err) {
        console.error('Error parsing SD-JWT claims:', err);
        return {};
    }
}
/**
 * Extract claims from a generic presentation object.
 */
function extractClaimsFromPresentation(presentation) {
    // Try common paths for credential subject
    const vc = presentation.verifiableCredential?.[0];
    if (vc?.credentialSubject) {
        return vc.credentialSubject;
    }
    // For compact presentations
    if (presentation.credentialSubject) {
        return presentation.credentialSubject;
    }
    // Return the whole object as fallback
    const claims = {};
    for (const [key, value] of Object.entries(presentation)) {
        if (!['@context', 'type', 'proof', 'id'].includes(key)) {
            claims[key] = value;
        }
    }
    return claims;
}
function mapCredoErrorToReasonCode(message) {
    const m = message.toLowerCase();
    if (m.includes('nonce') || m.includes('missing nonce'))
        return 'missing_nonce';
    if (m.includes('jti'))
        return 'jti_mismatch';
    if (m.includes('credential') || m.includes('presentation_submission') || m.includes('descriptor'))
        return 'invalid_credential';
    if (m.includes('invalid_state'))
        return 'invalid_state';
    if (m.includes('session_expired'))
        return 'session_expired';
    if (m.includes('session_already_used'))
        return 'session_already_used';
    return 'cryptographic_verification_failed';
}
//# sourceMappingURL=oid4vpService.js.map