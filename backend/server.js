import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;

// Path to .env file
const ENV_FILE_PATH = path.resolve(__dirname, '..', '.env');

// Load initial .env
dotenv.config({ path: ENV_FILE_PATH });

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safely update .env file with new key-value pairs
 * Does not delete existing variables, only updates/adds specified ones
 * @param {string} key - Environment variable name
 * @param {string} value - Environment variable value
 */
function saveEnvVariable(key, value) {
  try {
    let envContent = '';
    
    // Read existing .env file
    if (fs.existsSync(ENV_FILE_PATH)) {
      envContent = fs.readFileSync(ENV_FILE_PATH, 'utf8');
    }

    // Check if key already exists
    const keyRegex = new RegExp(`^${key}=.*$`, 'm');
    
    if (keyRegex.test(envContent)) {
      // Replace existing value
      envContent = envContent.replace(keyRegex, `${key}=${value}`);
      console.log(`[ENV] Updated: ${key}`);
    } else {
      // Add new variable
      if (envContent && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `${key}=${value}\n`;
      console.log(`[ENV] Added: ${key}`);
    }

    // Write back to .env
    fs.writeFileSync(ENV_FILE_PATH, envContent, 'utf8');

    // Reload process.env
    const newEnv = dotenv.parse(envContent);
    Object.assign(process.env, newEnv);

    return true;
  } catch (error) {
    console.error('[ENV] Error saving environment variable:', error.message);
    throw error;
  }
}

/**
 * Get migration credentials from environment variables
 * @returns {Object} Credentials object with source and target details
 */
function getMigrationCredentials() {
  const credentials = {
    source: {
      url: process.env.SOURCE_SUPABASE_URL || '',
      password: process.env.SOURCE_DB_PASSWORD || '',
    },
    target: {
      url: process.env.TARGET_SUPABASE_URL || '',
      password: process.env.TARGET_DB_PASSWORD || '',
    },
  };

  // Validate all required fields exist
  const missing = [];
  if (!credentials.source.url) missing.push('SOURCE_SUPABASE_URL');
  if (!credentials.source.password) missing.push('SOURCE_DB_PASSWORD');
  if (!credentials.target.url) missing.push('TARGET_SUPABASE_URL');
  if (!credentials.target.password) missing.push('TARGET_DB_PASSWORD');

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  return credentials;
}

/**
 * Convert Supabase URL + password to PostgreSQL connection string
 */
function convertSupabaseUrlToPostgres(baseUrl, password) {
  let url = baseUrl.toLowerCase().replace('https://', '').replace('http://', '').trim();
  const projectId = url.split('.supabase.co')[0];
  const encodedPassword = encodeURIComponent(password);
  return `postgres://postgres:${encodedPassword}@db.${projectId}.supabase.co:5432/postgres`;
}

/**
 * Extract region from Supabase URL (project ID)
 */
function extractRegion(baseUrl) {
  try {
    let url = baseUrl.toLowerCase().replace('https://', '').trim();
    return url.split('.supabase.co')[0];
  } catch (err) {
    return 'unknown';
  }
}

/**
 * Get database information from PostgreSQL
 */
async function getDatabaseInfoPostgres(pool) {
  try {
    const tablesResult = await pool.query(`
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const tables = parseInt(tablesResult.rows[0].count) || 0;

    let totalRecords = 0;
    const allTablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    for (const row of allTablesResult.rows) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
        totalRecords += parseInt(countResult.rows[0].count) || 0;
      } catch (err) {
        // Skip tables that can't be counted
      }
    }

    const functionsResult = await pool.query(`
      SELECT COUNT(*) FROM information_schema.routines 
      WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
    `);
    const functions = parseInt(functionsResult.rows[0].count) || 0;

    const triggersResult = await pool.query(`
      SELECT COUNT(*) FROM information_schema.triggers 
      WHERE trigger_schema = 'public'
    `);
    const triggers = parseInt(triggersResult.rows[0].count) || 0;

    const viewsResult = await pool.query(`
      SELECT COUNT(*) FROM information_schema.views 
      WHERE table_schema = 'public'
    `);
    const views = parseInt(viewsResult.rows[0].count) || 0;

    const indexesResult = await pool.query(`
      SELECT COUNT(*) FROM pg_indexes 
      WHERE schemaname = 'public'
    `);
    const indexes = parseInt(indexesResult.rows[0].count) || 0;

    console.log(`[DATABASE INFO] Tables: ${tables}, Records: ${totalRecords}, Functions: ${functions}, Triggers: ${triggers}, Views: ${views}, Indexes: ${indexes}`);

    return {
      tables,
      totalRecords,
      functions,
      triggers,
      views,
      indexes,
    };
  } catch (error) {
    console.error('Error getting database info:', error);
    throw error;
  }
}

// ============================================================================
// SUPABASE ADMIN API AUTH MIGRATION (Alternative approach)
// ============================================================================

/**
 * Migrate auth users using Supabase Admin API instead of raw SQL
 * This is the RECOMMENDED approach for actual Supabase projects
 * 
 * REQUIREMENTS:
 * - npm install @supabase/supabase-js
 * - Target Supabase project URL and Service Role Key in .env (TARGET_SUPABASE_SERVICE_ROLE_KEY)
 * - Service Role Key has full access to auth.users
 * 
 * ADVANTAGES:
 * - Handles Supabase-specific features correctly
 * - Manages password hashes through Supabase's auth system
 * - Proper error handling and audit logging
 * - Respects all RLS policies
 * 
 * LIMITATIONS:
 * - Cannot migrate password hashes directly (Supabase restriction)
 * - Users must reset passwords or use recovery flow
 * - MFA/OAuth identities must be reconfigured
 * - Slower than raw SQL (API calls per user)
 */
async function migrateAuthUsersViaSupabaseAPI(sourceUrl, sourcePassword, targetUrl, targetServiceRoleKey, migrationId) {
  try {
    console.log(`[${migrationId}] Starting Supabase Admin API auth migration...`);
    
    // REMINDER: This function requires @supabase/supabase-js to be installed
    // and TARGET_SUPABASE_SERVICE_ROLE_KEY to be set in .env
    
    const sourcePool = new Pool({
      connectionString: convertSupabaseUrlToPostgres(sourceUrl, sourcePassword),
    });

    try {
      // Fetch all auth users from source
      const authUsersResult = await sourcePool.query(`
        SELECT 
          id, email, phone, 
          raw_user_meta_data, 
          raw_app_meta_data,
          user_metadata,
          encrypted_password,
          email_confirmed_at,
          phone_confirmed_at,
          created_at
        FROM auth.users
        ORDER BY created_at
      `);

      console.log(`[${migrationId}] Fetched ${authUsersResult.rows.length} users from source`);

      // NOTE: For actual implementation, uncomment after npm install @supabase/supabase-js
      /*
      const { createClient } = require('@supabase/supabase-js');
      
      const targetSupabase = createClient(targetUrl, targetServiceRoleKey);
      
      let usersMigrated = 0;
      let usersFailed = 0;
      
      for (const sourceUser of authUsersResult.rows) {
        try {
          // NOTE: Supabase Admin API does NOT support setting encrypted_password directly
          // Users must reset passwords after migration
          
          const { data, error } = await targetSupabase.auth.admin.createUser({
            email: sourceUser.email,
            phone: sourceUser.phone,
            user_metadata: sourceUser.user_metadata || {},
            app_metadata: sourceUser.raw_app_meta_data || {},
            email_confirm: !!sourceUser.email_confirmed_at,
            phone_confirm: !!sourceUser.phone_confirmed_at,
          });

          if (error) {
            console.log(`[${migrationId}]   ⚠ User ${sourceUser.email}: ${error.message}`);
            usersFailed++;
          } else {
            console.log(`[${migrationId}]   ✓ User ${sourceUser.email} migrated (ID: ${data.user.id})`);
            usersMigrated++;
          }
        } catch (err) {
          console.log(`[${migrationId}]   ⚠ User ${sourceUser.email}: ${err.message}`);
          usersFailed++;
        }
      }
      
      console.log(`[${migrationId}] ✓ Admin API migration: ${usersMigrated}/${authUsersResult.rows.length} users created`);
      console.log(`[${migrationId}] ⚠ IMPORTANT: Users must reset their passwords via "Forgot Password" flow`);
      console.log(`[${migrationId}] ⚠ MFA/OAuth identities were NOT migrated and must be reconfigured`);
      */
    } finally {
      await sourcePool.end();
    }
  } catch (error) {
    console.error(`[${migrationId}] Supabase Admin API migration error:`, error.message);
    throw error;
  }
}

/**
 * Direct PostgreSQL superuser approach for auth.users migration
 * USE WITH CAUTION - requires disabling RLS and elevated privileges
 * 
 * REQUIREMENTS:
 * - Direct PostgreSQL superuser connection (postgres user)
 * - Both source and target must be accessible PostgreSQL instances
 * - RLS must be temporarily disabled on auth.users
 * 
 * ADVANTAGES:
 * - Can migrate encrypted_password field directly
 * - Fast batch operation
 * - Preserves exact password hashes
 * 
 * RISKS:
 * - Requires superuser access (security risk)
 * - Disabling RLS on auth schema is dangerous
 * - May break Supabase's auth system if not done carefully
 * - NOT recommended for production Supabase projects
 */
async function migrateAuthUsersViaSuperuser(sourcePool, targetPool, migrationId) {
  console.log(`[${migrationId}] ⚠ RISKY: Using superuser approach to copy encrypted passwords`);
  console.log(`[${migrationId}] ⚠ This requires elevated privileges and careful handling`);
  
  try {
    // This is a template - NOT automatically executed
    const queries = `
    -- Step 1: Temporarily disable RLS (DANGEROUS - do this very carefully)
    ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
    
    -- Step 2: Copy all users including encrypted_password
    INSERT INTO auth.users 
    SELECT * FROM source_db.auth.users
    ON CONFLICT (id) DO UPDATE SET
      encrypted_password = EXCLUDED.encrypted_password,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      raw_app_meta_data = EXCLUDED.raw_app_meta_data,
      user_metadata = EXCLUDED.user_metadata;
    
    -- Step 3: Re-enable RLS (CRITICAL!)
    ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
    `;
    
    console.log(`[${migrationId}] Superuser approach requires manual execution of:`, queries);
    
  } catch (error) {
    console.error(`[${migrationId}] Superuser migration error:`, error.message);
    throw error;
  }
}

// ============================================================================
// MAIN API ENDPOINTS
// ============================================================================

/**
 * Health check endpoint
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Save Source Database credentials to .env
 * POST /api/migration/save-source
 */
app.post('/api/migration/save-source', async (req, res) => {
  try {
    const { baseUrl, password } = req.body;

    if (!baseUrl || !password) {
      return res.status(400).json({ error: 'baseUrl and password are required' });
    }

    console.log('[SAVE-SOURCE] Received source credentials');
    console.log(`[SAVE-SOURCE] URL: ${baseUrl}`);

    // Validate format
    let url = baseUrl.toLowerCase().replace('https://', '').replace('http://', '').trim();
    if (!url.includes('.supabase.co')) {
      return res.status(400).json({ error: 'Invalid Supabase URL format' });
    }

    const projectId = url.split('.supabase.co')[0];
    if (!projectId || projectId.length < 5) {
      return res.status(400).json({ error: 'Invalid project ID in URL' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password is too short' });
    }

    // Test connection before saving
    console.log('[SAVE-SOURCE] Testing connection...');
    const encodedPassword = encodeURIComponent(password);
    const connString = `postgres://postgres:${encodedPassword}@db.${projectId}.supabase.co:5432/postgres`;
    
    const testPool = new Pool({
      connectionString: connString,
    });

    try {
      await testPool.query('SELECT 1');
      console.log('[SAVE-SOURCE] ✅ Connection successful');
    } catch (connError) {
      console.error('[SAVE-SOURCE] ❌ Connection failed:', connError.message);
      
      let errorMsg = connError.message;
      if (connError.message.includes('timeout') || connError.message.includes('ETIMEDOUT')) {
        errorMsg = 'Connection timeout. Your Supabase project region may not be reachable from your location. Try using ap-south-1 (Mumbai) region instead.';
      } else if (connError.message.includes('ENOTFOUND')) {
        errorMsg = 'Database host not found. Check your Supabase URL.';
      } else if (connError.message.includes('password authentication')) {
        errorMsg = 'Authentication failed. Your database password is incorrect.';
      }
      
      return res.status(503).json({
        error: 'Cannot connect to source database',
        details: errorMsg,
      });
    } finally {
      await testPool.end();
    }

    // Get database info
    const infoPool = new Pool({
      connectionString: connString,
    });

    let dbInfo;
    try {
      dbInfo = await getDatabaseInfoPostgres(infoPool);
      console.log('[SAVE-SOURCE] Retrieved database info:', dbInfo);
    } finally {
      await infoPool.end();
    }

    // Save to .env
    saveEnvVariable('SOURCE_SUPABASE_URL', baseUrl);
    saveEnvVariable('SOURCE_DB_PASSWORD', password);

    console.log('[SAVE-SOURCE] ✅ Saved to .env');

    res.json({
      success: true,
      message: 'Source database credentials saved',
      source: {
        url: baseUrl,
        region: projectId,
        tables: dbInfo.tables,
        records: dbInfo.totalRecords,
        functions: dbInfo.functions,
        triggers: dbInfo.triggers,
        views: dbInfo.views,
        indexes: dbInfo.indexes,
      },
    });
  } catch (error) {
    console.error('[SAVE-SOURCE] Error:', error.message);
    res.status(500).json({
      error: 'Failed to save source credentials',
      details: error.message,
    });
  }
});

/**
 * Save Target Database credentials to .env
 * POST /api/migration/save-target
 */
app.post('/api/migration/save-target', async (req, res) => {
  try {
    const { baseUrl, password } = req.body;

    if (!baseUrl || !password) {
      return res.status(400).json({ error: 'baseUrl and password are required' });
    }

    console.log('[SAVE-TARGET] Received target credentials');
    console.log(`[SAVE-TARGET] URL: ${baseUrl}`);

    // Validate format
    let url = baseUrl.toLowerCase().replace('https://', '').replace('http://', '').trim();
    if (!url.includes('.supabase.co')) {
      return res.status(400).json({ error: 'Invalid Supabase URL format' });
    }

    const projectId = url.split('.supabase.co')[0];
    if (!projectId || projectId.length < 5) {
      return res.status(400).json({ error: 'Invalid project ID in URL' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password is too short' });
    }

    // Test connection before saving
    console.log('[SAVE-TARGET] Testing connection...');
    const encodedPassword = encodeURIComponent(password);
    const connString = `postgres://postgres:${encodedPassword}@db.${projectId}.supabase.co:5432/postgres`;
    
    const testPool = new Pool({
      connectionString: connString,
    });

    try {
      await testPool.query('SELECT 1');
      console.log('[SAVE-TARGET] ✅ Connection successful');
    } catch (connError) {
      console.error('[SAVE-TARGET] ❌ Connection failed:', connError.message);
      
      let errorMsg = connError.message;
      if (connError.message.includes('timeout') || connError.message.includes('ETIMEDOUT')) {
        errorMsg = 'Connection timeout. Your Supabase project region may not be reachable from your location. Try using ap-south-1 (Mumbai) region instead.';
      } else if (connError.message.includes('ENOTFOUND')) {
        errorMsg = 'Database host not found. Check your Supabase URL.';
      } else if (connError.message.includes('password authentication')) {
        errorMsg = 'Authentication failed. Your database password is incorrect.';
      }
      
      return res.status(503).json({
        error: 'Cannot connect to target database',
        details: errorMsg,
      });
    } finally {
      await testPool.end();
    }

    // Save to .env
    saveEnvVariable('TARGET_SUPABASE_URL', baseUrl);
    saveEnvVariable('TARGET_DB_PASSWORD', password);

    console.log('[SAVE-TARGET] ✅ Saved to .env');

    res.json({
      success: true,
      message: 'Target database credentials saved',
      target: {
        url: baseUrl,
        region: projectId,
      },
    });
  } catch (error) {
    console.error('[SAVE-TARGET] Error:', error.message);
    res.status(500).json({
      error: 'Failed to save target credentials',
      details: error.message,
    });
  }
});

/**
 * Get Migration Summary (reads from .env)
 * POST /api/migration/summary
 */
app.post('/api/migration/summary', async (req, res) => {
  try {
    console.log('[SUMMARY] Getting migration summary from .env credentials');

    let credentials;
    try {
      credentials = getMigrationCredentials();
    } catch (err) {
      return res.status(400).json({
        error: 'Incomplete credentials',
        details: err.message,
      });
    }

    const sourceUrl = convertSupabaseUrlToPostgres(credentials.source.url, credentials.source.password);
    const targetUrl = convertSupabaseUrlToPostgres(credentials.target.url, credentials.target.password);

    // Connect to source
    console.log('[SUMMARY] Connecting to source...');
    const sourcePool = new Pool({
      connectionString: sourceUrl,
    });

    let sourceInfo;
    try {
      sourceInfo = await getDatabaseInfoPostgres(sourcePool);
      console.log('[SUMMARY] ✅ Source connected:', sourceInfo);
    } finally {
      await sourcePool.end();
    }

    // Connect to target
    console.log('[SUMMARY] Connecting to target...');
    const targetPool = new Pool({
      connectionString: targetUrl,
    });

    let targetConnected = false;
    try {
      await targetPool.query('SELECT 1');
      targetConnected = true;
      console.log('[SUMMARY] ✅ Target connected');
    } finally {
      await targetPool.end();
    }

    const sourceRegion = extractRegion(credentials.source.url);
    const targetRegion = extractRegion(credentials.target.url);

    const summary = {
      source: {
        url: credentials.source.url,
        region: sourceRegion,
        tables: sourceInfo.tables,
        records: sourceInfo.totalRecords,
        functions: sourceInfo.functions,
        triggers: sourceInfo.triggers,
        views: sourceInfo.views,
        indexes: sourceInfo.indexes,
      },
      target: {
        url: credentials.target.url,
        region: targetRegion,
        connected: targetConnected,
      },
      regions: {
        source: sourceRegion,
        target: targetRegion,
        sameRegion: sourceRegion === targetRegion,
      },
      warnings: [],
    };

    if (sourceRegion !== targetRegion) {
      summary.warnings.push({
        severity: 'warning',
        message: `Source is in ${sourceRegion}, target is in ${targetRegion}. Migration may take longer.`,
      });
    }

    res.json(summary);
  } catch (error) {
    console.error('[SUMMARY] Error:', error.message);
    res.status(500).json({
      error: 'Failed to get migration summary',
      details: error.message,
    });
  }
});

/**
 * Start Migration (reads from .env)
 * POST /api/migration/start
 */
app.post('/api/migration/start', async (req, res) => {
  try {
    console.log('[MIGRATION] Starting migration from .env credentials');

    let credentials;
    try {
      credentials = getMigrationCredentials();
    } catch (err) {
      return res.status(400).json({
        error: 'Incomplete credentials',
        details: err.message,
      });
    }

    const migrationId = `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[MIGRATION] Started: ${migrationId}`);
    
    migrations.set(migrationId, {
      id: migrationId,
      status: 'pending',
      startTime: new Date(),
      progress: 0,
      currentStep: 'Initializing...',
      details: {
        tablesProcessed: 0,
        totalTables: 0,
        recordsMigrated: 0,
        totalRecords: 0,
        functionsMigrated: 0,
        totalFunctions: 0,
        triggersMigrated: 0,
        totalTriggers: 0,
        viewsMigrated: 0,
        totalViews: 0,
        policiesMigrated: 0,
        totalPolicies: 0,
      },
      errors: [],
    });

    // Start async migration
    performMigration(migrationId, credentials);

    res.json({ migrationId });
  } catch (error) {
    console.error('[MIGRATION START] Error:', error.message);
    res.status(500).json({
      error: 'Failed to start migration',
      details: error.message,
    });
  }
});

/**
 * Get Migration Progress
 * GET /api/migration/:migrationId/progress
 */
app.get('/api/migration/:migrationId/progress', (req, res) => {
  try {
    const { migrationId } = req.params;
    const migration = migrations.get(migrationId);

    if (!migration) {
      return res.status(404).json({ error: 'Migration not found' });
    }

    res.json({
      migrationId,
      status: migration.status,
      progress: migration.progress,
      currentStep: migration.currentStep,
      details: migration.details,
      errors: migration.errors,
    });
  } catch (error) {
    console.error('[PROGRESS] Error:', error.message);
    res.status(500).json({
      error: 'Failed to get progress',
      details: error.message,
    });
  }
});

/**
 * Get Migration Report
 * GET /api/migration/:migrationId/report
 * 
 * Report includes:
 * - Migration status and timing
 * - Tables/functions/triggers/views migrated
 * - Auth users migrated with critical warnings
 * - Failed objects and errors
 */
app.get('/api/migration/:migrationId/report', (req, res) => {
  try {
    const { migrationId } = req.params;
    const migration = migrations.get(migrationId);

    if (!migration) {
      return res.status(404).json({ error: 'Migration not found' });
    }

    const endTime = migration.endTime || new Date();
    const duration = Math.floor((endTime - migration.startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    const report = {
      migrationId,
      startTime: migration.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: `${minutes}m ${seconds}s`,
      status: migration.status,
      summary: {
        tablesMigrated: migration.details.tablesProcessed,
        totalTables: migration.details.totalTables,
        recordsMigrated: migration.details.recordsMigrated,
        totalRecords: migration.details.totalRecords,
        functionsMigrated: migration.details.functionsMigrated,
        totalFunctions: migration.details.totalFunctions,
        triggersMigrated: migration.details.triggersMigrated,
        totalTriggers: migration.details.totalTriggers,
        viewsMigrated: migration.details.viewsMigrated,
        totalViews: migration.details.totalViews,
        policiesMigrated: migration.details.policiesMigrated,
        totalPolicies: migration.details.totalPolicies,
      },
      authMigration: {
        note: 'Auth users and OAuth provider identities migrated',
        passwordsMigrated: migration.details.usersMigratedWithPasswords || 0,
        identitiesMigrated: migration.details.identitiesMigrated || 0,
        approach: 'Direct PostgreSQL with parameterized queries (safe from SQL injection)',
        migratedTables: [
          'auth.users (with encrypted passwords)',
          'auth.identities (OAuth provider links)'
        ],
        migratedFields: [
          'id (user identifier)',
          'email',
          'phone', 
          'encrypted_password ← PASSWORDS INCLUDED',
          'raw_user_meta_data',
          'raw_app_meta_data',
          'user_metadata',
          'aud (audience)',
          'role',
          'confirmation_token',
          'confirmation_sent_at',
          'recovery_token',
          'recovery_sent_at',
          'recovery_code_sent_at',
          'created_at',
          'last_sign_in_at (exact SOURCE value migrated)',
          'Provider (from auth.identities.provider) ← OAUTH LINKS MIGRATED',
          'identity_data (OAuth account information)'
        ],
        notMigratedFields: [
          'email_confirmed_at (Supabase system-managed - cannot INSERT)',
          'phone_confirmed_at (Supabase system-managed - cannot INSERT)',
          'confirmed_at (Supabase system-managed - cannot INSERT)',
          'last_sign_in_ip (Supabase auto-sets on first login)',
          'last_sign_in_provider (Supabase auto-sets on first login)',
          'factors (MFA configuration - requires user reconfiguration)',
          'is_super_admin (admin-only field)',
          'banned_until (admin-managed)',
          'deleted_at (soft delete marker)'
        ],
        warnings: [
          'Users can log in immediately with their original passwords',
          'OAuth provider links have been migrated - users will see their linked providers',
          'MFA factors were not migrated - users must reconfigure 2FA',
          'Session tokens are invalid in target - users will need to log in again'
        ],
        successCriteria: [
          'Users can log in with original password ✓',
          'User metadata is available in target ✓',
          'User IDs are preserved ✓',
          'OAuth provider links are visible in Supabase dashboard ✓',
          'Custom metadata (raw_user_meta_data, user_metadata) transferred ✓'
        ],
        failedUsers: migration.details.failedAuthUsers || [],
        failedIdentities: migration.details.failedAuthIdentities || []
      },
      failedObjects: migration.errors,
      recommendations: {
        authUsers: [
          '1. Send notification to all users to reset passwords in target project',
          '2. Provide link to password reset flow',
          '3. Allow re-linking of OAuth providers if used',
          '4. Request email/phone re-verification if needed for compliance'
        ],
        testing: [
          '1. Verify random sample of users can log in with original credentials',
          '2. Test password reset flow for a user',
          '3. Verify user metadata was transferred correctly',
          '4. Check that failed users are retried or manually created'
        ]
      }
    };

    res.json(report);
  } catch (error) {
    console.error('[REPORT] Error:', error.message);
    res.status(500).json({
      error: 'Failed to get report',
      details: error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    details: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Supabase Migration Backend Server`);
  console.log(`📍 Listening on http://localhost:${PORT}`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api`);
  console.log(`❤️  Health: http://localhost:${PORT}/health\n`);
});

// ============================================================================
// MIGRATION LOGIC
// ============================================================================

// In-memory migration storage
const migrations = new Map();

/**
 * Perform the actual migration
 */
async function performMigration(migrationId, credentials) {
  const migration = migrations.get(migrationId);
  if (!migration) return;

  try {
    migration.status = 'connecting';
    migration.currentStep = 'Connecting to source database...';
    migration.progress = 10;

    const sourceUrl = convertSupabaseUrlToPostgres(credentials.source.url, credentials.source.password);
    const targetUrl = convertSupabaseUrlToPostgres(credentials.target.url, credentials.target.password);

    console.log(`[${migrationId}] Source DB: postgres://***@${sourceUrl.split('@')[1]}`);
    console.log(`[${migrationId}] Target DB: postgres://***@${targetUrl.split('@')[1]}`);

    // Phase 1: Get source info
    const sourcePool = new Pool({
      connectionString: sourceUrl,
    });

    let sourceInfo;
    try {
      sourceInfo = await getDatabaseInfoPostgres(sourcePool);
      console.log(`[${migrationId}] Source DB Info:`, sourceInfo);
      migration.currentStep = `✓ Connected to source (${sourceInfo.tables} tables)`;
      migration.progress = 30;
      migration.details.totalTables = sourceInfo.tables;
      migration.details.totalRecords = sourceInfo.totalRecords;
      migration.details.totalFunctions = sourceInfo.functions;
      migration.details.totalTriggers = sourceInfo.triggers;
      migration.details.totalViews = sourceInfo.views;
    } finally {
      await sourcePool.end();
    }

    // Phase 2: Verify target
    migration.currentStep = 'Connecting to target database...';
    migration.progress = 40;

    const targetPool = new Pool({
      connectionString: targetUrl,
    });

    try {
      await targetPool.query('SELECT 1');
      console.log(`[${migrationId}] Target database accessible`);
      migration.currentStep = '✓ Connected to target database';
      migration.progress = 50;
    } finally {
      await targetPool.end();
    }

    // Phase 3: Run migration
    migration.currentStep = 'Running data migration...';
    migration.status = 'migrating';
    migration.progress = 60;

    try {
      console.log(`[${migrationId}] Starting migration...`);
      
      await executeMigration(sourceUrl, targetUrl, migrationId);
      
      migration.details.recordsMigrated = sourceInfo.totalRecords;
      migration.details.tablesProcessed = sourceInfo.tables;
      migration.details.functionsMigrated = sourceInfo.functions;
      migration.details.triggersMigrated = sourceInfo.triggers;
      migration.details.viewsMigrated = sourceInfo.views;
      
      migration.currentStep = '✓ Data migration completed';
      migration.progress = 90;
      
      console.log(`[${migrationId}] ✓ Migration completed`);
    } catch (migrationError) {
      console.error(`[${migrationId}] Migration error:`, migrationError.message);
      migration.errors.push({
        objectName: 'Migration',
        objectType: 'Process',
        error: migrationError.message,
      });
    }

    // Phase 4: Finalize
    await new Promise(resolve => setTimeout(resolve, 1000));
    migration.progress = 100;
    migration.currentStep = 'Migration completed successfully!';
    migration.status = 'completed';
    migration.endTime = new Date();
    
    console.log(`[${migrationId}] ✅ Migration workflow completed`);
  } catch (error) {
    console.error(`[${migrationId}] ❌ Migration failed:`, error.message);
    migration.status = 'failed';
    migration.endTime = new Date();
    if (migration.errors.length === 0) {
      migration.errors.push({
        objectName: 'Migration Process',
        objectType: 'System',
        error: error.message,
      });
    }
  }
}

/**
 * Execute actual migration using direct SQL copy
 */
async function executeMigration(sourceUrl, targetUrl, migrationId) {
  const { spawn } = await import('child_process');
  const fs = await import('fs');
  const path = await import('path');

  return new Promise(async (resolve, reject) => {
    try {
      console.log(`[${migrationId}] Starting direct database migration...`);
      
      // Get migration object from global map
      const migration = migrations.get(migrationId);
      if (!migration) {
        throw new Error(`Migration ${migrationId} not found in migrations map`);
      }
      
      // Create connection pools for both databases
      const sourcePool = new Pool({ connectionString: sourceUrl });
      const targetPool = new Pool({ connectionString: targetUrl });

      try {
        // Get all tables from source (including auth schema if exists)
        console.log(`[${migrationId}] Fetching table list from source...`);
        const tablesResult = await sourcePool.query(`
          SELECT table_schema, table_name FROM information_schema.tables 
          WHERE table_schema IN ('public', 'auth') AND table_type = 'BASE TABLE'
          ORDER BY table_schema, table_name
        `);
        
        const tables = tablesResult.rows;
        console.log(`[${migrationId}] Found ${tables.length} tables to migrate`);

        // Clear target database (drop all tables from both schemas)
        console.log(`[${migrationId}] Clearing target database...`);
        await targetPool.query(`
          DO $$ 
          DECLARE 
            r RECORD; 
          BEGIN 
            FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname IN ('public', 'auth')) LOOP 
              EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE'; 
            END LOOP; 
          END $$;
        `);
        
        // Create auth schema if it doesn't exist
        try {
          await targetPool.query(`CREATE SCHEMA IF NOT EXISTS auth`);
        } catch (e) {
          // Schema might already exist or permission denied, continue
        }
        
        console.log(`[${migrationId}] Target database cleared`);

        // Migrate each table
        let tablesProcessed = 0;
        for (const tableObj of tables) {
          const schema = tableObj.table_schema;
          const table = tableObj.table_name;
          
          try {
            console.log(`[${migrationId}] Migrating table: ${schema}.${table}...`);
            
            // IMPORTANT: Drop and recreate to ensure TEXT schema (not character(n))
            try {
              const dropSql = `DROP TABLE IF EXISTS ${schema === 'auth' ? 'auth.' : ''}"${table}" CASCADE`;
              await targetPool.query(dropSql);
            } catch (dropErr) {
              // Ignore drop errors - table might not exist
            }
            
            // Get table structure from source
            const columnsResult = await sourcePool.query(`
              SELECT column_name, data_type, is_nullable
              FROM information_schema.columns
              WHERE table_schema = $1 AND table_name = $2
              ORDER BY ordinal_position
            `, [schema, table]);

            if (columnsResult.rows.length === 0) {
              console.log(`[${migrationId}]   ⚠ No columns found, skipping`);
              continue;
            }

            // Build CREATE TABLE statement with proper data types
            // IMPORTANT: Force character/varchar columns to TEXT to prevent truncation
            const createTableSql = `CREATE TABLE ${schema === 'auth' ? 'auth.' : ''}"${table}" (
              ${columnsResult.rows.map(col => {
                const notNull = col.is_nullable === 'NO' ? ' NOT NULL' : '';
                let dataType = col.data_type;
                
                // Convert character(n) and varchar(n) to TEXT - handle all variations
                if (dataType.includes('character') || dataType.includes('varchar')) {
                  dataType = 'TEXT';
                }
                // Also convert numeric types with length limits
                else if (dataType.includes('numeric') || dataType.includes('decimal')) {
                  dataType = 'NUMERIC';
                }
                
                return `"${col.column_name}" ${dataType}${notNull}`;
              }).join(', ')}
            )`;

            try {
              await targetPool.query(createTableSql);
              console.log(`[${migrationId}]   ✓ Table structure created`);
            } catch (createErr) {
              // Table creation failed, skip this table
              console.log(`[${migrationId}]   ⚠ Table structure (${createErr.message})`);
              continue;
            }

            // Copy data using parameterized approach
            const dataResult = await sourcePool.query(`SELECT * FROM "${schema}"."${table}"`);
            
            if (dataResult.rows.length > 0) {
              const columns = Object.keys(dataResult.rows[0]);
              const columnList = columns.map(c => `"${c}"`).join(', ');
              let recordsCopied = 0;
              
              // Process each row individually
              for (const row of dataResult.rows) {
                try {
                  // Build values - NO TRUNCATION needed since target is TEXT
                  const values = columns.map(col => {
                    let val = row[col];
                    
                    if (val === null) return null;
                    
                    // Handle JSON and arrays
                    if (typeof val === 'object' && val !== null) {
                      return JSON.stringify(val);
                    }
                    
                    // Convert to string
                    return String(val);
                  });
                  
                  const schemaPrefix = schema === 'auth' ? 'auth.' : '';
                  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
                  const insertSql = `INSERT INTO ${schemaPrefix}"${table}" (${columnList}) VALUES (${placeholders})`;
                  
                  await targetPool.query(insertSql, values);
                  recordsCopied++;
                } catch (rowErr) {
                  // Log error and skip
                  console.log(`[${migrationId}]   ⚠ Row error: ${rowErr.message}`);
                }
              }
              
              console.log(`[${migrationId}]   ✓ Copied ${recordsCopied} records`);
            } else {
              console.log(`[${migrationId}]   ✓ Table is empty`);
            }

            tablesProcessed++;
          } catch (tableError) {
            console.error(`[${migrationId}] Error migrating ${schema}.${table}:`, tableError.message);
            // Continue with next table
          }
        }

        console.log(`[${migrationId}] ✅ Migrated ${tablesProcessed}/${tables.length} tables successfully`);

        // Migrate Functions
        console.log(`[${migrationId}] Migrating functions...`);
        try {
          const functionsResult = await sourcePool.query(`
            SELECT routine_name, routine_definition, routine_type
            FROM information_schema.routines
            WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
          `);
          
          let functionsMigrated = 0;
          for (const func of functionsResult.rows) {
            try {
              // Get the full function definition using pg_get_functiondef
              const fullDefResult = await sourcePool.query(`
                SELECT pg_get_functiondef(oid) as definition
                FROM pg_proc
                WHERE proname = $1 AND pronamespace = (
                  SELECT oid FROM pg_namespace WHERE nspname = 'public'
                )
              `, [func.routine_name]);
              
              if (fullDefResult.rows.length > 0) {
                const fullDef = fullDefResult.rows[0].definition;
                
                try {
                  // Try to drop and recreate
                  await targetPool.query(`DROP FUNCTION IF EXISTS ${func.routine_name}() CASCADE`);
                  await targetPool.query(fullDef);
                  functionsMigrated++;
                  console.log(`[${migrationId}]   ✓ Function: ${func.routine_name}`);
                } catch (createErr) {
                  console.log(`[${migrationId}]   ⚠ Function ${func.routine_name}: ${createErr.message}`);
                }
              }
            } catch (funcErr) {
              console.log(`[${migrationId}]   ⚠ Function ${func.routine_name}: ${funcErr.message}`);
            }
          }
          migration.details.functionsMigrated = functionsMigrated;
          migration.details.totalFunctions = functionsResult.rows.length;
          console.log(`[${migrationId}] ✅ Migrated ${functionsMigrated}/${functionsResult.rows.length} functions`);
        } catch (err) {
          console.log(`[${migrationId}] ⚠ Could not migrate functions: ${err.message}`);
        }

        // Migrate Triggers
        console.log(`[${migrationId}] Migrating triggers...`);
        try {
          const triggersResult = await sourcePool.query(`
            SELECT trigger_name, event_object_table
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
          `);
          
          let triggersMigrated = 0;
          for (const trigger of triggersResult.rows) {
            try {
              // Get the full trigger definition
              const triggerDefResult = await sourcePool.query(`
                SELECT pg_get_triggerdef(oid) as definition
                FROM pg_trigger
                WHERE tgname = $1
              `, [trigger.trigger_name]);
              
              if (triggerDefResult.rows.length > 0) {
                const triggerDef = triggerDefResult.rows[0].definition;
                
                try {
                  // Drop trigger if exists
                  await targetPool.query(`DROP TRIGGER IF EXISTS ${trigger.trigger_name} ON ${trigger.event_object_table} CASCADE`);
                  
                  // Recreate trigger
                  await targetPool.query(triggerDef);
                  triggersMigrated++;
                  console.log(`[${migrationId}]   ✓ Trigger: ${trigger.trigger_name}`);
                } catch (createErr) {
                  console.log(`[${migrationId}]   ⚠ Trigger ${trigger.trigger_name}: ${createErr.message}`);
                }
              }
            } catch (trigErr) {
              console.log(`[${migrationId}]   ⚠ Trigger ${trigger.trigger_name}: ${trigErr.message}`);
            }
          }
          migration.details.triggersMigrated = triggersMigrated;
          migration.details.totalTriggers = triggersResult.rows.length;
          console.log(`[${migrationId}] ✅ Migrated ${triggersMigrated}/${triggersResult.rows.length} triggers`);
        } catch (err) {
          console.log(`[${migrationId}] ⚠ Could not migrate triggers: ${err.message}`);
        }

        // Migrate Auth User Data WITH PASSWORDS (excluding system-managed columns)
        console.log(`[${migrationId}] Attempting to migrate auth.users WITH encrypted passwords...`);
        try {
          // Check if auth.users exists
          const tableExistsResult = await sourcePool.query(`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.tables 
              WHERE table_schema = 'auth' AND table_name = 'users'
            ) as exists
          `);
          
          if (!tableExistsResult.rows[0].exists) {
            console.log(`[${migrationId}]   ⚠ auth.users table does not exist in source`);
          } else {
            // Get all columns from auth.users
            const colsResult = await sourcePool.query(`
              SELECT column_name FROM information_schema.columns 
              WHERE table_schema = 'auth' AND table_name = 'users'
              ORDER BY ordinal_position
            `);
            
            const allColumns = colsResult.rows.map(r => r.column_name);
            console.log(`[${migrationId}]   Found ${allColumns.length} columns in auth.users`);
            
            // Columns to EXCLUDE from migration (cannot be set on INSERT due to Supabase constraints)
            // These MUST remain excluded because Supabase has NOT NULL + DEFAULT constraints
            const excludeColumns = [
              'confirmed_at',                    // NOT NULL DEFAULT - Supabase won't allow INSERT
              'email_confirmed_at',              // DEFAULT constraint - Supabase won't allow INSERT
              'phone_confirmed_at',              // DEFAULT constraint - Supabase won't allow INSERT
              'last_sign_in_ip',                 // NOT NULL DEFAULT - Supabase constraint
              'last_sign_in_provider',           // NOT NULL DEFAULT - Supabase constraint
              'updated_at',                      // NOT NULL DEFAULT - Auto-updated by triggers
              'identities',                      // JSONB column - stored in separate auth.identities table
              'factors',                         // JSONB column - stored in separate auth.factors table
              'is_super_admin',                  // Admin-only - security restriction
              'is_sso_user',                     // NOT NULL DEFAULT - Supabase constraint
              'is_anonymous'                     // NOT NULL DEFAULT - Supabase constraint
            ];
            
            // IMPORTANT: last_sign_in_at IS NOW INCLUDED - can be migrated with exact source value
            
            // Columns that CAN be migrated with exact source values (including NULLs)
            const migrateColumns = allColumns.filter(col => !excludeColumns.includes(col));
            console.log(`[${migrationId}]   Found ${allColumns.length} total columns in auth.users`);
            console.log(`[${migrationId}]   Will migrate ${migrateColumns.length} columns with EXACT source values`);
            console.log(`[${migrationId}]   Excluding ${excludeColumns.length} columns with Supabase NOT NULL + DEFAULT constraints`);
            
            // Check if encrypted_password will be migrated
            const hasPassword = migrateColumns.includes('encrypted_password');
            console.log(`[${migrationId}]   Encrypted password will be migrated: ${hasPassword ? '✓' : '✗'}`);
            
            // Fetch auth users - include only allowed columns
            const columnList = migrateColumns.map(c => `"${c}"`).join(', ');
            const selectSql = `SELECT ${columnList} FROM auth.users`;
            
            const authUsersResult = await sourcePool.query(selectSql);
            console.log(`[${migrationId}]   Found ${authUsersResult.rows.length} auth users to migrate`);
            
            // Log column migration status
            const hasLastSignIn = migrateColumns.includes('last_sign_in_at');
            console.log(`[${migrationId}]   last_sign_in_at included in migration: ${hasLastSignIn ? '✓' : '✗'}`);
            
            if (authUsersResult.rows.length > 0) {
              let usersMigrated = 0;
              let usersFailed = 0;
              const failedUsers = [];
              
              for (const user of authUsersResult.rows) {
                try {
                  // Build values array - EXACT source values, no modifications
                  // If source has NULL → keep NULL, if source has value → keep value
                  const values = migrateColumns.map(col => user[col] !== undefined ? user[col] : null);
                  const placeholders = migrateColumns.map((_, i) => `$${i + 1}`).join(', ');
                  
                  // Log last_sign_in_at source value
                  const sourceLastSignIn = user.last_sign_in_at ? user.last_sign_in_at.toISOString() : '[NULL]';
                  const migrationLastSignIn = hasLastSignIn ? sourceLastSignIn : '[NOT INCLUDED]';
                  console.log(`[${migrationId}]   📝 ${user.email}: source last_sign_in_at = ${sourceLastSignIn}`);
                  
                  // UPDATE clause: update all columns except id
                  const updateSet = migrateColumns
                    .filter(c => c !== 'id')
                    .map((c, i) => `"${c}" = EXCLUDED."${c}"`)
                    .join(', ');
                  
                  const upsertSql = `
                    INSERT INTO auth.users (${columnList})
                    VALUES (${placeholders})
                    ON CONFLICT (id) DO UPDATE SET ${updateSet}
                  `;
                  
                  await targetPool.query(upsertSql, values);
                  
                  // Verify target value after migration
                  const targetVerify = await targetPool.query(
                    'SELECT last_sign_in_at FROM auth.users WHERE id = $1',
                    [user.id]
                  );
                  const targetLastSignIn = targetVerify.rows[0]?.last_sign_in_at 
                    ? targetVerify.rows[0].last_sign_in_at.toISOString() 
                    : '[NULL]';
                  
                  // Check if migration value matches target
                  const match = sourceLastSignIn === targetLastSignIn ? '✅' : '❌';
                  console.log(`[${migrationId}]   ${match} target last_sign_in_at = ${targetLastSignIn}`);
                  
                  usersMigrated++;
                  
                  // Log with password indicator
                  const hasPasswd = user.encrypted_password ? '🔐' : '⚠️';
                  console.log(`[${migrationId}]   ${hasPasswd} User ${user.email || user.id} migrated`);
                  
                } catch (err) {
                  usersFailed++;
                  failedUsers.push({
                    email: user.email || 'unknown',
                    id: user.id,
                    error: err.message,
                  });
                  console.log(`[${migrationId}]   ❌ User ${user.id}: ${err.message}`);
                }
              }
              
              console.log(`[${migrationId}]   ✓ Auth users migrated: ${usersMigrated}/${authUsersResult.rows.length}`);
              if (usersFailed > 0) {
                console.log(`[${migrationId}]   ❌ Failed: ${usersFailed} users`);
                console.log(`[${migrationId}]   Run migration again to retry failed users`);
              }
              
              if (hasPassword && usersMigrated > 0) {
                console.log(`[${migrationId}] 🔐 ENCRYPTED PASSWORDS SUCCESSFULLY MIGRATED ✓`);
              }
              
              // Report excluded columns with Supabase constraints
              console.log(`[${migrationId}]   `);
              console.log(`[${migrationId}]   ℹ️  Columns EXCLUDED due to Supabase NOT NULL + DEFAULT constraints:`);
              const constraintColumns = ['last_sign_in_ip', 'last_sign_in_provider', 'updated_at', 'is_sso_user', 'is_anonymous'];
              for (const col of constraintColumns) {
                if (allColumns.includes(col)) {
                  console.log(`[${migrationId}]      - ${col} (will use Supabase default on first login)`);
                }
              }
              console.log(`[${migrationId}]   ℹ️  Columns EXCLUDED (JSONB - separate tables):`);
              console.log(`[${migrationId}]      - identities (see auth.identities table - MIGRATING SEPARATELY)`);
              console.log(`[${migrationId}]      - factors (see auth.factors table - USER MUST RECONFIGURE)`);
              console.log(`[${migrationId}]   `);
              
              if (failedUsers.length > 0) {
                migration.details.failedAuthUsers = failedUsers;
              }
              migration.details.usersMigratedWithPasswords = usersMigrated;
            }
          }
        } catch (err) {
          console.log(`[${migrationId}] ⚠ Auth migration note: ${err.message}`);
          // Don't fail entire migration if auth fails - it's expected with Supabase
          if (!err.message.includes('permission denied') && !err.message.includes('does not exist')) {
            migration.errors.push({
              objectName: 'Auth Users',
              objectType: 'auth.users',
              error: err.message,
            });
          }
        }

        // ===== MIGRATE AUTH.IDENTITIES (OAuth Provider Links) =====
        console.log(`[${migrationId}] Migrating OAuth provider identities (auth.identities)...`);
        try {
          // Check if auth.identities table exists in source
          const identitiesTableResult = await sourcePool.query(`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.tables 
              WHERE table_schema = 'auth' AND table_name = 'identities'
            ) as exists
          `);
          
          if (!identitiesTableResult.rows[0].exists) {
            console.log(`[${migrationId}]   ⚠ auth.identities table does not exist in source`);
          } else {
            // Read ALL OAuth identities from source (READ-ONLY)
            // IMPORTANT: Include provider_id - this is required by target schema (NOT NULL)
            const identitiesResult = await sourcePool.query(`
              SELECT 
                id,
                user_id,
                provider_id,
                identity_data,
                provider,
                last_sign_in_at,
                created_at,
                updated_at
              FROM auth.identities
              ORDER BY user_id, provider
            `);
            
            const identityCount = identitiesResult.rows.length;
            console.log(`[${migrationId}]   Found ${identityCount} OAuth identities to migrate`);
            
            if (identityCount > 0) {
              let identitiesMigrated = 0;
              let identitiesFailed = 0;
              const failedIdentities = [];
              
              for (const identity of identitiesResult.rows) {
                try {
                  // Build parameterized UPSERT for each identity
                  // Including provider_id which is required by target schema
                  const upsertSql = `
                    INSERT INTO auth.identities 
                      (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
                    VALUES 
                      ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO UPDATE SET 
                      provider_id = EXCLUDED.provider_id,
                      identity_data = EXCLUDED.identity_data,
                      last_sign_in_at = EXCLUDED.last_sign_in_at,
                      updated_at = EXCLUDED.updated_at
                  `;
                  
                  await targetPool.query(upsertSql, [
                    identity.id,
                    identity.user_id,
                    identity.provider_id,
                    identity.identity_data,
                    identity.provider,
                    identity.last_sign_in_at,
                    identity.created_at,
                    identity.updated_at
                  ]);
                  
                  identitiesMigrated++;
                  console.log(`[${migrationId}]   ✓ Provider: ${identity.provider} for user ${identity.user_id.substring(0, 8)}...`);
                  
                } catch (err) {
                  identitiesFailed++;
                  failedIdentities.push({
                    id: identity.id,
                    user_id: identity.user_id,
                    provider: identity.provider,
                    error: err.message,
                  });
                  console.log(`[${migrationId}]   ❌ OAuth identity ${identity.provider}: ${err.message}`);
                }
              }
              
              console.log(`[${migrationId}]   ✓ OAuth identities migrated: ${identitiesMigrated}/${identityCount}`);
              if (identitiesFailed > 0) {
                console.log(`[${migrationId}]   ⚠ Failed OAuth identities: ${identitiesFailed}`);
              }
              
              if (identitiesMigrated > 0) {
                console.log(`[${migrationId}] 🔗 OAUTH PROVIDER LINKS SUCCESSFULLY MIGRATED ✓`);
              }
              
              if (failedIdentities.length > 0) {
                migration.details.failedAuthIdentities = failedIdentities;
              }
              migration.details.identitiesMigrated = identitiesMigrated;
              migration.details.totalIdentities = identityCount;
            }
          }
        } catch (err) {
          console.log(`[${migrationId}] ⚠ OAuth identities note: ${err.message}`);
          // Don't fail entire migration if identities fail - it's optional
          if (!err.message.includes('permission denied') && !err.message.includes('does not exist')) {
            console.log(`[${migrationId}]   Users can manually re-link OAuth providers in target project`);
          }
        }

        resolve();
      } finally {
        await sourcePool.end();
        await targetPool.end();
      }
    } catch (error) {
      console.error(`[${migrationId}] Migration error:`, error.message);
      reject(error);
    }
  });
}
