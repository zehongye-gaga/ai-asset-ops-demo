import { describe, expect, it } from 'vitest';
import { countByType, summarizeAssets } from './metrics';
import type { Asset } from '../types';

const asset = (overrides: Partial<Asset>): Asset => ({
  id: '1',
  name: '测试资产',
  asset_type: 'agent',
  scope: 'team',
  source: '自研',
  status: 'online',
  lifecycle: '正式运营',
  owner_name: '测试用户',
  team_name: '测试团队',
  domain: '研发',
  calls: 100,
  success_rate: 98,
  avg_latency: 1,
  monthly_cost: 20,
  version: 'v1.0.0',
  description: '',
  is_online: true,
  updated_at: '2026-07-19T00:00:00Z',
  created_at: '2026-07-19T00:00:00Z',
  ...overrides,
});

describe('asset metrics', () => {
  it('summarizes visible assets for dashboard cards', () => {
    const result = summarizeAssets([
      asset({ asset_type: 'agent', calls: 120, monthly_cost: 30, success_rate: 99 }),
      asset({ id: '2', asset_type: 'application', calls: 80, monthly_cost: 10, success_rate: 97 }),
      asset({ id: '3', asset_type: 'skill', calls: 20, monthly_cost: 5, success_rate: 100, is_online: false }),
    ]);

    expect(result).toEqual({ digitalEmployees: 2, calls: 220, cost: 45, successRate: 98.66666666666667, online: 2 });
  });

  it('counts all five PRD asset types', () => {
    const result = countByType([
      asset({ asset_type: 'agent' }),
      asset({ id: '2', asset_type: 'application' }),
      asset({ id: '3', asset_type: 'skill' }),
      asset({ id: '4', asset_type: 'knowledge' }),
      asset({ id: '5', asset_type: 'mcp' }),
      asset({ id: '6', asset_type: 'agent' }),
    ]);

    expect(result).toEqual({ agent: 2, application: 1, skill: 1, knowledge: 1, mcp: 1 });
  });
});
