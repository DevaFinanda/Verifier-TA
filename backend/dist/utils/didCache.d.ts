/**
 * DID Document Cache
 *
 * Menyimpan DID Document secara lokal dengan TTL (default: 24 jam).
 * Mendukung dua lapis penyimpanan:
 *   - In-memory cache  : akses cepat, hilang saat server restart
 *   - File-based cache : bertahan antar restart, digunakan sebagai warm-up
 *
 * Digunakan oleh didResolverWithCache untuk:
 *   1. Mempercepat resolusi DID berulang (cache hit)
 *   2. Menyediakan fallback jika server issuer tidak tersedia (stale cache)
 */
export interface DIDDocument {
    '@context'?: string | string[];
    id: string;
    verificationMethod?: Array<Record<string, unknown>>;
    authentication?: Array<string | Record<string, unknown>>;
    assertionMethod?: Array<string | Record<string, unknown>>;
    [key: string]: unknown;
}
export interface CacheEntry {
    did: string;
    didDocument: DIDDocument;
    /** Unix timestamp (ms) saat entry disimpan */
    cachedAt: number;
    /** Time-to-live dalam ms */
    ttl: number;
}
declare class DIDCache {
    private readonly cacheFilePath;
    private readonly defaultTtl;
    private store;
    private initialized;
    constructor(cacheFilePath?: string, defaultTtl?: number);
    /**
     * Inisialisasi cache — baca dari file jika ada.
     * Aman dipanggil berkali-kali (idempotent).
     */
    init(): Promise<void>;
    /**
     * Ambil entry yang masih valid (belum expired).
     * Kembalikan null jika tidak ada atau sudah expired.
     */
    get(did: string): CacheEntry | null;
    /**
     * Ambil entry tanpa cek TTL — untuk fallback saat network down.
     * Mengembalikan entry meskipun sudah expired.
     */
    getStale(did: string): CacheEntry | null;
    /** Cek apakah DID ada di cache dan TTL masih valid */
    has(did: string): boolean;
    /** Simpan DID Document ke in-memory cache dan file */
    set(did: string, didDocument: DIDDocument, ttl?: number): Promise<void>;
    /** Hapus satu entry dari cache */
    invalidate(did: string): Promise<void>;
    /** Bersihkan seluruh cache (in-memory + file) */
    clear(): Promise<void>;
    getStats(): {
        total: number;
        valid: number;
        expired: number;
    };
    private isExpired;
    private loadFromFile;
    private saveToFile;
}
export declare const didCache: DIDCache;
export {};
//# sourceMappingURL=didCache.d.ts.map