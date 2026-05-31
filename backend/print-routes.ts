import { initCredoVerifier } from './src/credo-verifier.js';

async function test() {
  const { credoApp } = await initCredoVerifier();
  console.log("CREDO APP ROUTES:");
  credoApp._router.stack.forEach((r: any) => {
    if (r.route && r.route.path) {
      console.log(Object.keys(r.route.methods).join(', ').toUpperCase(), r.route.path);
    }
  });
  process.exit(0);
}

test().catch(console.error);
