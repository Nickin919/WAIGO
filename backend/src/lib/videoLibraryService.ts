import path from 'path';
import { prisma } from './prisma';
import { uploadToR2, deleteFromR2, R2_PUBLIC_BUCKET, getPublicUrl } from './r2';
import type { VideoType as PrismaVideoType, VideoStatus } from '@prisma/client';

const MAX_PARTS = 100;
const MAX_SERIES = 50;

// ─── Include helpers ──────────────────────────────────────────────────────────

const videoInclude = {
  libraryParts: { include: { part: { select: { id: true, partNumber: true, series: true } } } },
  librarySeries: true,
  uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
  _count: { select: { views: true, comments: true, favorites: true } },
};

// ─── Part-number resolution ───────────────────────────────────────────────────

async function resolvePartNumbers(partNumbers: string[]): Promise<{ partIds: string[]; unresolvedParts: string[] }> {
  const partIds: string[] = [];
  const unresolvedParts: string[] = [];
  for (const pn of partNumbers) {
    const trimmed = pn.trim();
    if (!trimmed) continue;
    const part = await prisma.part.findFirst({
      where: { OR: [{ partNumber: trimmed }, { wagoIdent: trimmed }] },
      select: { id: true },
    });
    if (part) partIds.push(part.id);
    else unresolvedParts.push(trimmed);
  }
  return { partIds, unresolvedParts };
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadVideoWithAssociations(
  videoFile: Express.Multer.File,
  thumbnailFile: Express.Multer.File | undefined,
  metadata: {
    title: string;
    description?: string;
    videoType: string;
    partNumbers?: string[];
    seriesNames?: string[];
    keywords?: string[];
    industryTags?: string[];
    duration?: number;
  },
  userId: string
) {
  const partNumberInputs = (metadata.partNumbers ?? []).filter(Boolean);
  const seriesNames = (metadata.seriesNames ?? []).map((s) => s.trim()).filter(Boolean);
  const keywords = (metadata.keywords ?? []).map((k) => k.trim()).filter(Boolean);
  const industryTags = (metadata.industryTags ?? []).map((t) => t.trim()).filter(Boolean);

  const { partIds, unresolvedParts } = await resolvePartNumbers(partNumberInputs);

  if (partIds.length > MAX_PARTS || seriesNames.length > MAX_SERIES) {
    throw new Error(`Maximum ${MAX_PARTS} parts and ${MAX_SERIES} series per video`);
  }

  // Upload video to R2
  const videoExt = path.extname(videoFile.originalname) || '.mp4';
  const videoBase = path.basename(videoFile.originalname, videoExt).replace(/[^a-zA-Z0-9._-]/g, '_');
  const videoKey = `videos/lib/${Date.now()}-${videoBase}${videoExt}`;
  await uploadToR2(R2_PUBLIC_BUCKET, videoKey, videoFile.buffer, videoFile.mimetype || 'video/mp4');
  const videoUrl = getPublicUrl(videoKey);

  // Upload thumbnail to R2 (if provided)
  let thumbnailUrl: string | null = null;
  if (thumbnailFile) {
    const thumbExt = path.extname(thumbnailFile.originalname) || '.jpg';
    const thumbBase = path.basename(thumbnailFile.originalname, thumbExt).replace(/[^a-zA-Z0-9._-]/g, '_');
    const thumbKey = `videos/thumbnails/${Date.now()}-${thumbBase}${thumbExt}`;
    await uploadToR2(R2_PUBLIC_BUCKET, thumbKey, thumbnailFile.buffer, thumbnailFile.mimetype || 'image/jpeg');
    thumbnailUrl = getPublicUrl(thumbKey);
  }

  const result = await prisma.$transaction(async (tx) => {
    const video = await tx.video.create({
      data: {
        title: metadata.title.trim(),
        description: metadata.description?.trim() || null,
        videoType: metadata.videoType as PrismaVideoType,
        videoUrl,
        thumbnailUrl,
        keywords,
        industryTags,
        duration: metadata.duration ?? null,
        status: 'APPROVED' as VideoStatus, // Admin-uploaded videos are auto-approved
        uploadedById: userId,
      },
    });

    if (partIds.length) {
      await tx.videoLibraryPart.createMany({
        data: partIds.map((partId) => ({ videoId: video.id, partId })),
        skipDuplicates: true,
      });
    }
    if (seriesNames.length) {
      await tx.videoLibrarySeries.createMany({
        data: seriesNames.map((seriesName) => ({ videoId: video.id, seriesName })),
        skipDuplicates: true,
      });
    }

    return tx.video.findUnique({ where: { id: video.id }, include: videoInclude });
  });

  return { video: result, unresolvedParts };
}

// ─── List / Get ───────────────────────────────────────────────────────────────

export async function listVideos(options?: {
  videoType?: PrismaVideoType;
  partId?: string;
  partNumber?: string;
  seriesName?: string;
  search?: string;
  keyword?: string;
  industryTag?: string;
  status?: VideoStatus;
  limit?: number;
  offset?: number;
}) {
  const andClauses: object[] = [];

  // Admin library videos only (status APPROVED by default for users; admin sees all)
  if (options?.status) {
    andClauses.push({ status: options.status });
  } else {
    andClauses.push({ status: 'APPROVED' });
  }

  if (options?.videoType) {
    andClauses.push({ videoType: options.videoType });
  }

  if (options?.partId) {
    andClauses.push({ libraryParts: { some: { partId: options.partId } } });
  }

  if (options?.partNumber) {
    const part = await prisma.part.findFirst({
      where: { OR: [{ partNumber: options.partNumber }, { wagoIdent: options.partNumber }] },
      select: { id: true },
    });
    if (part) {
      andClauses.push({ libraryParts: { some: { partId: part.id } } });
    } else {
      return { items: [], total: 0 };
    }
  }

  if (options?.seriesName) {
    andClauses.push({
      librarySeries: { some: { seriesName: { contains: options.seriesName, mode: 'insensitive' } } },
    });
  }

  if (options?.search) {
    andClauses.push({
      OR: [
        { title: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
        { keywords: { has: options.search } },
      ],
    });
  }

  if (options?.keyword) {
    andClauses.push({ keywords: { hasSome: [options.keyword] } });
  }

  if (options?.industryTag) {
    andClauses.push({ industryTags: { hasSome: [options.industryTag] } });
  }

  const where = andClauses.length > 0 ? { AND: andClauses } : undefined;

  const [items, total] = await Promise.all([
    prisma.video.findMany({
      where,
      include: videoInclude,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 24,
      skip: options?.offset ?? 0,
    }),
    prisma.video.count({ where }),
  ]);

  return { items, total };
}

export async function getVideoById(id: string, userId?: string) {
  const video = await prisma.video.findUnique({
    where: { id },
    include: {
      ...videoInclude,
      favorites: userId ? { where: { userId } } : false,
    },
  });
  if (!video) return null;

  const isFavorited = userId ? (video as any).favorites?.length > 0 : false;

  return { ...video, isFavorited };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateVideoMetadata(
  id: string,
  fields: {
    title?: string;
    description?: string;
    videoType?: string;
    keywords?: string[];
    industryTags?: string[];
    duration?: number;
  }
) {
  const data: Record<string, unknown> = {};
  if (fields.title !== undefined) data.title = fields.title.trim();
  if (fields.description !== undefined) data.description = fields.description?.trim() || null;
  if (fields.videoType !== undefined) data.videoType = fields.videoType as PrismaVideoType;
  if (fields.keywords !== undefined) data.keywords = fields.keywords.map((k) => k.trim()).filter(Boolean);
  if (fields.industryTags !== undefined) data.industryTags = fields.industryTags.map((t) => t.trim()).filter(Boolean);
  if (fields.duration !== undefined) data.duration = fields.duration;

  return prisma.video.update({ where: { id }, data, include: videoInclude });
}

export async function updateVideoAssociations(
  videoId: string,
  partNumbers: string[],
  seriesNames: string[]
): Promise<{ video: any; unresolvedParts: string[] }> {
  const cleanedSeries = seriesNames.map((s) => s.trim()).filter(Boolean);
  const { partIds, unresolvedParts } = await resolvePartNumbers(partNumbers);

  if (partIds.length > MAX_PARTS || cleanedSeries.length > MAX_SERIES) {
    throw new Error(`Maximum ${MAX_PARTS} parts and ${MAX_SERIES} series per video`);
  }

  const video = await prisma.$transaction(async (tx) => {
    await tx.videoLibraryPart.deleteMany({ where: { videoId } });
    await tx.videoLibrarySeries.deleteMany({ where: { videoId } });

    if (partIds.length) {
      await tx.videoLibraryPart.createMany({
        data: partIds.map((partId) => ({ videoId, partId })),
        skipDuplicates: true,
      });
    }
    if (cleanedSeries.length) {
      await tx.videoLibrarySeries.createMany({
        data: cleanedSeries.map((seriesName) => ({ videoId, seriesName })),
        skipDuplicates: true,
      });
    }

    return tx.video.findUnique({ where: { id: videoId }, include: videoInclude });
  });

  return { video, unresolvedParts };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteVideo(id: string) {
  const video = await prisma.video.findUnique({
    where: { id },
    select: { videoUrl: true, thumbnailUrl: true },
  });
  if (!video) throw new Error('Video not found');

  const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

  const deleteR2 = async (url: string) => {
    try {
      let key: string | null = null;
      if (publicBase && url.startsWith(publicBase)) {
        key = url.slice(publicBase.length + 1);
      }
      if (key) await deleteFromR2(R2_PUBLIC_BUCKET, key);
    } catch (err) {
      console.warn('Could not delete R2 object:', url, err);
    }
  };

  await deleteR2(video.videoUrl);
  if (video.thumbnailUrl) await deleteR2(video.thumbnailUrl);

  await prisma.video.delete({ where: { id } });
}

// ─── View tracking ────────────────────────────────────────────────────────────

export async function trackView(videoId: string, userId: string) {
  await prisma.userVideoView.upsert({
    where: { userId_videoId: { userId, videoId } },
    update: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    create: { userId, videoId, viewCount: 1, lastViewedAt: new Date() },
  });
}

// ─── Favorites ────────────────────────────────────────────────────────────────

export async function toggleFavorite(userId: string, videoId: string): Promise<{ favorited: boolean }> {
  const existing = await prisma.videoFavorite.findUnique({
    where: { userId_videoId: { userId, videoId } },
  });

  if (existing) {
    await prisma.videoFavorite.delete({ where: { userId_videoId: { userId, videoId } } });
    return { favorited: false };
  } else {
    await prisma.videoFavorite.create({ data: { userId, videoId } });
    return { favorited: true };
  }
}

export async function getUserFavorites(userId: string, limit = 24, offset = 0) {
  const [items, total] = await Promise.all([
    prisma.videoFavorite.findMany({
      where: { userId },
      include: { video: { include: videoInclude } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.videoFavorite.count({ where: { userId } }),
  ]);
  return { items: items.map((f) => f.video), total };
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function addComment(
  userId: string,
  videoId: string,
  content: string,
  parentId?: string
) {
  return prisma.comment.create({
    data: { userId, videoId, content: content.trim(), parentId: parentId || null },
    include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } }, replies: true },
  });
}

export async function getComments(videoId: string) {
  return prisma.comment.findMany({
    where: { videoId, parentId: null, isApproved: true },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      replies: {
        where: { isApproved: true },
        include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Playlists ────────────────────────────────────────────────────────────────

export async function createPlaylist(userId: string, name: string, description?: string) {
  return prisma.videoPlaylist.create({
    data: { userId, name: name.trim(), description: description?.trim() || null },
    include: { _count: { select: { items: true } } },
  });
}

export async function getUserPlaylists(userId: string) {
  return prisma.videoPlaylist.findMany({
    where: { userId },
    include: {
      _count: { select: { items: true } },
      items: {
        take: 4,
        orderBy: { order: 'asc' },
        include: { video: { select: { id: true, thumbnailUrl: true, title: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPlaylistById(playlistId: string, userId: string) {
  const playlist = await prisma.videoPlaylist.findUnique({
    where: { id: playlistId },
    include: {
      items: {
        orderBy: { order: 'asc' },
        include: { video: { include: videoInclude } },
      },
    },
  });
  if (!playlist) throw new Error('Playlist not found');
  if (playlist.userId !== userId) throw new Error('Not authorized');
  return playlist;
}

export async function addToPlaylist(playlistId: string, videoId: string, userId: string) {
  const playlist = await prisma.videoPlaylist.findUnique({ where: { id: playlistId } });
  if (!playlist) throw new Error('Playlist not found');
  if (playlist.userId !== userId) throw new Error('Not authorized');

  const maxOrder = await prisma.videoPlaylistItem.aggregate({
    where: { playlistId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  return prisma.videoPlaylistItem.create({
    data: { playlistId, videoId, order: nextOrder },
  });
}

export async function removeFromPlaylist(playlistId: string, videoId: string, userId: string) {
  const playlist = await prisma.videoPlaylist.findUnique({ where: { id: playlistId } });
  if (!playlist) throw new Error('Playlist not found');
  if (playlist.userId !== userId) throw new Error('Not authorized');

  await prisma.videoPlaylistItem.deleteMany({ where: { playlistId, videoId } });
}

export async function deletePlaylist(playlistId: string, userId: string) {
  const playlist = await prisma.videoPlaylist.findUnique({ where: { id: playlistId } });
  if (!playlist) throw new Error('Playlist not found');
  if (playlist.userId !== userId) throw new Error('Not authorized');
  await prisma.videoPlaylist.delete({ where: { id: playlistId } });
}

export async function reorderPlaylistItem(playlistId: string, videoId: string, newOrder: number, userId: string) {
  const playlist = await prisma.videoPlaylist.findUnique({ where: { id: playlistId } });
  if (!playlist) throw new Error('Playlist not found');
  if (playlist.userId !== userId) throw new Error('Not authorized');

  await prisma.videoPlaylistItem.updateMany({
    where: { playlistId, videoId },
    data: { order: newOrder },
  });
}

// ─── Watch history ────────────────────────────────────────────────────────────

export async function getWatchHistory(userId: string, limit = 20) {
  const views = await prisma.userVideoView.findMany({
    where: { userId },
    include: { video: { include: videoInclude } },
    orderBy: { lastViewedAt: 'desc' },
    take: limit,
  });
  return views.map((v) => ({ ...v.video, lastViewedAt: v.lastViewedAt, viewCount: v.viewCount }));
}

// ─── Related videos ───────────────────────────────────────────────────────────

export async function getRelatedVideos(videoId: string, limit = 5) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      industryTags: true,
      keywords: true,
      videoType: true,
      libraryParts: { select: { partId: true } },
      librarySeries: { select: { seriesName: true } },
    },
  });
  if (!video) return [];

  const partIds = video.libraryParts.map((p) => p.partId);
  const seriesNames = video.librarySeries.map((s) => s.seriesName);

  return prisma.video.findMany({
    where: {
      id: { not: videoId },
      status: 'APPROVED',
      OR: [
        partIds.length ? { libraryParts: { some: { partId: { in: partIds } } } } : {},
        seriesNames.length ? { librarySeries: { some: { seriesName: { in: seriesNames } } } } : {},
        video.industryTags.length ? { industryTags: { hasSome: video.industryTags } } : {},
        { videoType: video.videoType },
      ].filter((c) => Object.keys(c).length > 0),
    },
    include: videoInclude,
    take: limit,
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Admin analytics ──────────────────────────────────────────────────────────

export async function getVideoAnalytics() {
  const [totalVideos, totalViews, topViewed, recentlyAdded] = await Promise.all([
    prisma.video.count({ where: { status: 'APPROVED' } }),
    prisma.userVideoView.aggregate({ _sum: { viewCount: true } }),
    prisma.video.findMany({
      where: { status: 'APPROVED' },
      include: { ...videoInclude },
      orderBy: { views: { _count: 'desc' } },
      take: 10,
    }),
    prisma.video.findMany({
      where: { status: 'APPROVED' },
      include: videoInclude,
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return {
    totalVideos,
    totalViews: totalViews._sum.viewCount ?? 0,
    topViewed,
    recentlyAdded,
  };
}

export async function getAllVideosForExport() {
  return prisma.video.findMany({
    where: { status: 'APPROVED' },
    include: {
      libraryParts: { include: { part: { select: { partNumber: true } } } },
      librarySeries: true,
    },
    orderBy: { title: 'asc' },
  });
}

// ─── Feed candidate resolver (project book → video IDs) ────────────────────────

/**
 * Returns approved video IDs eligible for the project book feed:
 * - Direct part links (CatalogItem.productId → Video.partId)
 * - Category-expanded parts (CatalogItem.categoryId → Part in that category → Video.partId / VideoLibraryPart)
 * - Series links: (1) Part.series for parts in the book, (2) VideoLibrarySeries.seriesName from any video already linked to a catalog part (so all videos with that series appear)
 * - Explicit video–part links (VideoLibraryPart.partId in resolved part set)
 */
export async function getFeedCandidateVideoIds(catalogId: string): Promise<string[]> {
  const catalogItems = await prisma.catalogItem.findMany({
    where: { catalogId },
    select: { productId: true, categoryId: true },
  });

  const partIdsFromProducts = catalogItems
    .map((i) => i.productId)
    .filter((id): id is string => id != null);

  const categoryIds = catalogItems
    .map((i) => i.categoryId)
    .filter((id): id is string => id != null);
  const partIdsFromCategories =
    categoryIds.length === 0
      ? []
      : await prisma.part
          .findMany({
            where: { catalogId, categoryId: { in: categoryIds } },
            select: { id: true },
          })
          .then((parts) => parts.map((p) => p.id));

  const allPartIds = [...new Set([...partIdsFromProducts, ...partIdsFromCategories])];
  if (allPartIds.length === 0) return [];

  const seriesRows = await prisma.part.findMany({
    where: { id: { in: allPartIds }, series: { not: null } },
    select: { series: true },
  });
  const seriesFromParts = new Set(seriesRows.map((r) => r.series!.trim()).filter(Boolean));

  // Also include series from videos already linked to catalog parts (VideoLibraryPart).
  // So if any video linked to a catalog part has series "001", all videos with series "001" appear in the feed.
  const seriesFromLinkedVideos = await prisma.videoLibrarySeries.findMany({
    where: {
      video: {
        libraryParts: { some: { partId: { in: allPartIds } } },
      },
    },
    select: { seriesName: true },
  });
  seriesFromLinkedVideos.forEach((r) => seriesFromParts.add(r.seriesName.trim()));

  // Also include series from legacy-linked videos (video.partId in catalog). Otherwise only one video
  // appears when that video is linked by partId but has no VideoLibraryPart and no Part.series match.
  const seriesFromLegacyVideos = await prisma.videoLibrarySeries.findMany({
    where: { video: { partId: { in: allPartIds }, status: 'APPROVED' } },
    select: { seriesName: true },
  });
  seriesFromLegacyVideos.forEach((r) => seriesFromParts.add(r.seriesName.trim()));

  const seriesNames = [...seriesFromParts];

  const [legacyVideos, libraryPartVideos, seriesVideos] = await Promise.all([
    prisma.video.findMany({
      where: { partId: { in: allPartIds }, status: 'APPROVED' },
      select: { id: true },
    }),
    prisma.videoLibraryPart.findMany({
      where: { partId: { in: allPartIds } },
      select: { videoId: true },
    }),
    seriesNames.length
      ? prisma.videoLibrarySeries.findMany({
          where: { seriesName: { in: seriesNames } },
          select: { videoId: true },
        })
      : Promise.resolve([]),
  ]);

  const videoIds = new Set<string>();
  legacyVideos.forEach((v) => videoIds.add(v.id));
  libraryPartVideos.forEach((v) => videoIds.add(v.videoId));
  seriesVideos.forEach((v) => videoIds.add(v.videoId));

  const approved = await prisma.video.findMany({
    where: { id: { in: [...videoIds] }, status: 'APPROVED' },
    select: { id: true },
  });
  return approved.map((v) => v.id);
}
