import { describe, expect, it } from 'vitest';
import {
  MANAGEMENT_PATHS,
  normalizePathname,
  parseRoute,
  pathForManagementView,
} from './routes';

describe('application routes', () => {
  it.each([
    ['/manage/overview', 'overview'],
    ['/manage/assets', 'assets'],
    ['/manage/approvals', 'approvals'],
  ] as const)('maps %s to the management %s view', (path, view) => {
    expect(parseRoute(path)).toEqual({ kind: 'management', path, view });
  });

  it('keeps the cockpit outside the management route family', () => {
    expect(parseRoute('/cockpit')).toEqual({ kind: 'cockpit', path: '/cockpit' });
  });

  it.each(['/', '', '/unknown', '/manage', '/manage/not-a-page'])(
    'normalizes %s to the management overview',
    (path) => {
      expect(parseRoute(path)).toEqual({
        kind: 'management',
        path: MANAGEMENT_PATHS.overview,
        view: 'overview',
      });
    },
  );

  it('accepts trailing slashes without creating duplicate route states', () => {
    expect(parseRoute('/manage/assets/')).toEqual({
      kind: 'management',
      path: MANAGEMENT_PATHS.assets,
      view: 'assets',
    });
    expect(normalizePathname('/cockpit///')).toBe('/cockpit');
  });

  it('generates management paths from the same authoritative map', () => {
    expect(pathForManagementView('overview')).toBe('/manage/overview');
    expect(pathForManagementView('assets')).toBe('/manage/assets');
    expect(pathForManagementView('approvals')).toBe('/manage/approvals');
  });
});
