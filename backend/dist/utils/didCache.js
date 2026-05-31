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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Cache file disimpan di: backend/cache/did-documents.json
const DEFAULT_CACHE_FILE = path.join(__dirname, '../../cache/did-documents.json');
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 jam
// ─── DIDCache class ───────────────────────────────────────────────────────────
class DIDCache {
    cacheFilePath;
    defaultTtl;
    store = new Map();
    initialized = false;
    constructor(cacheFilePath = DEFAULT_CACHE_FILE, defaultTtl = DEFAULT_TTL_MS) {
        this.cacheFilePath = cacheFilePath;
        this.defaultTtl = defaultTtl;
    }
    /**
     * Inisialisasi cache — baca dari file jika ada.
     * Aman dipanggil berkali-kali (idempotent).
     */
    async init() {
        if (this.initialized)
            return;
        this.initialized = true;
        await this.loadFromFile();
    }
    // ─── Read ─────────────────────────────────────────────────────────────────
    /**
     * Ambil entry yang masih valid (belum expired).
     * Kembalikan null jika tidak ada atau sudah expired.
     */
    get(did) {
        const entry = this.store.get(did);
        if (!entry)
            return null;
        if (this.isExpired(entry))
            return null;
        return entry;
    }
    /**
     * Ambil entry tanpa cek TTL — untuk fallback saat network down.
     * Mengembalikan entry meskipun sudah expired.
     */
    getStale(did) {
        return this.store.get(did) ?? null;
    }
    /** Cek apakah DID ada di cache dan TTL masih valid */
    has(did) {
        return this.get(did) !== null;
    }
    // ─── Write ────────────────────────────────────────────────────────────────
    /** Simpan DID Document ke in-memory cache dan file */
    async set(did, didDocument, ttl = this.defaultTtl) {
        this.store.set(did, {
            did,
            didDocument,
            cachedAt: Date.now(),
            ttl,
        });
        await this.saveToFile();
    }
    /** Hapus satu entry dari cache */
    async invalidate(did) {
        if (this.store.delete(did)) {
            await this.saveToFile();
        }
    }
    /** Bersihkan seluruh cache (in-memory + file) */
    async clear() {
        this.store.clear();
        await this.saveToFile();
    }
    // ─── Stats ────────────────────────────────────────────────────────────────
    getStats() {
        let valid = 0, expired = 0;
        for (const entry of this.store.values()) {
            this.isExpired(entry) ? expired++ : valid++;
        }
        return { total: this.store.size, valid, expired };
    }
    // ─── Helpers ──────────────────────────────────────────────────────────────
    isExpired(entry) {
        return Date.now() > entry.cachedAt + entry.ttl;
    }
    // ─── File persistence ─────────────────────────────────────────────────────
    async loadFromFile() {
        try {
            if (!fs.existsSync(this.cacheFilePath))
                return;
            const raw = fs.readFileSync(this.cacheFilePath, 'utf-8');
            const data = JSON.parse(raw);
            let loaded = 0;
            for (const [did, entry] of Object.entries(data)) {
                // Validasi struktur dasar sebelum memasukkan ke memory
                if (typeof entry.cachedAt === 'number' && entry.didDocument?.id) {
                    this.store.set(did, entry);
                    loaded++;
                }
            }
            console.log(`📂 DID Cache: loaded ${loaded} entr${loaded === 1 ? 'y' : 'ies'} from file`);
        }
        catch (err) {
            console.warn(`⚠️  DID Cache: gagal membaca file cache (${err.message}), mulai dengan cache kosong`);
        }
    }
    async saveToFile() {
        try {
            const dir = path.dirname(this.cacheFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const data = {};
            for (const [did, entry] of this.store.entries()) {
                data[did] = entry;
            }
            fs.writeFileSync(this.cacheFilePath, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch (err) {
            console.warn(`⚠️  DID Cache: gagal menyimpan ke file (${err.message})`);
        }
    }
}
// ─── Singleton export ─────────────────────────────────────────────────────────
export const didCache = new DIDCache();
//# sourceMappingURL=didCache.js.map