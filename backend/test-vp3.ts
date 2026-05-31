import { initCredoVerifier } from './src/credo-verifier.js';
import { getVerifierApi, getVerifierRecord, getVerifierDidUrl, BPJS_PRESENTATION_DEFINITION } from './src/credo-verifier.js';

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
    console.log("=== BEGIN JWT PAYLOAD ===");
    console.log(JSON.stringify(authorizationRequestObject, null, 2));
    console.log("=== END JWT PAYLOAD ===");
  } catch(e) { console.error(e); }
  process.exit(0);
}
test();
