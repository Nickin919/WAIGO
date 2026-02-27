import { CheckCircle } from 'lucide-react';

interface StepIndicatorProps {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}

export function StepIndicator({ number, label, active, completed }: StepIndicatorProps) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
          completed ? 'bg-green-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
        }`}
      >
        {completed ? <CheckCircle className="w-6 h-6" /> : number}
      </div>
      <span className="text-sm font-medium text-gray-700 mt-1">{label}</span>
    </div>
  );
}
