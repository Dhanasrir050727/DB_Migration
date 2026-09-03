import React from 'react';
import { Check } from 'lucide-react';

interface Step {
  id: string;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: string;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, currentStep }) => {
  const currentIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <div className="bg-white/50 backdrop-blur-md border-b border-primary-100/20 px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between relative">
          {/* Background connector lines */}
          {steps.length > 1 && (
            <div className="absolute top-6 left-0 right-0 h-1 bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300" 
              style={{ width: '100%', pointerEvents: 'none' }}
            />
          )}
          
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = step.id === currentStep;

            return (
              <div key={step.id} className="flex flex-col items-center relative flex-1">
                {/* Step Circle */}
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-full font-semibold transition-all duration-300 relative z-10 ${
                    isCompleted
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : isCurrent
                      ? 'bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 text-white ring-4 ring-blue-800 shadow-lg'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? (
                    <Check size={24} className="font-bold" />
                  ) : (
                    <span className="text-lg font-bold">{index + 1}</span>
                  )}
                </div>

                {/* Step Label */}
                <div className="mt-3 flex flex-col text-center">
                  <span
                    className={`text-sm font-semibold transition-colors duration-300 ${
                      isCompleted || isCurrent
                        ? 'text-blue-900'
                        : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
