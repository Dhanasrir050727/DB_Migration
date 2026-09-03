/**
 * Local Storage Service
 * Manages session state for the migration wizard
 */

export interface MigrationState {
  sourceCredentials?: {
    baseUrl: string;
    anonKey: string;
  };
  targetCredentials?: {
    baseUrl: string;
    anonKey: string;
  };
  migrationId?: string;
  currentStep: 'source' | 'target' | 'summary' | 'migration' | 'completed';
}

const STORAGE_KEY = 'supabase_migration_state';
const DEFAULT_STATE: MigrationState = {
  currentStep: 'source',
};

export const storageService = {
  getState(): MigrationState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_STATE;
    } catch (error) {
      console.error('Failed to retrieve state from storage:', error);
      return DEFAULT_STATE;
    }
  },

  setState(state: MigrationState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save state to storage:', error);
    }
  },

  updateState(updates: Partial<MigrationState>): MigrationState {
    const current = this.getState();
    const updated = { ...current, ...updates };
    this.setState(updated);
    return updated;
  },

  clearState(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear state from storage:', error);
    }
  },
};
