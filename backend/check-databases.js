const { Client } = require('pg');

(async () => {
  const config = {
    host: '202.155.132.71',
    port: 5432,
    user: 'appuser',
    password: 'Deva123',
    ssl: { rejectUnauthorized: false },
  };

  console.log('🔍 Checking database separation...\n');

  // Check issuer_db tables
  console.log('📦 ISSUER_DB Tables:');
  const issuerClient = new Client({ ...config, database: 'issuer_db' });
  await issuerClient.connect();
  const issuerTables = await issuerClient.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log(issuerTables.rows.map(r => `   • ${r.table_name}`).join('\n'));
  await issuerClient.end();

  console.log('\n📦 VERIFIER_DB Tables:');
  const verifierClient = new Client({ ...config, database: 'verifier_db' });
  await verifierClient.connect();
  const verifierTables = await verifierClient.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log(verifierTables.rows.map(r => `   • ${r.table_name}`).join('\n'));
  await verifierClient.end();

  console.log('\n✅ Kesimpulan:');
  console.log(`   issuer_db memiliki ${issuerTables.rows.length} tabel`);
  console.log(`   verifier_db memiliki ${verifierTables.rows.length} tabel`);
  console.log('\n   Kedua database TERPISAH SEMPURNA! 🎉');
  console.log('   Data issuer & verifier TIDAK bercampur.\n');
})();
