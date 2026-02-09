import { ReactNode } from 'react';

const BANNER_GREEN = '#4CAF50';

interface WorkflowRowProps {
  /** Banner label (e.g. "START HERE", "STEP 2", "REVIEW") */
  bannerLabel: string;
  /** Main content below the banner */
  children: ReactNode;
  /** Optional: dim the row when disabled */
  disabled?: boolean;
}

export function WorkflowRow({ bannerLabel, children, disabled = false }: WorkflowRowProps) {
  return (
    <section
      className={`rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
      aria-label={`Workflow step: ${bannerLabel}`}
    >
      <div
        className="w-full py-2 px-4 text-center text-white font-bold uppercase tracking-wide text-sm"
        style={{ backgroundColor: BANNER_GREEN }}
      >
        {bannerLabel}
      </div>
      <div className="p-4 md:p-6">{children}</div>
    </section>
  );
}
