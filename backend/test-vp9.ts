import express from 'express';
import { initCredoVerifier } from './src/credo-verifier.js';
import { getVerifierApi, getVerifierRecord, getVerifierDidUrl, BPJS_PRESENTATION_DEFINITION } from './src/credo-verifier.js';
import * as fs from 'fs';

async function test() {
  try {
    const app = express();
    const { credoApp } = await initCredoVerifier();
    
    app.use((req, res, next) => {
      if (req.path.startsWith('/oid4vp')) credoApp(req, res, next);
      else next();
    });

    const server = app.listen(9999, async () => {
      const verifierApi = getVerifierApi();
      const verifier = getVerifierRecord();
      const { authorizationRequestObject } = await verifierApi.createAuthorizationRequest({
        verifierId: verifier.verifierId,
        requestSigner: { method: 'did', didUrl: getVerifierDidUrl() },
        presentationExchange: { definition: BPJS_PRESENTATION_DEFINITION },
        responseMode: 'direct_post',
        version: 'v1.draft24',
      });
      
      const reqUrl = (authorizationRequestObject.request_uri || "").replace(/http:\/\/[\d\.]+:\d+/, 'http://localhost:9999');
      
      const response = await fetch(reqUrl, { headers: { Accept: 'application/oauth-authz-req+jwt' } });
      const text = await response.text();
      const payload = JSON.parse(Buffer.from(text.split('.')[1], 'base64url').toString('utf8'));
      
      const responseUri = payload.response_uri.replace(/http:\/\/[\d\.]+:\d+/, 'http://localhost:9999');
      console.log('Posting to', responseUri);
      
      const postRes = await fetch(responseUri, {
         method: 'POST',
         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
         body: 'vp_token=asdf&presentation_submission={}',
      });
      
      console.log('Status:', postRes.status);
      console.log('Response:', await postRes.text());
      
      server.close();
      process.exit(0);
    });
  } catch(e) { console.error(e); }
}
test();
