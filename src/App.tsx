import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  CURRENT_TEAM,
  CURRENT_USER,
  CURRENT_USER_NAMES,
  canCreateAsset,
  canCreateInScope,
  canHandleApproval,
  canPromoteAsset,
  canViewAsset,
  displayUserName,
  displayUserReferences,
  getApprovalResponsibility,
  getAssetAccess,
  getCockpitViews,
  getCreateAssetTypes,
  getCreateScopes,
  getDefaultScope,
  getPromotionTarget,
  isApprovalVisible,
  roleMeta,
  scopeLabels,
} from './access-control';
import { createAsset, handleApproval, loadDashboardData, submitPromotion } from './api';
import {
  countByDomain,
  countByLifecycle,
  filterAssetsForCockpit,
  getApprovalSla,
  summarizeGovernance,
} from './governance';
import { countByType, summarizeAssets } from './lib/metrics';
import {
  normalizePathname,
  parseRoute,
  pathForManagementView,
  type ManagementView,
} from './routes';
import type {
  ApprovalRequest,
  Asset,
  AssetScope,
  AssetType,
  CockpitView,
  DashboardData,
  Role,
  ScopeFilter,
} from './types';

type TypeFilter = AssetType | 'all';

const emptyData: DashboardData = { assets: [], approvals: [], events: [] };

const roles: Role[] = ['system_admin', 'operator', 'team_admin', 'personal'];

const typeMeta: Record<AssetType, { label: string; short: string; color: string; soft: string }> = {
  agent: { label: '智能体', short: 'AI', color: '#2563eb', soft: '#eaf2ff' },
  application: { label: '应用', short: 'AP', color: '#0891b2', soft: '#e8f8fb' },
  skill: { label: 'Skills', short: 'SK', color: '#7c3aed', soft: '#f2edff' },
  knowledge: { label: '知识库', short: 'KB', color: '#059669', soft: '#e8f8f2' },
  mcp: { label: 'MCP', short: 'MC', color: '#d97706', soft: '#fff6e6' },
};

type LineIconName = 'overview' | 'assets' | 'approval' | 'cockpit' | 'search' | 'building' | 'bell' | 'refresh' | 'plus' | 'chevron';

const navItems: Array<{ id: ManagementView; label: string; icon: LineIconName }> = [
  { id: 'overview', label: '运营概览', icon: 'overview' },
  { id: 'assets', label: '资产目录', icon: 'assets' },
  { id: 'approvals', label: '治理审批', icon: 'approval' },
];

const cockpitViewMeta: Record<CockpitView, { label: string; description: string }> = {
  global: { label: '全局视角', description: '集团资产与治理态势' },
  team: { label: '团队视角', description: '团队资产运营与准入' },
  personal: { label: '个人视角', description: '本人资产与使用成效' },
};

const scopeFilterLabels: Record<ScopeFilter, string> = {
  all: '全部资产',
  common: '通用资产',
  team: '团队资产',
  personal: '个人资产',
};

const lifecycleTone = (value: string) => {
  if (value.includes('正式') || value.includes('运营')) return 'success';
  if (value.includes('审核') || value.includes('调试')) return 'warning';
  if (value.includes('下线') || value.includes('废弃')) return 'danger';
  return 'neutral';
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    notation: Math.abs(value) > 99_999 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);

