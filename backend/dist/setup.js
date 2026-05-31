#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';
import { generateVerifierKeyPair, saveKeypairToEnv } from './utils/keyGenerator.js';
import { generateDIDDocument } from './utils/didDocument.js';
import { config } from './config/index.js';
/**
 * Setup script to initialize Verifier DID and keys
 */
async function setup() {
    console.log('🚀 Setting up Verifier DID and Keys...\n');
    try {
        // Step 1: Generate keypair
        console.log('Step 1: Generating Ed25519 keypair...');
        const { publicKeyHex, privateKeyHex, publicKeyMultibase } = generateVerifierKeyPair();
        console.log('✅ Keypair generated\n');
        // Step 2: Save to .env
        console.log('Step 2: Saving keys to .env file...');
        saveKeypairToEnv(privateKeyHex, publicKeyHex, publicKeyMultibase);
        console.log('✅ Keys saved to .env\n');
        // Step 3: Generate DID Document
        console.log('Step 3: Generating DID Document...');
        const didDocument = generateDIDDocument(publicKeyMultibase);
        console.log('✅ DID Document generated');
        console.log('   DID:', didDocument.id);
        console.log('   Public Key (Multibase):', publicKeyMultibase.substring(0, 20) + '...\n');
        // Step 4: Save DID Document to public/.well-known/
        console.log('Step 4: Saving DID Document to public/.well-known/did.json...');
        const publicDir = path.join(process.cwd(), 'public');
        const wellKnownDir = path.join(publicDir, '.well-known');
        // Create directories if they don't exist
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        if (!fs.existsSync(wellKnownDir)) {
            fs.mkdirSync(wellKnownDir, { recursive: true });
        }
        const didDocPath = path.join(wellKnownDir, 'did.json');
        fs.writeFileSync(didDocPath, JSON.stringify(didDocument, null, 2));
        console.log('✅ DID Document saved to:', didDocPath);
        console.log('   Accessible at: /.well-known/did.json\n');
        // Step 5: Display summary
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ SETUP COMPLETED SUCCESSFULLY!');
        console.log('═══════════════════════════════════════════════════════');
        console.log('\n📋 Configuration Summary:');
        console.log('   DID:', didDocument.id);
        console.log('   Port:', config.port);
        console.log('   Public Key:', publicKeyMultibase.substring(0, 30) + '...');
        console.log('\n🌐 DID Document URL:');
        console.log('   ' + config.oid4vp.verifierBaseUrl.replace(/\/$/, '') + '/.well-known/did.json');
        console.log('\n⚠️  IMPORTANT:');
        console.log('   - Keep your VERIFIER_PRIVATE_KEY secure and never share it');
        console.log('   - The public key is stored in .well-known/did.json');
        console.log('   - Issuers will fetch your public key from this endpoint');
        console.log('\n🔄 Next Steps:');
        console.log('   1. Start the backend server: npm run dev');
        console.log('   2. Share your DID with trusted issuers');
        console.log('   3. Verify credentials using your DID');
        console.log('\n');
    }
    catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}
// Run setup
setup().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=setup.js.map