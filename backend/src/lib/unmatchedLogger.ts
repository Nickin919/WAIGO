import { prisma } from './prisma';
import type { UnmatchedEventType, UnmatchedSubmissionStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

/** Context passed by callers to enrich all events in a batch (user, batch id, entity). */
export interface UnmatchedLogContext {
  userId?: string | null;
  importBatchId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

/** Single event input. All fields required except optional ones. */
export interface UnmatchedEventInput {
  source: string;
  process: string;
  eventType: UnmatchedEventType;
  submittedValue: string;
  submittedField: 'partNumber' | 'series';
  submittedManufacturer?: string | null;
  matchedAgainst?: string | null;
  payload?: Record<string, unknown> | null;
}

/** Build context from Express request (optional). */
export function contextFromRequest(req: { user?: { id: string } | null } | null): UnmatchedLogContext {
  if (!req?.user?.id) return {};
  return { userId: req.user.id };
}

/**
 * Log a single unmatched submission event. Never throws; logs errors to console.
 */
export async function logUnmatchedEvent(
  input: UnmatchedEventInput,
  context?: UnmatchedLogContext | null
): Promise<void> {
  const ctx = context ?? {};
  try {
    await prisma.unmatchedSubmissionEvent.create({
      data: {
        eventType: input.eventType,
        source: input.source,
        process: input.process,
        submittedValue: String(input.submittedValue).slice(0, 500),
        submittedField: input.submittedField,
        submittedManufacturer: input.submittedManufacturer ?? null,
        matchedAgainst: input.matchedAgainst ?? null,
        userId: ctx.userId ?? null,
        importBatchId: ctx.importBatchId ?? null,
        entityType: ctx.entityType ?? null,
        entityId: ctx.entityId ?? null,
        payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        status: 'OPEN' as UnmatchedSubmissionStatus,
      },
    });
  } catch (err) {
    console.error('UnmatchedSubmissionEvent log failed:', err);
  }
}

/**
 * Log multiple unmatched events in one batch. Never throws; logs errors to console.
 */
export async function logUnmatchedEvents(
  events: UnmatchedEventInput[],
  context?: UnmatchedLogContext | null
): Promise<void> {
  if (events.length === 0) return;
  const ctx = context ?? {};
  try {
    await prisma.unmatchedSubmissionEvent.createMany({
      data: events.map((input) => ({
        eventType: input.eventType,
        source: input.source,
        process: input.process,
        submittedValue: String(input.submittedValue).slice(0, 500),
        submittedField: input.submittedField,
        submittedManufacturer: input.submittedManufacturer ?? null,
        matchedAgainst: input.matchedAgainst ?? null,
        userId: ctx.userId ?? null,
        importBatchId: ctx.importBatchId ?? null,
        entityType: ctx.entityType ?? null,
        entityId: ctx.entityId ?? null,
        payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        status: 'OPEN' as UnmatchedSubmissionStatus,
      })),
      skipDuplicates: false,
    });
  } catch (err) {
    console.error('UnmatchedSubmissionEvent batch log failed:', err);
  }
}
