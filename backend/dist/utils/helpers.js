import crypto from 'crypto';
/**
 * Generate a random nonce for verification requests
 */
export const generateNonce = () => {
    return crypto.randomBytes(16).toString('hex');
};
/**
 * Generate a unique request ID
 */
export const generateRequestId = () => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `REQ-${dateStr}-${random}`;
};
/**
 * Generate a mock EdDSA signature (for demo purposes)
 */
export const generateMockSignature = (data) => {
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return `EdDSA-${hash.substring(0, 16)}`;
};
/**
 * Verify a mock signature
 */
export const verifyMockSignature = (data, signature) => {
    // In production, this would verify real EdDSA signatures
    return signature.startsWith('EdDSA-');
};
/**
 * Format date to Indonesian format
 */
export const formatDate = (date) => {
    return date.toLocaleString('id-ID', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};
/**
 * Generate mock patient data (for demo purposes)
 */
export const generateMockPatientData = () => {
    const patients = [
        {
            nama: 'Ahmad Rizki Pratama',
            nik: '3216058901950012',
            noBpjs: '0000123456789',
            statusKepesertaan: 'Aktif',
            tglAkhirKepesertaan: '2025-12-31',
            noAsuransi: 'JKN-001-2024',
        },
        {
            nama: 'Siti Nurhaliza',
            nik: '3216058901950013',
            noBpjs: '0000123456790',
            statusKepesertaan: 'Aktif',
            tglAkhirKepesertaan: '2025-12-31',
            noAsuransi: 'JKN-002-2024',
        },
        {
            nama: 'Budi Santoso',
            nik: '3216058901950014',
            noBpjs: '0000123456791',
            statusKepesertaan: 'Aktif',
            tglAkhirKepesertaan: '2026-06-30',
            noAsuransi: 'JKN-003-2024',
        },
    ];
    return patients[Math.floor(Math.random() * patients.length)];
};
//# sourceMappingURL=helpers.js.map