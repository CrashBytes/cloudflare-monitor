/**
 * Database Connection Management
 * 
 * Architectural Principles:
 * 1. Single connection instance (SQLite limitation)
 * 2. WAL mode for concurrent read performance
 * 3. Pragmatic defaults optimized for monitoring workloads
 * 4. Graceful connection lifecycle management
 * 
 * Performance Considerations:
 * - WAL mode enables concurrent reads during writes
 * - Synchronous=NORMAL balances durability with performance
 * - Foreign keys enforced for referential integrity
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { config } from '../config';

export class DatabaseManager {
  private static instance: Database.Database | null = null;

  /**
   * Get or create database instance
   * 
   * Implements the Singleton pattern to ensure:
   * - Single connection point across the application
   * - Consistent connection configuration
   * - Centralized lifecycle management
   */
  static getConnection(): Database.Database {
    if (!this.instance) {
      this.instance = this.initializeDatabase();
    }
    return this.instance;
  }

  /**
   * Initialize database with schema and optimized pragmas
   */
  private static initializeDatabase(): Database.Database {
    // Ensure database directory exists
    const dbPath = config.DATABASE_PATH;
    const dbDir = dirname(dbPath);
    
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    const db = new Database(dbPath, {
      verbose: config.NODE_ENV === 'development' ? console.log : undefined,
    });

    // Configure SQLite for optimal monitoring performance
    this.configurePragmas(db);
    
    // Initialize schema
    this.initializeSchema(db);

    console.log(`[Database] Initialized at ${dbPath}`);
    return db;
  }

  /**
   * Apply performance-optimized pragmas
   * 
   * Key optimizations:
   * - journal_mode=WAL: Write-Ahead Logging for concurrent reads
   * - synchronous=NORMAL: Balanced durability (safe for non-critical data)
   * - foreign_keys=ON: Enforce referential integrity
   * - cache_size: Tuned for monitoring workload
   */
  private static configurePragmas(db: Database.Database): void {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('cache_size = -16000'); // 16MB cache
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 30000000000'); // 30GB memory-mapped I/O
    
    if (config.NODE_ENV === 'development') {
      console.log('[Database] Pragmas configured for optimal performance');
    }
  }

  /**
   * Execute schema initialization SQL
   * 
   * Idempotent design: Safe to run multiple times
   * Uses IF NOT EXISTS for all schema objects
   */
  private static initializeSchema(db: Database.Database): void {
    try {
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');
      
      // Execute schema in a transaction for atomicity
      db.exec(schema);
      
      console.log('[Database] Schema initialized successfully');
    } catch (error) {
      console.error('[Database] Schema initialization failed:', error);
      throw error;
    }
  }

  /**
   * Close database connection gracefully
   * 
   * Critical for:
   * - Flushing pending writes
   * - Releasing file locks
   * - Clean process termination
   */
  static close(): void {
    if (this.instance) {
      try {
        this.instance.close();
        this.instance = null;
        console.log('[Database] Connection closed gracefully');
      } catch (error) {
        console.error('[Database] Error closing connection:', error);
        throw error;
      }
    }
  }

  /**
   * Health check for database connectivity
   */
  static healthCheck(): { status: 'operational' | 'degraded' | 'down'; details?: string } {
    try {
      const db = this.getConnection();
      db.prepare('SELECT 1').get();
      return { status: 'operational' };
    } catch (error) {
      return { 
        status: 'down', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get database statistics for monitoring
   */
  static getStats() {
    try {
      const db = this.getConnection();
      return {
        path: config.DATABASE_PATH,
        inTransaction: db.inTransaction,
        open: db.open,
        readonly: db.readonly,
        memory: db.memory,
      };
    } catch (error) {
      return null;
    }
  }
}

// Export singleton connection
export const db = DatabaseManager.getConnection();

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n[Database] Received SIGINT, closing connection...');
  DatabaseManager.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Database] Received SIGTERM, closing connection...');
  DatabaseManager.close();
  process.exit(0);
});

// Export repositories
export { ProjectsRepository } from './repositories/projects';
export { DeploymentsRepository } from './repositories/deployments';
