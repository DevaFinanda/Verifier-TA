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
import type { VerificationOutcome, VerificationReasonCode } from '../types/verification.js';
export interface VerifiedBPJSClaims {
    holderDID: string;
    issuerDID: string;
    holderName?: string;
    noBPJS?: string;
    nik?: string;
    tanggalLahir?: string;
    statusKepesertaan?: string;
    issuedAt?: number;
    expiresAt?: number;
    [key: string]: unknown;
}
export interface VerifiedPresentationResult {
    claims: VerifiedBPJSClaims;
    outcome: VerificationOutcome;
}
export declare class VPValidationError extends Error {
    step?: string | undefined;
    constructor(message: string, step?: string | undefined);
}
export declare function mapStepToReasonCode(step?: string, message?: string): VerificationReasonCode;
/**
 * Verifikasi VP Token sesuai flow MD — mendukung jwt_vc_json dan vc+sd-jwt.
 *
 * @param vpToken              String VP Token dari holder wallet
 * @param expectedNonce        Nonce dari sesi verifikasi yang dibuat verifier
 * @param presentationSubmission  (opsional) descriptor mapping
 */
export declare function verifyVPToken(vpToken: string, expectedNonce: string, presentationSubmission?: unknown, presentationDefinition?: unknown): Promise<VerifiedPresentationResult>;
export declare function verifyPresentation(vpToken: string, expectedNonce: string, presentationSubmission?: unknown, presentationDefinition?: unknown): Promise<VerifiedPresentationResult>;
//# sourceMappingURL=vpValidatorService.d.ts.map