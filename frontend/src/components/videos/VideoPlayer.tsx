import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Heart, MessageCircle, Share2, BookmarkPlus, ChevronRight,
  Send, Clock, Eye, Tag, Play,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { videoLibraryApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; firstName?: string; lastName?: string; avatarUrl?: string };
  replies: Comment[];
}

interface Playlist {
  id: string;
  name: string;
}

interface VideoPlayerProps {
  video: VideoItem;
  onClose: () => void;
  onFavoriteChange?: (videoId: string, favorited: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function userName(user: Comment['user']): string {
  if (user.firstName || user.lastName) return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return 'User';
}

// ─── Share Modal ─────────────────────────────────────────────────────────────

function ShareModal({ video, onClose }: { video: VideoItem; onClose: () => void }) {
  const shareUrl = video.videoUrl;
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">Share Video</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Video Link</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="input flex-1 text-sm bg-gray-50 font-mono"
              />
              <button
                onClick={copy}
                className={`btn text-sm ${copied ? 'bg-green-500 text-white' : 'btn-primary'}`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-500 text-center">
            Share this direct video link with colleagues
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add to Playlist Dropdown ─────────────────────────────────────────────────

function PlaylistDropdown({
  videoId, playlists, onAddNew, onClose,
}: {
  videoId: string;
  playlists: Playlist[];
  onAddNew: () => void;
  onClose: () => void;
}) {
  const addToPlaylist = async (playlistId: string) => {
    try {
      await videoLibraryApi.addToPlaylist(playlistId, videoId);
      toast.success('Added to playlist');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add to playlist');
    }
  };

  return (
    <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-lg w-52 overflow-hidden">
      <div className="p-2 text-xs font-semibold text-gray-500 border-b">Add to Playlist</div>
      {playlists.length === 0 ? (
        <div className="p-3 text-sm text-gray-500 text-center">No playlists yet</div>
      ) : (
        playlists.map((p) => (
          <button
            key={p.id}
            onClick={() => addToPlaylist(p.id)}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 truncate"
          >
            {p.name}
          </button>
        ))
      )}
      <div className="border-t">
        <button
          onClick={onAddNew}
          className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium"
        >
          + New Playlist
        </button>
      </div>
    </div>
  );
}

// ─── Comment component ────────────────────────────────────────────────────────

function CommentItem({
  comment, videoId, onReplyAdded,
}: { comment: Comment; videoId: string; onReplyAdded: () => void }) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await videoLibraryApi.postComment(videoId, { content: replyText, parentId: comment.id });
      setReplyText('');
      setShowReply(false);
      onReplyAdded();
    } catch {
      toast.error('Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-3">
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
          {userName(comment.user).charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">{userName(comment.user)}</span>
            <span className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleDateString()}</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
          <button
            onClick={() => setShowReply(!showReply)}
            className="mt-1 text-xs text-gray-400 hover:text-blue-600"
          >
            Reply
          </button>
          {showReply && (
            <div className="mt-2 flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="Write a reply…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(); } }}
              />
              <button
                onClick={submitReply}
                disabled={submitting || !replyText.trim()}
                className="btn btn-primary px-3 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
          {comment.replies?.length > 0 && (
            <div className="mt-3 pl-3 border-l-2 border-gray-100 space-y-2">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                    {userName(reply.user).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-900">{userName(reply.user)} </span>
                    <span className="text-xs text-gray-400">{new Date(reply.createdAt).toLocaleDateString()}</span>
                    <p className="text-xs text-gray-700 mt-0.5">{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main VideoPlayer ──────────────────────────────────────────────────────────

export default function VideoPlayer({ video, onClose, onFavoriteChange }: VideoPlayerProps) {
  const { user } = useAuthStore();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [favorited, setFavorited] = useState(video.isFavorited ?? false);
  const [favCount, setFavCount] = useState(video._count?.favorites ?? 0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [related, setRelated] = useState<VideoItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false);
  const [showNewPlaylistForm, setShowNewPlaylistForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [viewTracked, setViewTracked] = useState(false);

  // Load comments, related videos, playlists
  useEffect(() => {
    const loadData = async () => {
      try {
        const [commentsRes, relatedRes, playlistsRes] = await Promise.all([
          videoLibraryApi.getComments(video.id),
          videoLibraryApi.getRelated(video.id),
          user ? videoLibraryApi.getPlaylists() : Promise.resolve({ data: [] }),
        ]);
        setComments(commentsRes.data as Comment[]);
        setRelated(relatedRes.data as VideoItem[]);
        setPlaylists((playlistsRes.data as any) ?? []);
      } catch {
        // Non-critical
      } finally {
        setCommentsLoading(false);
      }
    };
    loadData();
  }, [video.id, user]);

  // Track view after 10 seconds of watching
  useEffect(() => {
    if (!user || viewTracked) return;
    const timer = setTimeout(async () => {
      try {
        await videoLibraryApi.trackView(video.id);
        setViewTracked(true);
      } catch { /* ignore */ }
    }, 10000);
    return () => clearTimeout(timer);
  }, [video.id, user, viewTracked]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleFavorite = async () => {
    if (!user) { toast.error('Please log in to save favorites'); return; }
    const prevFavorited = favorited;
    const prevCount = favCount;
    setFavorited(!prevFavorited);
    setFavCount((c) => Math.max(0, c + (prevFavorited ? -1 : 1)));
    try {
      const { data } = await videoLibraryApi.toggleFavorite(video.id);
      setFavorited(data.favorited);
      setFavCount((c) => Math.max(0, prevCount + (data.favorited ? 1 : -1)));
      onFavoriteChange?.(video.id, data.favorited);
      toast.success(data.favorited ? 'Added to favorites' : 'Removed from favorites');
    } catch {
      setFavorited(prevFavorited);
      setFavCount(prevCount);
      toast.error('Failed to update favorites');
    }
  };

  const loadComments = useCallback(async () => {
    try {
      const { data } = await videoLibraryApi.getComments(video.id);
      setComments(data as Comment[]);
    } catch { /* ignore */ }
  }, [video.id]);

  const submitComment = async () => {
    if (!user) { toast.error('Please log in to comment'); return; }
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await videoLibraryApi.postComment(video.id, { content: commentText });
      setCommentText('');
      await loadComments();
      toast.success('Comment posted');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const createPlaylistAndAdd = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      const { data: pl } = await videoLibraryApi.createPlaylist({ name: newPlaylistName });
      await videoLibraryApi.addToPlaylist(pl.id, video.id);
      setPlaylists((prev) => [...prev, pl]);
      setNewPlaylistName('');
      setShowNewPlaylistForm(false);
      setShowPlaylistDropdown(false);
      toast.success(`Added to "${pl.name}"`);
    } catch {
      toast.error('Failed to create playlist');
    }
  };

  const totalComments = comments.length > 0 ? comments.length : (video._count?.comments ?? 0);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl my-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${TYPE_COLORS[video.videoType] ?? 'bg-gray-100 text-gray-700'}`}>
              {video.videoType.replace(/_/g, ' ')}
            </span>
            <h2 className="text-lg font-semibold text-gray-900 truncate">{video.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-4">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main content */}
        <div className="flex flex-col lg:flex-row">
          {/* Left: video + details + comments */}
          <div className="flex-1 min-w-0">
            {/* Video player */}
            <div className="bg-black">
              <video
                ref={videoRef}
                src={video.videoUrl}
                poster={video.thumbnailUrl}
                controls
                autoPlay
                className="w-full max-h-[60vh] object-contain"
              />
            </div>

            {/* Meta & engagement */}
            <div className="p-6 border-b">
              {/* Stats row */}
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                {video.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" /> {formatDuration(video.duration)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" /> {video._count?.views ?? 0} views
                </span>
              </div>

              {video.description && (
                <p className="text-gray-700 text-sm leading-relaxed mb-4">{video.description}</p>
              )}

              {/* Tags */}
              <div className="space-y-2">
                {video.libraryParts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs text-gray-400 font-medium">Parts:</span>
                    {video.libraryParts.map((lp) => (
                      <span key={lp.part.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono">
                        {lp.part.partNumber}
                      </span>
                    ))}
                  </div>
                )}
                {video.librarySeries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs text-gray-400 font-medium">Series:</span>
                    {video.librarySeries.map((ls) => (
                      <span key={ls.seriesName} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
                        {ls.seriesName}
                      </span>
                    ))}
                  </div>
                )}
                {video.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <Tag className="w-3.5 h-3.5 text-gray-400" />
                    {video.keywords.map((kw) => (
                      <span key={kw} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{kw}</span>
                    ))}
                  </div>
                )}
                {video.industryTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {video.industryTags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full text-xs font-medium">{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Engagement bar */}
              <div className="flex items-center gap-2 mt-5 pt-4 border-t">
                <button
                  onClick={handleFavorite}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    favorited ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
                  <span>{favCount > 0 ? favCount : ''} {favorited ? 'Favorited' : 'Favorite'}</span>
                </button>

                <button
                  onClick={() => document.getElementById('comments-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{totalComments > 0 ? totalComments : ''} Comments</span>
                </button>

                <button
                  onClick={() => setShowShare(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>

                <div className="relative ml-auto">
                  <button
                    onClick={() => setShowPlaylistDropdown(!showPlaylistDropdown)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    <BookmarkPlus className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                  {showPlaylistDropdown && (
                    <>
                      <div className="fixed inset-0 z-0" onClick={() => setShowPlaylistDropdown(false)} />
                      <div className="relative z-10">
                        <PlaylistDropdown
                          videoId={video.id}
                          playlists={playlists}
                          onAddNew={() => { setShowNewPlaylistForm(true); setShowPlaylistDropdown(false); }}
                          onClose={() => setShowPlaylistDropdown(false)}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* New playlist inline form */}
              {showNewPlaylistForm && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">New Playlist</p>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1 text-sm"
                      placeholder="Playlist name…"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') createPlaylistAndAdd(); }}
                      autoFocus
                    />
                    <button onClick={createPlaylistAndAdd} className="btn btn-primary text-sm px-3">Create & Add</button>
                    <button onClick={() => setShowNewPlaylistForm(false)} className="btn bg-gray-100 text-sm px-3">Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* Comments */}
            <div id="comments-section" className="p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Comments {comments.length > 0 && <span className="text-gray-400 font-normal text-sm">({comments.length})</span>}
              </h3>

              {/* New comment input */}
              <div className="flex gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
                  {user ? (user.firstName ?? user.email ?? 'U').charAt(0).toUpperCase() : '?'}
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    className="input flex-1 text-sm"
                    placeholder={user ? 'Add a comment…' : 'Log in to comment'}
                    value={commentText}
                    disabled={!user}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                  />
                  <button
                    onClick={submitComment}
                    disabled={submittingComment || !commentText.trim() || !user}
                    className="btn btn-primary px-3 disabled:opacity-50"
                  >
                    {submittingComment
                      ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Send className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>

              {commentsLoading ? (
                <div className="text-center py-6 text-gray-400 text-sm">Loading comments…</div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No comments yet. Be the first!</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {comments.map((c) => (
                    <CommentItem key={c.id} comment={c} videoId={video.id} onReplyAdded={loadComments} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar: Related videos */}
          {related.length > 0 && (
            <div className="lg:w-72 xl:w-80 border-l flex-shrink-0">
              <div className="p-4 border-b">
                <h3 className="text-sm font-semibold text-gray-700">Related Videos</h3>
              </div>
              <div className="divide-y divide-gray-100 overflow-y-auto max-h-[80vh]">
                {related.map((rv) => (
                  <a
                    key={rv.id}
                    href={rv.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-3 p-3 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="relative w-20 h-14 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                      {rv.thumbnailUrl
                        ? <img src={rv.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Play className="w-5 h-5 text-gray-400" /></div>
                      }
                      {rv.duration && (
                        <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[10px] px-1 rounded">
                          {formatDuration(rv.duration)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600">{rv.title}</p>
                      <span className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${TYPE_COLORS[rv.videoType] ?? 'bg-gray-100 text-gray-700'}`}>
                        {rv.videoType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 self-center" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Share modal */}
      {showShare && <ShareModal video={video} onClose={() => setShowShare(false)} />}
    </div>
  );
}
