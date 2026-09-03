import React, { useState, useEffect } from 'react';
import { StepIndicator } from './components/StepIndicator';
import { SourceDatabaseStep } from './components/SourceDatabaseStep';
import { TargetDatabaseStep } from './components/TargetDatabaseStep';
import { MigrationSummaryStep } from './components/MigrationSummaryStep';
import { MigrationProgressStep } from './components/MigrationProgressStep';
import { MigrationCompletedStep } from './components/MigrationCompletedStep';
import {
  getMigrationSummary,
  getMigrationReport,
  SourceDatabaseCredentials,
  TargetDatabaseCredentials,
  MigrationSummary,
  MigrationReport,
} from './services/api';
import { storageService } from './services/storage';
import './App.css';

type StepType = 'source' | 'target' | 'summary' | 'migration' | 'completed';

interface AppState {
  currentStep: StepType;
  sourceCredentials?: SourceDatabaseCredentials;
  targetCredentials?: TargetDatabaseCredentials;
  migrationSummary?: MigrationSummary;
  migrationId?: string;
  migrationReport?: MigrationReport;
}

const STEPS = [
  { id: 'source', label: 'Source Database' },
  { id: 'target', label: 'Target Database' },
  { id: 'summary', label: 'Review Summary' },
  { id: 'migration', label: 'Migration Progress' },
  { id: 'completed', label: 'Completed' },
];

export const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const stored = storageService.getState();
    return {
      currentStep: (stored.currentStep as StepType) || 'source',
      sourceCredentials: stored.sourceCredentials,
      targetCredentials: stored.targetCredentials,
      migrationId: stored.migrationId,
    };
  });

  useEffect(() => {
    storageService.setState({
      currentStep: state.currentStep,
      sourceCredentials: state.sourceCredentials,
      targetCredentials: state.targetCredentials,
      migrationId: state.migrationId,
    });
  }, [state]);

  const handleSourceNext = async (credentials: SourceDatabaseCredentials) => {
    setState((prev) => ({
      ...prev,
      sourceCredentials: credentials,
      currentStep: 'target',
    }));
  };

  const handleTargetNext = async (credentials: TargetDatabaseCredentials) => {
    if (!state.sourceCredentials) return;

    try {
      const summary = await getMigrationSummary();
      setState((prev) => ({
        ...prev,
        targetCredentials: credentials,
        migrationSummary: summary,
        currentStep: 'summary',
      }));
    } catch (error) {
      console.error('Failed to get migration summary:', error);
      alert('Failed to get migration summary. Please try again.');
    }
  };

  const handleSummaryNext = (migrationId: string) => {
    setState((prev) => ({
      ...prev,
      migrationId,
      currentStep: 'migration',
    }));
  };

  const handleMigrationComplete = async (progressData: any) => {
    try {
      const report = await getMigrationReport(progressData.migrationId);
      setState((prev) => ({
        ...prev,
        migrationReport: report,
        currentStep: 'completed',
      }));
    } catch (error) {
      console.error('Failed to get migration report:', error);
    }
  };

  const handleNewMigration = () => {
    storageService.clearState();
    setState({
      currentStep: 'source',
    });
  };

  const handleBack = () => {
    if (state.currentStep === 'target') {
      setState((prev) => ({
        ...prev,
        targetCredentials: undefined,
        currentStep: 'source',
      }));
    } else if (state.currentStep === 'summary') {
      setState((prev) => ({
        ...prev,
        migrationSummary: undefined,
        targetCredentials: undefined,
        currentStep: 'target',
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 shadow-2xl sticky top-0 z-40 border-b border-blue-700/30">
        <div className="w-full px-6 py-6">
          <div className="flex items-center justify-center">
            <div 
              className="flex flex-col items-center gap-2 cursor-pointer group"
              onClick={state.currentStep === 'completed' ? handleNewMigration : undefined}
            >
              <div className="w-14 h-14 bg-blue-600 backdrop-blur-md rounded-xl flex items-center justify-center group-hover:bg-blue-700 transition-all duration-300 shadow-lg border border-blue-400/30">
                <span className="text-white font-bold text-2xl">⚡</span>
              </div>
              <div className="flex flex-col text-center">
                <h1 className="text-3xl font-bold text-white tracking-tight">DB Migration Pro</h1>
                <p className="text-sm text-white/80 font-medium">Enterprise Database Transfer Suite</p>
              </div>
            </div>
            {state.currentStep === 'completed' && (
              <div className="absolute right-6 flex items-center gap-4">
                <div className="px-5 py-2.5 bg-success/25 backdrop-blur-sm text-white rounded-lg font-semibold text-sm border border-success/50 flex items-center gap-2">
                  <span className="text-lg">✓</span> Migration Complete
                </div>
                <button
                  onClick={handleNewMigration}
                  className="px-6 py-2.5 rounded-lg font-semibold text-primary-700 bg-white hover:bg-white/95 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                >
                  ← Return Home
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Step Indicator */}
      {state.currentStep !== 'completed' && (
        <StepIndicator steps={STEPS} currentStep={state.currentStep} />
      )}

      {/* Main Content */}
      <main className="flex-1">
        {state.currentStep === 'source' && (
          <SourceDatabaseStep
            onNext={handleSourceNext}
            initialCredentials={state.sourceCredentials}
          />
        )}

        {state.currentStep === 'target' && (
          <TargetDatabaseStep
            onNext={handleTargetNext}
            onBack={handleBack}
            initialCredentials={state.targetCredentials}
          />
        )}

        {state.currentStep === 'summary' && state.migrationSummary && (
          <MigrationSummaryStep
            summary={state.migrationSummary}
            onNext={handleSummaryNext}
            onBack={handleBack}
          />
        )}

        {state.currentStep === 'migration' && state.migrationId && (
          <MigrationProgressStep
            migrationId={state.migrationId}
            onComplete={handleMigrationComplete}
          />
        )}

        {state.currentStep === 'completed' && state.migrationReport && (
          <MigrationCompletedStep
            report={state.migrationReport}
            onNewMigration={handleNewMigration}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 border-t border-blue-700/30 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-lg">
                <span className="text-2xl">⚡</span> DB Migration Pro
              </h3>
              <p className="text-sm text-white/80">
                Enterprise-grade database migration tool built for performance and reliability.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Features</h4>
              <ul className="text-sm text-white/80 space-y-2">
                <li>✓ Real-time progress tracking</li>
                <li>✓ Secure credential handling</li>
                <li>✓ Comprehensive reports</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Security</h4>
              <ul className="text-sm text-white/80 space-y-2">
                <li>✓ End-to-end encryption</li>
                <li>✓ Read-only source access</li>
                <li>✓ Audit logging</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Support</h4>
              <p className="text-sm text-white/80">
                24/7 technical support available for enterprise users.
              </p>
            </div>
          </div>
          <div className="border-t border-blue-700/30 pt-8 text-center text-sm text-white/60">
            <p>© 2024 DB Migration Pro. All rights reserved. Built with ⚡ for enterprises.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
