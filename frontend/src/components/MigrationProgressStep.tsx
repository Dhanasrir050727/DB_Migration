import React, { useState, useEffect } from 'react';
import { Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { getMigrationProgress, MigrationProgress } from '../services/api';

interface MigrationProgressStepProps {
  migrationId: string;
  onComplete: (report: any) => void;
}

export const MigrationProgressStep: React.FC<MigrationProgressStepProps> = ({
  migrationId,
  onComplete,
}) => {
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let isMounted = true;

    const pollProgress = async () => {
      try {
        const data = await getMigrationProgress(migrationId);
        if (isMounted) {
          setProgress(data);
          setLoading(false);

          // Stop polling when migration is complete or failed
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollInterval) clearInterval(pollInterval);
            // Call onComplete after a short delay to show final state
            setTimeout(() => onComplete(data), 500);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch migration progress');
          setLoading(false);
        }
      }
    };

    // Initial fetch
    pollProgress();

    // Poll every 500ms
    pollInterval = setInterval(pollProgress, 500);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [migrationId, onComplete]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="text-red-600" size={32} />
            <h1 className="text-2xl font-bold text-gray-900">Migration Error</h1>
          </div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (loading || !progress) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <Loader size={48} className="animate-spin mx-auto text-primary-600 mb-4" />
          <p className="text-gray-600">Loading migration progress...</p>
        </div>
      </div>
    );
  }

  const progressPercentage = progress.progress;
  const isComplete = progress.status === 'completed';

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Migration in Progress</h1>
          <p className="text-primary-100">
            {isComplete ? 'Migration completed successfully!' : progress.currentStep}
          </p>
        </div>

        <div className="p-8">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Overall Progress</span>
              <span className="text-sm font-bold text-primary-600">{progressPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isComplete ? 'bg-success' : 'bg-primary-600'
                }`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Migration Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Tables</p>
              <p className="text-2xl font-bold text-blue-600">
                {progress.details.tablesProcessed} / {progress.details.totalTables}
              </p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Records</p>
              <p className="text-2xl font-bold text-purple-600">
                {progress.details.recordsMigrated.toLocaleString()} /{' '}
                {progress.details.totalRecords.toLocaleString()}
              </p>
            </div>

            <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Functions</p>
              <p className="text-2xl font-bold text-pink-600">
                {progress.details.functionsMigrated} / {progress.details.totalFunctions}
              </p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Triggers</p>
              <p className="text-2xl font-bold text-orange-600">
                {progress.details.triggersMigrated} / {progress.details.totalTriggers}
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Views</p>
              <p className="text-2xl font-bold text-green-600">
                {progress.details.viewsMigrated} / {progress.details.totalViews}
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Policies</p>
              <p className="text-2xl font-bold text-red-600">
                {progress.details.policiesMigrated} / {progress.details.totalPolicies}
              </p>
            </div>
          </div>

          {/* Current Step */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">Current Step</p>
            <div className="flex items-center gap-3">
              {!isComplete && <Loader size={20} className="text-primary-600 animate-spin" />}
              {isComplete && <CheckCircle size={20} className="text-success" />}
              <p className="font-semibold text-gray-900">{progress.currentStep}</p>
            </div>
          </div>

          {/* Error List */}
          {progress.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-red-900 mb-3">Errors Encountered</h3>
              <ul className="space-y-2">
                {progress.errors.map((error, index) => (
                  <li key={index} className="text-sm text-red-800">
                    <span className="font-semibold">{error.objectName}</span> ({error.objectType}):
                    {error.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Status Message */}
          {!isComplete && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
              <p>Migration is in progress. Please do not close this window.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
