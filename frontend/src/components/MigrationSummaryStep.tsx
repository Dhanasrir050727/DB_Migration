import React, { useState } from 'react';
import {
  Database,
  AlertCircle,
  ChevronLeft,
  Loader,
} from 'lucide-react';
import { MigrationSummary, startMigration } from '../services/api';

interface MigrationSummaryStepProps {
  summary: MigrationSummary;
  onNext: (migrationId: string) => Promise<void>;
  onBack: () => void;
}

export const MigrationSummaryStep: React.FC<MigrationSummaryStepProps> = ({
  summary,
  onNext,
  onBack,
}) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartMigration = async () => {
    setError(null);
    setIsStarting(true);

    try {
      // Start migration (backend reads credentials from .env)
      const migrationId = await startMigration();
      await onNext(migrationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start migration');
      setIsStarting(false);
      setShowConfirmation(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Migration Summary</h1>
          <p className="text-primary-100">
            Review the migration details before starting the migration.
          </p>
        </div>

        <div className="p-8">
          {/* Source and Target Info */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Database size={20} className="text-blue-600" />
                Source Database
              </h3>
              <p className="text-sm text-gray-600 break-all font-mono bg-white px-3 py-2 rounded border border-blue-100 mb-2">
                {summary.source.url}
              </p>
              <p className="text-xs text-gray-500">Region: {summary.source.region}</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Database size={20} className="text-green-600" />
                Target Database
              </h3>
              <p className="text-sm text-gray-600 break-all font-mono bg-white px-3 py-2 rounded border border-green-100 mb-2">
                {summary.target.url}
              </p>
              <p className="text-xs text-gray-500">Region: {summary.target.region}</p>
            </div>
          </div>

          {/* Region Warning */}
          {!summary.regions.sameRegion && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 flex items-start gap-3">
              <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-semibold text-yellow-900">Different Regions</h3>
                <p className="text-yellow-700 text-sm mt-1">
                  Source is in {summary.regions.source}, target is in {summary.regions.target}. 
                  Migration between regions may be slower.
                </p>
              </div>
            </div>
          )}

          {/* Statistics Grid */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Database Objects</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Tables</p>
                <p className="text-2xl font-bold text-gray-900">{summary.source.tables}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Total Records</p>
                <p className="text-2xl font-bold text-gray-900">{summary.source.records.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Functions</p>
                <p className="text-2xl font-bold text-gray-900">{summary.source.functions}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Triggers</p>
                <p className="text-2xl font-bold text-gray-900">{summary.source.triggers}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Views</p>
                <p className="text-2xl font-bold text-gray-900">{summary.source.views}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Indexes</p>
                <p className="text-2xl font-bold text-gray-900">{summary.source.indexes}</p>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 flex items-start gap-3">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-amber-900">Pre-Migration Checklist</h3>
              <ul className="text-sm text-amber-800 mt-2 space-y-1 list-disc list-inside">
                <li>Ensure you have a backup of your target database</li>
                <li>Verify both databases are accessible</li>
                <li>Confirm you have sufficient storage space</li>
                <li>Plan for potential downtime during migration</li>
              </ul>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Confirmation Modal */}
          {showConfirmation && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8 animate-slide-in">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Start Database Migration?</h2>
                
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  This will migrate all tables, records, functions, triggers, and views from the source database
                  to the target database. This process cannot be undone.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmation(false)}
                    disabled={isStarting}
                    className="flex-1 px-4 py-3 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartMigration}
                    disabled={isStarting}
                    className="flex-1 px-4 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 hover:from-blue-800 hover:via-blue-700 hover:to-blue-800 transition disabled:bg-gray-300 flex items-center justify-center gap-2"
                  >
                    {isStarting ? (
                      <>
                        <Loader size={18} className="animate-spin" />
                        Starting...
                      </>
                    ) : (
                      'Start Migration'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-6 flex justify-between border-t border-gray-200">
            <button
              onClick={onBack}
              disabled={isStarting}
              className="px-6 py-3 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-50 flex items-center gap-2"
            >
              <ChevronLeft size={20} />
              Back
            </button>
            <button
              onClick={() => setShowConfirmation(true)}
              disabled={isStarting}
              className="px-8 py-3 rounded-lg font-semibold text-white bg-success hover:bg-green-600 transition disabled:bg-gray-300 flex items-center gap-2"
            >
              {isStarting ? (
                <>
                  <Loader size={20} className="animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  Send & Migrate
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
