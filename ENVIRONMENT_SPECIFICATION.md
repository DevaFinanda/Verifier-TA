# 📋 SPESIFIKASI LINGKUNGAN PENGEMBANGAN VERIFIER

Dokumen ini menjelaskan komponen teknologi, versi, dan fungsi utama yang digunakan dalam pengembangan sistem BPJS Healthcare Verifier.

---

## 📊 TABEL SPESIFIKASI LINGKUNGAN

### 1. RUNTIME & CORE PLATFORMS

| Komponen | Teknologi | Versi | Fungsi Utama |
|----------|-----------|-------|--------------|
| **Runtime Backend** | Node.js | ≥ 18.0.0 | JavaScript runtime untuk menjalankan server backend |
| **Web Framework Backend** | Express.js | 5.2.1 | HTTP server framework untuk REST API |
| **Language Backend** | TypeScript | 5.9.3 | Type-safe programming language untuk backend |
| **Web Framework Frontend** | Next.js | 16.1.6 | React framework untuk SSR dan static generation |
| **UI Library** | React | 19.2.4 | JavaScript library untuk UI components |
| **Language Frontend** | TypeScript | 5.7.3 | Type-safe programming language untuk frontend |

---

### 2. VERIFIABLE CREDENTIALS & IDENTITY

| Komponen | Teknologi | Versi | Fungsi Utama |
|----------|-----------|-------|--------------|
| **VC Framework Core** | @credo-ts/core | 0.6.2 | Core functionality untuk Verifiable Credentials |
| **VC OpenID4VC Protocol** | @credo-ts/openid4vc | 0.6.2 | Implementasi OpenID for Verifiable Presentations (OID4VP) |
| **VC Node Integration** | @credo-ts/node | 0.6.2 | Node.js bindings untuk Credo framework |
| **Cryptographic Store** | @credo-ts/askar | 0.6.2 | Secure key management dan credential storage |
| **Askar Native Binding** | @openwallet-foundation/askar-nodejs | 0.6.0 | Native binding untuk Askar cryptographic library |
| **DID Method Support** | Did Document Resolution | Custom | Resolving dan caching Decentralized Identifiers |

---

### 3. DATABASE & DATA PERSISTENCE

| Komponen | Teknologi | Versi | Fungsi Utama |
|----------|-----------|-------|--------------|
| **Database Server** | PostgreSQL | 12.x+ (VPS Cloud) | Relational database untuk user, credentials, audit logs |
| **Database Driver** | pg (node-postgres) | 8.18.0 | Native PostgreSQL driver untuk Node.js |
| **Connection Pooling** | pg (built-in) | 8.18.0 | Connection pooling untuk database efficiency |

---

### 4. AUTHENTICATION & SECURITY

| Komponen | Teknologi | Versi | Fungsi Utama |
|----------|-----------|-------|--------------|
| **JWT Token** | jsonwebtoken | 9.0.3 | Generate dan verify JWT tokens (ES256/EdDSA) |
| **Password Hashing** | bcryptjs | 3.0.3 | Hashing dan validation password user |
| **CORS Protection** | cors | 2.8.6 | Cross-Origin Resource Sharing middleware |
| **Helmet Security** | helmet | 8.1.0 | HTTP header security middleware |
| **CSRF Protection** | csurf | 1.11.0 | Cross-Site Request Forgery protection |
| **HPP Protection** | hpp | 0.2.3 | HTTP Parameter Pollution protection |
| **XSS Sanitization** | dompurify | 3.3.1 | HTML/DOM sanitization untuk mencegah XSS |
| **XSS Cleaner** | xss-clean | 0.1.4 | XSS attack prevention middleware |
| **Input Validation** | express-validator | 7.3.1 | Server-side input validation |
| **Rate Limiting** | express-rate-limit | 8.2.1 | API rate limiting untuk DoS protection |

---

### 5. FRONTEND UI & STYLING

| Komponen | Teknologi | Versi | Fungsi Utama |
|----------|-----------|-------|--------------|
| **CSS Framework** | Tailwind CSS | 4.2.0 | Utility-first CSS framework |
| **CSS Processing** | PostCSS | 8.5 | CSS transformations dan autoprefixing |
| **UI Component Library** | Radix UI | Latest | Unstyled, accessible React components |
| **Component Provider** | @radix-ui/react-* | 1.x | 30+ Radix UI components (Dialog, Select, Tabs, dll) |
| **Styling Utilities** | tailwind-merge | 3.3.1 | Merge Tailwind CSS classes |
| **Class Utilities** | clsx | 2.1.1 | Conditional className builder |

---

### 6. FORM HANDLING & VALIDATION

| Komponen | Teknologi | Versi | Fungsi Utama |
|----------|-----------|-------|--------------|
| **Form Management** | react-hook-form | 7.54.1 | Performant, flexible form management |
| **Schema Validation** | zod | 3.24.1 | TypeScript-first schema validation |
| **Form Resolvers** | @hookform/resolvers | 3.9.1 | Adapter untuk zod dengan react-hook-form |

---

### 7. UI COMPONENTS & VISUALIZATION

