import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
};
const pool = new Pool(poolConfig);
// Log connection events
pool.on('connect', () => {
    console.log('📦 New client connected to PostgreSQL');
});
pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle PostgreSQL client:', err);
});
/**
 * Execute a query with parameters
 */
export const query = async (text, params) => {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
        console.log(`  📝 Query executed in ${duration}ms | rows: ${result.rowCount}`);
    }
    return result;
};
/**
 * Get a client from the pool for transactions
 */
export const getClient = async () => {
    return pool.connect();
};
/**
 * Test database connection
 */
export const testConnection = async () => {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Database connected:', result.rows[0].now);
        return true;
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
};
/**
 * Close all connections in the pool
 */
export const closePool = async () => {
    await pool.end();
    console.log('📦 Database pool closed');
};
export default pool;
//# sourceMappingURL=database.js.map