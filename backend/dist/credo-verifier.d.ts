/**
 * Credo-TS Agent — OID4VP Verifier
 *
 * Initializes a Credo Agent with OpenId4VcModule for OID4VP verification.
 * The agent uses did:web backed by Askar-persistent KMS for signing
 * authorization requests and registers Express routes for the OID4VP protocol.
 */
import { Agent } from '@credo-ts/core';
import { OpenId4VcVerificationSessionState } from '@credo-ts/openid4vc';
import type { Express } from 'express';
export declare const BPJS_PRESENTATION_DEFINITION: {
    id: string;
    name: string;
    purpose: string;
    input_descriptors: {
        id: string;
        name: string;
        purpose: string;
        format: {
            jwt_vc: {
                alg: string[];
            };
            jwt_vp: {
                alg: string[];
            };
            jwt_vc_json: {
                alg: string[];
            };
            'vc+sd-jwt': {
                alg: string[];
            };
        };
        constraints: {
            fields: {
                path: string[];
                filter: {
                    type: "array";
                    contains: {
                        const: string;
                    };
                };
            }[];
        };
    }[];
};
export declare function initCredoVerifier(): Promise<{
    credoApp: Express;
}>;
export declare function getCredoAgent(): Agent<any>;
export declare function getVerifierApi(): any;
export declare function getVerifierRecord(): any;
export declare function getVerifierDidUrl(): string;
export { OpenId4VcVerificationSessionState, };
//# sourceMappingURL=credo-verifier.d.ts.map