| Komponen | Teknologi | Versi | Fungsi Utama |
|----------|-----------|-------|--------------|
| **QR Code Generation** | qrcode.react | 3.1.0 | Generate QR code untuk OID4VP requests |
| **Charts & Graphs** | recharts | 2.15.0 | React charting library untuk visualisasi data |
| **Icons** | lucide-react | 0.564.0 | SVG icon library dengan 500+ icons |
| **Toast Notifications** | sonner | 1.7.1 | Elegant toast notification component |
| **Carousel** | embla-carousel-react | 8.6.0 | Carousel/slider component |
| **Date Picker** | react-day-picker | 9.13.2 | Flexible date picker component |
| **Resizable Panels** | react-resizable-panels | 2.1.7 | Resizable split-view panels |
| **OTP Input** | input-otp | 1.4.2 | One-time password input component |
| **Analytics** | @vercel/analytics | 1.6.1 | Frontend performance analytics |

---

### 8. DEVELOPMENT & BUILD TOOLS

| Komponen | Teknologi | Versi | Fungsi Utama |
|----------|-----------|-------|--------------|
| **Task Runner** | npm scripts | Built-in | Build dan run tasks |
| **Dev Server Backend** | nodemon | 3.1.11 | Auto-restart development server |
| **TypeScript Compiler** | TypeScript Compiler | 5.9.3 | Compile TypeScript to JavaScript |
| **TS-Node** | ts-node | 10.9.2 | Direct TypeScript execution |
| **Process Manager** | PM2 | Latest | Production process management |
| **Package Manager Backend** | npm | Latest | Package management untuk Node.js |
| **Package Manager Frontend** | pnpm | Latest | Fast package manager untuk frontend |
| **Concurrency Runner** | concurrently | 9.1.2 | Run multiple commands simultaneously |

---

### 9. INFRASTRUCTURE & DEPLOYMENT

| Komponen | Teknologi | Versi | Fungsi Utama |
|----------|-----------|-------|--------------|
| **Web Server** | Nginx | Latest | Reverse proxy dan load balancing |
| **Process Manager** | PM2 | Latest | Cluster management dan auto-restart |
| **VPS Cloud** | Cloud VPS | Shared | Hosting untuk backend, database, Nginx |
| **SSL/TLS** | Nginx SSL | Latest | HTTPS encryption |
| **Domain** | verifier.identia.my.id | - | Production domain |

---

### 10. UTILITIES & HELPERS

| Komponen | Teknologi | Versi | Fungsi Utama |
|----------|-----------|-------|--------------|
| **Cookie Parser** | cookie-parser | 1.4.7 | Parse HTTP request cookies |
| **Logger** | morgan | 1.10.1 | HTTP request logging middleware |
| **Environment Variables** | dotenv | 17.2.4 | Load environment variables dari .env |
| **UUID Generator** | uuid | 13.0.0 | Generate unique identifiers |
| **DOM Sanitizer (Backend)** | isomorphic-dompurify | 3.0.0-rc.2 | DOM sanitization untuk isomorphic usage |
| **Theme Support** | next-themes | 0.4.6 | Dark/light mode theme management |
| **Drawer/Sheet** | vaul | 1.1.2 | Headless drawer component |

---

## 🖥️ RINGKASAN SPESIFIKASI TEKNIS

### Backend Stack
```
Language:     TypeScript 5.9.3 + Node.js ≥18.0.0
Framework:    Express.js 5.2.1
Credential:   Credo-TS 0.6.2 (OpenID4VC Protocol)
Crypto:       Ed25519, bcryptjs, JWT
Database:     PostgreSQL (VPS Cloud)
Security:     Helmet, CSRF, XSS Protection, Rate Limiting
```

### Frontend Stack
```
Framework:    Next.js 16.1.6
Language:     TypeScript 5.7.3 + React 19.2.4
Styling:      Tailwind CSS 4.2.0 + Radix UI
Forms:        React Hook Form 7.54.1 + Zod 3.24.1
QR Code:      qrcode.react 3.1.0
Charts:       recharts 2.15.0
```

### Infrastructure
```
Server:       Nginx (reverse proxy)
VPS:          Cloud VPS (verifier.identia.my.id)
Database:     PostgreSQL (VPS Cloud)
Process Mgmt: PM2
SSL/TLS:      HTTPS via Nginx
```

---

## 📌 CATATAN PENTING

1. **Node.js Version**: Minimum 18.0.0 untuk kompatibilitas dengan Credo-TS dan ES modules
2. **TypeScript**: Dua versi berbeda (5.9.3 backend, 5.7.3 frontend)
3. **Package Manager**: Backend menggunakan npm, Frontend menggunakan pnpm
4. **OpenID4VC Protocol**: Menggunakan Credo-TS 0.6.2 sebagai core framework
5. **Cryptography**: Menggunakan Ed25519 dan ES256 untuk JWT signing
6. **VPS Setup**: PostgreSQL, Node.js, Nginx, PM2 berjalan di cloud VPS
7. **Security First**: 8 security packages untuk comprehensive protection

---

**Dokumen Terakhir Diperbarui**: Mei 2026
**Status**: Aktif dalam Pengembangan
