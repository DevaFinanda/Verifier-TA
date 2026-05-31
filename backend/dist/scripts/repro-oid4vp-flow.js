"use strict";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
    const startRes = await fetch('http://127.0.0.1:3002/api/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    });
    const startJson = await startRes.json();
    const qrUrl = startJson?.data?.qrUrl;
    const sessionId = startJson?.data?.sessionId;
    if (!qrUrl) {
        throw new Error('qrUrl not found in start response');
    }
    const requestUriParam = qrUrl.split('request_uri=')[1];
    if (!requestUriParam) {
        throw new Error('request_uri param missing in qrUrl');
    }
    const requestUri = decodeURIComponent(requestUriParam);
    console.log(`sessionId=${sessionId}`);
    console.log(`request_uri=${requestUri}`);
    const reqRes = await fetch(requestUri, {
        headers: { Accept: 'application/oauth-authz-req+jwt, application/jwt, */*' },
    });
    console.log(`request_uri_status=${reqRes.status}`);
    await sleep(300);
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=repro-oid4vp-flow.js.map