/**
 * Generate Ed25519 keypair for Verifier
 */
export declare function generateVerifierKeyPair(): {
    publicKeyHex: string;
    privateKeyHex: string;
    publicKeyMultibase: string;
};
/**
 * Extract raw 32-byte Ed25519 private key from PKCS8 format
 */
export declare function extractRawPrivateKey(pkcs8Hex: string): Buffer;
/**
 * Save keypair to .env file
 */
export declare function saveKeypairToEnv(privateKeyHex: string, publicKeyHex: string, publicKeyMultibase: string): void;
/**
 * Load keypair from environment
 */
export declare function loadKeypairFromEnv(): {
    privateKeyHex: string;
    publicKeyHex: string;
    publicKeyMultibase: string;
} | null;
/**
 * Create Ed25519 signer for signing operations
 */
export declare function createSigner(privateKeyHex: string): (data: string) => Buffer;
//# sourceMappingURL=keyGenerator.d.ts.map