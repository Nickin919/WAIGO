import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, X, Play, ListVideo,
  GripVertical, Clock, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { videoLibraryApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import VideoPlayer from '@/components/videos/VideoPlayer';

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

interface PlaylistItem {
  id: string;
  order: number;
  addedAt: string;
  video: VideoItem;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  _count: { items: number };
  items: { video: { id: string; thumbnailUrl?: string; title: string } }[];
}

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

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function MyPlaylists() {
  const { user } = useAuthStore();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

  // New playlist form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadPlaylists();
  }, []); // eslint-disable-line

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const { data } = await videoLibraryApi.getPlaylists();
      setPlaylists(data as Playlist[]);
    } catch {
      toast.error('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const loadPlaylistItems = async (playlistId: string) => {
    setPlaylistLoading(true);
    try {
      const { data } = await videoLibraryApi.getPlaylist(playlistId);
      setPlaylistItems((data as any).items as PlaylistItem[]);
    } catch {
      toast.error('Failed to load playlist');
    } finally {
      setPlaylistLoading(false);
    }
  };

  const selectPlaylist = (id: string) => {
    setSelectedPlaylist(id);
    loadPlaylistItems(id);
  };

  const createPlaylist = async () => {
    if (!newName.trim()) { toast.error('Name is required'); return; }
    setCreating(true);
    try {
      await videoLibraryApi.createPlaylist({ name: newName.trim(), description: newDescription.trim() || undefined });
      setNewName('');
      setNewDescription('');
      setShowCreateForm(false);
      toast.success('Playlist created');
      loadPlaylists();
    } catch {
      toast.error('Failed to create playlist');
    } finally {
      setCreating(false);
    }
  };

  const deletePlaylist = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await videoLibraryApi.deletePlaylist(deleteTarget.id);
      toast.success('Playlist deleted');
      setDeleteTarget(null);
      if (selectedPlaylist === deleteTarget.id) {
        setSelectedPlaylist(null);
        setPlaylistItems([]);
      }
      loadPlaylists();
    } catch {
      toast.error('Failed to delete playlist');
    } finally {
      setDeleting(false);
    }
  };

  const removeVideoFromPlaylist = async (playlistId: string, videoId: string) => {
    try {
      await videoLibraryApi.removeFromPlaylist(playlistId, videoId);
      setPlaylistItems((prev) => prev.filter((item) => item.video.id !== videoId));
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlistId
            ? { ...p, _count: { items: Math.max(0, p._count.items - 1) } }
            : p
        )
      );
      toast.success('Removed from playlist');
    } catch {
      toast.error('Failed to remove video');
    }
  };

  const selectedPlaylistData = playlists.find((p) => p.id === selectedPlaylist);

  if (!user) {
    return (
      <div className="container-custom py-20 text-center">
        <ListVideo className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-700 mb-2">Sign In Required</h2>
        <p className="text-gray-500">Please log in to manage your video playlists.</p>
      </div>
    );
  }

  return (
    <div className="container-custom py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/videos/library" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">My Playlists</h1>
          <p className="text-sm text-gray-500">Save and organize videos into collections</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Playlist
        </button>
      </div>

      {/* Create playlist inline form */}
      {showCreateForm && (
        <div className="card p-5 mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Create New Playlist</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                className="input w-full"
                placeholder="e.g. 221 Series Tutorials"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                className="input w-full"
                placeholder="Optional description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={createPlaylist} disabled={creating} className="btn btn-primary flex items-center gap-2 disabled:opacity-60">
                {creating ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Playlist
              </button>
              <button onClick={() => { setShowCreateForm(false); setNewName(''); setNewDescription(''); }} className="btn bg-gray-100">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-6 min-h-[400px]">
        {/* Playlist list (left column) */}
        <div className="w-72 flex-shrink-0 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="card p-6 text-center">
              <ListVideo className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No playlists yet</p>
              <p className="text-xs text-gray-400 mt-1">Create one to start saving videos</p>
            </div>
          ) : (
            playlists.map((playlist) => (
              <div
                key={playlist.id}
                onClick={() => selectPlaylist(playlist.id)}
                className={`card p-4 cursor-pointer hover:shadow-md transition-shadow ${selectedPlaylist === playlist.id ? 'ring-2 ring-blue-500' : ''}`}
              >
                {/* Thumbnail strip */}
                <div className="flex gap-1 mb-3 h-12 overflow-hidden rounded">
                  {playlist.items.length > 0
                    ? playlist.items.slice(0, 4).map((item, i) => (
                        item.video.thumbnailUrl
                          ? <img key={i} src={item.video.thumbnailUrl} alt="" className="w-1/4 object-cover" />
                          : <div key={i} className="w-1/4 bg-gray-200 flex items-center justify-center"><Play className="w-4 h-4 text-gray-300" /></div>
                      ))
                    : <div className="w-full bg-gray-100 flex items-center justify-center rounded"><ListVideo className="w-6 h-6 text-gray-300" /></div>
                  }
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{playlist.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{playlist._count.items} video{playlist._count.items !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(playlist); }}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Playlist contents (right) */}
        <div className="flex-1 min-w-0">
          {!selectedPlaylist ? (
            <div className="card h-full flex items-center justify-center text-center p-8">
              <div>
                <ListVideo className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Select a playlist to view its videos</p>
              </div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedPlaylistData?.name}</h2>
                  {selectedPlaylistData?.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{selectedPlaylistData.description}</p>
                  )}
                </div>
                <span className="text-sm text-gray-400">{playlistItems.length} videos</span>
              </div>

              {playlistLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : playlistItems.length === 0 ? (
                <div className="py-12 text-center">
                  <Play className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">This playlist is empty</p>
                  <p className="text-xs text-gray-300 mt-1">Browse the Video Library and save videos here</p>
                  <Link to="/videos/library" className="btn btn-primary text-sm mt-3 inline-flex items-center gap-2">
                    <Play className="w-4 h-4" /> Browse Videos
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {playlistItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 group"
                    >
                      <span className="text-gray-300 w-5 text-center text-sm flex-shrink-0">{index + 1}</span>
                      <GripVertical className="w-4 h-4 text-gray-200 flex-shrink-0" />

                      {/* Thumbnail */}
                      <div
                        className="relative w-20 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0 cursor-pointer"
                        onClick={() => setSelectedVideo(item.video)}
                      >
                        {item.video.thumbnailUrl
                          ? <img src={item.video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Play className="w-4 h-4 text-gray-300" /></div>
                        }
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                          <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedVideo(item.video)}>
                        <p className="text-sm font-medium text-gray-900 truncate">{item.video.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${TYPE_COLORS[item.video.videoType] ?? 'bg-gray-100 text-gray-700'}`}>
                            {item.video.videoType.replace(/_/g, ' ')}
                          </span>
                          {item.video.duration && (
                            <span className="text-xs text-gray-400 flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> {formatDuration(item.video.duration)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeVideoFromPlaylist(selectedPlaylist!, item.video.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove from playlist"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Playlist?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Delete "<strong>{deleteTarget.name}</strong>"? The videos themselves won't be deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn bg-gray-100">Cancel</button>
              <button onClick={deletePlaylist} disabled={deleting} className="btn bg-red-600 text-white disabled:opacity-60 flex items-center gap-2">
                {deleting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video player modal */}
      {selectedVideo && (
        <VideoPlayer
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}
