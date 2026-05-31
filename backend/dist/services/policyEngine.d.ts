export interface VerifierPolicy {
    requireExactDisclosure: boolean;
    rejectOversharing: boolean;
    allowedAlgorithms: string[];
    requireAudienceMatch: boolean;
    requireNonceBinding: boolean;
    requireDescriptorMapValidation: boolean;
    requireKeyBindingForSdJwt: boolean;
    allowStatusCacheFallback: boolean;
    maxClockSkewSeconds: number;
}
export declare const verifierPolicy: VerifierPolicy;
export declare function parseClaimKeysFromDefinition(presentationDefinition: unknown): Set<string>;
export declare function enforceDisclosurePolicy(requiredClaimSet: Set<string>, disclosedClaims: Record<string, unknown>, policy: VerifierPolicy, mode: 'sd-jwt' | 'jwt-vc'): {
    ok: boolean;
    missing: string[];
    extras: string[];
};
//# sourceMappingURL=policyEngine.d.ts.map