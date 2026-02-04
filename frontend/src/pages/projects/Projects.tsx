import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderKanban, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProjectsQuery } from '@/hooks/useProjectQueries';

const PAGE_SIZES = [10, 20, 50];

const Projects = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const { data, isLoading, error } = useProjectsQuery({ page, limit });
  const projects = data?.projects ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const statusLabel = (s: string) => ({ DRAFT: 'Draft', SUBMITTED: 'Submitted', PROCESSING: 'Processing', COMPLETED: 'Completed' }[s] || s);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-16 h-16 border-4 border-wago-green border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="container-custom py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Projects</h1>
        <Link to="/projects/new" className="btn btn-primary flex items-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>New Project</span>
        </Link>
      </div>

      {error && (
        <p className="text-red-600 mb-4">Failed to load projects.</p>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <FolderKanban className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No projects yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first project to start managing BOMs and specifications
          </p>
          <Link to="/projects/new" className="btn btn-primary">
            New Project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="card card-hover p-6"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {project.name}
              </h3>
              {project.description && (
                <p className="text-gray-600 mb-4 line-clamp-2">
                  {project.description}
                </p>
              )}
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{project._count?.items ?? 0} items</span>
                <span>{project.status ? statusLabel(project.status) : 'Draft'} · Rev {project.currentRevision}</span>
              </div>
              {project.user && (
                <p className="text-xs text-gray-500 mt-2">
                  Created by {[project.user.firstName, project.user.lastName].filter(Boolean).join(' ') || project.user.email || 'Unknown'}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </span>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Per page
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="rounded border border-gray-300 px-2 py-1 text-gray-900"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-secondary flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-sm text-gray-600 px-2">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn btn-secondary flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
