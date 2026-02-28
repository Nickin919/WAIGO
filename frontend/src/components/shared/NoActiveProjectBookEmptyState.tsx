import { BookOpen, PlayCircle, FolderKanban, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  feature: 'Quick Grid' | 'Video Academy';
  isGuest?: boolean;
  hasAssignedProjectBooks?: boolean;
}

export function NoActiveProjectBookEmptyState({ feature, isGuest, hasAssignedProjectBooks }: Props) {
  const Icon = feature === 'Quick Grid' ? BookOpen : PlayCircle;

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <Icon className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Sign in to access {feature}</h2>
        <p className="text-gray-500 mb-8 max-w-sm leading-relaxed">
          {feature} shows curated WAGO products from your active project book. Create an account or
          sign in to get started.
        </p>
        <Link to="/login" className="btn btn-primary flex items-center gap-2">
          <LogIn className="w-4 h-4" />
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">
        {hasAssignedProjectBooks ? 'No active project book selected' : 'No project book assigned yet'}
      </h2>
      <p className="text-gray-500 mb-8 max-w-sm leading-relaxed">
        {feature} shows content curated from your active project book.{' '}
        {hasAssignedProjectBooks
          ? 'Go to My Project Books and select one as your active book to see content here.'
          : 'Your administrator will assign a project book to you, or you can browse and create one yourself.'}
      </p>
      <Link to="/catalog-list" className="btn btn-primary flex items-center gap-2">
        <FolderKanban className="w-4 h-4" />
        My Project Books
      </Link>
    </div>
  );
}
