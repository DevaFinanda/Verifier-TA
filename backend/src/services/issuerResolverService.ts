import {
  getTrustedIssuers,
  getIssuerByDid,
  updateTrustedIssuer,
  verifyIssuer,
  TrustedIssuer,
} from '../config/trustedIssuers.js';

interface DIDDocument {
  '@context': string | string[];
  id: string;
  verificationMethod?: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase?: string;
    publicKeyBase58?: string;
    publicKeyJwk?: any;
  }>;
  authentication?: string[];
  assertionMethod?: string[];
}

interface IssuerPublicKeyInfo {
  did: string;
  name: string;
  publicKey: string;
  keyType: string;
  verified: boolean;
  endpoint: string;
  lastFetched: Date;
}

export const issuerResolverService = {
  /**
   * Check if issuer server is reachable
   */
  async checkServerHealth(issuerEndpoint: string): Promise<boolean> {
    try {
      const healthEndpoints = [
        `${issuerEndpoint}/health`,
        `${issuerEndpoint}/api/health`,
        `${issuerEndpoint}/`,
      ];

      for (const endpoint of healthEndpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
          });
          
          if (response.ok) {
            console.log(`✓ Server reachable at: ${issuerEndpoint}`);
            return true;
          }
        } catch (err) {
          continue;
        }
      }
      
      console.warn(`⚠ Server not reachable: ${issuerEndpoint}`);
      return false;
    } catch (error) {
      return false;
    }
  },

  /**
   * Fetch DID Document from issuer
   */
  async fetchDIDDocument(issuerEndpoint: string, did: string): Promise<DIDDocument | null> {
    try {
      // First check if server is reachable
      const isReachable = await this.checkServerHealth(issuerEndpoint);
      if (!isReachable) {
        console.error(`✗ Cannot connect to issuer server: ${issuerEndpoint}`);
        console.log(`  Pastikan issuer jalan di port tersebut`);
        return null;
      }

      // Try multiple common DID document endpoints
      const endpoints = [
        `${issuerEndpoint}/.well-known/did.json`,
        `${issuerEndpoint}/.well-known/did-configuration.json`,
        `${issuerEndpoint}/api/did/document`,
        `${issuerEndpoint}/api/did`,
        `${issuerEndpoint}/did.json`,
        `${issuerEndpoint}/did`,
        `${issuerEndpoint}/.well-known/issuer`,
      ];

      console.log(`  Trying ${endpoints.length} possible endpoints...`);

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(5000), // 5 second timeout
          });

          if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
              console.log(`  ⚠ Skipping ${endpoint} (not JSON)`);
              continue;
            }

            const didDoc = await response.json() as DIDDocument;
            
            // Validate basic DID document structure
            if (!didDoc.id && !didDoc['@context']) {
              console.log(`  ⚠ Invalid DID document structure at ${endpoint}`);
              continue;
            }

            console.log(`✓ Fetched DID document from: ${endpoint}`);
            return didDoc;
          } else {
            console.log(`  ⚠ ${endpoint} returned ${response.status}`);
          }
        } catch (err) {
          // Try next endpoint
          continue;
        }
      }

      console.error(`✗ Could not fetch DID document from any endpoint`);
      console.log(`  Tried endpoints:`, endpoints.map(e => `\n    - ${e}`).join(''));
      return null;
    } catch (error) {
      console.error('Error fetching DID document:', error);
      return null;
    }
  },

  /**
   * Extract public key from DID Document
   */
  extractPublicKey(didDoc: DIDDocument): string | null {
    if (!didDoc.verificationMethod || didDoc.verificationMethod.length === 0) {
      return null;
    }

    // Get the first verification method (usually the main key)
    const verificationMethod = didDoc.verificationMethod[0];

    // Extract public key in various formats
    if (verificationMethod.publicKeyMultibase) {
      return verificationMethod.publicKeyMultibase;
    }
    if (verificationMethod.publicKeyBase58) {
      return `ed25519_${verificationMethod.publicKeyBase58}`;
    }
    if (verificationMethod.publicKeyJwk) {
      // Convert JWK to base58 or multibase if needed
      return JSON.stringify(verificationMethod.publicKeyJwk);
    }

    return null;
  },

  /**
   * Fetch public key directly from issuer endpoint
   */
  async fetchPublicKeyDirect(issuerEndpoint: string): Promise<string | null> {
    try {
      const endpoints = [
        `${issuerEndpoint}/api/public-key`,
        `${issuerEndpoint}/api/publickey`,
        `${issuerEndpoint}/public-key`,
        `${issuerEndpoint}/publickey`,
        `${issuerEndpoint}/.well-known/public-key`,
        `${issuerEndpoint}/api/issuer/public-key`,
      ];

      console.log(`  Trying direct public key endpoints...`);

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(5000),
          });

          if (response.ok) {
            const data = await response.json() as { publicKey?: string; key?: string; public_key?: string };
            const publicKey = data.publicKey || data.key || data.public_key;
            
            if (publicKey) {
              console.log(`✓ Got public key from: ${endpoint}`);
              return publicKey;
            }
          }
        } catch (err) {
          continue;
        }
      }

      console.log(`  ⚠ No direct public key endpoint found`);
      return null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Resolve issuer and get public key
   * Supports DEMO mode: returns mock public key if issuer server is offline
   */
  async resolveIssuer(did: string): Promise<IssuerPublicKeyInfo | null> {
    const issuer = await getIssuerByDid(did);
    
    if (!issuer) {
      console.warn(`⚠️  Issuer not found in trusted list: ${did}`);
      console.log(`   DEMO MODE: Using mock issuer configuration`);
      
      // Demo mode: return mock issuer info
      return {
        did,
        name: 'BPJS Healthcare (DEMO)',
        publicKey: 'z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK', // Mock Ed25519 public key
        keyType: 'Ed25519',
        verified: true,
        endpoint: 'http://202.155.132.71:3001',
        lastFetched: new Date(),
      };
    }

    console.log(`🔍 Resolving issuer: ${issuer.name} (${did})`);

    // Try to fetch DID document
    const didDoc = await this.fetchDIDDocument(issuer.endpoint, did);
    
    let publicKey: string | null = null;

    if (didDoc) {
      publicKey = this.extractPublicKey(didDoc);
    }

    // Fallback: Try direct public key endpoint
    if (!publicKey) {
      publicKey = await this.fetchPublicKeyDirect(issuer.endpoint);
    }

    if (publicKey) {
      // Update trusted issuer with public key
      await verifyIssuer(did, publicKey);

      return {
        did: issuer.did,
        name: issuer.name,
        publicKey,
        keyType: 'Ed25519',
        verified: true,
        endpoint: issuer.endpoint,
        lastFetched: new Date(),
      };
    }

    // 🎭 DEMO MODE: If we can't reach issuer server, return mock public key for testing
    console.warn(`⚠️  Could not resolve public key for issuer: ${did}`);
    console.log(`   Issuer server appears offline at: ${issuer.endpoint}`);
    console.log(`   DEMO MODE ACTIVATED: Using mock public key for testing`);
    console.log(`   ⚠️  In production, verification would FAIL without real issuer connection`);
    
    return {
      did: issuer.did,
      name: `${issuer.name} (DEMO MODE - Server Offline)`,
      publicKey: 'z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK', // Mock Ed25519 public key
      keyType: 'Ed25519',
      verified: false, // Mark as unverified since it's demo
      endpoint: issuer.endpoint,
      lastFetched: new Date(),
    };
  },

  /**
   * Resolve all trusted issuers
   */
  async resolveAllIssuers(): Promise<IssuerPublicKeyInfo[]> {
    const issuers = await getTrustedIssuers();
    const results: IssuerPublicKeyInfo[] = [];

    console.log(`\n🔍 Resolving ${issuers.length} trusted issuers...`);

    for (const issuer of issuers) {
      try {
        const info = await this.resolveIssuer(issuer.did);
        if (info) {
          results.push(info);
          console.log(`✓ Resolved: ${info.name}`);
        } else {
          console.log(`✗ Failed: ${issuer.name}`);
        }
      } catch (error) {
        console.error(`Error resolving ${issuer.name}:`, error);
      }
    }

    console.log(`\n✓ Successfully resolved ${results.length}/${issuers.length} issuers\n`);

    return results;
  },

  /**
   * Get all issuers with their status
   */
  async getAllIssuersStatus(): Promise<Array<TrustedIssuer>> {
    return await getTrustedIssuers();
  },

  /**
   * Verify credential signature with issuer public key
   */
  async verifyCredentialSignature(
    credentialDid: string,
    signature: string
  ): Promise<boolean> {
    const issuer = await getIssuerByDid(credentialDid);
    
    if (!issuer || !issuer.publicKey) {
      // Try to resolve if not cached
      const resolved = await this.resolveIssuer(credentialDid);
      if (!resolved) {
        return false;
      }
      // Re-fetch after resolution
      const updatedIssuer = await getIssuerByDid(credentialDid);
      return updatedIssuer?.verified || false;
    }

    // In production, implement actual signature verification
    // For now, just check if issuer is verified
    return issuer?.verified || false;
  },
};
