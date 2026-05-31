export type VerificationReasonCode =
  | 'invalid_request'
  | 'missing_vp_token'
  | 'missing_state'
  | 'invalid_state'
  | 'session_already_used'
  | 'session_expired'
  | 'invalid_nonce'
  | 'invalid_audience'
  | 'invalid_proof'
  | 'issuer_signature_invalid'
  | 'presentation_definition_mismatch'
  | 'descriptor_path_invalid'
  | 'descriptor_credential_mismatch'
  | 'missing_required_claim'
  | 'nonce_missing_in_proof'
  | 'replay_detected'
  | 'disclosure_hash_mismatch'
  | 'disclosure_format_invalid'
  | 'key_binding_invalid'
  | 'credential_expired'
  | 'credential_revoked'
  | 'credential_suspended'
  | 'credential_status_unavailable'
  | 'issuer_not_trusted'
  | 'invalid_credential_structure'
  | 'unsupported_algorithm'
  | 'oversharing_detected'
  | 'holder_binding_invalid'
  | 'unknown_error';

export interface VerificationCheck {
  name: string;
  passed: boolean;
  reasonCode?: VerificationReasonCode;
  message: string;
}

export interface VerificationOutcome {
  cryptographicVerified: boolean;
  issuerTrusted: boolean;
  statusValid: boolean;
  claimValid: boolean;
  overallVerified: boolean;
  failedLayer:
    | 'REQUEST'
    | 'SESSION'
    | 'PRESENTATION'
    | 'DESCRIPTOR'
    | 'CRYPTOGRAPHIC'
    | 'DISCLOSURE'
    | 'POLICY'
    | 'TRUST'
    | 'STATUS'
    | null;
  reasonCodes: VerificationReasonCode[];
  checks: VerificationCheck[];
}