const formatMoney = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(value);

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const relativeTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} 小时前` : `${Math.round(hours / 24)} 天前`;
};

const lineIconPaths: Record<LineIconName, React.ReactNode> = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  assets: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="m4 12 8 4 8-4" /><path d="m4 17 8 4 8-4" /></>,
  approval: <><path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="m8 14 2.5 2.5L16 11" /></>,
  cockpit: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4M7 13l3-3 2 2 4-5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  building: <><path d="M4 21V5l8-3v19M12 8h8v13M8 7v1M8 11v1M8 15v1M16 12v1M16 16v1M2 21h20" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  refresh: <><path d="M20 6v5h-5" /><path d="M4 18v-5h5" /><path d="M6.1 9a7 7 0 0 1 11.5-2.7L20 11M4 13l2.4 4.7A7 7 0 0 0 18 15" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
};

function LineIcon({ name }: { name: LineIconName }) {
  return <svg aria-hidden="true" className="line-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{lineIconPaths[name]}</svg>;
}

function readSavedRole(): Role {
  try {
    const saved = window.localStorage.getItem('asset-demo-role') as Role | null;
    return saved && roles.includes(saved) ? saved : 'system_admin';
  } catch {
    return 'system_admin';
  }
}

function App() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  const [role, setRole] = useState<Role>(readSavedRole);
  const [scope, setScope] = useState<ScopeFilter>(() => getDefaultScope(readSavedRole()));
  const [type, setType] = useState<TypeFilter>('all');
  const [query, setQuery] = useState('');
  const [globalQuery, setGlobalQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      setError('');
      setData(await loadDashboardData());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const canonicalPath = parseRoute(window.location.pathname).path;
    if (normalizePathname(window.location.pathname) !== canonicalPath) {
      window.history.replaceState(null, '', canonicalPath);
    }

    const onPopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.title = route.kind === 'cockpit'
      ? '运营大屏 · CATL'
      : `${navItems.find((item) => item.id === route.view)?.label ?? '运营概览'} · CATL`;
  }, [route]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleAssets = useMemo(
    () => data.assets.filter((asset) => canViewAsset(role, asset)),
    [data.assets, role],
  );

  const filteredAssets = useMemo(() => visibleAssets.filter((asset) => {
    const matchesScope = scope === 'all' || asset.scope === scope;
    const matchesType = type === 'all' || asset.asset_type === type;
    const search = `${asset.name} ${asset.description} ${asset.source} ${asset.team_name} ${asset.owner_name} ${displayUserName(asset.owner_name)} ${asset.domain}`.toLowerCase();
    return matchesScope && matchesType && search.includes(query.trim().toLowerCase());
  }), [query, scope, type, visibleAssets]);

  const visibleApprovals = useMemo(
    () => data.approvals.filter((request) => isApprovalVisible(
      role,
      request,
      data.assets.find((asset) => asset.id === request.asset_id),
    )),
    [data.approvals, data.assets, role],
  );
  const pendingVisibleApprovals = visibleApprovals.filter((request) => request.status === 'pending');
  const typeCounts = useMemo(() => countByType(visibleAssets), [visibleAssets]);
  const actionContext = { actorName: CURRENT_USER, actorRole: role };

  const notify = (message: string) => setToast(message);

  const changeRole = (nextRole: Role) => {
    setRole(nextRole);
    setScope(getDefaultScope(nextRole));
    try {
      window.localStorage.setItem('asset-demo-role', nextRole);
    } catch {
      // The role still changes for this session when storage is unavailable.
    }
    notify(`已切换为${roleMeta[nextRole].label}，页面操作按新边界生效`);
  };

  const goToView = (nextView: ManagementView) => {
    if (nextView === 'overview') setType('all');
    const path = pathForManagementView(nextView);
    if (normalizePathname(window.location.pathname) !== path) {
      window.history.pushState(null, '', path);
    }
    setRoute(parseRoute(path));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitGlobalSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery(globalQuery.trim());
    goToView('assets');
  };

  const changeAssetQuery = (value: string) => {
    setQuery(value);
    setGlobalQuery(value);
  };

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const requestedScope = String(form.get('scope')) as AssetScope;
    const requestedType = String(form.get('assetType')) as AssetType;
    if (!canCreateInScope(role, requestedScope)) {
      setError(`${roleMeta[role].label}不能直接创建${scopeLabels[requestedScope]}`);
      return;
    }
    if (!canCreateAsset(role, requestedScope, requestedType)) {
      setError(`${roleMeta[role].label}不能在${scopeLabels[requestedScope]}中直接创建${typeMeta[requestedType].label}`);
      return;
    }

    setSubmitting(true);
    try {
      await createAsset({
        name: String(form.get('name')).trim(),
        assetType: requestedType,
        scope: requestedScope,
        description: String(form.get('description')).trim(),
      }, actionContext);
      setCreateOpen(false);
      notify('资产已写入 InsForge，创建行为已留痕');
      await refresh(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '创建资产失败');
    } finally {
      setSubmitting(false);
    }
  };

  const onPromote = async (asset: Asset) => {
    if (!canPromoteAsset(role, asset)) {
      setError(`${roleMeta[role].label}无权提交该资产晋级`);
      return;
    }
    const hasPending = data.approvals.some(
      (request) => request.asset_id === asset.id && request.status === 'pending',
    );
    if (hasPending) {
      setError('该资产已有待处理晋级申请，请勿重复提交');
      return;
    }

    setSubmitting(true);
    try {
      await submitPromotion(asset, actionContext);
      notify(`「${asset.name}」已进入${getPromotionTarget(asset).approver}审批队列`);
      await refresh(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '提交晋级失败');
    } finally {
      setSubmitting(false);
    }
  };

  const onApproval = async (request: ApprovalRequest, approve: boolean) => {
    const requestedAsset = data.assets.find((asset) => asset.id === request.asset_id);
    if (!canHandleApproval(role, request, requestedAsset)) {
      setError(`${roleMeta[role].label}不是该审批节点的责任角色`);
      return;
    }
    setSubmitting(true);
    try {
      await handleApproval(request, approve, actionContext);
      notify(approve ? '审批通过，资产范围与审计动态已更新' : '审批已驳回，结果已进入活动留痕');
      await refresh(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '审批失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (route.kind === 'cockpit') {
    return (
      <div className="standalone-page">
        {loading ? <LoadingState fullPage /> : (
          <Cockpit
            data={data}
            onBack={() => goToView('overview')}
            onError={setError}
            role={role}
          />
        )}
        {error && <Notice kind="error" message={error} onClose={() => setError('')} />}
        {toast && <Notice kind="success" message={toast} onClose={() => setToast('')} />}
      </div>
    );
  }

  const view = route.view;
  const currentNav = navItems.find((item) => item.id === view) || navItems[0];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><i /><b>CATL</b></span>
          <span className="brand-copy">
            <strong>CATL</strong>
            <small>AI 资产运营平台</small>
          </span>
        </div>

        <div className="workspace-card">
          <span className="workspace-avatar"><LineIcon name="building" /></span>
          <span className="workspace-copy"><small>当前组织空间</small><strong>{CURRENT_TEAM}</strong></span>
          <span className="workspace-chevron"><LineIcon name="chevron" /></span>
        </div>

        <nav aria-label="主导航">
          <p className="nav-title">工作台</p>
          {navItems.filter((item) => item.id !== 'assets').map((item) => (
            <button
              className={view === item.id ? 'nav-item active' : 'nav-item'}
              key={item.id}
              onClick={() => goToView(item.id)}
              type="button"
              aria-current={view === item.id ? 'page' : undefined}
            >
              <span className="nav-icon"><LineIcon name={item.icon} /></span>
              <span>{item.label}</span>
              {item.id === 'approvals' && pendingVisibleApprovals.length > 0 && (
                <span className="nav-badge">{pendingVisibleApprovals.length}</span>
              )}
            </button>
          ))}

          <p className="nav-title nav-section">资产运营</p>
          <button
            aria-current={view === 'assets' && type === 'all' ? 'page' : undefined}
            className={view === 'assets' && type === 'all' ? 'nav-item active' : 'nav-item'}
            onClick={() => { setType('all'); goToView('assets'); }}
            type="button"
          >
            <span className="nav-icon"><LineIcon name="assets" /></span>
            <span>统一资产目录</span>
            <span className="nav-count">{visibleAssets.length}</span>
          </button>
          <p className="nav-subtitle">按资产类型</p>
          {(Object.keys(typeMeta) as AssetType[]).map((assetType) => (
            <button
              aria-current={view === 'assets' && type === assetType ? 'page' : undefined}
              className={view === 'assets' && type === assetType ? 'nav-item nav-child active' : 'nav-item nav-child'}
              key={assetType}
              onClick={() => { setType(assetType); goToView('assets'); }}
              type="button"
            >
              <span className="type-dot" style={{ background: typeMeta[assetType].color }} />
              <span>{typeMeta[assetType].label}</span>
              <span className="nav-count">{typeCounts[assetType]}</span>
            </button>
          ))}

          <p className="nav-title nav-section">运营与决策</p>
          <a className="nav-item" href="/cockpit" target="_blank" rel="noreferrer">
            <span className="nav-icon"><LineIcon name="cockpit" /></span>
            <span>运营大屏</span>
            <span className="nav-external">↗</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <div><span className="connection-dot" /><strong>演示治理规则已生效</strong><span className="footer-status">正常</span></div>
          <small>页面策略 · 晋级审批 · 操作留痕</small>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-leading">
            <div className="topbar-context"><span>AI 资产运营</span><i>/</i><strong>{currentNav.label}</strong></div>
            <form className="global-search" onSubmit={submitGlobalSearch} role="search">
              <button aria-label="搜索资产" type="submit"><LineIcon name="search" /></button>
              <input
                aria-label="全局资产搜索"
                onChange={(event) => setGlobalQuery(event.target.value)}
                placeholder="搜索资产、负责人、团队或业务域"
                value={globalQuery}
              />
              <kbd>Enter</kbd>
            </form>
          </div>
          <div className="topbar-actions">
            <div className="organization-chip"><LineIcon name="building" /><span><small>当前组织</small><strong>{CURRENT_TEAM}</strong></span></div>
            <button
              aria-label={`待处理审批 ${pendingVisibleApprovals.length} 项`}
              className="icon-button notification-button"
              onClick={() => goToView('approvals')}
              title="待处理审批"
              type="button"
            >
              <LineIcon name="bell" />
              {pendingVisibleApprovals.length > 0 && <span>{pendingVisibleApprovals.length}</span>}
            </button>
            <button
              aria-label="刷新数据"
              className="icon-button"
              onClick={() => void refresh(true)}
              title="刷新数据"
              type="button"
            >
              <span className={refreshing ? 'spin' : ''}><LineIcon name="refresh" /></span>
            </button>
            <label className="role-picker">
              <span className="avatar">AC</span>
              <span className="role-picker-copy">
                <small>演示身份 · {roleMeta[role].shortLabel}</small>
                <select value={role} onChange={(event) => changeRole(event.target.value as Role)} aria-label="演示身份">
                  {roles.map((item) => <option value={item} key={item}>{roleMeta[item].label}</option>)}
                </select>
              </span>
            </label>
            <button className="primary-button" onClick={() => setCreateOpen(true)} type="button">
              <LineIcon name="plus" /> 新建资产
            </button>
          </div>
        </header>

        {error && <Notice kind="error" message={error} onClose={() => setError('')} />}
        {toast && <Notice kind="success" message={toast} onClose={() => setToast('')} />}

        <section className="content" key={view}>
          <div className="content-inner">
            {loading ? <LoadingState /> : (
              <>
              {view === 'overview' && (
                <Overview
                  assets={filteredAssets}
                  data={data}
                  onAsset={setSelectedAsset}
                  onScope={setScope}
                  onView={goToView}
                  role={role}
                  scope={scope}
                />
              )}
              {view === 'assets' && (
                <AssetCatalog
                  approvals={data.approvals}
                  assets={filteredAssets}
                  onAsset={setSelectedAsset}
                  onPromote={onPromote}
                  onQuery={changeAssetQuery}
                  onScope={setScope}
                  onType={setType}
                  query={query}
                  role={role}
                  scope={scope}
                  submitting={submitting}
                  type={type}
                />
              )}
              {view === 'approvals' && (
                <ApprovalCenter
                  approvals={visibleApprovals}
                  assets={data.assets}
                  onApproval={onApproval}
                  role={role}
                  submitting={submitting}
                />
              )}
              </>
            )}
          </div>
        </section>
      </main>

      {createOpen && (
        <CreateAssetModal
          onClose={() => setCreateOpen(false)}
          onSubmit={onCreate}
          role={role}
          submitting={submitting}
        />
      )}

      {selectedAsset && (
        <AssetDrawer
          asset={selectedAsset}
          hasPendingApproval={data.approvals.some(
            (request) => request.asset_id === selectedAsset.id && request.status === 'pending',
          )}
          onClose={() => setSelectedAsset(null)}
          onPromote={onPromote}
          role={role}
          submitting={submitting}
        />
      )}
    </div>
  );
}

function Notice({ kind, message, onClose }: {
  kind: 'error' | 'success';
  message: string;
  onClose: () => void;
}) {
  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{kind === 'error' ? '!' : '✓'}</span>
      <p>{message}</p>
      <button aria-label="关闭提示" onClick={onClose} type="button">×</button>
    </div>
  );
}

function ScopeTabs({ scope, onScope }: {
  scope: ScopeFilter;
  onScope: (scope: ScopeFilter) => void;
}) {
  return (
    <div className="scope-tabs" aria-label="资产范围">
      {(Object.keys(scopeFilterLabels) as ScopeFilter[]).map((value) => (
        <button
          className={scope === value ? 'active' : ''}
          key={value}
          onClick={() => onScope(value)}
          type="button"
        >
          {scopeFilterLabels[value]}
        </button>
      ))}
    </div>
  );
}

function Overview({ assets, data, onAsset, onScope, onView, role, scope }: {
  assets: Asset[];
  data: DashboardData;
  onAsset: (asset: Asset) => void;
  onScope: (scope: ScopeFilter) => void;
  onView: (view: ManagementView) => void;
  role: Role;
  scope: ScopeFilter;
}) {
  const metrics = summarizeAssets(assets);
  const counts = countByType(assets);
  const governance = summarizeGovernance(data, assets);
  const totalCalls = Math.max(metrics.calls, 1);
  const topAssets = [...assets].sort((left, right) => Number(right.calls) - Number(left.calls)).slice(0, 5);

  return (
    <>
      <div className="page-intro">
        <div>
          <div className="intro-badge"><i />企业 AI 资产治理 · 实时运营</div>
          <h2>让资产可见、权限可解释、流程可追溯</h2>
          <p>统一查看五类数字资产的运营表现，并从当前身份出发判断管理边界与治理责任。</p>
        </div>
        <div className="intro-actions">
          <ScopeTabs scope={scope} onScope={onScope} />
          <a className="secondary-button" href="/cockpit" target="_blank" rel="noreferrer">进入运营大屏 <span>↗</span></a>
        </div>
      </div>

      <section className="identity-policy-card">
        <div className="identity-block">
          <span className="identity-avatar">AC</span>
          <div><small>当前演示身份</small><strong>{roleMeta[role].label}</strong><span>{CURRENT_USER} · {CURRENT_TEAM}</span></div>
        </div>
        <div className="policy-divider" />
        <div className="policy-copy"><small>数据与操作边界</small><strong>{roleMeta[role].boundary}</strong></div>
        <div className="policy-copy"><small>当前治理责任</small><strong>{roleMeta[role].responsibility}</strong></div>
        <div className="policy-proof"><span>策略已生效</span><small>生产环境需接入企业身份与服务端权限策略</small></div>
      </section>

      <div className="metric-grid">
        <MetricCard label="在运数字员工" value={formatNumber(metrics.digitalEmployees)} suffix="个" note="智能体 + 应用" tone="blue" code="DE" />
        <MetricCard label="本月累计调用" value={formatNumber(metrics.calls)} suffix="次" note={`${metrics.online} 项资产在线`} tone="cyan" code="API" />
        <MetricCard label="平均成功率" value={metrics.successRate.toFixed(2)} suffix="%" note={metrics.successRate >= 98 ? '服务质量稳定' : '低于治理基线'} tone="green" code="SLA" />
        <MetricCard label="本月运行成本" value={formatMoney(metrics.cost)} suffix="" note="按资产归集口径" tone="violet" code="¥" />
      </div>

      <div className="governance-strip">
        <GovernanceCard label="治理建档覆盖" value={`${governance.governanceCoverage.toFixed(0)}%`} note={`${assets.length} 项当前范围资产`} tone="blue" />
        <GovernanceCard label="待处理审批" value={governance.pending} note={governance.overdue ? `${governance.overdue} 项已超时` : '当前无超时'} tone={governance.overdue ? 'amber' : 'green'} />
        <GovernanceCard label="风险关注资产" value={governance.riskAssets.length} note="离线、低成功率或待审核" tone={governance.riskAssets.length ? 'red' : 'green'} />
        <GovernanceCard label="近期操作留痕" value={governance.auditEvents} note="创建、晋级与审批事件" tone="violet" />
      </div>

      <div className="overview-grid">
        <article className="panel asset-distribution">
          <PanelHeader title="资产构成" subtitle="当前视角下五类资产的真实分布" action={<span className="live-chip"><i />实时</span>} />
          <div className="distribution-layout">
            <div className="distribution-total"><strong>{assets.length}</strong><span>资产总量</span><small>{metrics.online} 项在线</small></div>
            <div className="distribution-bars">
              {(Object.keys(typeMeta) as AssetType[]).map((assetType) => {
                const ratio = assets.length ? (counts[assetType] / assets.length) * 100 : 0;
                return (
                  <div className="bar-row" key={assetType}>
                    <span className="bar-label"><i style={{ background: typeMeta[assetType].color }} />{typeMeta[assetType].label}</span>
                    <div className="bar-track"><span style={{ '--bar-width': `${ratio}%`, background: typeMeta[assetType].color } as CSSProperties} /></div>
                    <strong>{counts[assetType]}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </article>

        <article className="panel call-structure">
          <PanelHeader title="调用结构" subtitle="按资产类型统计本月调用贡献" action={<span className="panel-kpi">{formatNumber(metrics.calls)} 次</span>} />
          <div className="call-bars">
            {(Object.keys(typeMeta) as AssetType[]).map((assetType) => {
              const calls = assets.filter((asset) => asset.asset_type === assetType)
                .reduce((sum, asset) => sum + Number(asset.calls), 0);
              const height = Math.max(8, (calls / totalCalls) * 100);
              return (
                <div className="call-column" key={assetType}>
                  <div className="call-value">{formatNumber(calls)}</div>
                  <div className="call-track"><span style={{ '--bar-height': `${height}%`, background: typeMeta[assetType].color } as CSSProperties} /></div>
                  <span>{typeMeta[assetType].label}</span>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <GovernanceFlow pending={governance.pending} />

      <div className="overview-bottom-grid">
        <article className="panel key-assets">
          <PanelHeader title="重点资产运行" subtitle="按本月调用量排序" action={<button className="text-button" onClick={() => onView('assets')} type="button">查看全部 →</button>} />
          <div className="compact-table">
            {topAssets.length ? topAssets.map((asset) => (
              <button className="compact-row" key={asset.id} onClick={() => onAsset(asset)} type="button">
                <AssetGlyph type={asset.asset_type} />
                <span className="compact-main"><strong>{asset.name}</strong><small>{asset.domain} · {displayUserName(asset.owner_name)}</small></span>
                <span className={`status-dot ${asset.is_online ? 'online' : 'offline'}`}><i />{asset.is_online ? '在线' : '离线'}</span>
                <span><strong>{formatNumber(Number(asset.calls))}</strong><small>本月调用</small></span>
                <span><strong>{Number(asset.success_rate).toFixed(1)}%</strong><small>成功率</small></span>
                <span className="row-arrow">›</span>
              </button>
            )) : <EmptyState title="当前范围暂无资产" detail="切换资产视角后再查看" />}
          </div>
        </article>

        <article className="panel activity-panel">
          <PanelHeader title="治理动态" subtitle="关键操作与运行事件留痕" action={<span className="trace-chip">追踪 {data.events.length}</span>} />
          <div className="activity-list">
            {data.events.slice(0, 6).map((event) => (
              <div className="activity-item" key={event.id}>
                <span className={`activity-marker ${event.severity}`} />
                <div><strong>{displayUserReferences(event.title)}</strong><p>{displayUserReferences(event.detail)}</p><small>{relativeTime(event.created_at)} · Trace {event.id.slice(0, 8)}</small></div>
              </div>
            ))}
            {!data.events.length && <EmptyState title="暂无治理动态" detail="创建或审批资产后会在这里留痕" />}
          </div>
        </article>
      </div>
    </>
  );
}

function MetricCard({ label, value, suffix, note, tone, code }: {
  label: string;
  value: string;
  suffix: string;
  note: string;
  tone: string;
  code: string;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-top"><span className="metric-code">{code}</span><span className="metric-trend">运营口径</span></div>
      <p>{label}</p>
      <div className="metric-value"><strong>{value}</strong><span>{suffix}</span></div>
      <small>{note}</small>
    </article>
  );
}

function GovernanceCard({ label, value, note, tone }: {
  label: string;
  value: string | number;
  note: string;
  tone: string;
}) {
  return (
    <article className="governance-card">
      <span className={`governance-icon ${tone}`}>✓</span>
      <div><small>{label}</small><strong>{value}</strong><p>{note}</p></div>
    </article>
  );
}

function GovernanceFlow({ pending }: { pending: number }) {
  return (
    <article className="panel governance-flow">
      <div className="flow-intro"><span className="flow-icon">策</span><div><h3>资产准入治理流程</h3><p>范围越大，责任越高；所有晋级均经过独立责任角色确认。</p></div></div>
      <div className="flow-stage"><span>01</span><div><strong>个人资产</strong><small>本人负责质量与材料</small></div></div>
      <div className="flow-connector"><b>团队管理员</b><span>审批 →</span></div>
      <div className="flow-stage"><span>02</span><div><strong>团队资产</strong><small>团队内复用与运营</small></div></div>
      <div className="flow-connector"><b>运营人员</b><span>审批 →</span></div>
      <div className="flow-stage"><span>03</span><div><strong>通用资产</strong><small>全组织复用与治理</small></div></div>
      <div className="flow-pending"><strong>{pending}</strong><small>当前待处理</small></div>
    </article>
  );
}

function AssetCatalog({ approvals, assets, onAsset, onPromote, onQuery, onScope, onType, query, role, scope, submitting, type }: {
  approvals: ApprovalRequest[];
  assets: Asset[];
  onAsset: (asset: Asset) => void;
  onPromote: (asset: Asset) => void;
  onQuery: (value: string) => void;
  onScope: (scope: ScopeFilter) => void;
  onType: (type: TypeFilter) => void;
  query: string;
  role: Role;
  scope: ScopeFilter;
  submitting: boolean;
  type: TypeFilter;
}) {
  return (
    <>
      <div className="page-intro compact">
        <div><h2>统一资产目录</h2><p>同一目录承载五类资产；可见范围与管理权限分别判断。</p></div>
        <ScopeTabs scope={scope} onScope={onScope} />
      </div>

      <section className="boundary-banner">
        <span className="boundary-icon">权</span>
        <div><small>当前权限边界 · {roleMeta[role].label}</small><strong>{roleMeta[role].boundary}</strong></div>
        <span className="boundary-note">页面策略演示</span>
      </section>

      <article className="panel catalog-panel">
        <div className="catalog-toolbar">
          <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索名称、负责人、团队或业务域" /></label>
          <label className="select-filter"><span>资产类型</span><select value={type} onChange={(event) => onType(event.target.value as TypeFilter)}><option value="all">全部类型</option>{(Object.keys(typeMeta) as AssetType[]).map((assetType) => <option key={assetType} value={assetType}>{typeMeta[assetType].label}</option>)}</select></label>
          <div className="result-count"><strong>{assets.length}</strong><span>项结果</span></div>
        </div>

        <div className="asset-table">
          <div className="asset-table-head">
            <span>资产</span><span>范围 / 生命周期</span><span>负责人 / 团队</span><span>运行表现</span><span>当前权限</span><span>操作</span>
          </div>
          {assets.map((asset) => {
            const access = getAssetAccess(role, asset);
            const canPromote = canPromoteAsset(role, asset);
            const hasPending = approvals.some((request) => request.asset_id === asset.id && request.status === 'pending');
            return (
              <div className="asset-table-row" key={asset.id}>
                <div className="asset-name-cell"><AssetGlyph type={asset.asset_type} /><span><strong>{asset.name}</strong><small>{typeMeta[asset.asset_type].label} · {asset.version} · {asset.source}</small></span></div>
                <div><span className={`scope-tag ${asset.scope}`}>{scopeLabels[asset.scope]}</span><span className={`lifecycle-tag ${lifecycleTone(asset.lifecycle)}`}>{asset.lifecycle}</span></div>
                <div className="owner-cell"><strong>{displayUserName(asset.owner_name)}</strong><small>{asset.team_name} · {asset.domain}</small></div>
                <div className="performance-cell"><strong>{formatNumber(Number(asset.calls))} 次</strong><small>{Number(asset.success_rate).toFixed(1)}% · {Number(asset.avg_latency).toFixed(1)}s</small></div>
                <div><span className={`access-badge ${access.level}`}><i />{access.label}</span><small className="access-reason">{access.reason}</small></div>
                <div className="table-actions">
                  <button className="ghost-button" onClick={() => onAsset(asset)} type="button">详情</button>
                  {canPromote && <button className="outline-button" disabled={submitting || hasPending} onClick={() => void onPromote(asset)} type="button">{hasPending ? '审批中' : '申请晋级'}</button>}
                </div>
              </div>
            );
          })}
          {!assets.length && <EmptyState title="未找到匹配资产" detail="调整范围、类型或搜索条件后重试" />}
        </div>
      </article>
    </>
  );
}

function ApprovalCenter({ approvals, assets, onApproval, role, submitting }: {
  approvals: ApprovalRequest[];
  assets: Asset[];
  onApproval: (request: ApprovalRequest, approve: boolean) => void;
  role: Role;
  submitting: boolean;
}) {
  const pending = approvals.filter((request) => request.status === 'pending');
  const approved = approvals.filter((request) => request.status === 'approved');
  const overdue = pending.filter((request) => getApprovalSla(request).state === 'overdue');
  const isPersonal = role === 'personal';

  return (
    <>
      <div className="page-intro compact">
        <div><h2>{isPersonal ? '我的晋级申请' : '资产准入与晋级审批'}</h2><p>{isPersonal ? '查看本人资产申请的当前节点与处理结果。' : `当前由${roleMeta[role].label}负责：${roleMeta[role].responsibility}`}</p></div>
        <span className="responsibility-chip">职责已匹配 · {roleMeta[role].shortLabel}</span>
      </div>

      <div className="approval-summary-grid">
        <ApprovalSummary label="当前可见" value={approvals.length} note="含本人申请与责任队列" tone="blue" />
        <ApprovalSummary label="待处理" value={pending.length} note="等待责任角色决策" tone="amber" />
        <ApprovalSummary label="已通过" value={approved.length} note="资产范围已更新" tone="green" />
        <ApprovalSummary label="已超时" value={overdue.length} note="演示 SLA：24 小时" tone={overdue.length ? 'red' : 'green'} />
      </div>

      <GovernanceFlow pending={pending.length} />

      <article className="panel approval-panel">
        <PanelHeader title="审批与申请记录" subtitle="展示责任节点、范围变化、时效和结果" action={<span className="policy-version">Policy v1.1</span>} />
        <div className="approval-list-head"><span>申请资产</span><span>范围变化</span><span>责任节点</span><span>流程时效</span><span>处理</span></div>
        <div className="approval-list">
          {approvals.map((request) => {
            const asset = assets.find((candidate) => candidate.id === request.asset_id);
            const sla = getApprovalSla(request);
            const canHandle = canHandleApproval(role, request, asset);
            return (
              <div className="approval-row" key={request.id}>
                <div className="approval-asset"><AssetGlyph type={asset?.asset_type || 'agent'} /><span><strong>{request.asset_name}</strong><small>{displayUserName(request.requester)} · {formatDateTime(request.submitted_at)}</small><p>{displayUserReferences(request.note)}</p></span></div>
                <div className="approval-scope-flow"><span className={`scope-tag ${request.from_scope}`}>{scopeLabels[request.from_scope]}</span><b>→</b><span className={`scope-tag ${request.target_scope}`}>{scopeLabels[request.target_scope]}</span></div>
                <div className="approval-responsibility"><strong>{getApprovalResponsibility(request)}</strong><small>提交人与审批职责分离</small></div>
                <div><span className={`sla-badge ${sla.state}`}>{sla.label}</span><small className="sla-time">{request.status === 'pending' ? `已等待 ${sla.hours.toFixed(1)}h` : `处理于 ${request.handled_at ? formatDateTime(request.handled_at) : '—'}`}</small></div>
                <div className="approval-actions">
                  {canHandle ? <><button disabled={submitting} onClick={() => void onApproval(request, false)} type="button">驳回</button><button className="approve" disabled={submitting} onClick={() => void onApproval(request, true)} type="button">通过</button></> : <span className={`approval-status ${request.status}`}>{request.status === 'pending' ? '等待责任人' : request.status === 'approved' ? '已通过' : '已驳回'}</span>}
                </div>
              </div>
            );
          })}
          {!approvals.length && <EmptyState title="当前身份没有可见审批" detail="切换演示身份可查看对应责任队列" />}
        </div>
      </article>
    </>
  );
}

function ApprovalSummary({ label, value, note, tone }: {
  label: string;
  value: number;
  note: string;
  tone: string;
}) {
  return <article className="approval-summary"><span className={`summary-mark ${tone}`} /><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>;
}

function Cockpit({ data, onBack, onError, role }: {
  data: DashboardData;
  onBack: () => void;
  onError: (message: string) => void;
  role: Role;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const allowedViews = getCockpitViews(role);
  const [cockpitView, setCockpitView] = useState<CockpitView>(allowedViews[0]);
  const [fullscreen, setFullscreen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (rootRef.current?.requestFullscreen) await rootRef.current.requestFullscreen();
      else throw new Error('当前浏览器不支持全屏 API');
    } catch (cause) {
      onError(cause instanceof Error ? `进入全屏失败：${cause.message}` : '进入全屏失败');
    }
  };

  const roleVisibleAssets = data.assets.filter((asset) => canViewAsset(role, asset));
  const assets = filterAssetsForCockpit(roleVisibleAssets, cockpitView, CURRENT_USER_NAMES, CURRENT_TEAM);
  const metrics = summarizeAssets(assets);
  const governance = summarizeGovernance(data, assets);
  const lifecycles = Object.entries(countByLifecycle(assets)).sort((left, right) => right[1] - left[1]);
  const domains = Object.entries(countByDomain(assets)).sort((left, right) => right[1].calls - left[1].calls);
  const maxDomainCalls = Math.max(...domains.map(([, item]) => item.calls), 1);
  const assetIds = new Set(assets.map((asset) => asset.id));
  const approvals = data.approvals.filter((request) => assetIds.has(request.asset_id));
  const pending = approvals.filter((request) => request.status === 'pending');
  const riskAssets = governance.riskAssets.slice(0, 4);
  const clock = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
  const date = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).format(now);

  return (
    <div className={fullscreen ? 'cockpit-root is-fullscreen' : 'cockpit-root'} ref={rootRef}>
      <header className="cockpit-header">
        <div className="cockpit-brand"><span>CATL</span><div><strong>CATL · AI 资产运营中心</strong><small>ENTERPRISE ASSET GOVERNANCE COCKPIT</small></div></div>
        <div className="cockpit-view-tabs">
          {allowedViews.map((item) => <button className={cockpitView === item ? 'active' : ''} key={item} onClick={() => setCockpitView(item)} type="button"><strong>{cockpitViewMeta[item].label}</strong><small>{cockpitViewMeta[item].description}</small></button>)}
        </div>
        <div className="cockpit-actions">
          <div className="cockpit-clock"><strong>{clock}</strong><small>{date}</small></div>
          <button onClick={() => void toggleFullscreen()} type="button">{fullscreen ? '退出全屏' : '全屏显示'} <span>⛶</span></button>
          <button onClick={onBack} type="button">返回管理 <span>↩</span></button>
        </div>
      </header>

      <div className="cockpit-context">
        <div><span className="pulse-dot" /><strong>{cockpitViewMeta[cockpitView].label}</strong><span>{cockpitViewMeta[cockpitView].description}</span></div>
        <div><span>当前身份</span><strong>{roleMeta[role].label}</strong><span>数据口径随视角统一切换</span></div>
      </div>

      <div className="cockpit-kpi-grid">
        <CockpitKpi label="在运数字员工" value={formatNumber(metrics.digitalEmployees)} suffix="个" code="DE" tone="blue" />
        <CockpitKpi label="资产总量" value={formatNumber(assets.length)} suffix="项" code="AS" tone="cyan" />
        <CockpitKpi label="本月调用" value={formatNumber(metrics.calls)} suffix="次" code="API" tone="blue" />
        <CockpitKpi label="服务成功率" value={metrics.successRate.toFixed(2)} suffix="%" code="SLA" tone="green" />
        <CockpitKpi label="风险关注" value={formatNumber(governance.riskAssets.length)} suffix="项" code="RISK" tone={governance.riskAssets.length ? 'red' : 'green'} />
        <CockpitKpi label="本月成本" value={formatMoney(metrics.cost)} suffix="" code="COST" tone="violet" />
        <CockpitKpi label="待审批" value={formatNumber(governance.pending)} suffix="项" code="FLOW" tone={governance.pending ? 'amber' : 'green'} />
        <CockpitKpi label="资产在线率" value={governance.onlineRate.toFixed(1)} suffix="%" code="LIVE" tone="cyan" />
      </div>

      <div className="cockpit-main-grid">
        <div className="cockpit-column left">
          <CockpitPanel title="生命周期分布" code="LIFECYCLE">
            <div className="lifecycle-list">
              {lifecycles.slice(0, 6).map(([name, count]) => (
                <div key={name}><span><i className={lifecycleTone(name)} />{name}</span><div><b style={{ '--bar-width': `${assets.length ? (count / assets.length) * 100 : 0}%` } as CSSProperties} /></div><strong>{count}</strong></div>
              ))}
              {!lifecycles.length && <MiniEmpty label="暂无生命周期数据" />}
            </div>
          </CockpitPanel>
          <CockpitPanel title="治理健康" code="GOVERNANCE">
            <div className="health-grid">
              <HealthRing label="建档覆盖" value={governance.governanceCoverage} tone="#2563eb" />
              <HealthRing label="在线率" value={governance.onlineRate} tone="#0891b2" />
              <HealthRing label="审批时效" value={pending.length ? Math.max(0, 100 - (governance.overdue / pending.length) * 100) : 100} tone="#059669" />
            </div>
            <div className="health-foot"><span><i className="green" />健康运行 {assets.length - governance.riskAssets.length}</span><span><i className="red" />风险关注 {governance.riskAssets.length}</span></div>
          </CockpitPanel>
        </div>

        <div className="cockpit-column center">
          <CockpitPanel title="数字员工与业务运行态势" code="OPERATIONS">
            <div className="digital-employee-hero">
              <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
              <span className="hero-core"><small>在运数字员工</small><strong>{metrics.digitalEmployees}</strong><b>DIGITAL EMPLOYEES</b></span>
              <div className="hero-side left"><span><small>在线资产</small><strong>{metrics.online}</strong></span><span><small>业务域</small><strong>{governance.domainCount}</strong></span><span><small>审计留痕</small><strong>{governance.auditEvents}</strong></span></div>
              <div className="hero-side right"><span><small>平均时延</small><strong>{governance.averageLatency.toFixed(1)}s</strong></span><span><small>成功率</small><strong>{metrics.successRate.toFixed(1)}%</strong></span><span><small>治理覆盖</small><strong>{governance.governanceCoverage.toFixed(0)}%</strong></span></div>
            </div>
            <div className="domain-distribution">
              <div className="cockpit-subhead"><span>业务域调用分布</span><small>按本月调用量排序</small></div>
              {domains.slice(0, 6).map(([name, item]) => (
                <div className="domain-bar" key={name}><span>{name}</span><div><i style={{ '--bar-width': `${(item.calls / maxDomainCalls) * 100}%` } as CSSProperties} /></div><strong>{formatNumber(item.calls)}</strong></div>
              ))}
              {!domains.length && <MiniEmpty label="当前视角暂无业务域数据" />}
            </div>
          </CockpitPanel>
        </div>

        <div className="cockpit-column right">
          <CockpitPanel title="审批时效与责任" code="WORKFLOW">
            <div className="cockpit-approval-list">
              {pending.slice(0, 4).map((request) => {
                const sla = getApprovalSla(request);
                return <div key={request.id}><span className={`mini-sla ${sla.state}`}>{sla.label}</span><p><strong>{request.asset_name}</strong><small>{scopeLabels[request.from_scope]} → {scopeLabels[request.target_scope]}</small></p><time>{sla.hours.toFixed(1)}h</time></div>;
              })}
              {!pending.length && <MiniEmpty label="当前视角没有待审批事项" />}
            </div>
          </CockpitPanel>
          <CockpitPanel title="风险与实时留痕" code="RISK & AUDIT">
            <div className="risk-list">
              {riskAssets.map((asset) => <div key={asset.id}><span className="risk-mark">!</span><p><strong>{asset.name}</strong><small>{!asset.is_online ? '资产离线' : Number(asset.success_rate) < 98 ? `成功率 ${Number(asset.success_rate).toFixed(1)}%` : asset.lifecycle}</small></p><span>{typeMeta[asset.asset_type].short}</span></div>)}
              {!riskAssets.length && <div className="all-healthy"><span>✓</span><p><strong>当前资产健康</strong><small>未发现离线、低成功率或待治理资产</small></p></div>}
            </div>
            <div className="audit-ticker">
              {data.events.slice(0, 3).map((event) => <div key={event.id}><time>{formatDateTime(event.created_at)}</time><p><strong>{displayUserReferences(event.title)}</strong><small>{displayUserReferences(event.detail)}</small></p></div>)}
              {!data.events.length && <MiniEmpty label="暂无活动留痕" />}
            </div>
          </CockpitPanel>
        </div>
      </div>

      <div className="cockpit-domain-grid">
        {domains.slice(0, 6).map(([name, item], index) => (
          <article key={name}><span className="domain-index">0{index + 1}</span><div><small>业务域</small><strong>{name}</strong></div><dl><div><dt>资产</dt><dd>{item.assets}</dd></div><div><dt>调用</dt><dd>{formatNumber(item.calls)}</dd></div><div><dt>在线率</dt><dd>{item.assets ? ((item.online / item.assets) * 100).toFixed(0) : 0}%</dd></div><div><dt>成本</dt><dd>{formatMoney(item.cost)}</dd></div></dl></article>
        ))}
      </div>

      <footer className="cockpit-footer"><span><i />InsForge 实时数据</span><span>数据刷新于 {clock}</span><strong>资产有边界 · 流程有责任 · 操作有留痕</strong><span>CATL</span></footer>
    </div>
  );
}

function CockpitKpi({ label, value, suffix, code, tone }: {
  label: string;
  value: string;
  suffix: string;
  code: string;
  tone: string;
}) {
  return <article className={`cockpit-kpi ${tone}`}><div><span>{code}</span><i /></div><small>{label}</small><p><strong>{value}</strong><span>{suffix}</span></p></article>;
}

function CockpitPanel({ title, code, children }: { title: string; code: string; children: React.ReactNode }) {
  return <section className="cockpit-panel"><header><h3>{title}</h3><span>{code}</span></header><div className="cockpit-panel-body">{children}</div></section>;
}

function HealthRing({ label, value, tone }: { label: string; value: number; tone: string }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return <div className="health-ring"><div style={{ '--ring-value': `${safeValue * 3.6}deg`, '--ring-tone': tone } as CSSProperties}><span>{safeValue.toFixed(0)}<small>%</small></span></div><strong>{label}</strong></div>;
}

function MiniEmpty({ label }: { label: string }) {
  return <div className="mini-empty"><span>✓</span>{label}</div>;
}

function PanelHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <header className="panel-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{action}</header>;
}

function AssetGlyph({ type }: { type: AssetType }) {
  return <span className="asset-glyph" style={{ color: typeMeta[type].color, background: typeMeta[type].soft }}>{typeMeta[type].short}</span>;
}

function CreateAssetModal({ onClose, onSubmit, role, submitting }: {
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  role: Role;
  submitting: boolean;
}) {
  const scopes = getCreateScopes(role);
  const [selectedScope, setSelectedScope] = useState<AssetScope>(scopes[0]);
  const allowedTypes = getCreateAssetTypes(role, selectedScope);
  const [selectedType, setSelectedType] = useState<AssetType>(allowedTypes[0]);

  const changeScope = (nextScope: AssetScope) => {
    setSelectedScope(nextScope);
    const nextTypes = getCreateAssetTypes(role, nextScope);
    if (!nextTypes.includes(selectedType)) setSelectedType(nextTypes[0]);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal" onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><p className="eyebrow">Create governed asset</p><h2>新建数字资产</h2><span>按当前身份限制可创建范围，成功后同步记录活动留痕。</span></div><button aria-label="关闭" onClick={onClose} type="button">×</button></div>
        <section className="modal-policy"><span>权</span><div><small>{roleMeta[role].label} · 创建边界</small><strong>可创建 {scopes.map((item) => scopeLabels[item]).join('、')}</strong></div></section>
        <label>资产名称<input name="name" required minLength={2} maxLength={80} placeholder="例如：采购异常分析助手" /></label>
        <div className="form-grid">
          <label>资产类型<select name="assetType" value={selectedType} onChange={(event) => setSelectedType(event.target.value as AssetType)}>{allowedTypes.map((item) => <option key={item} value={item}>{typeMeta[item].label}</option>)}</select></label>
          <label>所属范围<select name="scope" value={selectedScope} onChange={(event) => changeScope(event.target.value as AssetScope)}>{scopes.map((item) => <option key={item} value={item}>{scopeLabels[item]}</option>)}</select></label>
        </div>
        <label>资产说明<textarea name="description" required minLength={8} maxLength={500} rows={4} placeholder="说明资产解决什么业务问题、服务谁、如何判断有效" /></label>
        <div className="form-note"><span>i</span><p><strong>真实写入 InsForge</strong>资产主数据写入 assets；创建人、角色与范围写入 activity_events。</p></div>
        <div className="modal-actions"><button className="secondary-button" onClick={onClose} type="button">取消</button><button className="primary-button" disabled={submitting} type="submit">{submitting ? '正在创建…' : '创建并留痕'}</button></div>
      </form>
    </div>
  );
}

function AssetDrawer({ asset, hasPendingApproval, onClose, onPromote, role, submitting }: {
  asset: Asset;
  hasPendingApproval: boolean;
  onClose: () => void;
  onPromote: (asset: Asset) => void;
  role: Role;
  submitting: boolean;
}) {
  const access = getAssetAccess(role, asset);
  const canPromote = canPromoteAsset(role, asset);
  const target = getPromotionTarget(asset);

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-head"><AssetGlyph type={asset.asset_type} /><div><small>{typeMeta[asset.asset_type].label} · {asset.version}</small><h2>{asset.name}</h2></div><button aria-label="关闭详情" onClick={onClose} type="button">×</button></div>
        <div className="drawer-status"><span className={`scope-tag ${asset.scope}`}>{scopeLabels[asset.scope]}</span><span className={`lifecycle-tag ${lifecycleTone(asset.lifecycle)}`}>{asset.lifecycle}</span><span className={`status-dot ${asset.is_online ? 'online' : 'offline'}`}><i />{asset.is_online ? '运行中' : '已离线'}</span></div>

        <section className={`drawer-access ${access.level}`}><span>{access.level === 'manage' ? '✓' : '◌'}</span><div><small>当前身份权限结论</small><strong>{access.label} · {access.reason}</strong><p>{roleMeta[role].boundary}</p></div></section>

        <section><h3>资产说明</h3><p>{asset.description}</p></section>
        <section><h3>运行表现</h3><div className="detail-metrics"><div><small>本月调用</small><strong>{formatNumber(Number(asset.calls))}</strong></div><div><small>成功率</small><strong>{Number(asset.success_rate).toFixed(2)}%</strong></div><div><small>平均时延</small><strong>{Number(asset.avg_latency).toFixed(1)}s</strong></div><div><small>本月成本</small><strong>{formatMoney(Number(asset.monthly_cost))}</strong></div></div></section>
        <section><h3>责任与元数据</h3><dl><div><dt>资产负责人</dt><dd>{displayUserName(asset.owner_name)}</dd></div><div><dt>所属团队</dt><dd>{asset.team_name}</dd></div><div><dt>业务域</dt><dd>{asset.domain}</dd></div><div><dt>资产来源</dt><dd>{asset.source}</dd></div><div><dt>最近更新</dt><dd>{formatDateTime(asset.updated_at)}</dd></div><div><dt>资产 ID</dt><dd className="mono">{asset.id.slice(0, 12)}…</dd></div></dl></section>
        <section><h3>治理路径</h3><div className="drawer-governance"><span>{scopeLabels[asset.scope]}</span><b>当前范围</b>{asset.scope !== 'common' && <><i>→</i><span>{target.label}</span><b>{target.approver}审批</b></>}</div><p className="drawer-governance-note">关键创建、晋级与审批动作均进入活动留痕。生产环境应由服务端写入不可变审计记录。</p></section>
        {canPromote && <button className="primary-button drawer-action" disabled={submitting || hasPendingApproval} onClick={() => void onPromote(asset)} type="button">{hasPendingApproval ? '已有申请等待处理' : `申请晋级为${target.label}`}</button>}
      </aside>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span>◇</span><strong>{title}</strong><p>{detail}</p></div>;
}

function LoadingState({ fullPage = false }: { fullPage?: boolean }) {
  return <div className={fullPage ? 'loading-state full-page' : 'loading-state'}><span className="loading-logo">CATL</span><strong>正在同步企业资产数据</strong><p>连接 InsForge 资产、审批与活动留痕</p></div>;
}

export default App;
