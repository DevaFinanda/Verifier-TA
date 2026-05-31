/**
 * DID Resolver with Cache
 *
 * Fungsi utama: resolveDidWithCache(did)
 *
 * Urutan resolusi berlapis:
 *
 *  1. Cache Hit  — DID Document ada di cache dan TTL masih valid
 *                  → logging: "DID loaded from cache"
 *                  → TIDAK melakukan network call
 *
 *  2. Network    — Fetch dari endpoint did:web (/.well-known/did.json)
 *                  atau dari trust anchor endpoint (VPS)
 *                  → simpan ke cache jika berhasil
 *                  → logging: "DID resolved from network"
 *
 *  3. Stale Fallback — Network gagal (server issuer down)
 *                      → gunakan cache meskipun TTL sudah expired
 *                      → logging: "DID fallback from cache"
 *
 *  4. Total Failure  — Tidak ada di cache, network tidak tersedia
 *                      → throw Error
 */
import { type DIDDocument } from './didCache.js';
/**
 * Resolve DID Document dengan mekanisme cache berlapis.
 *
 * Logging:
 *   "DID resolved from network"  — berhasil fetch dari network, disimpan ke cache
 *   "DID loaded from cache"      — TTL valid, tidak perlu network call
 *   "DID fallback from cache"    — network gagal, menggunakan stale cache
 *
 * @param did  DID string (e.g. "did:web:202.155.132.71")
 * @returns    DID Document lengkap
 * @throws     Error jika tidak ada di cache dan network tidak tersedia
 */
export declare function resolveDidWithCache(did: string): Promise<DIDDocument>;
//# sourceMappingURL=didResolverWithCache.d.ts.map