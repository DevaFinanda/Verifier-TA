mkdir ./dist/esm
cat >dist/esm/index.js <<!EOF
import cjsModule from '../index.js';
export const DEFAULT_HEADERS = cjsModule.DEFAULT_HEADERS;
export const httpClient = cjsModule.httpClient;
export const kyPromise = cjsModule.kyPromise;
!EOF

cat >dist/package.json <<!EOF
{
    "type": "commonjs",
    "browser": {
      "./agentCompatibility.js": "./agentCompatibility-browser.js"
    },
    "react-native": {
      "./agentCompatibility.js": "./agentCompatibility-browser.js"
    }
}
!EOF


cat >dist/esm/package.json <<!EOF
{
  "type": "module"
}
!EOF
