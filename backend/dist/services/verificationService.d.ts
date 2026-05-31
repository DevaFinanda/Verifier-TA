import { VerificationRequest, VerificationResult, VerificationLog } from '../types/index.js';
export declare const verificationService: {
    /**
     * Create a new verification request (generate QR code data)
     */
    createRequest(verifierId: string, attributes: string[]): Promise<VerificationRequest>;
    /**
     * Get verification request by ID
     */
    getRequest(requestId: string): Promise<VerificationRequest | undefined>;
    /**
     * Simulate scanning QR code (DEMO ONLY - for testing without real holder wallet)
     * In production, holder wallet will scan QR and send real credential
     */
    simulateScan(requestId: string): Promise<{
        logs: string[];
        request: VerificationRequest;
    }>;
    /**
     * Verify credential signature using Issuer's public key from DID Document
     * Supports DEMO mode when issuer server is offline
     */
    verifyCredentialSignature(issuerDid: string, credential: any): Promise<{
        valid: boolean;
        issuerPublicKey?: string;
        error?: string;
        demoMode?: boolean;
    }>;
    /**
     * Complete verification and return patient data
     * Supports both DEMO mode (auto-generate mock credential) and PRODUCTION mode (requires real credential)
     */
    completeVerification(requestId: string, tujuanPoli?: string, credential?: any): Promise<VerificationResult>;
    /**
     * Get verification history
     */
    getHistory(verifierId?: string, page?: number, limit?: number): Promise<{
        logs: VerificationLog[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    /**
     * Get verification log by request ID
     */
    getLogByRequestId(requestId: string): Promise<VerificationLog | undefined>;
    /**
     * Get verification stats
     */
    getStats(): Promise<{
        total: number;
        success: number;
        failed: number;
        today: number;
    }>;
};
//# sourceMappingURL=verificationService.d.ts.map