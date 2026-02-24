import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Heart, Eye, Clock, Play, ListVideo, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { videoLibraryApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import VideoPlayer from '@/components/videos/VideoPlayer';

const VIDEO_TYPES = [
  'TECHNICAL', 'APPLICATION', 'TESTIMONIAL', 'TUTORIAL',
  'PRODUCT_DEMO', 'WEBINAR', 'TRAINING', 'OTHER',
];

const PAGE_SIZE = 24;

const TYPE_COLORS: Record<string, string> = {
  TECHNICAL:    'bg-blue-100 text-blue-800',
  APPLICATION:  'bg-green-100 text-green-800',
  TESTIMONIAL:  'bg-amber-100 text-amber-800',
  TUTORIAL:     'bg-purple-100 text-purple-800',
  PRODUCT_DEMO: 'bg-cyan-100 text-cyan-800',
  WEBINAR:      'bg-pink-100 text-pink-800',
  TRAINING:     'bg-orange-100 text-orange-800',
  OTHER:        'bg-gray-100 text-gray-700',
};

interface VideoItem {
  id: string;
  title: string;
  description?: string;
  videoType: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  keywords: string[];
  industryTags: string[];
  isFavorited?: boolean;
  _count?: { views: number; comments: number; favorites: number };
  libraryParts: { part: { id: string; partNumber: string } }[];
  librarySeries: { seriesName: string }[];
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface VideoCardProps {
  video: VideoItem;
  onClick: () => void;
  onFavoriteToggle: (id: string, favorited: boolean) => void;
}

function VideoCard({ video, onClick, onFavoriteToggle }: VideoCardProps) {
  const { user } = useAuthStore();
  const [favorited, setFavorited] = useState(video.isFavorited ?? false);
  const [favCount, setFavCount] = useState(video._count?.favorites ?? 0);
  const [toggling, setToggling] = useState(false);

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error('Please log in to save favorites'); return; }
    if (toggling) return;
    setToggling(true);
    try {
      const { data } = await videoLibraryApi.toggleFavorite(video.id);
      setFavorited(data.favorited);
      setFavCount((c) => c + (data.favorited ? 1 : -1));
      onFavoriteToggle(video.id, data.favorited);
    } catch {
      toast.error('Failed to update favorites');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div
      className="card overflow-hidden group cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-200 overflow-hidden">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <Play className="w-10 h-10 text-gray-300" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
            <Play className="w-5 h-5 text-gray-900 ml-0.5" />
          </div>
        </div>
        {/* Duration badge */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black/75 text-white text-xs px-1.5 py-0.5 rounded font-mono">
            {formatDuration(video.duration)}
          </div>
        )}
        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${TYPE_COLORS[video.videoType] ?? 'bg-gray-100 text-gray-700'}`}>
            {video.videoType.replace(/_/g, ' ')}
          </span>
        </div>
        {/* Favorite button */}
        <button
          onClick={handleFavorite}
          className={`absolute top-2 right-2 p-1.5 rounded-full transition-all ${
            favorited ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-500 hover:bg-white hover:text-red-500'
          }`}
          title={favorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`w-3.5 h-3.5 ${favorited ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-tight mb-1.5">{video.title}</h3>
        {video.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">{video.description}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {(video._count?.views ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> {video._count!.views}
            </span>
          )}
          {favCount > 0 && (
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" /> {favCount}
            </span>
          )}
          {video.duration && (
            <span className="flex items-center gap-1 ml-auto">
              <Clock className="w-3.5 h-3.5" /> {formatDuration(video.duration)}
            </span>
          )}
        </div>

        {/* Industry tags */}
        {video.industryTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {video.industryTags.slice(0, 3).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded text-[10px] font-medium">
                {tag}
              </span>
            ))}
            {video.industryTags.length > 3 && (
              <span className="text-[10px] text-gray-400">+{video.industryTags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VideoLibraryBrowse() {
  const { user } = useAuthStore();

  const [items, setItems] = useState<VideoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadList = useCallback(async (pageNum = 0, searchVal = '', typeVal = '', industryVal = '') => {
    setLoading(true);
    try {
      const { data } = await videoLibraryApi.list({
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
        search: searchVal || undefined,
        videoType: typeVal || undefined,
        industryTag: industryVal || undefined,
      });
      setItems(data.items as VideoItem[]);
      setTotal(data.total ?? 0);
    } catch {
      toast.error('Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, []); // eslint-disable-line

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(0);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadList(0, val, typeFilter, industryFilter), 400);
  };

  const applyFilter = (typeVal: string, industryVal: string) => {
    setPage(0);
    loadList(0, search, typeVal, industryVal);
  };

  const handleFavoriteToggle = (videoId: string, favorited: boolean) => {
    setItems((prev) =>
      prev.map((v) =>
        v.id === videoId
          ? { ...v, isFavorited: favorited, _count: { ...(v._count ?? { views: 0, comments: 0, favorites: 0 }), favorites: (v._count?.favorites ?? 0) + (favorited ? 1 : -1) } }
          : v
      )
    );
    if (selectedVideo?.id === videoId) {
      setSelectedVideo((prev) =>
        prev ? { ...prev, isFavorited: favorited } : null
      );
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="container-custom py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Video Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} video{total !== 1 ? 's' : ''} available</p>
        </div>
        {user && (
          <Link
            to="/videos/library/playlists"
            className="btn bg-gray-100 flex items-center gap-2 text-sm"
          >
            <ListVideo className="w-4 h-4" /> My Playlists
          </Link>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-56 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Search videos by title, keyword…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn flex items-center gap-2 text-sm ${showFilters || typeFilter || industryFilter ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100'}`}
        >
          <Filter className="w-4 h-4" /> Filters {(typeFilter || industryFilter) && '•'}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card p-4 flex flex-wrap gap-4">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-gray-600 mb-1">Video Type</label>
            <select
              className="input w-full text-sm"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); applyFilter(e.target.value, industryFilter); }}
            >
              <option value="">All Types</option>
              {VIDEO_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-gray-600 mb-1">Industry</label>
            <input
              className="input w-full text-sm"
              placeholder="e.g. Automation"
              value={industryFilter}
              onChange={(e) => { setIndustryFilter(e.target.value); applyFilter(typeFilter, e.target.value); }}
            />
          </div>
          {(typeFilter || industryFilter) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setTypeFilter('');
                  setIndustryFilter('');
                  applyFilter('', '');
                }}
                className="btn bg-gray-100 text-sm"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Video Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <Play className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-500 font-medium">No videos found</h3>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onClick={() => setSelectedVideo(video)}
              onFavoriteToggle={handleFavoriteToggle}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={page === 0}
            onClick={() => { const p = page - 1; setPage(p); loadList(p, search, typeFilter, industryFilter); }}
            className="btn bg-gray-100 disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-sm text-gray-600">Page {page + 1} of {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => { const p = page + 1; setPage(p); loadList(p, search, typeFilter, industryFilter); }}
            className="btn bg-gray-100 disabled:opacity-40 flex items-center gap-1"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Video Player Modal */}
      {selectedVideo && (
        <VideoPlayer
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onFavoriteChange={handleFavoriteToggle}
        />
      )}
    </div>
  );
}
