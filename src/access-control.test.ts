import { describe, expect, it } from 'vitest';
import {
  canCreateInScope,
  canCreateAsset,
  canHandleApproval,
  canManageAsset,
  canPromoteAsset,
  canViewAsset,
  getCockpitViews,
  getCreateScopes,
  getDefaultScope,
  isApprovalVisible,
} from './access-control';
import { approvalFixture, assetFixture } from './test/fixtures';

describe('enterprise access policy', () => {
  it('sets a role-specific default view and create boundary', () => {
    expect(getDefaultScope('system_admin')).toBe('common');
    expect(getDefaultScope('operator')).toBe('common');
    expect(getDefaultScope('team_admin')).toBe('team');
    expect(getDefaultScope('personal')).toBe('personal');

    expect(getCreateScopes('system_admin')).toEqual(['common', 'team', 'personal']);
    expect(getCreateScopes('operator')).toEqual(['common', 'personal']);
    expect(getCreateScopes('team_admin')).toEqual(['team', 'personal']);
    expect(getCreateScopes('personal')).toEqual(['personal']);
    expect(canCreateInScope('personal', 'team')).toBe(false);
    expect(canCreateInScope('operator', 'common')).toBe(true);
    expect(canCreateAsset('operator', 'common', 'knowledge')).toBe(true);
    expect(canCreateAsset('operator', 'common', 'agent')).toBe(false);
    expect(canCreateAsset('operator', 'personal', 'agent')).toBe(true);
  });

  it('applies role and asset scope together when deciding management access', () => {
    const common = assetFixture({ scope: 'common' });
    const team = assetFixture({ scope: 'team', team_name: '研发中心' });
    const otherTeam = assetFixture({ scope: 'team', team_name: '法务部' });
    const ownPersonal = assetFixture({ scope: 'personal', owner_name: '叶泽宏' });
    const otherPersonal = assetFixture({ scope: 'personal', owner_name: '林悦' });

    expect([common, team, ownPersonal, otherPersonal].map((asset) => canManageAsset('system_admin', asset)))
      .toEqual([true, true, true, true]);
    expect([common, team, ownPersonal, otherPersonal].map((asset) => canManageAsset('operator', asset)))
      .toEqual([true, false, true, false]);
    expect([common, team, ownPersonal, otherPersonal].map((asset) => canManageAsset('team_admin', asset)))
      .toEqual([false, true, true, false]);
    expect([common, team, ownPersonal, otherPersonal].map((asset) => canManageAsset('personal', asset)))
      .toEqual([false, false, true, false]);
    expect(canManageAsset('team_admin', otherTeam)).toBe(false);
  });

  it('filters visible assets by role, current team and ownership', () => {
    const common = assetFixture({ scope: 'common' });
    const currentTeam = assetFixture({ scope: 'team', team_name: '研发中心' });
    const otherTeam = assetFixture({ scope: 'team', team_name: '法务部' });
    const ownPersonal = assetFixture({ scope: 'personal', owner_name: '叶泽宏', team_name: '研发中心' });
    const teamMemberPersonal = assetFixture({ scope: 'personal', owner_name: '陈曦', team_name: '研发中心' });

    expect([common, currentTeam, otherTeam, ownPersonal, teamMemberPersonal].map((asset) => canViewAsset('team_admin', asset)))
      .toEqual([true, true, false, true, true]);
    expect([common, currentTeam, otherTeam, ownPersonal, teamMemberPersonal].map((asset) => canViewAsset('personal', asset)))
      .toEqual([true, true, false, true, false]);
  });

  it('allows only the responsible submitter and approver at each promotion level', () => {
    const personalAsset = assetFixture({ scope: 'personal', owner_name: '叶泽宏', team_name: '研发中心' });
    const teamAsset = assetFixture({ scope: 'team', team_name: '研发中心' });
    const personalRequest = approvalFixture({ approver_role: 'team_admin' });
    const commonRequest = approvalFixture({
      id: 'approval-2',
      from_scope: 'team',
      target_scope: 'common',
      approver_role: 'system_admin',
    });

    expect(canPromoteAsset('personal', personalAsset)).toBe(true);
    expect(canPromoteAsset('team_admin', personalAsset)).toBe(false);
    expect(canPromoteAsset('team_admin', teamAsset)).toBe(true);
    expect(canPromoteAsset('operator', teamAsset)).toBe(false);

    expect(canHandleApproval('team_admin', personalRequest, personalAsset)).toBe(true);
    expect(canHandleApproval('operator', personalRequest)).toBe(false);
    expect(canHandleApproval('operator', commonRequest)).toBe(true);
    expect(canHandleApproval('system_admin', personalRequest)).toBe(true);
    expect(canHandleApproval('system_admin', commonRequest)).toBe(true);
    expect(canHandleApproval('team_admin', { ...personalRequest, status: 'approved' }, personalAsset)).toBe(false);
  });

  it('keeps own requests visible without granting approval authority', () => {
    const ownRequest = approvalFixture({ requester: '叶泽宏', approver_role: 'team_admin' });
    const otherRequest = approvalFixture({ requester: '林悦', approver_role: 'system_admin' });

    const ownAsset = assetFixture({ id: ownRequest.asset_id, team_name: '研发中心' });
    const otherAsset = assetFixture({ id: otherRequest.asset_id, team_name: '法务部' });
    expect(isApprovalVisible('personal', ownRequest, ownAsset)).toBe(true);
    expect(canHandleApproval('personal', ownRequest, ownAsset)).toBe(false);
    expect(isApprovalVisible('personal', otherRequest, otherAsset)).toBe(false);
    expect(isApprovalVisible('operator', otherRequest, otherAsset)).toBe(true);
    expect(isApprovalVisible('team_admin', { ...ownRequest, requester: '陈曦' }, ownAsset)).toBe(true);
    expect(isApprovalVisible('team_admin', { ...ownRequest, requester: '法务用户' }, otherAsset)).toBe(false);
  });

  it('limits cockpit views by governance role', () => {
    expect(getCockpitViews('system_admin')).toEqual(['global', 'team', 'personal']);
    expect(getCockpitViews('operator')).toEqual(['global', 'team']);
    expect(getCockpitViews('team_admin')).toEqual(['team', 'personal']);
    expect(getCockpitViews('personal')).toEqual(['personal']);
  });
});
