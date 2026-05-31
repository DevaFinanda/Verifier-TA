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
import { didCache } from './didCache.js';
import { getIssuerByDid } from '../config/trustedIssuers.js';
import { issuerResolverService } from '../services/issuerResolverService.js';
// ─── did:web URL derivation (per W3C did:web spec) ───────────────────────────
/**
 * Konversi DID did:web ke canonical HTTP URL.
 *   did:web:example.com          → https://example.com/.well-known/did.json
 *   did:web:202.155.132.71       → http://202.155.132.71/.well-known/did.json
 *   did:web:example.com:path:sub → https://example.com/path/sub/did.json
 */
function didWebToUrl(did) {
    const suffix = did.slice('did:web:'.length);
    const segments = suffix.split(':');
    const host = decodeURIComponent(segments[0]); // handles encoded port (%3A → :)
    const isIpAddr = /^[\d.]+$/.test(host.split(':')[0]);
    const protocol = isIpAddr ? 'http' : 'https';
    if (segments.length === 1) {
        return `${protocol}://${host}/.well-known/did.json`;
    }
    const subPath = segments.slice(1).join('/');
    return `${protocol}://${host}/${subPath}/did.json`;
}
// ─── Network resolution ───────────────────────────────────────────────────────
/**
 * Coba ambil DID Document dari network.
 * Urutan:
 *   A. Direct did:web URL (spec-compliant, tanpa trust anchor DB)
 *   B. Trust anchor endpoint (dari trusted_issuers DB / VPS)
 *
 * Kembalikan null jika semua gagal (bukan throw, agar caller bisa fallback ke cache).
 */
async function fetchDIDDocumentFromNetwork(did) {
    // ── A. Direct did:web URL ──────────────────────────────────────────────────
    if (did.startsWith('did:web:')) {
        try {
            const url = didWebToUrl(did);
            console.log(`  🌐 DID fetch: ${url}`);
            const res = await fetch(url, {
                headers: { Accept: 'application/json, application/did+json' },
                signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
                const doc = (await res.json());
                // Validasi minimal: harus punya verificationMethod
                if (doc?.verificationMethod?.length) {
                    return doc;
                }
                console.warn(`  ⚠️  DID Document dari ${url} tidak memiliki verificationMethod`);
            }
            else {
                console.warn(`  ⚠️  HTTP ${res.status} saat fetch DID Document: ${url}`);
            }
        }
        catch (err) {
            console.warn(`  ⚠️  Direct did:web fetch gagal: ${err.message}`);
        }
    }
    // ── B. Trust anchor endpoint (VPS) ───────────────────────────────────────
    try {
        const trustedIssuer = await getIssuerByDid(did);
        if (trustedIssuer?.endpoint) {
            console.log(`  🏛️  Mencoba trust anchor endpoint: ${trustedIssuer.endpoint}`);
            const doc = await issuerResolverService.fetchDIDDocument(trustedIssuer.endpoint, did);
            if (doc) {
                return doc;
            }
        }
    }
    catch (err) {
        console.warn(`  ⚠️  Trust anchor fetch gagal: ${err.message}`);
    }
    return null;
}
// ─── Main export ──────────────────────────────────────────────────────────────
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
export async function resolveDidWithCache(did) {
    await didCache.init();
    // ── 1. Cache Hit: valid TTL ──────────────────────────────────────────────
    const cached = didCache.get(did);
    if (cached) {
        const ageMin = Math.round((Date.now() - cached.cachedAt) / 60_000);
        console.log(`  📦 DID loaded from cache: ${did} (usia ${ageMin} menit)`);
        return cached.didDocument;
    }
    // ── 2. Network Resolution ───────────────────────────────────────────────
    let networkError = null;
    let didDocument = null;
    try {
        didDocument = await fetchDIDDocumentFromNetwork(did);
    }
    catch (err) {
        networkError = err;
    }
    if (didDocument) {
        await didCache.set(did, didDocument);
        console.log(`  🌐 DID resolved from network: ${did}`);
        return didDocument;
    }
    // ── 3. Stale Cache Fallback ─────────────────────────────────────────────
    const stale = didCache.getStale(did);
    if (stale) {
        const ageHr = (Date.now() - stale.cachedAt) / 3_600_000;
        console.warn(`  🔄 DID fallback from cache: ${did} ` +
            `(stale ${ageHr.toFixed(1)} jam, server tidak tersedia)`);
        if (networkError) {
            console.warn(`     Network error: ${networkError.message}`);
        }
        return stale.didDocument;
    }
    // ── 4. Total Failure ─────────────────────────────────────────────────────
    throw new Error(`Tidak dapat resolve DID "${did}": ` +
        `server issuer tidak tersedia dan DID Document tidak ada di cache lokal. ` +
        `Pastikan koneksi ke server issuer tersedia, atau lakukan satu resolusi sukses terlebih dahulu agar cache terisi.`);
}
//# sourceMappingURL=didResolverWithCache.js.map