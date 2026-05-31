import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { User, JWTPayload } from '../types/index.js';
import { query } from '../config/database.js';

export const authService = {
  /**
   * Register a new user
   */
  async register(data: {
    email: string;
    password: string;
    name: string;
    fasikesName: string;
  }): Promise<{ user: Omit<User, 'password'>; token: string }> {
    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const id = uuidv4();
    const result = await query(
      `INSERT INTO users (id, email, password, name, fasikes_name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, email, name, fasikes_name, role, created_at, updated_at`,
      [id, data.email, hashedPassword, data.name, data.fasikesName, 'verifier']
    );

    const row = result.rows[0];
    const user: Omit<User, 'password'> = {
      id: row.id,
      email: row.email,
      name: row.name,
      fasikesName: row.fasikes_name,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // Generate token
    const token = this.generateToken({
      ...user,
      password: '',
    } as User);

    return { user, token };
  },

  /**
   * Login user
   */
  async login(
    email: string,
    password: string
  ): Promise<{ user: Omit<User, 'password'>; token: string }> {
    console.log('🔍 AuthService.login called with email:', email);
    console.log('🔍 Password length:', password?.length, 'Password value:', JSON.stringify(password));
    
    const result = await query(
      'SELECT id, email, password, name, fasikes_name, role, created_at, updated_at FROM users WHERE email = $1',
      [email]
    );

    console.log('🔍 DB query returned', result.rows.length, 'rows');

    if (result.rows.length === 0) {
      console.log('❌ No user found with email:', email);
      throw new Error('Invalid email or password');
    }

    const row = result.rows[0];
    console.log('🔍 Found user:', row.email, '| Hash:', row.password?.substring(0, 20) + '...');
    const isValidPassword = await bcrypt.compare(password, row.password);
    console.log('🔍 bcrypt.compare result:', isValidPassword);

    if (!isValidPassword) {
      console.log('❌ Password mismatch for:', email);
      throw new Error('Invalid email or password');
    }

    const user: Omit<User, 'password'> = {
      id: row.id,
      email: row.email,
      name: row.name,
      fasikesName: row.fasikes_name,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // Generate token
    const token = this.generateToken({
      ...user,
      password: '',
    } as User);

    return { user, token };
  },

  /**
   * Generate JWT token
   */
  generateToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });
  },

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<Omit<User, 'password'> | null> {
    const result = await query(
      'SELECT id, email, name, fasikes_name, role, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      fasikesName: row.fasikes_name,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};
