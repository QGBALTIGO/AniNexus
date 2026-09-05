import { z } from 'zod';

export const mediaListEntry = z.object({
  status: z.enum(['PLANNING', 'CURRENT', 'COMPLETED', 'PAUSED', 'DROPPED']),
  score: z.number().min(0).max(10).nullable().optional(),
  reaction: z.enum(['LIKE', 'DISLIKE', 'LOVE', 'WOW']).nullable().optional(),
  reactions: z.array(z.string().trim().min(1).max(60)).max(32).optional(),
  progress: z.number().int().min(0).max(100000).default(0),
  volumeProgress: z.number().int().min(0).max(100000).default(0),
}).transform(value => ({
  ...value,
  reactions: value.reactions ? [...new Set(value.reactions)] : undefined,
  progress: value.status === 'PLANNING' ? 0 : value.progress,
  volumeProgress: value.status === 'PLANNING' ? 0 : value.volumeProgress,
  score: value.status === 'PLANNING' || (value.status !== 'COMPLETED' && !value.progress && !value.volumeProgress) ? null : value.score ?? null,
}));
