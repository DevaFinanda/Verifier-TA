export interface User {
    id: string;
    email: string;
    password: string;
    name: string;
    fasikesName: string;
    role: 'admin' | 'verifier';
    createdAt: Date;
    updatedAt: Date;
}
export interface VerificationRequest {
    id: string;
    requestId: string;
    verifierId: string;
    attributes: string[];
    nonce: string;
    timestamp: Date;
    status: 'pending' | 'scanned' | 'verified' | 'failed';
    qrData: string;
}
export interface VerificationResult {
    id: string;
    requestId: string;
    status: 'success' | 'failed';
    patientData?: PatientData;
    errorMessage?: string;
    verifiedAt: Date;
}
export interface PatientData {
    nama: string;
    nik: string;
    noBpjs: string;
    statusKepesertaan: string;
    tglAkhirKepesertaan: string;
    noAsuransi: string;
}
export interface VerificationLog {
    id: string;
    requestId: string;
    waktu: Date;
    namaPasien: string;
    tujuanPoli: string;
    status: 'success' | 'failed';
    verifierId: string;
}
export interface DIDConfig {
    did: string;
    publicKey: string;
    algorithm: string;
    status: 'active' | 'revoked' | 'not_configured';
    createdAt: Date;
}
export interface Endorser {
    id: string;
    name: string;
    did: string;
    status: 'verified' | 'pending' | 'revoked';
}
export interface JWTPayload {
    userId: string;
    email: string;
    name: string;
    role: string;
}
export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
}
//# sourceMappingURL=index.d.ts.map