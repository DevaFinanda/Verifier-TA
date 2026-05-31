import type { VerificationReasonCode } from '../types/verification.js';
export interface DescriptorMapItem {
    id: string;
    path: string;
    format?: string;
}
export interface DescriptorValidationResult {
    ok: boolean;
    reasonCodes: VerificationReasonCode[];
    mappings: Array<{
        descriptorId: string;
        path: string;
        matched: boolean;
        credentialIndex?: number;
        error?: string;
    }>;
}
export declare function validateDescriptorMap(presentationDefinition: unknown, presentationSubmission: unknown, vpPayload: Record<string, unknown>): DescriptorValidationResult;
//# sourceMappingURL=descriptorValidationService.d.ts.map