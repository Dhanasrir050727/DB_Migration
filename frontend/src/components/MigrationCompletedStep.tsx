import React from 'react';
import { CheckCircle, AlertCircle, FileText, RotateCw, Loader } from 'lucide-react';
import { MigrationReport } from '../services/api';

interface MigrationCompletedStepProps {
  report: MigrationReport;
  onNewMigration: () => void;
}

export const MigrationCompletedStep: React.FC<MigrationCompletedStepProps> = ({
  report,
  onNewMigration,
}) => {
  const [isResetting, setIsResetting] = React.useState(false);
  const isSuccessful = report.status === 'success';
  const isPartial = report.status === 'partial';
  const hasErrors = report.failedObjects.length > 0;
  // Show as "completed" even if there are some failures - migration process finished
  const migrationCompleted = true;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden animate-slide-in">
        {/* Header */}
        <div
          className={`bg-gradient-to-r ${
            isSuccessful
              ? 'from-success to-green-600'
              : isPartial
              ? 'from-blue-500 to-blue-600'
              : 'from-success to-green-600'
          } px-8 py-12 text-white text-center`}
        >
          <div className="flex justify-center mb-4">
            <CheckCircle size={64} className="animate-pulse" />
          </div>
          <h1 className="text-4xl font-bold mb-2">
            ✓ Migration Completed
          </h1>
          <p className="text-white text-opacity-90">
            Duration: {report.duration}
          </p>
        </div>

        <div className="p-8">
          {/* Main Stats */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Tables & Records</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Tables:</span>
                  <span className="font-bold text-lg">
                    {report.summary.tablesMigrated} / {report.summary.totalTables}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{
                      width: `${(report.summary.tablesMigrated / report.summary.totalTables) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-gray-600">Records:</span>
                  <span className="font-bold text-lg">
                    {report.summary.recordsMigrated.toLocaleString()} /{' '}
                    {report.summary.totalRecords.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{
                      width: `${(report.summary.recordsMigrated / report.summary.totalRecords) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Functions & Triggers</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Functions:</span>
                  <span className="font-bold text-lg">
                    {report.summary.functionsMigrated} / {report.summary.totalFunctions}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{
                      width: `${(report.summary.functionsMigrated / report.summary.totalFunctions) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-gray-600">Triggers:</span>
                  <span className="font-bold text-lg">
                    {report.summary.triggersMigrated} / {report.summary.totalTriggers}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{
                      width: `${(report.summary.triggersMigrated / report.summary.totalTriggers) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Objects */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Views</h3>
              <p className="text-2xl font-bold text-green-600">
                {report.summary.viewsMigrated} / {report.summary.totalViews}
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Policies</h3>
              <p className="text-2xl font-bold text-red-600">
                {report.summary.policiesMigrated} / {report.summary.totalPolicies}
              </p>
            </div>
          </div>

          {/* Issue Summary */}
          {hasErrors && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                <AlertCircle size={20} />
                Issues Identified ({report.failedObjects.length})
              </h3>
              <div className="space-y-2 text-sm text-yellow-800">
                {report.failedObjects.map((issue, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-semibold min-w-fit">{i + 1}.</span>
                    <div>
                      <p className="font-semibold">{issue.objectName} ({issue.objectType})</p>
                      <p className="text-yellow-700">{issue.error}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Records Summary - Quick Check */}
          {(report.summary.recordsMigrated < report.summary.totalRecords || 
            report.summary.tablesMigrated < report.summary.totalTables) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
              <h4 className="font-semibold text-blue-900 mb-2">What Didn't Migrate</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                {report.summary.tablesMigrated < report.summary.totalTables && (
                  <li>• {report.summary.totalTables - report.summary.tablesMigrated} table(s) had issues</li>
                )}
                {report.summary.recordsMigrated < report.summary.totalRecords && (
                  <li>• {report.summary.totalRecords - report.summary.recordsMigrated} record(s) had issues</li>
                )}
                {report.summary.functionsMigrated < report.summary.totalFunctions && (
                  <li>• {report.summary.totalFunctions - report.summary.functionsMigrated} function(s) failed</li>
                )}
                {report.summary.triggersMigrated < report.summary.totalTriggers && (
                  <li>• {report.summary.totalTriggers - report.summary.triggersMigrated} trigger(s) failed</li>
                )}
              </ul>
            </div>
          )}

          {/* Success Message */}
          {isSuccessful && (
            <div className="bg-success/10 border border-success rounded-lg p-6 mb-8">
              <p className="text-success font-semibold text-lg">
                ✓ All database objects and records have been successfully migrated to the target database.
              </p>
            </div>
          )}

          {/* Partial/Warning Message */}
          {isPartial && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <p className="text-blue-800 font-semibold text-lg">
                ✓ Migration process completed. {report.summary.recordsMigrated.toLocaleString()} of {report.summary.totalRecords.toLocaleString()} records were migrated successfully.
              </p>
            </div>
          )}

          {/* Migration Details */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Migration Details</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Migration ID</p>
                <p className="font-mono text-sm break-all bg-white px-3 py-2 rounded border border-gray-200 mt-1">
                  {report.migrationId}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className={`font-semibold text-sm mt-1 ${isSuccessful ? 'text-success' : 'text-orange-600'}`}>
                  {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Started</p>
                <p className="text-sm mt-1">
                  {new Date(report.startTime).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-sm mt-1">
                  {new Date(report.endTime).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                // Generate report - could download as PDF or display in new window
                console.log('View report:', report);
              }}
              disabled={isResetting}
              className="px-6 py-3 rounded-lg font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 transition border border-primary-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText size={20} />
              View Migration Report
            </button>
            <button
              onClick={() => {
                setIsResetting(true);
                setTimeout(() => {
                  onNewMigration();
                  setIsResetting(false);
                }, 300);
              }}
              disabled={isResetting}
              className="px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 hover:from-blue-800 hover:via-blue-700 hover:to-blue-800 transition flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isResetting ? (
                <>
                  <Loader size={20} className="animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <RotateCw size={20} />
                  Start New Migration
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
