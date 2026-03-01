import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProjectBook {
  id: string;
  name: string;
}

interface Props {
  activeCatalogId: string;
  activeCatalogName: string;
  assignedProjectBooks: ProjectBook[];
  onSwitch: (catalogId: string) => void;
  isSwitching: boolean;
}

export function ActiveProjectBookBar({
  activeCatalogId,
  activeCatalogName,
  assignedProjectBooks,
  onSwitch,
  isSwitching,
}: Props) {
  const hasMultiple = assignedProjectBooks.length > 1;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm">
      <BookOpen className="w-4 h-4 text-green-600 flex-shrink-0" />
      <span className="text-gray-500 flex-shrink-0">Project Book:</span>
      {hasMultiple ? (
        <div className="relative flex items-center gap-1 min-w-0">
          <select
            value={activeCatalogId}
            disabled={isSwitching}
            onChange={(e) => onSwitch(e.target.value)}
            className="appearance-none bg-transparent font-semibold text-green-700 pr-4 cursor-pointer focus:outline-none disabled:opacity-60 max-w-[200px] truncate"
          >
            {assignedProjectBooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <svg
            className="w-3 h-3 text-green-600 pointer-events-none flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      ) : (
        <span className="font-semibold text-green-700 truncate">{activeCatalogName}</span>
      )}
      <Link
        to="/catalog-list"
        className="flex-shrink-0 text-green-600 hover:text-green-700 font-medium text-xs whitespace-nowrap ml-auto"
      >
        {hasMultiple ? 'Change' : 'Manage'}
      </Link>
      {isSwitching && (
        <div className="w-3.5 h-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin ml-1 flex-shrink-0" />
      )}
    </div>
  );
}
