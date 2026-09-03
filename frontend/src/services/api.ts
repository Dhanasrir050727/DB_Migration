import axios from 'axios';

/**
 * API Service - Database Migration
 * Frontend handles source/target validation
 * Backend only called for migration execution
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Database Connection Credentials
 */
export interface SourceDatabaseCredentials {
  baseUrl: string;
  anonKey: string;
}

export interface TargetDatabaseCredentials {
  baseUrl: string;
  anonKey: string;
}

export interface DatabaseInfo {
  tables: number;
  records: number;
  totalRecords?: number;
  functions: number;
  triggers: number;
  views: number;
  indexes: number;
}

/**
 * Save source database credentials to backend .env
 */
export async function saveSourceCredentials(credentials: SourceDatabaseCredentials): Promise<DatabaseInfo> {
  try {
    if (!credentials.baseUrl) {
      throw new Error('Database URL is required');
    }

    // Call backend to test connection and save to .env
    const response = await apiClient.post('/api/migration/save-source', {
      baseUrl: credentials.baseUrl,
      password: credentials.anonKey || '',
    });

    return response.data.source;
  } catch (error: any) {
    console.error('Failed to save source credentials:', error);
    throw new Error(error.response?.data?.error || error.message || 'Failed to save source');
  }
}

export async function saveTargetCredentials(credentials: TargetDatabaseCredentials): Promise<boolean> {
  try {
    if (!credentials.baseUrl) {
      throw new Error('Database URL is required');
    }

    // Call backend to test connection and save to .env
    const response = await apiClient.post('/api/migration/save-target', {
      baseUrl: credentials.baseUrl,
      password: credentials.anonKey || '',
    });

    return response.data.success;
  } catch (error: any) {
    console.error('Failed to save target credentials:', error);
    throw new Error(error.response?.data?.error || error.message || 'Failed to save target');
  }
}

/**
 * Migration Summary - Reads from .env
 */
export interface MigrationSummary {
  source: {
    url: string;
    region: string;
    tables: number;
    records: number;
    functions: number;
    triggers: number;
    views: number;
    indexes: number;
  };
  target: {
    url: string;
    region: string;
    connected: boolean;
  };
  regions: {
    source: string;
    target: string;
    sameRegion: boolean;
  };
  warnings: Array<{
    severity: string;
    message: string;
  }>;
}

export async function getMigrationSummary(): Promise<MigrationSummary> {
  try {
    // No credentials needed - backend reads from .env
    const response = await apiClient.post('/api/migration/summary');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to get migration summary');
  }
}

/**
 * Start Migration - Reads credentials from .env
 */
export interface MigrationOptions {
  // No options needed - backend reads from .env
}

export async function startMigration(): Promise<string> {
  try {
    const response = await apiClient.post('/api/migration/start');
    return response.data.migrationId;
  } catch (error: any) {
    console.error('Failed to start migration:', error);
    throw new Error(error.response?.data?.error || error.message || 'Migration failed to start');
  }
}

/**
 * Get Migration Progress
 */
export interface MigrationProgress {
  migrationId: string;
  status: 'pending' | 'connecting' | 'reading' | 'migrating' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  details: {
    tablesProcessed: number;
    totalTables: number;
    recordsMigrated: number;
    totalRecords: number;
    functionsMigrated: number;
    totalFunctions: number;
    triggersMigrated: number;
    totalTriggers: number;
    viewsMigrated: number;
    totalViews: number;
    policiesMigrated: number;
    totalPolicies: number;
  };
  errors: Array<{
    objectName: string;
    objectType: string;
    error: string;
  }>;
}

export async function getMigrationProgress(migrationId: string): Promise<MigrationProgress> {
  try {
    const response = await apiClient.get(`/api/migration/${migrationId}/progress`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to get progress');
  }
}

/**
 * Get Migration Report
 */
export interface MigrationReport {
  migrationId: string;
  startTime: string;
  endTime: string;
  duration: string;
  status: 'success' | 'failed' | 'partial';
  summary: {
    tablesMigrated: number;
    totalTables: number;
    recordsMigrated: number;
    totalRecords: number;
    functionsMigrated: number;
    totalFunctions: number;
    triggersMigrated: number;
    totalTriggers: number;
    viewsMigrated: number;
    totalViews: number;
    policiesMigrated: number;
    totalPolicies: number;
  };
  failedObjects: Array<{
    objectName: string;
    objectType: string;
    error: string;
  }>;
}

export async function getMigrationReport(migrationId: string): Promise<MigrationReport> {
  try {
    const response = await apiClient.get(`/api/migration/${migrationId}/report`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to get report');
  }
}
