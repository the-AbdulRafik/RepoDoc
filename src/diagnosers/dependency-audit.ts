import pLimit from 'p-limit';
import semver from 'semver';
import type { Finding } from '../contracts/finding.js';
import type { PackageJson } from '../detector/node-detector.js';

export interface NpmPackageMeta {
  name: string;
  latestVersion?: string;
  deprecated?: string;
  versionDeprecations?: Record<string, string>;
}

export type RegistryCache = Map<string, NpmPackageMeta | null>;

/**
 * Encodes package name for NPM registry URL.
 * Preserves the leading '@' for scoped packages (e.g. @nestjs%2Fcore).
 */
export function formatPackageRegistryUrl(pkgName: string): string {
  if (pkgName.startsWith('@')) {
    const [scope, name] = pkgName.split('/');
    return `https://registry.npmjs.org/${scope}%2F${name}`;
  }
  return `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`;
}

/**
 * Fetches package metadata from the NPM registry with timeout and caching.
 */
export async function fetchPackageMeta(
  pkgName: string,
  cache: RegistryCache,
  timeoutMs: number = 10000
): Promise<NpmPackageMeta | null> {
  if (cache.has(pkgName)) {
    return cache.get(pkgName) ?? null;
  }

  const url = formatPackageRegistryUrl(pkgName);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      cache.set(pkgName, null);
      return null;
    }

    const data = (await res.json()) as {
      name: string;
      'dist-tags'?: Record<string, string>;
      deprecated?: string;
      versions?: Record<string, { deprecated?: string }>;
    };

    const latestVersion = data['dist-tags']?.latest;
    let deprecatedNotice: string | undefined = data.deprecated;

    const versionDeprecations: Record<string, string> = {};
    if (data.versions) {
      for (const [ver, info] of Object.entries(data.versions)) {
        if (info.deprecated) {
          versionDeprecations[ver] = info.deprecated;
        }
      }
    }

    // If latest version is deprecated, consider package deprecated
    if (!deprecatedNotice && latestVersion && versionDeprecations[latestVersion]) {
      deprecatedNotice = versionDeprecations[latestVersion];
    }

    const meta: NpmPackageMeta = {
      name: data.name || pkgName,
      latestVersion,
      deprecated: deprecatedNotice,
      versionDeprecations,
    };

    cache.set(pkgName, meta);
    return meta;
  } catch {
    cache.set(pkgName, null);
    return null;
  }
}

export interface DependencyAuditOptions {
  cache?: RegistryCache;
  concurrencyLimit?: number;
  timeoutMs?: number;
  fetcher?: (pkgName: string, cache: RegistryCache) => Promise<NpmPackageMeta | null>;
}

/**
 * Audits dependencies and devDependencies against the NPM registry.
 * Employs a bounded concurrency pool (p-limit, default 8) and a single-run in-memory cache.
 */
export async function auditDependencies(
  packageJson: PackageJson | undefined,
  options: DependencyAuditOptions = {}
): Promise<Finding[]> {
  if (!packageJson) {
    return [];
  }

  // Single-run in-memory cache instantiated for the duration of this audit if not provided
  const cache = options.cache ?? new Map<string, NpmPackageMeta | null>();
  const limit = pLimit(options.concurrencyLimit ?? 8);
  const fetcher = options.fetcher ?? ((pkg) => fetchPackageMeta(pkg, cache, options.timeoutMs));

  const allDependencies: Array<{ name: string; declaredRange: string; isDev: boolean }> = [];
  const seenPackages = new Set<string>();

  const deps = packageJson.dependencies ?? {};
  for (const [name, declaredRange] of Object.entries(deps)) {
    if (!seenPackages.has(name)) {
      seenPackages.add(name);
      allDependencies.push({ name, declaredRange, isDev: false });
    }
  }

  const devDeps = packageJson.devDependencies ?? {};
  for (const [name, declaredRange] of Object.entries(devDeps)) {
    if (!seenPackages.has(name)) {
      seenPackages.add(name);
      allDependencies.push({ name, declaredRange, isDev: true });
    }
  }

  const auditTasks = allDependencies.map((dep) =>
    limit(async () => {
      const meta = await fetcher(dep.name, cache);
      if (!meta) {
        return [];
      }

      const depFindings: Finding[] = [];
      const currentCoerced = semver.coerce(dep.declaredRange);
      const currentVersion = currentCoerced?.version ?? dep.declaredRange;
      const latestVersion = meta.latestVersion;

      // 1. Deprecation check (severity: 'critical')
      let isDeprecated = false;
      let deprecationMessage = meta.deprecated;

      if (meta.deprecated) {
        isDeprecated = true;
      } else if (currentCoerced && meta.versionDeprecations?.[currentCoerced.version]) {
        isDeprecated = true;
        deprecationMessage = meta.versionDeprecations[currentCoerced.version];
      }

      if (isDeprecated) {
        depFindings.push({
          severity: 'critical',
          category: 'dependency',
          package: dep.name,
          currentVersion,
          suggestedVersion: latestVersion,
          message: `Package "${dep.name}" is deprecated: ${deprecationMessage || 'Marked deprecated on npm'}`,
          autoFixable: false,
        });
      }

      // 2. Version gap check
      if (currentCoerced && latestVersion) {
        const latestClean = semver.clean(latestVersion) || semver.coerce(latestVersion)?.version;

        if (latestClean) {
          const currentMajor = currentCoerced.major;
          const latestMajor = semver.major(latestClean);

          if (latestMajor > currentMajor) {
            // Major version gap -> warning
            depFindings.push({
              severity: 'warning',
              category: 'dependency',
              package: dep.name,
              currentVersion,
              suggestedVersion: latestVersion,
              message: `Package "${dep.name}" has a major version gap: currently ${dep.declaredRange} (${currentVersion}), latest is ${latestVersion}`,
              autoFixable: false,
            });
          } else if (semver.gt(latestClean, currentCoerced)) {
            // Minor / patch version gap -> info
            depFindings.push({
              severity: 'info',
              category: 'dependency',
              package: dep.name,
              currentVersion,
              suggestedVersion: latestVersion,
              message: `Package "${dep.name}" can be updated to latest ${latestVersion} (currently ${dep.declaredRange})`,
              autoFixable: true,
            });
          }
        }
      }

      return depFindings;
    })
  );

  const results = await Promise.all(auditTasks);
  return results.flat();
}
