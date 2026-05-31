import { Pool } from 'pg';
declare const pool: Pool;
/**
 * Execute a query with parameters
 */
export declare const query: (text: string, params?: any[]) => Promise<import("pg").QueryResult<any>>;
/**
 * Get a client from the pool for transactions
 */
export declare const getClient: () => Promise<import("pg").PoolClient>;
/**
 * Test database connection
 */
export declare const testConnection: () => Promise<boolean>;
/**
 * Close all connections in the pool
 */
export declare const closePool: () => Promise<void>;
export default pool;
//# sourceMappingURL=database.d.ts.map