/**
 * Generate a random nonce for verification requests
 */
export declare const generateNonce: () => string;
/**
 * Generate a unique request ID
 */
export declare const generateRequestId: () => string;
/**
 * Generate a mock EdDSA signature (for demo purposes)
 */
export declare const generateMockSignature: (data: string) => string;
/**
 * Verify a mock signature
 */
export declare const verifyMockSignature: (data: string, signature: string) => boolean;
/**
 * Format date to Indonesian format
 */
export declare const formatDate: (date: Date) => string;
/**
 * Generate mock patient data (for demo purposes)
 */
export declare const generateMockPatientData: () => {
    nama: string;
    nik: string;
    noBpjs: string;
    statusKepesertaan: string;
    tglAkhirKepesertaan: string;
    noAsuransi: string;
};
//# sourceMappingURL=helpers.d.ts.map