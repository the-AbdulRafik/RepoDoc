import { z } from 'zod';

export const SEVERITIES = ['critical', 'warning', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const FINDING_CATEGORIES = [
  'dependency',
  'install',
  'runtime',
  'security',
] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const FindingSchema = z.object({
  severity: z.enum(SEVERITIES),
  category: z.enum(FINDING_CATEGORIES),
  message: z.string().min(1),
  package: z.string().optional(),
  currentVersion: z.string().optional(),
  suggestedVersion: z.string().optional(),
  autoFixable: z.boolean(),
});

export type Finding = z.infer<typeof FindingSchema>;
