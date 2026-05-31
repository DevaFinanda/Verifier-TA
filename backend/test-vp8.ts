import express from 'express';
import { initCredoVerifier } from './src/credo-verifier.js';
import { getVerifierApi, getVerifierRecord, getVerifierDidUrl, BPJS_PRESENTATION_DEFINITION } from './src/credo-verifier.js';
import { mountCredoApp } from './src/app.js';
import * as fs from 'fs';

async function test() {
  try {
    const app = express();
    const { credoApp } = await initCredoVerifier();
    
    // NOTE: DO NOT use app.use('/oid4vp', ...), use exact path preservation
    app.use((req, res, next) => {
      if (req.path.startsWith('/oid4vp')) {
        credoApp(req, res, next);
      } else {
        next();
      }
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
      const localUrl = reqUrl.replace(/http:\/\/[\d\.]+:\d+/, 'http://localhost:9999');
      
      const response = await fetch(localUrl, { headers: { Accept: 'application/oauth-authz-req+jwt' } });
      const text = await response.text();
      
      if (text.startsWith('eyJ')) {
         const payload = Buffer.from(text.split('.')[1], 'base64url').toString('utf8');
         fs.writeFileSync('jwt-real.json', payload);
         console.log('SUCCESS');
      } else {
         fs.writeFileSync('jwt-real.json', text);
         console.log('FAILED TO GET JWT');
      }
      
      server.close();
      process.exit(0);
    });
  } catch(e) { console.error(e); }
}
test();
