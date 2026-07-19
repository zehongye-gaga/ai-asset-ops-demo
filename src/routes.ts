export type ManagementView = 'overview' | 'assets' | 'approvals';

export type AppRoute =
  | { kind: 'management'; path: string; view: ManagementView }
  | { kind: 'cockpit'; path: '/cockpit' };

export const MANAGEMENT_PATHS: Record<ManagementView, string> = {
  overview: '/manage/overview',
  assets: '/manage/assets',
  approvals: '/manage/approvals',
};

const managementEntries = Object.entries(MANAGEMENT_PATHS) as Array<[ManagementView, string]>;

export function normalizePathname(pathname: string): string {
  const cleanPath = pathname.split(/[?#]/, 1)[0].trim();
  if (!cleanPath || cleanPath === '/') return '/';
  return `/${cleanPath.replace(/^\/+|\/+$/g, '')}`;
}

export function parseRoute(pathname: string): AppRoute {
  const normalizedPath = normalizePathname(pathname);
  if (normalizedPath === '/cockpit') return { kind: 'cockpit', path: '/cockpit' };

  const matchedManagementRoute = managementEntries.find(([, path]) => path === normalizedPath);
  const view = matchedManagementRoute?.[0] ?? 'overview';
  return { kind: 'management', path: MANAGEMENT_PATHS[view], view };
}

export function pathForManagementView(view: ManagementView): string {
  return MANAGEMENT_PATHS[view];
}
