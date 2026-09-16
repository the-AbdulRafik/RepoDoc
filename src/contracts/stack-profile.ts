import { z } from 'zod';

export const SUPPORTED_STACKS = ['node', 'python', 'rust', 'unknown'] as const;
export type SupportedStack = (typeof SUPPORTED_STACKS)[number];

export const StackProfileSchema = z.object({
  stack: z.enum(SUPPORTED_STACKS),
  framework: z.string().optional(),
  packageManager: z.string().optional(),
  scripts: z.record(z.string(), z.string()).optional(),
  deepDiagnosisSupported: z.boolean(),
});

export type StackProfile = z.infer<typeof StackProfileSchema>;
