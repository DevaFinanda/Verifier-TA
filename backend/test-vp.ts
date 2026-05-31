import { initCredoVerifier } from './src/credo-verifier.js';
import { oid4vpService } from './src/services/oid4vpService.js';
import { config } from './src/config/index.js';

async function test() {
  await initCredoVerifier();
  const res = await oid4vpService.startVerification();
  console.log("RESPONSE URI IS:", res);
  process.exit(0);
}

test().catch(console.error);
