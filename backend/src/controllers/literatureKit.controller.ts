import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  listKits,
  createKit,
  getKit,
  updateKit,
  deleteKit,
  addItemsToKit,
  removeItemFromKit,
  generateKitZip,
  generateKitSlipPdf,
} from '../lib/literatureKitService';

function getUserDisplayName(user: AuthRequest['user']): string {
  if (!user) return 'Unknown';
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : (user.email ?? 'Unknown');
}

/** List current user's kits. */
export const listKitsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const kits = await listKits(req.user.id);
    res.json({ items: kits, total: kits.length });
  } catch (err) {
    console.error('List kits error:', err);
    res.status(500).json({ error: 'Failed to list kits' });
  }
};

/** Create a new kit. */
export const createKitHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const { name, notes } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
    const kit = await createKit(req.user.id, name, notes);
    res.status(201).json(kit);
  } catch (err) {
    console.error('Create kit error:', err);
    res.status(500).json({ error: 'Failed to create kit' });
  }
};

/** Get a kit by ID (owner only). */
export const getKitHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const kit = await getKit(req.params.id, req.user.id);
    if (!kit) { res.status(404).json({ error: 'Kit not found' }); return; }
    res.json(kit);
  } catch (err) {
    console.error('Get kit error:', err);
    res.status(500).json({ error: 'Failed to get kit' });
  }
};

/** Update kit name/notes. */
export const updateKitHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const { name, notes } = req.body;
    const kit = await updateKit(req.params.id, req.user.id, { name, notes });
    res.json(kit);
  } catch (err) {
    console.error('Update kit error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to update kit';
    res.status(400).json({ error: msg });
  }
};

/** Delete a kit. */
export const deleteKitHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    await deleteKit(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete kit error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to delete kit';
    res.status(400).json({ error: msg });
  }
};

/** Add item(s) to a kit. */
export const addItemsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const { literatureIds } = req.body;
    if (!Array.isArray(literatureIds) || literatureIds.length === 0) {
      res.status(400).json({ error: 'literatureIds array is required' }); return;
    }
    const kit = await addItemsToKit(req.params.id, req.user.id, literatureIds);
    res.json(kit);
  } catch (err) {
    console.error('Add items error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to add items';
    res.status(400).json({ error: msg });
  }
};

/** Remove a single item from a kit. */
export const removeItemHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    await removeItemFromKit(req.params.id, req.user.id, req.params.litId);
    res.json({ success: true });
  } catch (err) {
    console.error('Remove item error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to remove item';
    res.status(400).json({ error: msg });
  }
};

/** Download all kit PDFs as a ZIP (or single file if only one small file). */
export const downloadZipHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const { buffer, isZipped, filename } = await generateKitZip(req.params.id, req.user.id);
    res.setHeader('Content-Type', isZipped ? 'application/zip' : 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Kit ZIP error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to generate ZIP';
    res.status(400).json({ error: msg });
  }
};

/** Generate and download Literature Slip PDF. */
export const downloadSlipHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const userName = getUserDisplayName(req.user);
    const buffer = await generateKitSlipPdf(req.params.id, req.user.id, userName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Literature_Slip_${req.params.id}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('Kit slip error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to generate slip';
    res.status(400).json({ error: msg });
  }
};
