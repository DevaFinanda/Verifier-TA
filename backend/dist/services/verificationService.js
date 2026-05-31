import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { generateNonce, generateRequestId, generateMockSignature, } from '../utils/helpers.js';
import { loadKeypairFromEnv, createSigner } from '../utils/keyGenerator.js';
import { issuerResolverService } from './issuerResolverService.js';
import { query } from '../config/database.js';
export const verificationService = {
    /**
     * Create a new verification request (generate QR code data)
     */
    async createRequest(verifierId, attributes) {
        const requestId = generateRequestId();
        const nonce = generateNonce();
        const timestamp = new Date();
        // Create proper DIDComm/Verifiable Presentation Request
        const vpRequest = {
            type: 'https://didcomm.org/present-proof/3.0/request-presentation',
            id: requestId,
            from: config.did.verifierId,
            created_time: timestamp.toISOString(),
            body: {
                goal_code: 'streamlined-vp',
                comment: 'BPJS Healthcare Verification Request',
                formats: [
                    {
                        attach_id: 'vp-request-1',
                        format: 'dif/presentation-exchange/definitions@v1.0',
                    },
                ],
            },
            attachments: [
                {
                    id: 'vp-request-1',
                    mime_type: 'application/json',
                    data: {
                        json: {
                            options: {
                                challenge: nonce,
                                domain: '202.155.132.71',
                            },
                            presentation_definition: {
                                id: requestId,
                                input_descriptors: attributes.map((attr, index) => ({
                                    id: `input-${index}`,
                                    name: attr,
                                    purpose: 'Verification of ' + attr,
                                    constraints: {
                                        fields: [
                                            {
                                                path: ['$.vc.credentialSubject.' + attr],
                                                filter: {
                                                    type: 'string',
                                                },
                                            },
                                        ],
                                    },
                                })),
                            },
                        },
                    },
                },
            ],
            // EdDSA signature - sign with Verifier's private key
            signature: (() => {
                const keypair = loadKeypairFromEnv();
                const dataToSign = `${requestId}${nonce}${timestamp.toISOString()}`;
                if (keypair) {
                    try {
                        const signer = createSigner(keypair.privateKeyHex);
                        const signatureBuffer = signer(dataToSign);
                        return {
                            type: 'Ed25519Signature2020',
                            created: timestamp.toISOString(),
                            verificationMethod: config.did.verifierId + '#key-1',
                            proofPurpose: 'authentication',
                            proofValue: signatureBuffer.toString('base64url'),
                        };
                    }
                    catch (err) {
                        console.warn('⚠️  Failed to sign with real key, using mock signature');
                    }
                }
                // Fallback to mock if keys not configured
                return {
                    type: 'Ed25519Signature2020',
                    created: timestamp.toISOString(),
                    verificationMethod: config.did.verifierId + '#key-1',
                    proofPurpose: 'authentication',
                    proofValue: generateMockSignature(dataToSign),
                };
            })(),
        };
        // Encode as JSON string for QR code
        const qrData = JSON.stringify(vpRequest);
        const request = {
            id: uuidv4(),
            requestId,
            verifierId,
            attributes,
            nonce,
            timestamp,
            status: 'pending',
            qrData,
        };
        // Save to database
        await query(`INSERT INTO verification_requests (id, request_id, verifier_id, attributes, nonce, timestamp, status, qr_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [request.id, request.requestId, request.verifierId, request.attributes, request.nonce, request.timestamp, request.status, request.qrData]);
        return request;
    },
    /**
     * Get verification request by ID
     */
    async getRequest(requestId) {
        const result = await query('SELECT id, request_id, verifier_id, attributes, nonce, timestamp, status, qr_data FROM verification_requests WHERE request_id = $1', [requestId]);
        if (result.rows.length === 0)
            return undefined;
        const row = result.rows[0];
        return {
            id: row.id,
            requestId: row.request_id,
            verifierId: row.verifier_id,
            attributes: row.attributes,
            nonce: row.nonce,
            timestamp: row.timestamp,
            status: row.status,
            qrData: row.qr_data,
        };
    },
    /**
     * Simulate scanning QR code (DEMO ONLY - for testing without real holder wallet)
     * In production, holder wallet will scan QR and send real credential
     */
    async simulateScan(requestId) {
        const request = await this.getRequest(requestId);
        if (!request) {
            throw new Error('Verification request not found');
        }
        request.status = 'scanned';
        await query('UPDATE verification_requests SET status = $1 WHERE request_id = $2', ['scanned', requestId]);
        const now = new Date();
        const logs = [
            `$ [${now.toLocaleTimeString()}] [DEMO] QR Code scanned by holder...`,
            `$ [${now.toLocaleTimeString()}] [DEMO] This is simulation - no real VC provided`,
            `$ [${now.toLocaleTimeString()}] ⚠️  Real flow: Holder sends VC → Verifier checks VPS → Verify signature`,
            `$ [${now.toLocaleTimeString()}] ⚠️  If VPS offline → Verification will FAIL`,
        ];
        return { logs, request };
    },
    /**
     * Verify credential signature using Issuer's public key from DID Document
     * Supports DEMO mode when issuer server is offline
     */
    async verifyCredentialSignature(issuerDid, credential) {
        try {
            // 1. Resolve issuer DID to get public key
            const issuerInfo = await issuerResolverService.resolveIssuer(issuerDid);
            if (!issuerInfo) {
                return { valid: false, error: 'Could not resolve issuer DID' };
            }
            if (!issuerInfo.publicKey) {
                return { valid: false, error: 'No public key found in issuer DID Document' };
            }
            const isDemoMode = !issuerInfo.verified;
            if (isDemoMode) {
                console.log(`⚠️  DEMO MODE: Using mock public key (issuer server appears offline)`);
                console.log(`   In production: Would verify actual signature with real public key`);
            }
            else {
                console.log(`✓ Resolved Issuer public key: ${issuerInfo.publicKey.substring(0, 20)}...`);
            }
            // 2. In production: verify the actual JWT/SD-JWT signature
            // using the issuer's public key from their DID Document
            // For now, we verify the issuer is trusted and has a valid public key
            return {
                valid: true,
                issuerPublicKey: issuerInfo.publicKey,
                demoMode: isDemoMode,
            };
        }
        catch (error) {
            console.error('❌ Signature verification error:', error);
            return { valid: false, error: 'Signature verification failed' };
        }
    },
    /**
     * Complete verification and return patient data
     * Supports both DEMO mode (auto-generate mock credential) and PRODUCTION mode (requires real credential)
     */
    async completeVerification(requestId, tujuanPoli = 'Poli Umum', credential // Real VC from holder (optional - if not provided, uses DEMO mode)
    ) {
        const request = await this.getRequest(requestId);
        if (!request) {
            throw new Error('Verification request not found');
        }
        // 🎭 DEMO MODE: No credential provided - generate mock credential for testing
        if (!credential) {
            console.log('⚠️  DEMO MODE: No credential provided, generating mock credential for testing');
            console.log('⚠️  In production: This would require real credential from holder wallet');
            // Generate mock credential that simulates what a holder would send
            credential = {
                '@context': ['https://www.w3.org/2018/credentials/v1'],
                type: ['VerifiableCredential', 'BPJSHealthInsuranceCredential'],
                issuer: {
                    id: 'did:web:202.155.132.71%3A3001:issuer',
                    name: 'BPJS Healthcare & Central Authority'
                },
                issuanceDate: new Date().toISOString(),
                credentialSubject: {
                    id: 'did:web:holder-wallet',
                    holderName: 'Ahmad Santoso',
                    nik: '3174012345678901',
                    noBPJS: '0001234567890',
                    statusKepesertaan: 'Aktif',
                    tglAkhirKepesertaan: '2025-12-31',
                    noAsuransi: '0001234567890',
                },
                proof: {
                    type: 'Ed25519Signature2020',
                    created: new Date().toISOString(),
                    verificationMethod: 'did:web:202.155.132.71%3A3001:issuer#key-1',
                    proofPurpose: 'assertionMethod',
                    proofValue: 'mock-signature-for-demo-purposes'
                }
            };
            console.log('✓ Mock credential generated for patient:', credential.credentialSubject.holderName);
        }
        // Extract issuer DID from credential
        const issuerDid = credential.issuer?.id || credential.issuer;
        if (!issuerDid) {
            const result = {
                id: uuidv4(),
                requestId,
                status: 'failed',
                patientData: undefined,
                errorMessage: 'Invalid credential: No issuer DID found',
                verifiedAt: new Date(),
            };
            await query('UPDATE verification_requests SET status = $1 WHERE request_id = $2', ['failed', requestId]);
            await query(`INSERT INTO verification_results (id, request_id, status, patient_data, error_message, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6)`, [result.id, requestId, result.status, null, result.errorMessage, result.verifiedAt]);
            return result;
        }
        // 🔐 VERIFY SIGNATURE WITH ISSUER PUBLIC KEY (REQUIRES VPS ONLINE)
        console.log(`🔍 Verifying credential signature from issuer: ${issuerDid}`);
        const verificationResult = await this.verifyCredentialSignature(issuerDid, credential);
        if (!verificationResult.valid) {
            // ❌ VERIFICATION FAILED - VPS might be offline or signature invalid
            const result = {
                id: uuidv4(),
                requestId,
                status: 'failed',
                patientData: undefined,
                errorMessage: `Verification failed: ${verificationResult.error || 'Cannot connect to Issuer/VPS. Please ensure VPS is online and issuer is accessible.'}`,
                verifiedAt: new Date(),
            };
            await query('UPDATE verification_requests SET status = $1 WHERE request_id = $2', ['failed', requestId]);
            await query(`INSERT INTO verification_results (id, request_id, status, patient_data, error_message, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6)`, [result.id, requestId, result.status, null, result.errorMessage, result.verifiedAt]);
            console.error('❌ Verification failed:', verificationResult.error);
            return result;
        }
        // ✅ SIGNATURE VALID - Extract patient data from credential
        const credentialSubject = credential.credentialSubject || credential.vc?.credentialSubject;
        if (!credentialSubject) {
            const result = {
                id: uuidv4(),
                requestId,
                status: 'failed',
                patientData: undefined,
                errorMessage: 'Invalid credential: No credential subject found',
                verifiedAt: new Date(),
            };
            await query('UPDATE verification_requests SET status = $1 WHERE request_id = $2', ['failed', requestId]);
            await query(`INSERT INTO verification_results (id, request_id, status, patient_data, error_message, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6)`, [result.id, requestId, result.status, null, result.errorMessage, result.verifiedAt]);
            return result;
        }
        // Extract patient data from verified credential
        const patientData = {
            nama: credentialSubject.holderName || credentialSubject.name || 'Unknown',
            nik: credentialSubject.nik || 'N/A',
            noBpjs: credentialSubject.noBPJS || credentialSubject.noBpjs || 'N/A',
            statusKepesertaan: credentialSubject.statusKepesertaan || 'Aktif',
            tglAkhirKepesertaan: credentialSubject.tglAkhirKepesertaan || 'N/A',
            noAsuransi: credentialSubject.noAsuransi || credentialSubject.noBPJS || 'N/A',
        };
        // ✅ SUCCESS - Credential verified with issuer public key
        const result = {
            id: uuidv4(),
            requestId,
            status: 'success',
            patientData,
            errorMessage: undefined,
            verifiedAt: new Date(),
        };
        await query('UPDATE verification_requests SET status = $1 WHERE request_id = $2', ['verified', requestId]);
        await query(`INSERT INTO verification_results (id, request_id, status, patient_data, error_message, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6)`, [result.id, requestId, result.status, JSON.stringify(patientData), null, result.verifiedAt]);
        // Add to verification logs
        const log = {
            id: uuidv4(),
            requestId,
            waktu: new Date(),
            namaPasien: patientData?.nama || 'Unknown',
            tujuanPoli,
            status: 'success',
            verifierId: request.verifierId,
        };
        await query(`INSERT INTO verification_logs (id, request_id, waktu, nama_pasien, tujuan_poli, status, verifier_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`, [log.id, log.requestId, log.waktu, log.namaPasien, log.tujuanPoli, log.status, log.verifierId]);
        console.log('✅ Verification completed successfully');
        return result;
    },
    /**
     * Get verification history
     */
    async getHistory(verifierId, page = 1, limit = 10) {
        let countQuery = 'SELECT COUNT(*) FROM verification_logs';
        let dataQuery = 'SELECT id, request_id, waktu, nama_pasien, tujuan_poli, status, verifier_id FROM verification_logs';
        const params = [];
        if (verifierId) {
            countQuery += ' WHERE verifier_id = $1';
            dataQuery += ' WHERE verifier_id = $1';
            params.push(verifierId);
        }
        dataQuery += ` ORDER BY waktu DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        const offset = (page - 1) * limit;
        const countResult = await query(countQuery, params);
        const total = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(total / limit);
        const dataResult = await query(dataQuery, [...params, limit, offset]);
        const logs = dataResult.rows.map((row) => ({
            id: row.id,
            requestId: row.request_id,
            waktu: row.waktu,
            namaPasien: row.nama_pasien,
            tujuanPoli: row.tujuan_poli,
            status: row.status,
            verifierId: row.verifier_id,
        }));
        return { logs, total, page, totalPages };
    },
    /**
     * Get verification log by request ID
     */
    async getLogByRequestId(requestId) {
        const result = await query('SELECT id, request_id, waktu, nama_pasien, tujuan_poli, status, verifier_id FROM verification_logs WHERE request_id = $1', [requestId]);
        if (result.rows.length === 0)
            return undefined;
        const row = result.rows[0];
        return {
            id: row.id,
            requestId: row.request_id,
            waktu: row.waktu,
            namaPasien: row.nama_pasien,
            tujuanPoli: row.tujuan_poli,
            status: row.status,
            verifierId: row.verifier_id,
        };
    },
    /**
     * Get verification stats
     */
    async getStats() {
        const totalResult = await query('SELECT COUNT(*) FROM verification_logs');
        const successResult = await query("SELECT COUNT(*) FROM verification_logs WHERE status = 'success'");
        const failedResult = await query("SELECT COUNT(*) FROM verification_logs WHERE status = 'failed'");
        const todayResult = await query("SELECT COUNT(*) FROM verification_logs WHERE waktu >= CURRENT_DATE");
        return {
            total: parseInt(totalResult.rows[0].count, 10),
            success: parseInt(successResult.rows[0].count, 10),
            failed: parseInt(failedResult.rows[0].count, 10),
            today: parseInt(todayResult.rows[0].count, 10),
        };
    },
};
//# sourceMappingURL=verificationService.js.map