import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, RefreshCw } from 'lucide-react';
import { partApi } from '@/lib/api';

interface PartForGrid {
  id: string;
  partNumber: string;
  description?: string | null;
  gridLevelNumber?: number | null;
  gridLevelName?: string | null;
  gridSublevelNumber?: number | null;
  gridSublevelName?: string | null;
  thumbnailUrl?: string | null;
}

const UNASSIGNED = 'Unassigned';

function groupPartsByGrid(parts: PartForGrid[]): Map<string, Map<string, PartForGrid[]>> {
  const byLevel = new Map<string, Map<string, PartForGrid[]>>();
  for (const p of parts) {
    const levelKey = p.gridLevelNumber != null && p.gridLevelNumber >= 1 ? String(p.gridLevelNumber) : UNASSIGNED;
    const subKey = p.gridSublevelNumber != null && p.gridSublevelNumber >= 1 ? String(p.gridSublevelNumber) : UNASSIGNED;
    if (!byLevel.has(levelKey)) byLevel.set(levelKey, new Map());
    const bySub = byLevel.get(levelKey)!;
    if (!bySub.has(subKey)) bySub.set(subKey, []);
    bySub.get(subKey)!.push(p);
  }
  for (const subMap of byLevel.values()) {
    for (const arr of subMap.values()) {
      arr.sort((a, b) => (a.partNumber || '').localeCompare(b.partNumber || ''));
    }
  }
  return byLevel;
}

function sortKeys(keys: string[]): string[] {
  const numeric = keys.filter((k) => k !== UNASSIGNED).map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b).map(String);
  const hasUnassigned = keys.includes(UNASSIGNED);
  return hasUnassigned ? [...numeric, UNASSIGNED] : numeric;
}

interface CatalogGridProps {
  catalogId: string;
}

export default function CatalogGrid({ catalogId }: CatalogGridProps) {
  const navigate = useNavigate();
  const [parts, setParts] = useState<PartForGrid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCell, setExpandedCell] = useState<{ level: string; sub: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    partApi
      .getByCatalog(catalogId, { limit: 2000 })
      .then((res) => {
        if (!cancelled) setParts(res.data.parts ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load parts');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [catalogId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600">Loading grid...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  const byLevel = groupPartsByGrid(parts);
  const levelKeys = sortKeys(Array.from(byLevel.keys()));
  const allSubKeys = new Set<string>();
  byLevel.forEach((subMap) => subMap.forEach((_, k) => allSubKeys.add(k)));
  const subKeys = sortKeys(Array.from(allSubKeys));

  if (parts.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
        <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">No parts in this Project Book yet</p>
        <p className="text-gray-500 text-sm mt-1">Add products via Product Import or convert a Project BOM to a Project Book.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-gray-200 bg-gray-50 p-2 text-left font-semibold w-32">Level / Sublevel</th>
            {subKeys.map((sub) => (
              <th key={sub} className="border border-gray-200 bg-gray-50 p-2 text-center font-semibold min-w-[100px]">
                {sub === UNASSIGNED ? UNASSIGNED : `Sub ${sub}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {levelKeys.map((levelKey) => (
            <tr key={levelKey}>
              <td className="border border-gray-200 bg-gray-50 p-2 font-medium">
                {levelKey === UNASSIGNED ? UNASSIGNED : `Level ${levelKey}`}
              </td>
              {subKeys.map((subKey) => {
                const cellParts = byLevel.get(levelKey)?.get(subKey) ?? [];
                const key = `${levelKey}-${subKey}`;
                const isExpanded = expandedCell?.level === levelKey && expandedCell?.sub === subKey;
                return (
                  <td key={key} className="border border-gray-200 p-2 align-top">
                    {cellParts.length === 0 ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedCell(isExpanded ? null : { level: levelKey, sub: subKey })}
                          className="w-full text-left rounded p-2 hover:bg-gray-100 flex items-center justify-between gap-2"
                        >
                          <span className="font-mono text-xs truncate">{cellParts[0].partNumber}</span>
                          {cellParts.length > 1 && (
                            <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-xs">
                              +{cellParts.length - 1}
                            </span>
                          )}
                        </button>
                        {isExpanded && (
                          <ul className="mt-2 space-y-1 pl-2 border-l-2 border-green-200">
                            {cellParts.map((p) => (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/catalog/part/${p.id}`)}
                                  className="text-left text-blue-600 hover:underline font-mono text-xs"
                                >
                                  {p.partNumber}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
