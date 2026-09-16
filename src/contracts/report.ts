import { z } from 'zod';
import { FindingSchema, type Finding, type Severity, SEVERITIES } from './finding.js';
import { StackProfileSchema, type StackProfile } from './stack-profile.js';

export const ReportSummarySchema = z.object({
  totalFindings: z.number().int().nonnegative(),
  bySeverity: z.record(z.enum(SEVERITIES), z.number().int().nonnegative()),
  autoFixableCount: z.number().int().nonnegative(),
});

export type ReportSummary = z.infer<typeof ReportSummarySchema>;

export const ReportSchema = z.object({
  repoPath: z.string().min(1),
  stackProfile: StackProfileSchema,
  scannedAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T/)),
  findings: z.array(FindingSchema),
  summary: ReportSummarySchema,
});

export type Report = z.infer<typeof ReportSchema>;

/**
 * Deterministically computes summary statistics from a list of findings.
 */
export function generateReportSummary(findings: Finding[]): ReportSummary {
  const bySeverity: Record<Severity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
  };

  let autoFixableCount = 0;

  for (const finding of findings) {
    if (finding.severity in bySeverity) {
      bySeverity[finding.severity] += 1;
    }
    if (finding.autoFixable) {
      autoFixableCount += 1;
    }
  }

  return {
    totalFindings: findings.length,
    bySeverity,
    autoFixableCount,
  };
}

/**
 * Creates and validates a complete Report.
 */
export function createReport(params: {
  repoPath: string;
  stackProfile: StackProfile;
  findings: Finding[];
  scannedAt?: string;
}): Report {
  const scannedAt = params.scannedAt ?? new Date().toISOString();
  const summary = generateReportSummary(params.findings);

  return ReportSchema.parse({
    repoPath: params.repoPath,
    stackProfile: params.stackProfile,
    scannedAt,
    findings: params.findings,
    summary,
  });
}
