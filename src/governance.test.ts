import { describe, expect, it } from 'vitest';
import {
  countByDomain,
  countByLifecycle,
  filterAssetsForCockpit,
  getApprovalSla,
  isRiskAsset,
  summarizeGovernance,
} from './governance';
import { approvalFixture, assetFixture, eventFixture } from './test/fixtures';

describe('governance metrics', () => {
  it('uses one consistent data scope for global, team and personal cockpit views', () => {
    const assets = [
      assetFixture({ id: 'common', scope: 'common' }),
      assetFixture({ id: 'team', scope: 'team', team_name: '研发中心' }),
      assetFixture({ id: 'other-team', scope: 'team', team_name: '法务部' }),
      assetFixture({ id: 'mine', scope: 'personal', owner_name: '叶泽宏' }),
      assetFixture({ id: 'other', scope: 'personal', owner_name: '林悦' }),
    ];

    expect(filterAssetsForCockpit(assets, 'global').map((asset) => asset.id)).toEqual(['common', 'team', 'other-team', 'mine', 'other']);
    expect(filterAssetsForCockpit(assets, 'team').map((asset) => asset.id)).toEqual(['team']);
    expect(filterAssetsForCockpit(assets, 'personal').map((asset) => asset.id)).toEqual(['mine']);
  });

  it('classifies runtime and lifecycle risks', () => {
    expect(isRiskAsset(assetFixture())).toBe(false);
    expect(isRiskAsset(assetFixture({ is_online: false }))).toBe(true);
    expect(isRiskAsset(assetFixture({ success_rate: 97.9 }))).toBe(true);
    expect(isRiskAsset(assetFixture({ lifecycle: '审核中' }))).toBe(true);
  });

  it('calculates healthy, warning, overdue and handled approval SLA states', () => {
    const now = new Date('2026-07-19T12:00:00Z');
    expect(getApprovalSla(approvalFixture({ submitted_at: '2026-07-19T06:00:00Z' }), now).state).toBe('healthy');
    expect(getApprovalSla(approvalFixture({ submitted_at: '2026-07-18T16:00:00Z' }), now).state).toBe('warning');
    expect(getApprovalSla(approvalFixture({ submitted_at: '2026-07-18T11:00:00Z' }), now).state).toBe('overdue');
    expect(getApprovalSla(approvalFixture({ status: 'approved' }), now).state).toBe('handled');
  });

  it('keeps approval counts within the selected asset scope', () => {
    const teamAsset = assetFixture({ id: 'team-asset', scope: 'team', success_rate: 97 });
    const commonAsset = assetFixture({ id: 'common-asset', scope: 'common' });
    const data = {
      assets: [teamAsset, commonAsset],
      approvals: [
        approvalFixture({ id: 'team-approval', asset_id: 'team-asset', submitted_at: '2026-07-18T10:00:00Z' }),
        approvalFixture({ id: 'common-approval', asset_id: 'common-asset', submitted_at: '2026-07-19T09:00:00Z' }),
      ],
      events: [eventFixture(), eventFixture({ id: 'event-2' })],
    };

    const summary = summarizeGovernance(data, [teamAsset], new Date('2026-07-19T12:00:00Z'));
    expect(summary.pending).toBe(1);
    expect(summary.overdue).toBe(1);
    expect(summary.riskAssets.map((asset) => asset.id)).toEqual(['team-asset']);
    expect(summary.onlineRate).toBe(100);
    expect(summary.governanceCoverage).toBe(100);
    expect(summary.auditEvents).toBe(2);
  });

  it('aggregates lifecycle and business-domain facts without adding display-only data', () => {
    const assets = [
      assetFixture({ id: '1', lifecycle: '正式运营', domain: '研发', calls: 120, monthly_cost: 20 }),
      assetFixture({ id: '2', lifecycle: '正式运营', domain: '研发', calls: 80, monthly_cost: 10, is_online: false }),
      assetFixture({ id: '3', lifecycle: '审核中', domain: '营销', calls: 30, monthly_cost: 5 }),
    ];

    expect(countByLifecycle(assets)).toEqual({ 正式运营: 2, 审核中: 1 });
    expect(countByDomain(assets)).toEqual({
      研发: { assets: 2, calls: 200, online: 1, cost: 30 },
      营销: { assets: 1, calls: 30, online: 1, cost: 5 },
    });
  });
});
