import { initCredoVerifier } from './src/credo-verifier.js';
import { getVerifierApi, getVerifierRecord, getVerifierDidUrl, BPJS_PRESENTATION_DEFINITION } from './src/credo-verifier.js';

async function test() {
  await initCredoVerifier();
  const verifierApi = getVerifierApi();
  const verifier = getVerifierRecord();
  
  const { authorizationRequest } = await verifierApi.createAuthorizationRequest({
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
  
  console.log("AUTH REQ URL:", authorizationRequest);
  
  // extract response_uri
  const qrParams = new URLSearchParams(authorizationRequest.replace(/^openid4vp:\/\/\?/, ''));
  const requestUri = qrParams.get('request_uri');
  console.log("REQUEST URI:", requestUri);
  process.exit(0);
}

test().catch(console.error);
