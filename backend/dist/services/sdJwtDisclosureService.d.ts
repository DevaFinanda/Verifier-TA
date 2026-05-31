import type { VerificationReasonCode } from '../types/verification.js';
export declare class SdJwtDisclosureError extends Error {
    step?: string | undefined;
    constructor(message: string, step?: string | undefined);
}
export interface ParsedDisclosure {
    encoded: string;
    rawJson: string;
    salt: string;
    key: string;
    value: unknown;
}
export interface DisclosureVerificationResult {
    ok: boolean;
    reasonCodes: VerificationReasonCode[];
    claims: Record<string, unknown>;
}
export declare function parseDisclosureToken(encodedDisclosure: string): ParsedDisclosure;
export declare function verifyDisclosures(issuerPayload: Record<string, unknown>, disclosures: ParsedDisclosure[]): DisclosureVerificationResult;
//# sourceMappingURL=sdJwtDisclosureService.d.ts.map