import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { saveSourceCredentials, SourceDatabaseCredentials, DatabaseInfo } from '../services/api';

interface SourceDatabaseStepProps {
  onNext: (credentials: SourceDatabaseCredentials) => Promise<void>;
  initialCredentials?: SourceDatabaseCredentials;
}

export const SourceDatabaseStep: React.FC<SourceDatabaseStepProps> = ({
  onNext,
  initialCredentials,
}) => {
  const [baseUrl, setBaseUrl] = useState(initialCredentials?.baseUrl || '');
  const [anonKey, setAnonKey] = useState(initialCredentials?.anonKey || '');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [connected, setConnected] = useState(false);
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);

  // Reset form when initialCredentials changes (e.g., after clicking "New Migration")
  useEffect(() => {
    setBaseUrl(initialCredentials?.baseUrl || '');
    setAnonKey(initialCredentials?.anonKey || '');
    setConnected(false);
    setDbInfo(null);
    setError(null);
  }, [initialCredentials?.baseUrl, initialCredentials?.anonKey]);

  const isFormValid = baseUrl.trim() !== '' && anonKey.trim() !== '';

  const handleConnect = async () => {
    setError(null);
    setValidating(true);

    try {
      // Connect and save source credentials to backend .env
      const info = await saveSourceCredentials({ baseUrl, anonKey });
      setDbInfo(info);
      setConnected(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to connect to source database'
      );
      setConnected(false);
    } finally {
      setValidating(false);
    }
  };

  const handleNext = async () => {
    try {
      await onNext({ baseUrl, anonKey });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to proceed');
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 animate-slide-in">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Source Database</h1>
          <p className="text-gray-600">
            Enter your source PostgreSQL database credentials to begin the migration.
          </p>
        </div>

        {/* Error Alert with Troubleshooting */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Connection Error</h3>
                <p className="text-red-700 text-sm mt-1">{error}</p>
                
                {/* Troubleshooting tips based on error type */}
                <div className="mt-3 p-3 bg-red-100 rounded border border-red-300 text-sm">
                  <p className="font-semibold text-red-900 mb-2">💡 Troubleshooting Tips:</p>
                  <ul className="text-red-800 space-y-1 text-xs">
                    {error.includes('timeout') && (
                      <>
                        <li>• Your network cannot reach the Supabase server</li>
                        <li>• Check your internet connection</li>
                        <li>• Your firewall might be blocking port 5432</li>
                        <li>• Try using a VPN</li>
                        <li>• Or verify the Supabase project still exists</li>
                      </>
                    )}
                    {error.includes('password authentication') && (
                      <>
                        <li>• Check your database password is correct</li>
                        <li>• Make sure you're using the DATABASE password, not API key</li>
                        <li>• Reset password in Supabase Settings → Database</li>
                      </>
                    )}
                    {error.includes('host not found') && (
                      <>
                        <li>• Check the Supabase URL is correct</li>
                        <li>• Verify the project ID in the URL</li>
                        <li>• Make sure the project hasn't been deleted</li>
                      </>
                    )}
                  </ul>
                </div>

                <button
                  onClick={() => setError(null)}
                  className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Database Info Display (Connected) */}
        {connected && dbInfo && (
          <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="text-green-600" size={24} />
              <h2 className="text-lg font-semibold text-green-900">Connected Successfully!</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded border border-green-100">
                <p className="text-gray-500 text-sm">Tables</p>
                <p className="text-2xl font-bold text-green-600">{dbInfo.tables}</p>
              </div>
              <div className="bg-white p-4 rounded border border-green-100">
                <p className="text-gray-500 text-sm">Records</p>
                <p className="text-2xl font-bold text-green-600">{(dbInfo.records || dbInfo.totalRecords || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white p-4 rounded border border-green-100">
                <p className="text-gray-500 text-sm">Functions</p>
                <p className="text-2xl font-bold text-green-600">{dbInfo.functions}</p>
              </div>
              <div className="bg-white p-4 rounded border border-green-100">
                <p className="text-gray-500 text-sm">Triggers</p>
                <p className="text-2xl font-bold text-green-600">{dbInfo.triggers}</p>
              </div>
              <div className="bg-white p-4 rounded border border-green-100">
                <p className="text-gray-500 text-sm">Views</p>
                <p className="text-2xl font-bold text-green-600">{dbInfo.views}</p>
              </div>
              <div className="bg-white p-4 rounded border border-green-100">
                <p className="text-gray-500 text-sm">Indexes</p>
                <p className="text-2xl font-bold text-green-600">{dbInfo.indexes}</p>
              </div>
            </div>
          </div>
        )}

        {/* Form (Not Connected) */}
        {!connected && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConnect();
            }}
            className="space-y-6"
          >
            {/* Base URL Input */}
            <div>
              <label htmlFor="baseUrl" className="block text-sm font-semibold text-gray-900 mb-2">
                Supabase Project URL
              </label>
              <input
                id="baseUrl"
                type="text"
                placeholder="https://xxxx.supabase.co"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                disabled={validating}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-gray-50 disabled:text-gray-500 font-mono text-sm"
              />
              <p className="text-gray-500 text-xs mt-1">
                Example: https://hziooiyrrtufhvsojjzq.supabase.co
              </p>
            </div>

            {/* Anon Key Input */}
            <div>
              <label htmlFor="anonKey" className="block text-sm font-semibold text-gray-900 mb-2">
                Database Password (NOT the API Key)
              </label>
              <div className="relative">
                <input
                  id="anonKey"
                  type={showKey ? 'text' : 'password'}
                  placeholder="e.g., MyPassword123"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  disabled={validating}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-gray-50 disabled:text-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  disabled={validating}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
                >
                  {showKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-1">
                Your PostgreSQL database password (set when you created the database)
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
              <p className="font-semibold mb-2">⚠️ Important: Do NOT use API Keys</p>
              <p className="text-amber-800 text-xs">
                This is your <strong>database password</strong>, NOT your Supabase API Key (JWT token). 
                If you see a long token starting with "eyJ...", that's NOT what you need here.
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-6 flex justify-end">
              <button
                type="submit"
                disabled={!isFormValid || validating}
                className={`px-8 py-3 rounded-lg font-semibold text-white transition flex items-center gap-2 ${
                  isFormValid && !validating
                    ? 'bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 hover:from-blue-800 hover:via-blue-700 hover:to-blue-800 cursor-pointer'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {validating ? (
                  <>
                    <Loader size={20} className="animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    Connect to Source
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Next Button (After Connected) */}
        {connected && (
          <div className="pt-6 flex justify-between gap-4">
            <button
              onClick={() => {
                setConnected(false);
                setDbInfo(null);
              }}
              className="px-8 py-3 rounded-lg font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 transition"
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              className="px-8 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 hover:from-blue-800 hover:via-blue-700 hover:to-blue-800 transition flex items-center gap-2"
            >
              Next
              <span>→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
