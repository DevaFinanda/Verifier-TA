import { User } from '../types/index.js';
export declare const authService: {
    /**
     * Register a new user
     */
    register(data: {
        email: string;
        password: string;
        name: string;
        fasikesName: string;
    }): Promise<{
        user: Omit<User, "password">;
        token: string;
    }>;
    /**
     * Login user
     */
    login(email: string, password: string): Promise<{
        user: Omit<User, "password">;
        token: string;
    }>;
    /**
     * Generate JWT token
     */
    generateToken(user: User): string;
    /**
     * Get user by ID
     */
    getUserById(id: string): Promise<Omit<User, "password"> | null>;
};
//# sourceMappingURL=authService.d.ts.map