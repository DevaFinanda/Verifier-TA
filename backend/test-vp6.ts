import express from 'express';
import { initCredoVerifier } from './src/credo-verifier.js';
import { getVerifierApi, getVerifierRecord, getVerifierDidUrl, BPJS_PRESENTATION_DEFINITION } from './src/credo-verifier.js';
import { mountCredoApp } from './src/app.js';
import * as fs from 'fs';

async function test() {
  try {
    const app = express();
    const { credoApp } = await initCredoVerifier();
    
    app.use('/oid4vp', (req, res, next) => {
      credoApp(req, res, next);
    });

    const server = app.listen(9999, async () => {
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
      
      const reqUrl = authorizationRequestObject.request_uri || "";
      // we need to replace the config host to localhost:9999
      const localUrl = reqUrl.replace(/http:\/\/[\d\.]+:\d+/, 'http://localhost:9999');
      
      const res = await fetch(localUrl);
      const jwt = await res.text();
      const payloadBase64 = jwt.split('.')[1];
      const payloadString = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
      fs.writeFileSync('jwt-payload.json', payloadString);
      
      server.close();
      process.exit(0);
    });
  } catch(e) { console.error(e); }
}
test();
