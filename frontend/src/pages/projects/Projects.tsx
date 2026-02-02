import { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderKanban } from 'lucide-react';
import { projectApi } from '@/lib/api';
import { useProjectsListStore } from '@/stores/projectsListStore';

const Projects = () => {
  const { projects, loading, setProjects, setLoading, setError } = useProjectsListStore();

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await projectApi.getAll();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [setProjects, setLoading, setError]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const statusLabel = (s: string) => ({ DRAFT: 'Draft', SUBMITTED: 'Submitted', PROCESSING: 'Processing', COMPLETED: 'Completed' }[s] || s);

  if (loading) {
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
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {project._count?.items ?? 0} items
                </span>
                <span className="text-gray-600">
                  {project.status ? statusLabel(project.status) : 'Draft'} · Rev {project.currentRevision}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Projects;
