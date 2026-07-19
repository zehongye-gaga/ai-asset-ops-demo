import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAsset, handleApproval, submitPromotion } from './api';
import { approvalFixture, assetFixture } from './test/fixtures';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('./lib/insforge', () => ({
  insforge: { database: { from: fromMock } },
}));

describe('InsForge governed writes', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('creates an asset with the actor context and records an activity event', async () => {
    const created = assetFixture({ id: 'created', scope: 'personal' });
    const assetInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [created], error: null }),
    });
    const eventInsert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => (
      table === 'assets' ? { insert: assetInsert } : { insert: eventInsert }
    ));

    await createAsset({
      name: '测试资产',
      assetType: 'agent',
      scope: 'personal',
      description: '用于验证资产创建活动留痕',
    }, { actorName: 'Alex Chen', actorRole: 'personal' });

    expect(assetInsert).toHaveBeenCalledWith(expect.objectContaining({
      owner_name: 'Alex Chen',
      team_name: '研发中心',
      scope: 'personal',
    }));
    expect(eventInsert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'asset_created',
      title: '数字资产已创建',
      detail: expect.stringContaining('Alex Chen（个人用户）'),
    }));
  });

  it('submits team-to-common promotion to the common publication queue and leaves a trace', async () => {
    const approvalInsert = vi.fn().mockResolvedValue({ error: null });
    const eventInsert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => (
      table === 'approval_requests' ? { insert: approvalInsert } : { insert: eventInsert }
    ));

    await submitPromotion(assetFixture({ scope: 'team', owner_name: '原负责人' }), {
      actorName: 'Alex Chen',
      actorRole: 'team_admin',
    });

    expect(approvalInsert).toHaveBeenCalledWith(expect.objectContaining({
      requester: 'Alex Chen',
      from_scope: 'team',
      target_scope: 'common',
      approver_role: 'system_admin',
    }));
    expect(eventInsert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'promotion_submitted',
      detail: expect.stringContaining('team → common'),
    }));
  });

  it('updates the approval and asset scope before recording who approved it', async () => {
    const request = approvalFixture();
    const asset = assetFixture({ id: request.asset_id, scope: 'personal' });
    const assetSelectEq = vi.fn().mockResolvedValue({ data: [asset], error: null });
    const assetUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const approvalUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const assetUpdate = vi.fn().mockReturnValue({ eq: assetUpdateEq });
    const approvalUpdate = vi.fn().mockReturnValue({ eq: approvalUpdateEq });
    const eventInsert = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'assets') {
        return {
          select: vi.fn().mockReturnValue({ eq: assetSelectEq }),
          update: assetUpdate,
        };
      }
      if (table === 'approval_requests') return { update: approvalUpdate };
      return { insert: eventInsert };
    });

    await handleApproval(request, true, { actorName: 'Alex Chen', actorRole: 'team_admin' });

    expect(approvalUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
    expect(approvalUpdateEq).toHaveBeenCalledWith('id', request.id);
    expect(assetUpdate).toHaveBeenCalledWith(expect.objectContaining({ scope: 'team' }));
    expect(assetUpdateEq).toHaveBeenCalledWith('id', request.asset_id);
    expect(eventInsert).toHaveBeenCalledWith(expect.objectContaining({
      title: '资产晋级已通过',
      detail: expect.stringContaining('Alex Chen（团队管理员）通过'),
      severity: 'success',
    }));
  });
});
