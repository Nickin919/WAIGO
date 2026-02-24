import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { uploadVideoLibrary } from '../middleware/upload';
import {
  uploadVideoHandler,
  getVideoList,
  getVideoHandler,
  patchVideoMetadata,
  patchVideoAssociations,
  deleteVideoHandler,
  trackViewHandler,
  toggleFavoriteHandler,
  getFavoritesHandler,
  postCommentHandler,
  getCommentsHandler,
  getPlaylistsHandler,
  createPlaylistHandler,
  getPlaylistHandler,
  deletePlaylistHandler,
  addToPlaylistHandler,
  removeFromPlaylistHandler,
  reorderPlaylistItemHandler,
  getHistoryHandler,
  getRelatedHandler,
  getAnalyticsHandler,
  exportCsvHandler,
} from '../controllers/videoLibrary.controller';

const router = Router();

// ─── User: self routes (must be before /:id to avoid collision) ───────────────
router.get('/me/favorites', authenticate, getFavoritesHandler);
router.get('/me/history', authenticate, getHistoryHandler);

// ─── Admin: analytics & export ────────────────────────────────────────────────
router.get('/admin/analytics', authenticate, authorize('ADMIN'), getAnalyticsHandler);
router.get('/export/csv', authenticate, authorize('ADMIN'), exportCsvHandler);

// ─── Playlist routes ──────────────────────────────────────────────────────────
router.get('/playlists', authenticate, getPlaylistsHandler);
router.post('/playlists', authenticate, createPlaylistHandler);
router.get('/playlists/:playlistId', authenticate, getPlaylistHandler);
router.delete('/playlists/:playlistId', authenticate, deletePlaylistHandler);
router.post('/playlists/:playlistId/items', authenticate, addToPlaylistHandler);
router.delete('/playlists/:playlistId/items/:videoId', authenticate, removeFromPlaylistHandler);
router.patch('/playlists/:playlistId/reorder', authenticate, reorderPlaylistItemHandler);

// ─── Video library CRUD ───────────────────────────────────────────────────────
router.get('/', authenticate, getVideoList);
router.post('/', authenticate, authorize('ADMIN'), uploadVideoLibrary, uploadVideoHandler);
router.get('/:id', authenticate, getVideoHandler);
router.patch('/:id', authenticate, authorize('ADMIN'), patchVideoMetadata);
router.patch('/:id/associations', authenticate, authorize('ADMIN'), patchVideoAssociations);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteVideoHandler);

// ─── Engagement ───────────────────────────────────────────────────────────────
router.post('/:id/view', authenticate, trackViewHandler);
router.post('/:id/favorite', authenticate, toggleFavoriteHandler);
router.get('/:id/comments', authenticate, getCommentsHandler);
router.post('/:id/comments', authenticate, postCommentHandler);
router.get('/:id/related', authenticate, getRelatedHandler);

export default router;
