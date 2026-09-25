import type { Project } from "@ecorione/shared-schema";

export const PERSONAL_PROJECT_ID = "prj_personal";
export const PROJECT_STORAGE_KEY = "ecorione.projectId";

const PROJECT_ID_PATTERN = /^prj_[a-z0-9][a-z0-9_-]*$/;

export function isProjectIdCandidate(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && PROJECT_ID_PATTERN.test(value);
}

export function activeProjects(projects: readonly Project[]): Project[] {
  return projects.filter((project) => project.archivedAt === null);
}

export function resolveActiveProjectId(
  candidate: string | null | undefined,
  projects: readonly Project[],
): string | null {
  const active = activeProjects(projects);
  if (isProjectIdCandidate(candidate) && active.some((project) => project.id === candidate)) {
    return candidate;
  }
  const personal = active.find((project) => project.id === PERSONAL_PROJECT_ID);
  return personal?.id ?? active[0]?.id ?? null;
}
