import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  uploadVideoWithAssociations,
  listVideos,
  getVideoById,
  updateVideoMetadata,
  updateVideoAssociations,
  deleteVideo,
  trackView,
  toggleFavorite,
  getUserFavorites,
  addComment,
  getComments,
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addToPlaylist,
  removeFromPlaylist,
  deletePlaylist,
  reorderPlaylistItem,
  getWatchHistory,
  getRelatedVideos,
  getVideoAnalytics,
  getAllVideosForExport,
} from '../lib/videoLibraryService';
import type { VideoType } from '@prisma/client';
import { logUnmatchedEvents } from '../lib/unmatchedLogger';

type MulterFiles = { [fieldname: string]: Express.Multer.File[] };

const parseList = (val: unknown): string[] => {
  if (!val) return [];
  const arr = Array.isArray(val) ? val : [val];
  return arr.flatMap((s: unknown) => String(s).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean));
};

const parseTagList = (val: unknown): string[] | undefined => {
  if (val === undefined) return undefined;
  if (Array.isArray(val)) return val.map(String).map((s) => s.trim()).filter(Boolean);
  return String(val).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
};

// ─── Admin: Upload ────────────────────────────────────────────────────────────

export const uploadVideoHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }

    const files = req.files as MulterFiles | undefined;
    const videoFile = files?.video?.[0];
    const thumbnailFile = files?.thumbnail?.[0];

    if (!videoFile) { res.status(400).json({ error: 'No video file uploaded. Use field name "video".' }); return; }

    const title = (req.body.title as string)?.trim();
    const videoType = (req.body.videoType as string)?.trim();
    if (!title || !videoType) { res.status(400).json({ error: 'title and videoType are required' }); return; }

    const duration = req.body.duration ? parseInt(String(req.body.duration), 10) : undefined;

    const { video, unresolvedParts } = await uploadVideoWithAssociations(
      videoFile,
      thumbnailFile,
      {
        title,
        description: req.body.description,
        videoType,
        partNumbers: parseList(req.body.partNumbers),
        seriesNames: parseList(req.body.seriesNames),
        keywords: parseList(req.body.keywords),
        industryTags: parseList(req.body.industryTags),
        duration,
      },
      req.user.id
    );

    if (unresolvedParts.length > 0) {
      logUnmatchedEvents(
        unresolvedParts.map((pn) => ({
          source: 'VIDEO_LIBRARY_UPLOAD',
          process: 'uploadVideoWithAssociations',
          eventType: 'PART_NOT_FOUND',
          submittedValue: pn,
          submittedField: 'partNumber',
          matchedAgainst: 'Part'
        })),
        { userId: req.user.id, entityType: 'video', entityId: video?.id }
      ).catch(() => {});
    }

    res.status(201).json({ video, unresolvedParts });
  } catch (error) {
    console.error('Upload video error:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload video';
    res.status(400).json({ error: message });
  }
};

// ─── List ─────────────────────────────────────────────────────────────────────

export const getVideoList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user?.role === 'ADMIN';
    const result = await listVideos({
      videoType: req.query.videoType as VideoType | undefined,
      partId: req.query.partId as string | undefined,
      partNumber: req.query.partNumber as string | undefined,
      seriesName: req.query.seriesName as string | undefined,
      search: req.query.search as string | undefined,
      keyword: req.query.keyword as string | undefined,
      industryTag: req.query.industryTag as string | undefined,
      status: isAdmin && req.query.status ? (req.query.status as any) : undefined,
      limit: req.query.limit != null ? parseInt(String(req.query.limit), 10) : undefined,
      offset: req.query.offset != null ? parseInt(String(req.query.offset), 10) : undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('List videos error:', error);
    res.status(500).json({ error: 'Failed to list videos' });
  }
};

// ─── Get single ───────────────────────────────────────────────────────────────

export const getVideoHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const video = await getVideoById(id, req.user?.id);
    if (!video) { res.status(404).json({ error: 'Video not found' }); return; }
    res.json(video);
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
};

// ─── Admin: Update metadata ───────────────────────────────────────────────────

export const patchVideoMetadata = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, videoType, duration } = req.body;
    const video = await updateVideoMetadata(id, {
      title,
      description,
      videoType,
      keywords: parseTagList(req.body.keywords),
      industryTags: parseTagList(req.body.industryTags),
      duration: duration !== undefined ? parseInt(String(duration), 10) : undefined,
    });
    res.json(video);
  } catch (error) {
    console.error('Update video metadata error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update video';
    res.status(400).json({ error: message });
  }
};

