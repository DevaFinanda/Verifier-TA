import { initCredoVerifier } from './src/credo-verifier.js';
import { getVerifierApi, getVerifierRecord, getVerifierDidUrl, BPJS_PRESENTATION_DEFINITION } from './src/credo-verifier.js';
import * as fs from 'fs';

async function test() {
  try {
    await initCredoVerifier();
    const verifierApi = getVerifierApi();
    const verifier = getVerifierRecord();
    const { authorizationRequestObject } = await verifierApi.createAuthorizationRequest({
      verifierId: verifier.verifierId,
      requestSigner: {
        method: 'did',
        didUrl: getVerifierDidUrl(),
      },
      presentationExchange: {
        definition: BPJS_PRESENTATION_DEFINITION,
      },
      responseMode: 'direct_post',
      version: 'v1.draft24',
    });
    fs.writeFileSync('payload.json', JSON.stringify(authorizationRequestObject, null, 2));
  } catch(e) { console.error(e); }
  process.exit(0);
}
test();
