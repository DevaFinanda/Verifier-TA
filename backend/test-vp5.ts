import { initCredoVerifier } from './src/credo-verifier.js';
import { getVerifierApi, getVerifierRecord, getVerifierDidUrl, BPJS_PRESENTATION_DEFINITION } from './src/credo-verifier.js';
import * as fs from 'fs';

async function test() {
  try {
    const { credoApp } = await initCredoVerifier();
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
    
    // It's a signed JWT (authorizationRequestObject is not the JWT string itself, wait!)
    // Wait, authorizationRequestObject is the JWT string or is it an object? Let's check type.
    
    const requestUri = authorizationRequestObject.request_uri || authorizationRequestObject;
    fs.writeFileSync('payload2.json', JSON.stringify({ typeof: typeof authorizationRequestObject, obj: authorizationRequestObject }, null, 2));
  } catch(e) { console.error(e); }
  process.exit(0);
}
test();
