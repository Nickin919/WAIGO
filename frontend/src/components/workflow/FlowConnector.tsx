import { motion } from 'framer-motion';

const WORKFLOW_GREEN = '#4CAF50';

/** Downward arrow between workflow rows */
export function FlowConnectorDown({ animate = true }: { animate?: boolean }) {
  return (
    <div className="flex justify-center py-2" aria-hidden>
      <motion.svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke={WORKFLOW_GREEN}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animate ? { opacity: 0, y: -8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <path d="M12 5v14M12 19l-6-6M12 19l6-6" />
      </motion.svg>
    </div>
  );
}

/** Horizontal arrow from Project to Quote or Catalog (rightward) */
export function FlowConnectorRight({
  active = false,
  label,
}: {
  active?: boolean;
  label?: string;
}) {
  const stroke = active ? WORKFLOW_GREEN : '#9CA3AF';
  return (
    <div
      className="flex flex-col items-center justify-center"
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <svg
        width="40"
        height="24"
        viewBox="0 0 40 24"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={active ? 'none' : '4 4'}
        className="transition-all duration-300"
      >
        <path d="M0 12h32M32 12l-8-6M32 12l-8 6" />
      </svg>
      {label && (
        <span className="text-xs text-gray-500 mt-0.5 max-w-[100px] text-center hidden md:block">
          {label}
        </span>
      )}
    </div>
  );
}
