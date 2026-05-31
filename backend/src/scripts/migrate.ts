import { query, testConnection, closePool } from '../config/database.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Database migration script
 * Creates all tables for the Verifier application
 */
async function migrate() {
  console.log('🚀 Starting database migration...\n');

  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to database. Aborting migration.');
    process.exit(1);
  }

  try {
    // ==========================================
    // 1. Create UUID extension
    // ==========================================
    console.log('Step 1: Enabling UUID extension...');
    await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    console.log('✅ UUID extension enabled\n');

    // ==========================================
    // 2. Create Users table
    // ==========================================
    console.log('Step 2: Creating users table...');
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        fasikes_name VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'verifier' CHECK (role IN ('admin', 'verifier')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Users table created\n');

    // ==========================================
    // 3. Create Verification Requests table
    // ==========================================
    console.log('Step 3: Creating verification_requests table...');
    await query(`
      CREATE TABLE IF NOT EXISTS verification_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        request_id VARCHAR(100) UNIQUE NOT NULL,
        verifier_id VARCHAR(255) NOT NULL,
        attributes TEXT[] NOT NULL DEFAULT '{}',
        nonce VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scanned', 'verified', 'failed')),
        qr_data TEXT NOT NULL
      );
    `);
    console.log('✅ Verification requests table created\n');

    // ==========================================
    // 4. Create Verification Results table
    // ==========================================
    console.log('Step 4: Creating verification_results table...');
    await query(`
      CREATE TABLE IF NOT EXISTS verification_results (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        request_id VARCHAR(100) NOT NULL REFERENCES verification_requests(request_id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
        patient_data JSONB,
        error_message TEXT,
        verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Verification results table created\n');

    // ==========================================
    // 5. Create Verification Logs table
    // ==========================================
    console.log('Step 5: Creating verification_logs table...');
    await query(`
      CREATE TABLE IF NOT EXISTS verification_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        request_id VARCHAR(100) NOT NULL,
        waktu TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        nama_pasien VARCHAR(255) NOT NULL,
        tujuan_poli VARCHAR(255) NOT NULL DEFAULT 'Poli Umum',
        status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
        verifier_id VARCHAR(255) NOT NULL
      );
    `);
    console.log('✅ Verification logs table created\n');

    // ==========================================
    // 6. Create Trusted Issuers table
    // ==========================================
    console.log('Step 6: Creating trusted_issuers table...');
    await query(`
      CREATE TABLE IF NOT EXISTS trusted_issuers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        did VARCHAR(500) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        public_key TEXT,
        endpoint VARCHAR(500) NOT NULL,
        verified BOOLEAN NOT NULL DEFAULT false,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Trusted issuers table created\n');

    // ==========================================
    // 7. Create Verification Sessions table (OID4VP / Credo-TS)
    // ==========================================
    console.log('Step 7: Creating verification_sessions table (OID4VP)...');
    await query(`
      CREATE TABLE IF NOT EXISTS verification_sessions (
        id VARCHAR(100) PRIMARY KEY,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED')),
        requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        holder_did VARCHAR(500),
        disclosed_claims JSONB,
        raw_vp_token TEXT,
        error TEXT,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);
    console.log('✅ Verification sessions table created\n');

    // ==========================================    // 7b. Add nonce / state / qr_url columns (idempotent ALTER TABLE)
    // ==========================================
    console.log('Step 7b: Adding nonce/state/qr_url columns (OID4VP flow)...');
    await query(`ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS nonce VARCHAR(64);`);
    await query(`ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS nonce_expires_at TIMESTAMP WITH TIME ZONE;`);
    await query(`ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS state VARCHAR(64);`);
    await query(`ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE;`);
    await query(`ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb;`);
    await query(`ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS verification_details JSONB;`);
    await query(`ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS qr_url TEXT;`);
    console.log('\u2705 Columns nonce, nonce_expires_at, state, used_at, reason_codes, verification_details, qr_url added (or already exist)\n');

    // ==========================================    // 8. Create indexes
    // ==========================================
    console.log('Step 8: Creating indexes...');
    await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_verification_requests_request_id ON verification_requests(request_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_verification_results_request_id ON verification_results(request_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_verification_logs_verifier_id ON verification_logs(verifier_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_verification_logs_waktu ON verification_logs(waktu DESC);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_trusted_issuers_did ON trusted_issuers(did);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_verification_sessions_status ON verification_sessions(status);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_verification_sessions_expires ON verification_sessions(expires_at);`);    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_sessions_state ON verification_sessions(state) WHERE state IS NOT NULL;`);    console.log('✅ Indexes created\n');

    // ==========================================
    // 9. Seed default data
    // ==========================================
    console.log('Step 9: Seeding default data...');

    // Check if admin user exists
    const existingUser = await query(`SELECT id FROM users WHERE email = $1`, ['admin@rumahsakit.com']);
    if (existingUser.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      await query(
        `INSERT INTO users (id, email, password, name, fasikes_name, role) VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), 'admin@rumahsakit.com', hashedPassword, 'Admin RS Medika', 'Rumah Sakit Medika', 'admin']
      );
      console.log('  ✅ Default admin user created (admin@rumahsakit.com / password123)');
    } else {
      console.log('  ℹ️  Admin user already exists, skipping');
    }

    // Seed trusted issuer
    const existingIssuer = await query(`SELECT id FROM trusted_issuers WHERE did = $1`, ['did:web:202.155.132.71%3A3001:issuer']);
    if (existingIssuer.rows.length === 0) {
      await query(
        `INSERT INTO trusted_issuers (did, name, endpoint, verified) VALUES ($1, $2, $3, $4)`,
        ['did:web:202.155.132.71%3A3001:issuer', 'BPJS Healthcare & Central Authority', 'http://202.155.132.71:3001', false]
      );
      console.log('  ✅ Default trusted issuer seeded');
    } else {
      console.log('  ℹ️  Trusted issuer already exists, skipping');
    }

    console.log('\n✅ Seeding complete\n');

    // ==========================================
    // Summary
    // ==========================================
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ DATABASE MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n📋 Tables created:');
    console.log('   • users');
    console.log('   • verification_requests');
    console.log('   • verification_results');
    console.log('   • verification_logs');
    console.log('   • trusted_issuers');
    console.log('   • verification_sessions (OID4VP) — with nonce, state, qr_url');
    console.log('\n📋 Default data:');
    console.log('   • Admin: admin@rumahsakit.com / password123');
    console.log('   • Trusted Issuer: did:web:202.155.132.71%3A3001:issuer');
    console.log('\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run migration
migrate().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
