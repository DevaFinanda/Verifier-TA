import express from 'express';
import { initCredoVerifier } from './src/credo-verifier.js';
import { getVerifierApi, getVerifierRecord, getVerifierDidUrl, BPJS_PRESENTATION_DEFINITION } from './src/credo-verifier.js';
import { mountCredoApp } from './src/app.js';
import http from 'http';
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
      const localUrl = reqUrl.replace(/http:\/\/[\d\.]+:\d+/, 'http://localhost:9999');
      console.log("Fetching: " + localUrl);

      http.get(localUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (data.startsWith('eyJ')) {
            const payload = Buffer.from(data.split('.')[1], 'base64url').toString();
            fs.writeFileSync('jwt.json', payload);
          } else {
            fs.writeFileSync('jwt.json', data);
          }
          server.close();
          process.exit(0);
        });
      });
    });
  } catch(e) { console.error(e); }
}
test();
