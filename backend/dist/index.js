import app, { mountCredoApp, finalizeApp } from './app.js';
import { config } from './config/index.js';
import { testConnection, closePool } from './config/database.js';
import { initCredoVerifier, getCredoAgent } from './credo-verifier.js';
const startServer = async () => {
    try {
        // Test database connection
        console.log('📦 Connecting to PostgreSQL database...');
        const dbConnected = await testConnection();
        if (!dbConnected) {
            console.error('❌ Database connection failed. Server will not start.');
            console.error('   Please check DATABASE_URL in .env');
            console.error('   Run: npm run migrate (to create tables)');
            process.exit(1);
        }
        // Initialize Credo-TS OID4VP Verifier Agent
        console.log('\n🔐 Setting up Credo-TS OID4VP Verifier...');
        try {
            const { credoApp } = await initCredoVerifier();
            // Mount Credo's Express app for OID4VP protocol endpoints
            mountCredoApp(credoApp);
            console.log('✅ Credo-TS OID4VP Verifier initialized successfully\n');
        }
        catch (credoError) {
            console.error('⚠️  Failed to initialize Credo-TS OID4VP:', credoError);
            console.error('   OID4VP endpoints will not be available.');
            console.error('   Legacy verification endpoints still work.\n');
        }
        // Finalize app (register 404 and error handlers AFTER credo mount)
        finalizeApp();
        const server = app.listen(config.port, () => {
            const publicBaseUrl = config.oid4vp.verifierBaseUrl.replace(/\/$/, '');
            console.log('\n🚀 ========================================');
            console.log(`   Verifier Backend Server`);
            console.log('========================================');
            console.log(`📍 Environment: ${config.nodeEnv}`);
            console.log(`🌐 Port: ${config.port}`);
            console.log(`🔗 URL: ${publicBaseUrl}`);
            console.log(`📦 Database: PostgreSQL (VPS)`);
            console.log('========================================\n');
            console.log('📌 Available endpoints:');
            console.log(`   • Health: ${publicBaseUrl}/health`);
            console.log(`   • API Info: ${publicBaseUrl}/api`);
            console.log(`   • Auth: ${publicBaseUrl}/api/auth`);
            console.log(`   • Verification (legacy): ${publicBaseUrl}/api/verification`);
            console.log(`   • DID: ${publicBaseUrl}/api/did`);
            console.log(`   • OID4VP Start: ${publicBaseUrl}/api/verify/start`);
            console.log(`   • OID4VP Result: ${publicBaseUrl}/api/verify/result/:id`);
            console.log(`   • OID4VP Sessions: ${publicBaseUrl}/api/verify/sessions`);
            console.log(`   • OID4VP Info: ${publicBaseUrl}/api/verify/info`);
            console.log(`   • OID4VP Protocol: ${publicBaseUrl}/oid4vp/`);
            console.log('\n========================================\n');
        });
        // Graceful shutdown
        const shutdown = async (signal) => {
            console.log(`\n${signal} received. Shutting down gracefully...`);
            // Shutdown Credo agent
            try {
                const agent = getCredoAgent();
                await agent.shutdown();
                console.log('🔐 Credo agent shut down');
            }
            catch {
                // Agent might not be initialized
            }
            await closePool();
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
            // Force close if not done in 10 seconds
            setTimeout(() => {
                console.error('Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 10000);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
//# sourceMappingURL=index.js.map