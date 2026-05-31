# DOKUMENTASI SISTEM VERIFIER UNTUK ACTIVITY & SEQUENCE DIAGRAM

---

## 📋 DAFTAR ISI
1. [Overview Sistem](#overview-sistem)
2. [Main Flows & Processes](#main-flows--processes)
3. [Actors & Stakeholders](#actors--stakeholders)
4. [Data Entities](#data-entities)
5. [System Components](#system-components)
6. [Sequence Diagram Flows](#sequence-diagram-flows)
7. [Activity Diagram Flows](#activity-diagram-flows)
8. [Integration Points](#integration-points)

---

## 📊 OVERVIEW SISTEM

### Tujuan Sistem
Sistem **BPJS Healthcare Verifier** adalah platform untuk memverifikasi credential kesehatan BPJS menggunakan protokol **OID4VP (OpenID for Verifiable Presentations)** dengan DID (Decentralized Identifiers).

### Teknologi Stack
```
Frontend:  Next.js 16.1.6 (Port 3004)
Backend:   Node.js + Express.js (Port 3002)
Protocol:  OID4VP (Credo-TS @0.6.2)
Database:  PostgreSQL (VPS Cloud)
Auth:      JWT (ES256 / EdDSA)
Crypto:    Ed25519, bcryptjs
```

### Architecture Pattern
```
┌──────────────────────────┐
│   Web Browser (User)     │
└────────────┬─────────────┘
             │ HTTP/REST
             ↓
┌──────────────────────────────────────┐
│   Next.js Frontend (Dashboard)        │
│   - Login, Verifier UI               │
│   - QR Display, Result Display        │
└────────────┬─────────────────────────┘
             │ API Calls
             ↓
┌──────────────────────────────────────┐
│   Express.js Backend (API Server)     │
│   - Auth Routes                       │
│   - OID4VP Routes (Verify, Result)    │
│   - DID Routes                        │
│   - Callback Handler (Credo)          │
└────────────┬─────────────────────────┘
             │
      ┌──────┼──────┬──────────┐
      ↓      ↓      ↓          ↓
   ┌────┐┌──────┐┌────────┐┌──────────┐
   │Credo││PostgreSQL  │DID Resolver │
   │Agent││Db│        │Cache│
   └────┘└──────┘└────────┘└──────────┘
```

---

## 🎯 MAIN FLOWS & PROCESSES

### FLOW 1: USER AUTHENTICATION (Login)

**Actors:**
- Healthcare Worker (User)
- Frontend Application
- Backend API Server
- PostgreSQL Database

**Steps:**
```
1. User enters email & password → Frontend
2. Frontend → Backend: POST /api/auth/login
   {email, password}
3. Backend validates input (express-validator)
4. Backend queries DB: SELECT from users WHERE email
5. Backend bcrypt.compare(password, hashedPassword)
6. If valid:
   a. Generate JWT token
   b. Return {success: true, data: {user, token}}
   c. Frontend stores token in localStorage
   d. Frontend redirects to /dashboard
7. If invalid:
   a. Return {success: false, message: "Invalid credentials"}
   b. Frontend shows error message
```

**Key Entities:**
- users table: {id, email, password_hash, name, fasikes_name, role}
- JWT Payload: {userId, email, name, role, iat, exp}

---

### FLOW 2: OID4VP VERIFICATION (Main Process - 7 Steps)

#### **STEP 1: Verifier Initiates Request**

```
User (Healthcare Worker) 
    → Clicks "Start Verification" button on dashboard
    → Frontend sends: POST /api/verify/start {}

Backend (oid4vpController.startVerification):
    → Calls oid4vpService.startVerification()
    → Credo Agent generates Authorization Request:
        - Includes BPJS_PRESENTATION_DEFINITION
        - Specifies credential types needed
        - Creates nonce (anti-replay token)
        - Creates state (request correlation)
        - Creates sessionId (unique for this verification)
    → Generates QR code URL (via QR service)
    → Saves to verification_sessions table:
        {id: sessionId, status: 'PENDING', nonce, state, qr_url, expires_at}
    → Returns to Frontend:
        {
          verificationId,
          qrUrl,
          sessionId,
          nonce,
          state,
          deepLink,
          expiresAt,
          presentationDefinition
        }

Frontend:
    → Displays QR code to healthcare worker
    → Starts polling: GET /api/verify/result/{sessionId}
      (every 2 seconds with exponential backoff)
```

**Database State After Step 1:**
```
verification_sessions:
- id: "abc123-uuid"
- status: "PENDING"
- requested_at: NOW()
- completed_at: NULL
- holder_did: NULL
- disclosed_claims: NULL
- raw_vp_token: NULL
- nonce: "nonce-xyz-123"
- state: "state-abc-456"
- qr_url: "https://api.verifier.id/qr/abc123"
- expires_at: NOW() + 5 minutes
```

---

#### **STEP 2: Holder Scans QR Code**

```
Healthcare Worker
    → Shows QR code to patient (or patient scans self)
    
Patient (Holder) 
    → Opens mobile wallet app
    → Scans QR code
    → Wallet decodes QR (contains request_uri)
    → Wallet extracts request_uri:
        "https://verifier.id/api/verify/request?state=state-abc-456"
```

---

#### **STEP 3: Wallet Fetches Authorization Request**

```
Wallet App
    → Makes request: GET /api/verify/request?state=state-abc-456
    
Backend (Credo endpoint, auto-registered)
    → Credo Module handles this request
    → Returns full Authorization Request:
        {
          client_id: "did:web:verifier.id",
          response_type: "vp_token",
          response_mode: "form_post",
          nonce: "nonce-xyz-123",
          state: "state-abc-456",
          presentation_definition: {
            id: "bpjs-credential-request",
            input_descriptors: [
              {
                id: "bpjs-health-credential",
                format: {jwt_vc, jwt_vp, vc+sd-jwt},
                constraints: {...}
              }
            ]
          }
        }
    
Wallet App
    → User selects BPJS credential
    → User reviews claims to disclose
    → User approves presentation
```

---

#### **STEP 4: Holder Signs & Sends VP Token**

```
Wallet App
    → Signs Verifiable Presentation:
        {
          "@context": "https://www.w3.org/2018/credentials/v1",
          "type": ["VerifiablePresentation"],
          "verifiableCredential": [VC_JWT_TOKEN],
          "proof": {
            "type": "Ed25519Signature2020",
            "verificationMethod": "did:key:z6...",
            "signatureValue": "signature_hex..."
          }
        }
    
    → Encodes as JWT (VP JWT):
        header: {alg: "EdDSA", typ: "JWT"}
        payload: {vp_token, nonce, aud, exp, iat, ...}
        signature: signed_by_holder_private_key
    
    → Sends to Backend: POST /callback
        {
          vp_token: "eyJhbGc...",
          state: "state-abc-456",
          presentation_submission: {...}
        }
```

---

#### **STEP 5: Backend Validates VP Token (9-Step Verification)**

```
Backend (Credo Module + vpValidatorService)

┌─────────────────────────────────────────────┐
│ 9-STEP VP VALIDATION PROCESS                │
└─────────────────────────────────────────────┘

STEP 5.1: Decode VP JWT Header
    ├─ Extract header: {alg: "EdDSA", typ: "JWT"}
    ├─ Verify algorithm is EdDSA (trusted)
    └─ Continue to step 5.2

STEP 5.2: Resolve Holder DID
    ├─ Extract from VP token: "holder_did": "did:key:z6..."
    ├─ Query DID Resolver (cached via didCache)
    ├─ Retrieve DID Document with public keys
    ├─ Extract public_key for verification
    └─ Continue to step 5.3

STEP 5.3: Verify VP Signature (Holder's Key)
    ├─ Use crypto.subtle.verify(EdDSA) with holder's public key
    ├─ If valid: ✓ pass check, store in verificationChecks
    ├─ If invalid: ✗ fail, reasonCode: "VP_SIGNATURE_INVALID"
    └─ Continue to step 5.4

STEP 5.4: Check Nonce (Anti-Replay Protection)
    ├─ Extract from VP payload: "nonce": "nonce-xyz-123"
    ├─ Query DB: SELECT from verification_sessions WHERE nonce
    ├─ Compare with stored nonce in verification_sessions
    ├─ Check nonce expiration: nonce_expires_at > NOW()
    ├─ If valid: ✓ pass check
    ├─ If invalid/expired: ✗ fail, reasonCode: "NONCE_MISMATCH"
    └─ Continue to step 5.5

STEP 5.5: Decode VC JWT (Extract Issuer)
    ├─ From VP, extract VC JWT from verifiableCredential
    ├─ Decode JWT header/payload (no signature check yet)
    ├─ Extract issuer DID: "iss": "did:web:trusted-issuer.id"
    ├─ Verify issuer in trusted_issuers table
    ├─ If not trusted: ✗ fail, reasonCode: "ISSUER_UNTRUSTED"
    └─ Continue to step 5.6

STEP 5.6: Resolve Issuer DID
    ├─ Query DID Resolver for issuer DID
    ├─ Retrieve issuer's public key from DID Document
    ├─ Cache result (didCache)
    └─ Continue to step 5.7

STEP 5.7: Verify VC Signature (Issuer's Key)
    ├─ Use crypto.subtle.verify(EdDSA) with issuer's public key
    ├─ Verify VC JWT signature
    ├─ If valid: ✓ pass check
    ├─ If invalid: ✗ fail, reasonCode: "VC_SIGNATURE_INVALID"
    └─ Continue to step 5.8

STEP 5.8: Validate VC Claims
    ├─ Check nbf (not before): credential is not used before issued
    ├─ Check exp (expiration): credential not expired
    ├─ Check credential type: contains "KartuBPJSKesehatan"
    ├─ Check holder binding: VP nonce matches VC nonce
    ├─ Extract credential subject: {noBPJS, nik, nama, tanggalLahir, ...}
    ├─ If all valid: ✓ pass check
    ├─ If any invalid: ✗ fail, reasonCode: "CLAIM_INVALID" or "CREDENTIAL_EXPIRED"
    └─ Continue to step 5.9

STEP 5.9: Extract Required Claims
    ├─ From VC credentialSubject, extract:
    │   {
    │     noBPJS: "0002155132710001",
    │     nik: "3501234567890123",
    │     nama: "John Doe",
    │     tanggalLahir: "1990-01-01",
    │     statusKepesertaan: "AKTIF",
    │     issuedAt: 1234567890,
    │     expiresAt: 1234567890
    │   }
    ├─ Apply disclosure policy (policyEngine):
    │   - Check if claims align with presentation_definition
    │   - Verify required fields are present
    │   - Sanitize claims
    └─ Build verificationResult

FINAL: Build Verification Outcome
    ├─ Collect all verification checks
    ├─ Generate reasonCodes array (failed checks only)
    ├─ Set overall status:
    │   - If all checks pass: status = "SUCCESS"
    │   - If any check fails: status = "FAILED"
    │   - reasonCodes = [list of failure codes]
    └─ Return VerifiedPresentationResult
```

**Example Reason Codes (on failure):**
- `SIGNATURE_INVALID` - VP or VC signature verification failed
- `NONCE_MISMATCH` - Nonce doesn't match or expired
- `ISSUER_UNTRUSTED` - Issuer DID not in trusted_issuers table
- `CREDENTIAL_EXPIRED` - VC exp claim is in the past
- `CLAIM_INVALID` - Required claims missing or invalid format
- `HOLDER_BINDING_FAILED` - VP nonce doesn't match VC
- `FORMAT_ERROR` - VP/VC format not recognized

---

#### **STEP 6: Save Result & Update Session**

```
After validation (step 5.9 complete):

Backend (oid4vpService.getVerificationResult):
    → Update verification_sessions table:
        {
          id: sessionId,
          status: "SUCCESS" | "FAILED",
          completed_at: NOW(),
          holder_did: "did:key:z6...",
          disclosed_claims: {
            noBPJS: "0002155132710001",
            nama: "John Doe",
            nik: "3501234567890123",
            statusKepesertaan: "AKTIF",
            ...
          },
          raw_vp_token: "eyJhbGc...",
          error: null | "error message",
          reason_codes: ["CODE1", "CODE2"],
          verification_details: {
            checks: [...],
            issuer: "did:web:trusted-issuer.id",
            verifiedAt: NOW(),
            ...
          }
        }
    
    → Optionally save to verification_logs for audit trail:
        {
          request_id: sessionId,
          waktu: NOW(),
          nama_pasien: extracted_from_claims,
          tujuan_poli: "Poli Umum",
          status: "success" | "failed",
          verifier_id: current_user_id
        }
```

---

#### **STEP 7: Frontend Polls & Displays Result**

```
Frontend Polling (running since Step 1):
    → setInterval: GET /api/verify/result/{sessionId}
    
    First Poll (before wallet returns VP):
        Response: {status: "PENDING", claims: null}
        Action: Continue polling
    
    After Wallet Returns VP (Step 4):
        Response: {status: "SUCCESS", claims: {...}}
        Action:
            ✓ Clear interval
            ✓ Stop polling
            ✓ Display success screen with:
                - noBPJS
                - nama pasien
                - NIK
                - status kepesertaan: "AKTIF"
                - issued_at, expires_at
            ✓ Allow healthcare worker to proceed
    
    If Validation Failed (Step 5):
        Response: {status: "FAILED", error: "...", reasonCodes: [...]}
        Action:
            ✓ Clear interval
            ✓ Display error screen with:
                - Error message
                - Reason codes (translated)
                - Retry button to start over
    
    If Session Expired (>5 min):
        Response: {status: "EXPIRED"}
        Action:
            ✓ Clear interval
            ✓ Display "Session expired" message
            ✓ Show restart button
```

**Frontend Result Display:**
```
┌─────────────────────────────────────┐
│   VERIFICATION RESULT               │
├─────────────────────────────────────┤
│ Status: ✓ SUCCESS                   │
├─────────────────────────────────────┤
│ Verified Claims:                    │
│  • No. BPJS: 0002155132710001       │
│  • Nama: John Doe                   │
│  • NIK: 3501234567890123            │
│  • Tgl Lahir: 1990-01-01            │
│  • Status: AKTIF                    │
│  • Diterbitkan: 2024-01-15          │
│  • Berlaku Hingga: 2025-01-14       │
├─────────────────────────────────────┤
│ [LANJUTKAN] [CETAK] [BARU]          │
└─────────────────────────────────────┘
```

---

## 👥 ACTORS & STAKEHOLDERS

### Primary Actors
1. **Healthcare Worker (Verifier)**
   - Employee at healthcare facility (rumah sakit, puskesmas)
   - Uses dashboard to verify patient credentials
   - Scans patient to wallet app

2. **Patient (Holder)**
   - Has mobile wallet app with BPJS credential
   - Scans QR code to approve presentation
   - Shares credential with healthcare facility

3. **System Administrator**
   - Manages trusted issuers
   - Monitors verification logs
   - Manages user accounts

### Secondary Actors
4. **BPJS Issuer**
   - Issues BPJS healthcare credentials
   - Signs credentials with their private key
   - Published DID document

5. **DID Resolver Service**
   - Resolves DID → DID Document mapping
   - Returns public keys for verification
   - Cached locally for performance

6. **Credo-TS Agent**
   - OID4VP protocol handler
   - Session management
   - Request/Response formatting

---

## 💾 DATA ENTITIES

### 1. Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,  -- hashed with bcrypt
    name VARCHAR(255) NOT NULL,
    fasikes_name VARCHAR(255) NOT NULL,  -- facility name
    role VARCHAR(20) DEFAULT 'verifier',  -- 'admin' | 'verifier'
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**Sample Data:**
```
id: "550e8400-e29b-41d4-a716-446655440000"
email: "verifier@rumahsakit.id"
name: "Dr. Budi Santoso"
fasikes_name: "RS Mitra Sehat Jakarta"
role: "verifier"
```

---

### 2. Verification Sessions (OID4VP) Table
```sql
CREATE TABLE verification_sessions (
    id VARCHAR(100) PRIMARY KEY,  -- sessionId
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING|SUCCESS|FAILED|EXPIRED
    requested_at TIMESTAMP,
    completed_at TIMESTAMP,
    holder_did VARCHAR(500),
    disclosed_claims JSONB,
    raw_vp_token TEXT,
    error TEXT,
    expires_at TIMESTAMP,
    nonce VARCHAR(64),
    nonce_expires_at TIMESTAMP,
    state VARCHAR(64),
    used_at TIMESTAMP,
    reason_codes JSONB,  -- ["CODE1", "CODE2"]
    verification_details JSONB,
    qr_url TEXT
);
```

**Sample Data (Pending):**
```
id: "abc123-uuid-session"
status: "PENDING"
requested_at: 2024-01-15 10:30:00
completed_at: NULL
nonce: "nonce-xyz-123-abc"
state: "state-abc-456"
qr_url: "https://api.verifier.id/qr/abc123"
expires_at: 2024-01-15 10:35:00
```

**Sample Data (Success):**
```
id: "abc123-uuid-session"
status: "SUCCESS"
requested_at: 2024-01-15 10:30:00
completed_at: 2024-01-15 10:32:15
holder_did: "did:key:z6MkhaXgBZDvotDkL5257faWxcqV7E82NqWfYRSdjWPf"
disclosed_claims: {
    "noBPJS": "0002155132710001",
    "nik": "3501234567890123",
    "nama": "John Doe",
    "tanggalLahir": "1990-01-01",
    "statusKepesertaan": "AKTIF",
    "issuedAt": 1705315200,
    "expiresAt": 1736851200
}
raw_vp_token: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."
reason_codes: []
```

---

### 3. Verification Requests (Legacy) Table
```sql
CREATE TABLE verification_requests (
    id UUID PRIMARY KEY,
    request_id VARCHAR(100) UNIQUE NOT NULL,
    verifier_id VARCHAR(255) NOT NULL,
    attributes TEXT[] DEFAULT '{}',
    nonce VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',  -- pending|scanned|verified|failed
    qr_data TEXT NOT NULL
);
```

---

### 4. Trusted Issuers Table
```sql
CREATE TABLE trusted_issuers (
    id UUID PRIMARY KEY,
    did VARCHAR(500) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    public_key TEXT,
    endpoint VARCHAR(500) NOT NULL,
    verified BOOLEAN DEFAULT false,
    last_updated TIMESTAMP
);
```

**Sample Data:**
```
did: "did:web:bpjs.go.id"
name: "BPJS Kesehatan (Official)"
public_key: "z6MkhaXgBZDvotDkL5257faWxcqV7E82NqWfYRSdjWPf"
endpoint: "https://did.bpjs.go.id"
verified: true
```

---

### 5. Verification Logs (Audit Trail) Table
```sql
CREATE TABLE verification_logs (
    id UUID PRIMARY KEY,
    request_id VARCHAR(100) NOT NULL,
    waktu TIMESTAMP DEFAULT NOW(),
    nama_pasien VARCHAR(255) NOT NULL,
    tujuan_poli VARCHAR(255) DEFAULT 'Poli Umum',
    status VARCHAR(20),  -- success|failed
    verifier_id VARCHAR(255) NOT NULL
);
```

---

## 🏗️ SYSTEM COMPONENTS

### A. Frontend Components
```
frontend1/
├── app/
│   ├── login/
│   │   └── Login Form (email, password)
│   ├── dashboard/
│   │   └── Verifier Dashboard (start verification)
│   └── verifier/
│       └── Verification Page (QR display, result polling)
├── components/
│   ├── verifier/
│   │   ├── QRDisplay (shows QR code)
│   │   ├── VerificationStatus (loading, success, failed)
│   │   └── ResultDisplay (shows verified claims)
│   └── ui/ (Radix UI components)
├── services/
│   ├── authApi.ts (login, register)
│   └── verifierApi.ts (verify/start, verify/result/:sessionId)
└── types/
    └── verifier.ts (TypeScript interfaces)
```

### B. Backend Routes
```
backend/src/routes/
├── authRoutes.ts
│   ├── POST /api/auth/register
│   ├── POST /api/auth/login
│   ├── POST /api/auth/logout
│   └── POST /api/auth/refresh
├── oid4vpRoutes.ts
│   ├── POST /api/verify/start
│   ├── GET  /api/verify/result/:sessionId
│   ├── GET  /api/verify/sessions (admin)
│   └── GET  /api/verify/info
├── verificationRoutes.ts (legacy)
│   ├── POST /api/verification/create
│   └── GET  /api/verification/:requestId/status
├── didRoutes.ts
│   └── GET  /api/did/:did/resolve
└── issuerRoutes.ts
    └── GET  /api/issuers/trusted
```

### C. Backend Controllers
```
src/controllers/
├── authController.ts
│   ├── register(req, res)
│   └── login(req, res)
├── oid4vpController.ts
│   ├── startVerification(req, res)
│   ├── getResult(req, res, sessionId)
│   └── getVerifierInfo(req, res)
├── verificationController.ts (legacy)
│   ├── createRequest(req, res)
│   └── getRequestStatus(req, res)
├── didController.ts
│   └── resolveDid(req, res, did)
└── issuerController.ts
    └── getTrustedIssuers(req, res)
```

### D. Backend Services
```
src/services/
├── authService.ts
│   ├── register(data)
│   ├── login(email, password)
│   └── generateToken(user)
├── oid4vpService.ts
│   ├── startVerification()
│   └── getVerificationResult(sessionId)
├── verificationService.ts (legacy)
│   ├── createRequest(verifierId, attributes)
│   └── getRequest(requestId)
├── vpValidatorService.ts
│   └── verifyPresentation(vpToken) [9-step validation]
├── didService.ts
│   └── resolveDid(did)
├── issuerResolverService.ts
│   └── resolveIssuer(issuerDid)
├── policyEngine.ts
│   └── enforceDisclosurePolicy(claims, definition)
├── sdJwtDisclosureService.ts
│   └── parseDisclosureToken(token)
└── descriptorValidationService.ts
    └── validateDescriptorMap(presentation)
```

### E. Credo-TS Integration
```
src/credo-verifier.ts
├── initCredoVerifier()
│   └── Creates Credo Agent with OID4VP Module
├── getCredoAgent()
│   └── Returns initialized agent
├── BPJS_PRESENTATION_DEFINITION
│   └── Specifies required credential format
└── OpenId4VcVerificationSessionState
    └── Enum: PENDING, COMPLETED, ERRORED
```

---

## 🔄 SEQUENCE DIAGRAM FLOWS

### SEQUENCE 1: LOGIN FLOW

```
User                Frontend              Backend            Database
 │                     │                    │                  │
 ├─ Click Login        │                    │                  │
 ├────────────────────>│                    │                  │
 │  enter email/pwd    │                    │                  │
 │                     │                    │                  │
 │                     ├─ POST /api/auth/login
 │                     ├──────────────────> │                  │
 │                     │   {email, password}
 │                     │                    │                  │
 │                     │                    ├─ Find user by email
 │                     │                    ├─────────────────>│
 │                     │                    │<─ user_record ───┤
 │                     │                    │                  │
 │                     │                    ├─ bcrypt.compare()
 │                     │                    │ (verify password)
 │                     │                    │                  │
 │                     │  201 Success       │                  │
 │                     │<─────────────────┤  │                  │
 │                     │  {token, user}    │                  │
 │                     │                    │                  │
 │  <────────────────┤                    │                  │
 │   Redirect to      │                    │                  │
 │   Dashboard        │                    │                  │
 │                     │                    │                  │
```

---

### SEQUENCE 2: OID4VP VERIFICATION FLOW (Complete)

```
Healthcare Worker   Frontend            Backend (Credo)      Database        DID Resolver    Wallet
    │                  │                      │                  │                │            │
    ├─ Click           │                      │                  │                │            │
    │ "Verify" Button  │                      │                  │                │            │
    ├────────────────>│                       │                  │                │            │
    │                  │                      │                  │                │            │
    │                  ├──Step 1: Start Verification
    │                  ├─ POST /api/verify/start
    │                  ├───────────────────────>│                │                │            │
    │                  │                      │ Generate nonce    │                │            │
    │                  │                      │ Generate state    │                │            │
    │                  │                      │ Create sessionId  │                │            │
    │                  │                      │ Build Auth Request
    │                  │                      │ Generate QR URL   │                │            │
    │                  │                      ├─ INSERT session ─>│                │            │
    │                  │                      │ (status: PENDING)
    │                  │ 201 {qrUrl, sessionId, nonce, state}     │                │            │
    │                  │<──────────────────────┤                │                │            │
    │                  │                      │                  │                │            │
    │  <─ Display QR ─┤                      │                  │                │            │
    │                  │                      │                  │                │            │
    │  ┌──────────────┐│                      │                  │                │            │
    │  │ QR Code      ││                      │                  │                │            │
    │  │ Display      ││                      │                  │                │            │
    │  └──────────────┘│                      │                  │                │            │
    │                  │                      │                  │                │            │
    │                  ├──Step 2 & 3: Poll (Frontend starts) & Holder Scans
    │                  │ GET /api/verify/result/{sessionId}       │                │            │
    │                  ├──────────────────────(every 2 sec)───────>│                │            │
    │                  │ Query DB (status still PENDING)          │                │            │
    │                  │ 200 {status: PENDING}                    │                │            │
    │                  │<──────────────────────┤                │                │            │
    │                  │                      │                  │                │            │
    │                  │                      │                  │                │            │
    │                  │                      │                  │                │            │
    │   [Patient       │                      │                  │                │            │
    │    scans QR]     │                      │                  │                │            │
    │                  │                      │                  │                │            │
    │                  │                      │                  │                │ Request    │
    │                  │                      │                  │                │ Auth Req   │
    │                  │                      │                  │                │<───────────┤
    │                  │                      │                  │                │            │
    │                  │                      │ GET /request?state
    │                  │                      ├─────────────────>│                │            │
    │                  │                      │<─ Auth Request ──┤                │            │
    │                  │                      │                  │                │            │
    │                  │                      │                  │                │ Auth Req   │
    │                  │                      │                  │                ├───────────>│
    │                  │                      │                  │                │            │
    │                  │                      │                  │                │  [User    │
    │                  │                      │                  │                │   approves]
    │                  │                      │                  │                │            │
    │                  │                      │                  │    ┌──Step 4: Sign & Send VP
    │                  │                      │                  │    │ [Wallet signs VP]
    │                  │                      │                  │    │ [VC inside VP]
    │                  │                      │                  │    │                         │
    │                  │                      ├─ POST /callback ──────────────────────────────<┤
    │                  │                      │ {vp_token, state} │                │            │
    │                  │                      │                  │                │            │
    │                  │  ┌──Step 5: Validate VP Token (9-step process)
    │                  │  │ 1. Decode VP JWT header               │                │            │
    │                  │  │ 2. Resolve holder DID ─────────────────────────────> │            │
    │                  │  │    <─ DID Document ──────────────────────────────────┤            │
    │                  │  │ 3. Verify VP signature                │                │            │
    │                  │  │ 4. Check nonce ─────────────>│ (nonce valid?)       │            │
    │                  │  │    <─ ✓ valid ───────────────┤                │            │
    │                  │  │ 5. Decode VC JWT (issuer)     │                │            │
    │                  │  │ 6. Resolve issuer DID ─────────────────────────────> │            │
    │                  │  │    <─ DID Document ──────────────────────────────────┤            │
    │                  │  │ 7. Verify VC signature         │                │            │
    │                  │  │ 8. Validate VC claims          │                │            │
    │                  │  │ 9. Extract required claims     │                │            │
    │                  │  │                                │                │            │
    │                  │  ├─ UPDATE session ─────────────> │                │            │
    │                  │  │ (status: SUCCESS|FAILED)       │ (Update DB)          │            │
    │                  │  │ (disclosed_claims: {...})      │                │            │
    │                  │  │ (reason_codes: [...])          │                │            │
    │                  │  └──Step 6: Save result complete
    │                  │                      │                  │                │            │
    │                  ├─ GET /api/verify/result/{sessionId}
    │                  ├───────────────────────>│                │                │            │
    │                  │ Query DB (status now SUCCESS)    │                │            │
    │                  │ 200 {status: SUCCESS, claims: {...}}     │                │            │
    │                  │<──────────────────────┤                │                │            │
    │                  │                      │                  │                │            │
    │  <─ Step 7: Display Result
    │  ┌──────────────┐   │                      │                  │                │            │
    │  │ VERIFIED ✓   │───┤                      │                  │                │            │
    │  │ No. BPJS:... │   │                      │                  │                │            │
    │  │ Nama: ...    │   │                      │                  │                │            │
    │  │ Status: AKTIF│   │                      │                  │                │            │
    │  └──────────────┘   │                      │                  │                │            │
    │                  │                      │                  │                │            │
```

---

### SEQUENCE 3: VP TOKEN VALIDATION (9-STEP DETAIL)

```
Frontend                Backend             DID Resolver    Trusted Issuers    Crypto Module
    │                     │                      │                  │                 │
    │ POST VP Token       │                      │                  │                 │
    ├────────────────────>│                      │                  │                 │
    │ {vp_token, state}   │                      │                  │                 │
    │                     │                      │                  │                 │
    │ ┌─ STEP 1: Decode VP JWT Header
    │ │ Extract: {alg: "EdDSA", typ: "JWT"}     │                  │                 │
    │ │ Verify alg is trusted                    │                  │                 │
    │ └─> Continue to STEP 2                     │                  │                 │
    │                     │                      │                  │                 │
    │ ┌─ STEP 2: Resolve Holder DID
    │ │ Extract from VP: holder_did              │                  │                 │
    │ │ "did:key:z6MkhaXgBZDvotDkL5257..."      │                  │                 │
    │ │                     ├─ Resolve DID ─────>│                  │                 │
    │ │                     │<─ DID Document ───┤                  │                 │
    │ │                     │ (extract public_key)
    │ └─> Continue to STEP 3                     │                  │                 │
    │                     │                      │                  │                 │
    │ ┌─ STEP 3: Verify VP Signature
    │ │ Use holder's public_key                  │                  │                 │
    │ │                     ├─ crypto.subtle.verify ────────────────────────────────>│
    │ │                     │<─ ✓ Signature valid ────────────────────────────────┤
    │ └─> Continue to STEP 4                     │                  │                 │
    │                     │                      │                  │                 │
    │ ┌─ STEP 4: Check Nonce (Anti-Replay)
    │ │ Extract from VP: nonce = "nonce-xyz"    │                  │                 │
    │ │ Query DB verification_sessions          │                  │                 │
    │ │ Match nonce: ✓ Valid                    │                  │                 │
    │ │ Check expiration: ✓ Not expired         │                  │                 │
    │ └─> Continue to STEP 5                     │                  │                 │
    │                     │                      │                  │                 │
    │ ┌─ STEP 5: Decode VC JWT (Extract Issuer)
    │ │ From VP, extract VC JWT                  │                  │                 │
    │ │ Decode: {iss: "did:web:trusted-issuer.id"}              │                 │
    │ │ Check if issuer in trusted list          ├─ Query issuer ──>│                 │
    │ │                     │<─ Issuer found ────┤                  │                 │
    │ └─> Continue to STEP 6                     │                  │                 │
    │                     │                      │                  │                 │
    │ ┌─ STEP 6: Resolve Issuer DID
    │ │ Fetch issuer DID Document                │                  │                 │
    │ │                     ├─ Resolve DID ─────>│                  │                 │
    │ │                     │<─ DID Document ───┤                  │                 │
    │ │                     │ (extract public_key)
    │ └─> Continue to STEP 7                     │                  │                 │
    │                     │                      │                  │                 │
    │ ┌─ STEP 7: Verify VC Signature
    │ │ Use issuer's public_key                  │                  │                 │
    │ │                     ├─ crypto.subtle.verify ────────────────────────────────>│
    │ │                     │<─ ✓ Signature valid ────────────────────────────────┤
    │ └─> Continue to STEP 8                     │                  │                 │
    │                     │                      │                  │                 │
    │ ┌─ STEP 8: Validate VC Claims
    │ │ Check nbf (not before): ✓ OK             │                  │                 │
    │ │ Check exp (expiration): ✓ OK             │                  │                 │
    │ │ Check credential type: ✓ KartuBPJSKesehatan
    │ │ Check holder binding: ✓ Nonce matches    │                  │                 │
    │ │ Extract credentialSubject claims         │                  │                 │
    │ └─> Continue to STEP 9                     │                  │                 │
    │                     │                      │                  │                 │
    │ ┌─ STEP 9: Extract Required Claims
    │ │ From VC: {noBPJS, nik, nama, ...}       │                  │                 │
    │ │ Apply disclosure policy                  │                  │                 │
    │ │ Sanitize claims                          │                  │                 │
    │ │ Build final verification result          │                  │                 │
    │ └─ COMPLETE                                │                  │                 │
    │                     │                      │                  │                 │
    │ Result: {status: SUCCESS, claims: {...}}   │                  │                 │
    │<────────────────────┤                      │                  │                 │
    │                     │                      │                  │                 │
```

---

## 📈 ACTIVITY DIAGRAM FLOWS

### ACTIVITY 1: LOGIN PROCESS

```
START

│
├─> [Display Login Page]
│   ├─ Email input field
│   ├─ Password input field
│   └─ Login button
│
├─> [User Enters Credentials]
│   ├─ email: verifier@rumahsakit.id
│   └─ password: ****
│
├─> [User Clicks "Login"]
│
├─> [Validate Input]
│   ├─ Check email format (regex)
│   ├─ Check password length (min 6)
│   └─ [Decision: Input Valid?]
│       ├─ NO ──> [Display Validation Error]
│       │         └─> [Repeat from "User Enters Credentials"]
│       └─ YES ──> Continue
│
├─> [Send POST /api/auth/login]
│   ├─ email, password
│   └─ [Wait for response]
│
├─> [Server: Query Database]
│   ├─ SELECT * FROM users WHERE email = ?
│   ├─ [Decision: User Found?]
│   │   ├─ NO ──> [Return 401 Error]
│   │   └─ YES ──> Continue
│   └─
├─> [Server: Compare Passwords]
│   ├─ bcrypt.compare(password, hashedPassword)
│   ├─ [Decision: Password Valid?]
│   │   ├─ NO ──> [Return 401 Error]
│   │   └─ YES ──> Continue
│
├─> [Server: Generate JWT Token]
│   ├─ Payload: {userId, email, name, role}
│   ├─ Sign with secret key
│   └─ Return {success: true, token, user}
│
├─> [Frontend: Receive Token]
│   ├─ Store in localStorage
│   ├─ Set Authorization header
│   └─ Redirect to /dashboard
│
├─> [Display Dashboard]
│   └─ Show: "Welcome, Dr. Budi Santoso!"
│
END
```

---

### ACTIVITY 2: OID4VP VERIFICATION (Main Process)

```
START

│
├─> [Healthcare Worker: Click "Start Verification"]
│   │
│   ├─> [Frontend: POST /api/verify/start]
│   │   ├─ No parameters needed
│   │   └─ [Wait for response]
│   │
│   ├─> [Backend: Generate Authorization Request]
│   │   ├─ Generate nonce (random 32-char string)
│   │   ├─ Generate state (random 32-char string)
│   │   ├─ Create sessionId (UUID)
│   │   ├─ Create expiresAt = NOW() + 5 minutes
│   │   ├─ Include BPJS_PRESENTATION_DEFINITION
│   │   └─ Build full Authorization Request
│   │
│   ├─> [Backend: Database Insert]
│   │   ├─ INSERT INTO verification_sessions
│   │   │   (id, status, nonce, state, requested_at, expires_at, ...)
│   │   │   VALUES (sessionId, 'PENDING', nonce, state, ...)
│   │   └─ [DB Confirm: Insert successful]
│   │
│   ├─> [Backend: Generate QR Code]
│   │   ├─ QR encodes: request_uri with state parameter
│   │   ├─ QR URL: /qr/{sessionId}
│   │   └─ Return to frontend
│   │
│   ├─> [Frontend: Receive Response]
│   │   └─ {sessionId, qrUrl, nonce, state, expiresAt, deepLink}
│   │
│   ├─> [Frontend: Display QR Code]
│   │   └─ Show QR image to healthcare worker
│   │
│   ├─> [Frontend: Start Polling Loop]
│   │   ├─ Every 2 seconds:
│   │   ├─ GET /api/verify/result/{sessionId}
│   │   └─ [Wait for response: status = ?]
│   │
│   └─> [Status Decision Node]
│       ├─ PENDING ──> [Wait & Continue Polling]
│       ├─ SUCCESS ──> [Stop Polling, Continue]
│       ├─ FAILED ──> [Stop Polling, Continue]
│       └─ EXPIRED ──> [Stop Polling, Show Error]
│
├─ [Parallel: Holder Scans QR]
│  │
│  ├─> [Patient: Takes Phone/Wallet]
│  │
│  ├─> [Holder: Scans QR Code]
│  │   └─ Camera app captures QR image
│  │
│  ├─> [Wallet App: Decode QR]
│  │   ├─ Extract request_uri parameter
│  │   └─ Open Wallet application
│  │
│  ├─> [Wallet: Fetch Authorization Request]
│  │   ├─ GET /request?state={state}
│  │   ├─ [Backend Credo: Send Auth Request]
│  │   └─ [Wallet: Receive full Authorization Request]
│  │
│  ├─> [Wallet: Show Credential Selection]
│  │   ├─ Display available BPJS credentials
│  │   └─ User selects: "BPJS Kesehatan - No. 0002155132710001"
│  │
│  ├─> [Wallet: Show Claims Review]
│  │   ├─ Display claims to be shared:
│  │   │   - No. BPJS
│  │   │   - NIK
│  │   │   - Nama
│  │   │   - Status Kepesertaan
│  │   └─ User approves presentation
│  │
│  ├─> [Wallet: Sign Verifiable Presentation]
│  │   ├─ Retrieve holder's private key
│  │   ├─ Create VP JSON:
│  │   │   {
│  │   │     "@context": "...",
│  │   │     "type": ["VerifiablePresentation"],
│  │   │     "verifiableCredential": [VC_JWT_TOKEN]
│  │   │   }
│  │   ├─ Sign with EdDSA algorithm
│  │   └─ Create VP JWT token
│  │
│  ├─> [Wallet: Send VP to Backend]
│  │   ├─ POST /callback
│  │   │   {
│  │   │     vp_token: "eyJhbGc...",
│  │   │     state: "state-abc-456",
│  │   │     presentation_submission: {...}
│  │   │   }
│  │   └─ [Backend Credo: Receive VP]
│  │
│  └─
│
├─> [Backend: Validate VP Token (9-Step Process)]
│   │
│   ├─ STEP 1: Decode VP JWT Header
│   │   ├─ Extract: alg, typ, kid
│   │   └─ [Decision: Algorithm Valid?] ──NO─> [Fail: Invalid Algorithm]
│   │                                  └─YES─> STEP 2
│   │
│   ├─ STEP 2: Resolve Holder DID
│   │   ├─ Extract holder_did from VP payload
│   │   ├─ Query DID Resolver (cached)
│   │   └─ [Decision: DID Resolved?] ──NO─> [Fail: DID Not Found]
│   │                               └─YES─> STEP 3
│   │
│   ├─ STEP 3: Verify VP Signature (Holder's Key)
│   │   ├─ Use crypto.subtle.verify with holder's public key
│   │   └─ [Decision: Signature Valid?] ──NO─> [Fail: VP_SIGNATURE_INVALID]
│   │                                  └─YES─> STEP 4
│   │
│   ├─ STEP 4: Check Nonce (Anti-Replay)
│   │   ├─ Extract nonce from VP payload
│   │   ├─ Query DB: SELECT from verification_sessions WHERE nonce
│   │   ├─ Check: nonce_expires_at > NOW()
│   │   └─ [Decision: Nonce Valid?] ──NO─> [Fail: NONCE_MISMATCH]
│   │                            └─YES─> STEP 5
│   │
│   ├─ STEP 5: Decode VC JWT (Extract Issuer)
│   │   ├─ From VP, extract VC JWT from verifiableCredential
│   │   ├─ Decode JWT payload
│   │   ├─ Extract issuer_did from VC
│   │   ├─ Query DB: SELECT from trusted_issuers WHERE did = issuer_did
│   │   └─ [Decision: Issuer Trusted?] ──NO─> [Fail: ISSUER_UNTRUSTED]
│   │                              └─YES─> STEP 6
│   │
│   ├─ STEP 6: Resolve Issuer DID
│   │   ├─ Query DID Resolver for issuer_did
│   │   ├─ Cache result (didCache)
│   │   └─ [Decision: DID Resolved?] ──NO─> [Fail: Issuer DID Not Found]
│   │                               └─YES─> STEP 7
│   │
│   ├─ STEP 7: Verify VC Signature (Issuer's Key)
│   │   ├─ Use crypto.subtle.verify with issuer's public key
│   │   └─ [Decision: Signature Valid?] ──NO─> [Fail: VC_SIGNATURE_INVALID]
│   │                                  └─YES─> STEP 8
│   │
│   ├─ STEP 8: Validate VC Claims
│   │   ├─ Check nbf (not before): ✓
│   │   ├─ Check exp (expiration): ✓
│   │   ├─ Check credential type: "KartuBPJSKesehatan"
│   │   ├─ Check holder binding (nonce match)
│   │   └─ [Decision: All Claims Valid?] ──NO─> [Fail: CLAIM_INVALID]
│   │                              └─YES─> STEP 9
│   │
│   ├─ STEP 9: Extract Required Claims
│   │   ├─ From VC credentialSubject:
│   │   │   - noBPJS
│   │   │   - nik
│   │   │   - nama
│   │   │   - tanggalLahir
│   │   │   - statusKepesertaan
│   │   ├─ Apply disclosure policy
│   │   ├─ Sanitize claims
│   │   └─ [Final Verification Status: SUCCESS]
│   │
│   └─
│
├─> [Backend: Collect Verification Outcome]
│   ├─ [Decision: All Checks Passed?]
│   │   ├─ YES ──> Status = "SUCCESS"
│   │   │         reasonCodes = []
│   │   └─ NO  ──> Status = "FAILED"
│   │             reasonCodes = [failed checks]
│   │
│   └─ Update verification_sessions:
│       ├─ id = sessionId
│       ├─ status = SUCCESS | FAILED
│       ├─ completed_at = NOW()
│       ├─ holder_did = "did:key:..."
│       ├─ disclosed_claims = {...}
│       ├─ raw_vp_token = "eyJhbGc..."
│       ├─ reason_codes = [...]
│       └─ [DB: Update confirmed]
│
├─> [Frontend: Poll Result (Polling loop from earlier)]
│   ├─ GET /api/verify/result/{sessionId}
│   ├─ [Backend: Query DB status]
│   ├─ [Response: status = SUCCESS | FAILED]
│   └─ [Decision: Terminal status?]
│       ├─ YES ──> Continue
│       └─ NO  ──> [Wait 2 seconds, re-poll]
│
├─> [Frontend: Receive Final Result]
│   ├─ [Decision: Status = SUCCESS?]
│   │   │
│   │   ├─ YES ──> [Display Success Screen]
│   │   │          ├─ Show verified claims:
│   │   │          │   - No. BPJS: 0002155132710001
│   │   │          │   - Nama: John Doe
│   │   │          │   - NIK: 3501234567890123
│   │   │          │   - Status: AKTIF
│   │   │          │   - Berlaku hingga: 2025-01-14
│   │   │          ├─ Show buttons: [Lanjutkan] [Cetak] [Baru]
│   │   │          └─ Healthcare worker can proceed
│   │   │
│   │   └─ NO  ──> [Display Failed Screen]
│   │              ├─ Show error message
│   │              ├─ Show reason codes (translated):
│   │              │   "Credential expired"
│   │              │   "Issuer not trusted"
│   │              │   etc.
│   │              └─ Show [Retry] button
│   │
│   └─
│
└─ END
```

---

## 🔌 INTEGRATION POINTS

### 1. Credo-TS OID4VP Module
- **Location:** `src/credo-verifier.ts`
- **Purpose:** OpenID4VC Verifier protocol implementation
- **Auto-registered Routes:**
  - `GET /request?state={state}` - Serve Authorization Request
  - `POST /callback` - Receive VP token
  - `GET /status?state={state}` - Check verification status (optional)

### 2. DID Resolver
- **Purpose:** Resolve DID → DID Document → Public Keys
- **Supported DIDs:**
  - `did:web` (Web-based DIDs)
  - `did:key` (Key-based DIDs)
  - `did:jwk` (JWK-based DIDs)
- **Caching:** didCache (in-memory with TTL)

### 3. PostgreSQL Database
- **Pool Size:** 20 connections
- **Connection Timeout:** 10 seconds
- **Idle Timeout:** 30 seconds
- **Tables:** users, verification_sessions, verification_requests, trusted_issuers, verification_logs

### 4. JWT Token Management
- **Algorithm:** EdDSA (Ed25519) or ES256
- **Token Structure:**
  ```
  header: {alg: "EdDSA", typ: "JWT"}
  payload: {
    userId: "uuid",
    email: "user@example.com",
    name: "Dr. Budi",
    role: "verifier",
    iat: 1234567890,
    exp: 1234571490  // 1 hour expiry
  }
  ```
- **Secret Key:** Loaded from environment (`.env`)

### 5. Express Middleware Stack
```
Request Flow:
  ↓
[Helmet Security Headers]
  ↓
[CORS Handler]
  ↓
[Body Parser (10MB limit)]
  ↓
[Rate Limiters (API, Auth)]
  ↓
[Sanitization (XSS, HPP)]
  ↓
[Request Logging]
  ↓
[Route Handlers]
  ↓
[Error Handler]
```

### 6. QR Code Generation
- **Library:** (specified in codebase)
- **Format:** Encodes request_uri with state parameter
- **URL Pattern:** `/qr/{sessionId}`
- **Displayed to:** Healthcare Worker

### 7. SD-JWT (Selective Disclosure JWT)
- **Purpose:** Support for credentials that allow selective disclosure
- **Format:** `vc+sd-jwt` (alternative to `jwt_vc`)
- **Service:** `sdJwtDisclosureService.ts`
- **Use Case:** Holder can hide non-essential claims while sharing required ones

---

## 🔐 SECURITY CONSIDERATIONS

### Authentication
- JWT-based with EdDSA signatures
- Passwords hashed with bcrypt (salt rounds: 10)
- Token expiry: 1 hour

### Validation
- Signature verification on VP and VC tokens
- Nonce validation (prevents replay attacks)
- Issuer trust list (only accept credentials from trusted issuers)
- Claim validation (exp, nbf, type checking)

### Rate Limiting
- API Limiter: 100 requests per 15 minutes per IP
- Auth Limiter: 5 login attempts per 15 minutes per IP

### Input Sanitization
- DOMPurify for XSS protection
- HPP (HTTP Parameter Pollution) protection
- Request size limit: 10MB

### Network Security
- CORS configured for specific origins
- HTTPS required in production
- Content Security Policy headers
- X-Frame-Options: deny (prevent clickjacking)

---

## 📊 DATA FLOW SUMMARY

```
1. User Login
   Browser → Frontend → Backend (authService) → Database
   ← JWT Token ←

2. Start Verification
   Frontend → Backend (oid4vpController) → Credo Agent
   ↓
   Database (insert session)
   → Generate QR → Frontend displays QR

3. Holder Scans QR
   Wallet App reads QR → Contacts backend
   Backend (Credo) sends Authorization Request → Wallet

4. Wallet Approves & Signs
   Wallet creates VP with VC inside
   POST /callback → Backend (Credo handles)

5. Backend Validates (9-step)
   vpValidatorService (9 verification steps)
   ↓
   Query DID Resolver (cache)
   Query Database (nonce, issuer)
   Crypto verification
   ↓
   Database (update session with result)

6. Frontend Polls
   Every 2 seconds: GET /api/verify/result/{sessionId}
   Response: {status, claims, reasonCodes}
   Display result when status !== PENDING

7. Display Result
   Frontend shows verified claims to healthcare worker
```

---

## 🎓 KEY CONCEPTS FOR DIAGRAMS

### For Sequence Diagrams:
- **Actors:** Healthcare Worker, Frontend, Backend, Database, DID Resolver, Wallet
- **Messages:** HTTP requests/responses, database queries, DID resolutions
- **Order:** Sequential steps 1-7
- **Decision Points:** Validation checks, status polling

### For Activity Diagrams:
- **Activities:** Login, Start Verification, Validate VP, Poll Result, Display Result
- **Decision Nodes:** Input validation, signature verification, issuer check, nonce validity
- **Parallel Paths:** Frontend polling + Holder scanning + Backend processing
- **End States:** Success or Failed verification

### For Use Case Diagrams:
- **Actors:** Healthcare Worker, Patient/Holder, System Administrator, BPJS Issuer
- **Use Cases:** Login, Verify Credential, View History, Manage Trusted Issuers
- **Relationships:** Include, extend, generalization

---

## 📝 EXAMPLE DATA FOR DIAGRAMS

### JWT Token Example
```json
Header: {
  "alg": "EdDSA",
  "typ": "JWT"
}

Payload: {
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "verifier@rumahsakit.id",
  "name": "Dr. Budi Santoso",
  "role": "verifier",
  "iat": 1705315200,
  "exp": 1705318800
}

Signature: [EdDSA signature hex string]
```

### VP Token Structure
```json
{
  "vp_token": "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVQcmVzZW50YXRpb24iXSwidmVyaWZpYWJsZUNyZWRlbnRpYWwiOlsiZXlKaGJHY2lPaUpGVXpJMU5pd2lkSGx3SWpvaU1Td2lZV3hzYjJOaGRHbHZiaUk2SWpBdU1EQXlNakl3TVRBd01Td2liV0ZwYkhNaU9sdDBjblZ1YzNSTmIzUnlJbDA4TENKMGVIQWlPaUkwTmpVM01EYzBNalFpZlN3aVlXeHNiMk5oZEdsdmJpSTZJakF1TURBMWRIQjBkSE02THk5M2QzY3ViMzluTDJGc2RHVmZjbWN2TVRCRUlpd2liV0ZwYkhNaU9sdDBjblZ1YzNSTmIzUnlJbDA4TENKMGVIQWlPaUkwTjBSVFRVRkJVMVJVSWZTd2lZV3hzYjJOaGRHbHZiaUk2SWpRNU5EQTBOREEyTXpjeElpd2liV0ZwYkhNaU9sdDBjblZ1YzNSTmIzUnlJbDA....",
  "state": "state-abc-456",
  "presentation_submission": {
    "id": "a30e3b91-fb77-4d22-95fa-871689c322e2",
    "definition_id": "bpjs-credential-request",
    "descriptor_map": [
      {
        "id": "bpjs-health-credential",
        "format": "jwt_vc",
        "path": "$.verifiableCredential[0]"
      }
    ]
  }
}
```

### Verification Result Example (Success)
```json
{
  "status": "SUCCESS",
  "claims": {
    "noBPJS": "0002155132710001",
    "nik": "3501234567890123",
    "nama": "John Doe",
    "tanggalLahir": "1990-01-01",
    "statusKepesertaan": "AKTIF",
    "issuedAt": 1705315200,
    "expiresAt": 1736851200
  },
  "holderDid": "did:key:z6MkhaXgBZDvotDkL5257faWxcqV7E82NqWfYRSdjWPf",
  "reasonCodes": []
}
```

### Verification Result Example (Failed)
```json
{
  "status": "FAILED",
  "claims": null,
  "holderDid": null,
  "error": "Credential has expired",
  "reasonCodes": [
    "CREDENTIAL_EXPIRED",
    "VC_SIGNATURE_INVALID"
  ]
}
```

---

**Dokumen ini lengkap dan siap digunakan untuk membuat Activity Diagram, Sequence Diagram, Class Diagram, dan Use Case Diagram yang komprehensif.**
