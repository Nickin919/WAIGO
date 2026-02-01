import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * Get comments by video
 */
export const getCommentsByVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { videoId } = req.params;

    const comments = await prisma.comment.findMany({
      where: {
        videoId,
        isApproved: true,
        parentId: null // Only get top-level comments
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(comments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

/**
 * Create comment
 */
export const createComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { videoId, content, parentId, imageUrl } = req.body;

    if (!videoId || !content) {
      res.status(400).json({ error: 'videoId and content are required' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        videoId,
        userId: req.user.id,
        content,
        parentId: parentId || null,
        imageUrl,
        isApproved: true // Auto-approve for MVP; can add moderation later
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
};

/**
 * Update comment
 */
export const updateComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const { content } = req.body;

    // Verify ownership
    const existingComment = await prisma.comment.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!existingComment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (existingComment.userId !== req.user.id) {
      res.status(403).json({ error: 'Not authorized to update this comment' });
      return;
    }

    const comment = await prisma.comment.update({
      where: { id },
      data: { content }
    });

    res.json(comment);
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
};

/**
 * Delete comment
 */
export const deleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    // Verify ownership or admin
    const existingComment = await prisma.comment.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!existingComment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (existingComment.userId !== req.user.id && req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Not authorized to delete this comment' });
      return;
    }

    await prisma.comment.delete({
      where: { id }
    });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};

/**
 * Like comment
 */
export const likeComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const comment = await prisma.comment.update({
      where: { id },
      data: {
        likesCount: { increment: 1 }
      }
    });

    res.json(comment);
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ error: 'Failed to like comment' });
  }
};