// ─── Admin: Update associations ───────────────────────────────────────────────

export const patchVideoAssociations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const partNumbers = parseList(req.body.partNumbers);
    const seriesNames = parseList(req.body.seriesNames);
    const result = await updateVideoAssociations(id, partNumbers, seriesNames);
    if (!result.video) { res.status(404).json({ error: 'Video not found' }); return; }
    res.json({ video: result.video, unresolvedParts: result.unresolvedParts });
  } catch (error) {
    console.error('Update video associations error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update associations';
    res.status(400).json({ error: message });
  }
};

// ─── Admin: Delete ────────────────────────────────────────────────────────────

export const deleteVideoHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await deleteVideo(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete video error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete video';
    res.status(400).json({ error: message });
  }
};

// ─── View tracking ────────────────────────────────────────────────────────────

export const trackViewHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    await trackView(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to track view' });
  }
};

// ─── Favorites ────────────────────────────────────────────────────────────────

export const toggleFavoriteHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const result = await toggleFavorite(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
};

export const getFavoritesHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 24;
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
    const result = await getUserFavorites(req.user.id, limit, offset);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
};

// ─── Comments ─────────────────────────────────────────────────────────────────

export const postCommentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const { content, parentId } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: 'Comment content is required' }); return; }
    const comment = await addComment(req.user.id, req.params.id, content, parentId);
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to post comment' });
  }
};

export const getCommentsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const comments = await getComments(req.params.id);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

// ─── Playlists ────────────────────────────────────────────────────────────────

export const getPlaylistsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const playlists = await getUserPlaylists(req.user.id);
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
};

export const createPlaylistHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const { name, description } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'Playlist name is required' }); return; }
    const playlist = await createPlaylist(req.user.id, name, description);
    res.status(201).json(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create playlist' });
  }
};

export const getPlaylistHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const playlist = await getPlaylistById(req.params.playlistId, req.user.id);
    res.json(playlist);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch playlist';
    res.status(400).json({ error: message });
  }
};

export const deletePlaylistHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    await deletePlaylist(req.params.playlistId, req.user.id);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete playlist';
    res.status(400).json({ error: message });
  }
};

export const addToPlaylistHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const { videoId } = req.body;
    if (!videoId) { res.status(400).json({ error: 'videoId is required' }); return; }
    const item = await addToPlaylist(req.params.playlistId, videoId, req.user.id);
    res.status(201).json(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add to playlist';
    res.status(400).json({ error: message });
  }
};

export const removeFromPlaylistHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    await removeFromPlaylist(req.params.playlistId, req.params.videoId, req.user.id);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove from playlist';
    res.status(400).json({ error: message });
  }
};

export const reorderPlaylistItemHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const { videoId, order } = req.body;
    if (videoId === undefined || order === undefined) {
      res.status(400).json({ error: 'videoId and order are required' }); return;
    }
    await reorderPlaylistItem(req.params.playlistId, videoId, parseInt(String(order), 10), req.user.id);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reorder';
    res.status(400).json({ error: message });
  }
};

// ─── Watch history ────────────────────────────────────────────────────────────

export const getHistoryHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const history = await getWatchHistory(req.user.id, limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch watch history' });
  }
};

// ─── Related videos ───────────────────────────────────────────────────────────

export const getRelatedHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const videos = await getRelatedVideos(req.params.id);
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch related videos' });
  }
};

// ─── Admin analytics ──────────────────────────────────────────────────────────

export const getAnalyticsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const analytics = await getVideoAnalytics();
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

// ─── Admin: Export CSV ────────────────────────────────────────────────────────

export const exportCsvHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const videos = await getAllVideosForExport();
    const rows = videos.map((v) => ({
      video_id: v.id,
      title: v.title,
      video_type: v.videoType,
      video_url: v.videoUrl,
      duration_seconds: v.duration ?? '',
      part_numbers: v.libraryParts.map((p) => p.part.partNumber).join('; '),
      series_names: v.librarySeries.map((s) => s.seriesName).join('; '),
      keywords: v.keywords.join('; '),
      industry_tags: v.industryTags.join('; '),
    }));

    const header = Object.keys(rows[0] ?? {}).join(',');
    const csvRows = rows.map((r) =>
      Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="video-library-export.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export CSV' });
  }
};
