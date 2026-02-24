import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  FileText,
  FolderKanban,
  DollarSign,
  BookOpen,
  Cog,
  Search,
  X,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkflowStore } from '@/stores/workflowStore';
import { WorkflowRow } from './WorkflowRow';
import { FlowConnectorDown, FlowConnectorRight } from './FlowConnector';
import { bomApi, projectApi, quoteApi, catalogApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

const WORKFLOW_GREEN = '#4CAF50';

type ReviewItem = {
  id: string;
  itemType: 'Project' | 'Quote' | 'Catalog';
  name: string;
  linkedFrom?: string;
  lastModified: string;
};

export function DashboardWorkflow() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();
  const {
    hasBom,
    activeProjectId,
    bomData,
    setBomReady,
    setActiveProjectId,
    setProjectFromBom,
  } = useWorkflowStore();

  const [uploading, setUploading] = useState(false);
  const [buildModalOpen, setBuildModalOpen] = useState(false);
  const [step2Loading, setStep2Loading] = useState<'project' | 'quote' | 'catalog' | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const { data } = await bomApi.upload(file);
      const project = data as { id: string; name?: string; items?: unknown[] };
      setBomReady({
        projectId: project.id,
        itemCount: Array.isArray(project.items) ? project.items.length : 0,
        name: project.name,
        createdAt: new Date().toISOString(),
      });
      setActiveProjectId(project.id);
      toast.success('BOM uploaded successfully');
      navigate(`/projects/${project.id}`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : 'Upload failed';
      toast.error(msg || 'Invalid BOM upload');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleBuildEmptyBom = async () => {
    setStep2Loading('project');
    try {
      const name = `My BOM ${new Date().toLocaleDateString()}`;
      const { data } = await projectApi.create({ name });
      const created = data as { id: string };
      setBomReady({
        projectId: created.id,
        itemCount: 0,
        name,
        createdAt: new Date().toISOString(),
      });
      setActiveProjectId(created.id);
      setBuildModalOpen(false);
      toast.success('BOM project created. Add parts in the project.');
      navigate(`/projects/${created.id}`);
    } catch {
      toast.error('Failed to create BOM project');
    } finally {
      setStep2Loading(null);
    }
  };

  const handleUseBomForProject = async () => {
    if (!hasBom || !bomData?.projectId) return;
    setStep2Loading('project');
    try {
      const projectId = bomData.projectId;
      setActiveProjectId(projectId);
      setProjectFromBom(projectId);
      toast.success('Using this BOM for project');
      navigate(`/projects/${projectId}`);
    } catch {
      toast.error('Failed to open project');
    } finally {
      setStep2Loading(null);
    }
  };

  const handleUseBomForQuote = async () => {
    if (!hasBom) return;
    setStep2Loading('quote');
    try {
      const projectId = activeProjectId || bomData?.projectId;
      if (projectId) {
        navigate(`/quotes/new?projectId=${projectId}`);
      } else {
        navigate('/quotes/new');
      }
      toast.success('Create your quote');
    } catch {
      toast.error('Failed to start quote');
    } finally {
      setStep2Loading(null);
    }
  };

  const handleUseBomForCatalog = async () => {
    if (!hasBom) return;
    setStep2Loading('catalog');
    try {
      navigate('/catalog-creator/new');
      toast.success('Build your catalog');
    } catch {
      toast.error('Failed to open catalog creator');
    } finally {
      setStep2Loading(null);
    }
  };

  const loadReviewData = async () => {
    if (!user) return;
    setReviewLoading(true);
    try {
      const [projectsRes, quotesRes, catalogsRes] = await Promise.all([
        projectApi.getAll({ limit: 10 }).catch(() => ({ data: { projects: [] } })),
        quoteApi.getAll().catch(() => ({ data: [] })),
        catalogApi.getMySummary().catch(() => ({ data: null })),
      ]);

      const projectsPayload = projectsRes.data as { projects?: Array<{ id: string; name: string; updatedAt: string }> };
      const projectsData = projectsPayload?.projects ?? [];
      const quotesData = quotesRes.data;
      const quotes = Array.isArray(quotesData) ? quotesData : (quotesData as { quotes?: unknown[] })?.quotes ?? [];
      const catalogsSummary = catalogsRes.data as { catalogCount?: number } | null;

      const items: ReviewItem[] = [];
      projectsData.slice(0, 5).forEach((p: { id: string; name: string; updatedAt: string }) => {
        items.push({
          id: p.id,
          itemType: 'Project',
          name: p.name,
          lastModified: p.updatedAt,
        });
      });
      (quotes as Array<{ id: string; quoteNumber?: string; createdAt: string }>).slice(0, 5).forEach((q) => {
        items.push({
          id: q.id,
          itemType: 'Quote',
          name: q.quoteNumber || q.id,
          lastModified: q.createdAt,
        });
      });
      if (catalogsSummary?.catalogCount) {
        items.push({
          id: 'catalogs',
          itemType: 'Catalog',
          name: `${catalogsSummary.catalogCount} catalog(s)`,
          lastModified: new Date().toISOString(),
        });
      }
      setReviewItems(items);
    } catch {
      setReviewItems([]);
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    if (hasBom) loadReviewData();
  }, [hasBom]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const step2Disabled = !hasBom;
  const fromProject = activeProjectId ? ' from this project' : '';

  return (
    <div className="space-y-0">
      {/* Row 1: START HERE */}
      <WorkflowRow bannerLabel="Start Here">
        <div className="flex flex-col items-center gap-5 text-center">
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Cog className="w-6 h-6" style={{ color: WORKFLOW_GREEN }} aria-hidden />
              <h3 className="text-lg font-bold text-gray-900">Build Your BOM</h3>
            </div>
            <p className="text-sm text-gray-500 max-w-sm">
              A Bill of Materials (BOM) is your starting point. Upload a CSV file or build one manually using the Product Finder.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
              aria-label="Upload BOM file"
            />
            <motion.button
              type="button"
              className="flex items-center gap-2 rounded-lg px-6 py-3 font-semibold text-white shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60"
              style={{ backgroundColor: WORKFLOW_GREEN }}
              onClick={handleUploadClick}
              disabled={uploading}
              aria-label="Upload BOM CSV file"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
              ) : (
                <UploadCloud className="w-5 h-5" aria-hidden />
              )}
              <span>Upload CSV</span>
            </motion.button>
            <motion.button
              type="button"
              className="flex items-center gap-2 rounded-lg border-2 px-6 py-3 font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ borderColor: WORKFLOW_GREEN, color: WORKFLOW_GREEN }}
              onClick={() => setBuildModalOpen(true)}
              aria-label="Build BOM manually with Product Finder"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Search className="w-5 h-5" aria-hidden />
              <span>Build Manually</span>
            </motion.button>
          </div>
          {hasBom && bomData && (
            <p className="text-sm font-medium" style={{ color: WORKFLOW_GREEN }}>
              ✓ BOM ready — {bomData.name || 'Your BOM'} {bomData.itemCount != null ? `(${bomData.itemCount} items)` : ''}
            </p>
          )}
        </div>
      </WorkflowRow>

      <FlowConnectorDown />

      {/* Row 2: STEP 2 */}
      <WorkflowRow bannerLabel="Step 2 – Use Your BOM" disabled={step2Disabled}>
        {step2Disabled && (
          <p className="text-sm text-gray-500 mb-4 text-center" role="status">
            Complete Step 1 above — upload or build a BOM to unlock these options.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-2 items-stretch">
          <div className="flex flex-col">
            <motion.button
              type="button"
              disabled={step2Disabled}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white p-6 font-medium text-gray-900 transition-all hover:border-green-500 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 min-h-[120px]"
              onClick={handleUseBomForProject}
              aria-label={activeProjectId ? 'Open this project' : 'Use your BOM to build a project'}
              title={step2Disabled ? 'Create a BOM first' : undefined}
              whileHover={!step2Disabled ? { y: -2 } : {}}
              whileTap={!step2Disabled ? { scale: 0.99 } : {}}
            >
              {step2Loading === 'project' ? (
                <Loader2 className="w-8 h-8 text-green-600 animate-spin" aria-hidden />
              ) : (
                <FolderKanban className="w-8 h-8" style={{ color: WORKFLOW_GREEN }} aria-hidden />
              )}
              <span className="text-center text-sm">
                {activeProjectId ? 'Open this project' : 'Use your BOM to build a project'}
              </span>
            </motion.button>
          </div>
          <div className="hidden md:flex items-center justify-center py-4">
            <FlowConnectorRight active={!!activeProjectId} label="Then build quote from project" />
          </div>
          <div className="flex flex-col">
            <motion.button
              type="button"
              disabled={step2Disabled}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white p-6 font-medium text-gray-900 transition-all hover:border-green-500 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 min-h-[120px]"
              onClick={handleUseBomForQuote}
              aria-label={`Build quote${fromProject}`}
              title={step2Disabled ? 'Create a BOM first' : undefined}
              whileHover={!step2Disabled ? { y: -2 } : {}}
              whileTap={!step2Disabled ? { scale: 0.99 } : {}}
            >
              {step2Loading === 'quote' ? (
                <Loader2 className="w-8 h-8 text-green-600 animate-spin" aria-hidden />
              ) : (
                <DollarSign className="w-8 h-8" style={{ color: WORKFLOW_GREEN }} aria-hidden />
              )}
              <span className="text-center text-sm">Build quote{fromProject}</span>
            </motion.button>
          </div>
          <div className="hidden md:flex items-center justify-center py-4">
            <FlowConnectorRight active={!!activeProjectId} label="Or build catalog" />
          </div>
          <div className="flex flex-col">
            <motion.button
              type="button"
              disabled={step2Disabled}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white p-6 font-medium text-gray-900 transition-all hover:border-green-500 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 min-h-[120px]"
              onClick={handleUseBomForCatalog}
              aria-label={`Build catalog${fromProject}`}
              title={step2Disabled ? 'Create a BOM first' : undefined}
              whileHover={!step2Disabled ? { y: -2 } : {}}
              whileTap={!step2Disabled ? { scale: 0.99 } : {}}
            >
              {step2Loading === 'catalog' ? (
                <Loader2 className="w-8 h-8 text-green-600 animate-spin" aria-hidden />
              ) : (
                <BookOpen className="w-8 h-8" style={{ color: WORKFLOW_GREEN }} aria-hidden />
              )}
              <span className="text-center text-sm">Build catalog{fromProject}</span>
            </motion.button>
          </div>
        </div>
      </WorkflowRow>

      <FlowConnectorDown />

      {/* Row 3: REVIEW */}
      <WorkflowRow bannerLabel="Step 3 – Review" disabled={!hasBom}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FolderKanban className="w-5 h-5" style={{ color: WORKFLOW_GREEN }} />
                Review your projects
              </h4>
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="text-sm text-green-600 font-medium hover:underline flex items-center gap-1"
                aria-label="View all projects"
              >
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="card p-4">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <DollarSign className="w-5 h-5" style={{ color: WORKFLOW_GREEN }} />
                View your quotes
              </h4>
              <button
                type="button"
                onClick={() => navigate('/quotes')}
                className="text-sm text-green-600 font-medium hover:underline flex items-center gap-1"
                aria-label="View all quotes"
              >
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="card p-4">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <BookOpen className="w-5 h-5" style={{ color: WORKFLOW_GREEN }} />
                View your catalogs
              </h4>
              <button
                type="button"
                onClick={() => navigate('/catalog-list')}
                className="text-sm text-green-600 font-medium hover:underline flex items-center gap-1"
                aria-label="View all catalogs"
              >
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          {reviewLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" aria-label="Loading" />
            </div>
          ) : reviewItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" role="table" aria-label="Recent items">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Item type</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Linked from</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Last modified</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewItems.map((item) => (
                    <tr key={`${item.itemType}-${item.id}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{item.itemType}</td>
                      <td className="py-3 px-4 text-gray-900">{item.name}</td>
                      <td className="py-3 px-4 text-gray-500">{item.linkedFrom ?? '—'}</td>
                      <td className="py-3 px-4 text-gray-500">{formatDate(item.lastModified)}</td>
                      <td className="py-3 px-4">
                        {item.itemType === 'Project' && (
                          <button
                            type="button"
                            onClick={() => navigate(`/projects/${item.id}`)}
                            className="text-green-600 font-medium hover:underline"
                            aria-label={`Edit project ${item.name}`}
                          >
                            Edit
                          </button>
                        )}
                        {item.itemType === 'Quote' && (
                          <button
                            type="button"
                            onClick={() => navigate(`/quotes/${item.id}`)}
                            className="text-green-600 font-medium hover:underline"
                            aria-label={`View quote ${item.name}`}
                          >
                            View
                          </button>
                        )}
                        {item.itemType === 'Catalog' && (
                          <button
                            type="button"
                            onClick={() => navigate('/catalog-list')}
                            className="text-green-600 font-medium hover:underline"
                            aria-label="View catalogs"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No items to review yet.</p>
          )}
        </div>
      </WorkflowRow>

      {/* Build BOM Modal */}
      <AnimatePresence>
        {buildModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBuildModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="build-bom-title"
          >
            <motion.div
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 id="build-bom-title" className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-6 h-6" style={{ color: WORKFLOW_GREEN }} />
                  Build your BOM
                </h2>
                <button
                  type="button"
                  onClick={() => setBuildModalOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-600 mb-6">
                Create an empty BOM project and add parts from the Product Finder, or upload a CSV above.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60"
                  style={{ backgroundColor: WORKFLOW_GREEN }}
                  onClick={handleBuildEmptyBom}
                  disabled={step2Loading === 'project'}
                  aria-label="Create empty BOM project"
                >
                  {step2Loading === 'project' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <FolderKanban className="w-5 h-5" />
                  )}
                  Create empty BOM project
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{ borderColor: WORKFLOW_GREEN, color: WORKFLOW_GREEN }}
                  onClick={() => {
                    setBuildModalOpen(false);
                    navigate('/product-finder');
                  }}
                  aria-label="Open Product Finder"
                >
                  <Search className="w-5 h-5" />
                  Open Product Finder
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
