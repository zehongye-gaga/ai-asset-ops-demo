import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createAsset, handleApproval, loadDashboardData, submitPromotion } from './api';
import { countByType, summarizeAssets } from './lib/metrics';
import type {
  ApprovalRequest,
  Asset,
  AssetScope,
  AssetType,
  DashboardData,
  Role,
} from './types';

type View = 'overview' | 'assets' | 'approvals' | 'cockpit';
type ScopeFilter = AssetScope | 'all';
type TypeFilter = AssetType | 'all';

const emptyData: DashboardData = { assets: [], approvals: [], events: [] };

const roleLabels: Record<Role, string> = {
  personal: '个人用户',
  team_admin: '团队管理员',
  system_admin: '系统管理员',
};

const scopeLabels: Record<AssetScope, string> = {
  common: '通用资产',
  team: '团队资产',
  personal: '个人资产',
};

const typeMeta: Record<AssetType, { label: string; icon: string; color: string }> = {
  agent: { label: '智能体', icon: 'AI', color: '#745cff' },
  application: { label: '应用', icon: 'AP', color: '#20b8cd' },
  skill: { label: 'Skills', icon: 'SK', color: '#f0a03c' },
  knowledge: { label: '知识库', icon: 'KB', color: '#55a36d' },
  mcp: { label: 'MCP', icon: 'MC', color: '#ed6f91' },
};

const navItems: Array<{ id: View; label: string; icon: string }> = [
  { id: 'overview', label: '运营概览', icon: '⌂' },
  { id: 'assets', label: '资产目录', icon: '◇' },
  { id: 'approvals', label: '晋级审批', icon: '✓' },
  { id: 'cockpit', label: '运营大屏', icon: '⌁' },
];

const formatNumber = (value: number) =>
  new Intl.NumberFormat('zh-CN', { notation: value > 99999 ? 'compact' : 'standard' }).format(value);

const formatMoney = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(value);

const relativeTime = (value: string) => {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} 小时前` : `${Math.round(hours / 24)} 天前`;
};

function App() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [view, setView] = useState<View>('overview');
  const [role, setRole] = useState<Role>('system_admin');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [query, setQuery] = useState('');
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
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const scopedAssets = useMemo(() => {
    return data.assets.filter((asset) => {
      const matchesScope = scope === 'all' || asset.scope === scope;
      const matchesType = type === 'all' || asset.asset_type === type;
      const haystack = `${asset.name} ${asset.description} ${asset.source} ${asset.team_name}`.toLowerCase();
      return matchesScope && matchesType && haystack.includes(query.trim().toLowerCase());
    });
  }, [data.assets, query, scope, type]);

  const metrics = useMemo(() => summarizeAssets(scopedAssets), [scopedAssets]);
  const typeCounts = useMemo(() => countByType(scopedAssets), [scopedAssets]);
  const pendingApprovals = data.approvals.filter((item) => item.status === 'pending');
  const visibleApprovals = data.approvals.filter((item) => {
    if (role === 'personal') return item.requester === '叶泽宏' || item.from_scope === 'personal';
    return item.approver_role === role;
  });

  const notify = (message: string) => setToast(message);

  const changeRole = (nextRole: Role) => {
    setRole(nextRole);
    if (nextRole === 'personal') setScope('personal');
    if (nextRole === 'team_admin') setScope('team');
    if (nextRole === 'system_admin') setScope('all');
  };

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      await createAsset({
        name: String(form.get('name')),
        assetType: String(form.get('assetType')) as AssetType,
        scope: String(form.get('scope')) as AssetScope,
        description: String(form.get('description')),
      });
      setCreateOpen(false);
      notify('资产已写入 InsForge');
      await refresh(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '创建资产失败');
    } finally {
      setSubmitting(false);
    }
  };

  const onPromote = async (asset: Asset) => {
    setSubmitting(true);
    try {
      await submitPromotion(asset);
      notify(`「${asset.name}」已提交晋级`);
      await refresh(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '提交晋级失败');
    } finally {
      setSubmitting(false);
    }
  };

  const onApproval = async (request: ApprovalRequest, approve: boolean) => {
    setSubmitting(true);
    try {
      await handleApproval(request, approve);
      notify(approve ? '审批通过，资产范围已更新' : '审批已驳回');
      await refresh(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '审批失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">A</span>
          <span><strong>AI 资产</strong><small>运营管理平台</small></span>
        </div>
        <div className="workspace-card">
          <span className="workspace-avatar">智</span>
          <span><small>当前空间</small><strong>AI 创新中心</strong></span>
          <span className="chevron">⌄</span>
        </div>
        <nav aria-label="主导航">
          <p className="nav-title">工作台</p>
          {navItems.map((item) => (
            <button
              className={view === item.id ? 'nav-item active' : 'nav-item'}
              key={item.id}
              onClick={() => setView(item.id)}
              type="button"
            >
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.id === 'approvals' && pendingApprovals.length > 0 && (
                <span className="nav-badge">{pendingApprovals.length}</span>
              )}
            </button>
          ))}
          <p className="nav-title nav-section">资产分类</p>
          {(Object.keys(typeMeta) as AssetType[]).map((assetType) => (
            <button
              className={view === 'assets' && type === assetType ? 'nav-item active' : 'nav-item'}
              key={assetType}
              onClick={() => { setType(assetType); setView('assets'); }}
              type="button"
            >
              <span className="type-dot" style={{ background: typeMeta[assetType].color }} />
              {typeMeta[assetType].label}
              <span className="nav-count">{countByType(data.assets)[assetType]}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="connection-dot" /> InsForge 实时连接
          <small>Rainbond · App 140</small>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">数字资产运营中心</p>
            <h1>{navItems.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" title="刷新数据" onClick={() => void refresh(true)} type="button">
              <span className={refreshing ? 'spin' : ''}>↻</span>
            </button>
            <label className="role-picker">
              <span className="avatar">叶</span>
              <span><small>演示身份</small>
                <select value={role} onChange={(event) => changeRole(event.target.value as Role)} aria-label="演示身份">
                  {(Object.keys(roleLabels) as Role[]).map((item) => <option value={item} key={item}>{roleLabels[item]}</option>)}
                </select>
              </span>
            </label>
            <button className="primary-button" onClick={() => setCreateOpen(true)} type="button">＋ 新建资产</button>
          </div>
        </header>

        {error && <div className="error-banner"><span>!</span>{error}<button onClick={() => setError('')} type="button">×</button></div>}
        {toast && <div className="toast">✓ {toast}</div>}

        <section className="content" key={view}>
          {loading ? <LoadingState /> : (
            <>
              {view === 'overview' && (
                <Overview
                  assets={scopedAssets}
                  counts={typeCounts}
                  data={data}
                  metrics={metrics}
                  onAsset={setSelectedAsset}
                  onScope={setScope}
                  scope={scope}
                  setView={setView}
                />
              )}
              {view === 'assets' && (
                <AssetCatalog
                  assets={scopedAssets}
                  query={query}
                  scope={scope}
                  type={type}
                  onQuery={setQuery}
                  onScope={setScope}
                  onType={setType}
                  onAsset={setSelectedAsset}
                  onPromote={onPromote}
                  role={role}
                  submitting={submitting}
                />
              )}
              {view === 'approvals' && (
                <ApprovalCenter
                  approvals={visibleApprovals}
                  assets={data.assets}
                  role={role}
                  onApproval={onApproval}
                  submitting={submitting}
                />
              )}
              {view === 'cockpit' && <Cockpit data={data} />}
            </>
          )}
        </section>
      </main>

      {createOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCreateOpen(false)}>
          <form className="modal" onSubmit={onCreate} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><p className="eyebrow">Create asset</p><h2>新建数字资产</h2></div><button onClick={() => setCreateOpen(false)} type="button">×</button></div>
            <label>资产名称<input name="name" required placeholder="例如：采购分析助手" /></label>
            <div className="form-grid">
              <label>资产类型<select name="assetType" defaultValue="agent">{(Object.keys(typeMeta) as AssetType[]).map((item) => <option key={item} value={item}>{typeMeta[item].label}</option>)}</select></label>
              <label>所属范围<select name="scope" defaultValue={role === 'personal' ? 'personal' : role === 'team_admin' ? 'team' : 'common'}>{(Object.keys(scopeLabels) as AssetScope[]).map((item) => <option key={item} value={item}>{scopeLabels[item]}</option>)}</select></label>
            </div>
            <label>资产说明<textarea name="description" required rows={4} placeholder="说明资产解决什么问题、供谁使用" /></label>
            <div className="form-note"><span>i</span>提交后将直接写入当前 InsForge 数据库，可在资产目录中查看。</div>
            <div className="modal-actions"><button className="secondary-button" onClick={() => setCreateOpen(false)} type="button">取消</button><button className="primary-button" disabled={submitting} type="submit">{submitting ? '正在写入…' : '创建资产'}</button></div>
          </form>
        </div>
      )}

      {selectedAsset && <AssetDrawer asset={selectedAsset} role={role} onClose={() => setSelectedAsset(null)} onPromote={onPromote} submitting={submitting} />}
    </div>
  );
}

function ScopeTabs({ scope, onScope }: { scope: ScopeFilter; onScope: (scope: ScopeFilter) => void }) {
  return <div className="scope-tabs">
    {([['all', '全部视角'], ['common', '通用'], ['team', '团队'], ['personal', '个人']] as const).map(([value, label]) => (
      <button className={scope === value ? 'active' : ''} key={value} onClick={() => onScope(value)} type="button">{label}</button>
    ))}
  </div>;
}

function Overview({ assets, counts, data, metrics, onAsset, onScope, scope, setView }: {
  assets: Asset[];
  counts: Record<AssetType, number>;
  data: DashboardData;
  metrics: ReturnType<typeof summarizeAssets>;
  onAsset: (asset: Asset) => void;
  onScope: (scope: ScopeFilter) => void;
  scope: ScopeFilter;
  setView: (view: View) => void;
}) {
  const maxCount = Math.max(...Object.values(counts), 1);
  return <>
    <div className="section-heading">
      <div><h2>资产运营全景</h2><p>统一查看资产规模、调用表现与当前运营动态</p></div>
      <ScopeTabs scope={scope} onScope={onScope} />
    </div>
    <div className="metric-grid">
      <MetricCard label="数字员工" value={metrics.digitalEmployees} suffix="个" delta="较上月 +12.6%" tone="violet" icon="AI" />
      <MetricCard label="本月调用" value={formatNumber(metrics.calls)} suffix="次" delta="较上月 +8.2%" tone="cyan" icon="↗" />
      <MetricCard label="平均成功率" value={metrics.successRate.toFixed(2)} suffix="%" delta="服务整体稳定" tone="green" icon="✓" />
      <MetricCard label="本月总成本" value={formatMoney(metrics.cost)} suffix="" delta="预算使用 68.4%" tone="orange" icon="¥" />
    </div>
    <div className="overview-grid">
      <article className="panel asset-distribution">
        <div className="panel-head"><div><h3>资产构成</h3><p>五类数字资产实时分布</p></div><span className="live-label"><i />实时</span></div>
        <div className="distribution-content">
          <div className="donut" style={{ '--donut-total': Math.max(assets.length, 1) } as React.CSSProperties}>
            <span><strong>{assets.length}</strong><small>资产总数</small></span>
          </div>
          <div className="type-bars">
            {(Object.keys(typeMeta) as AssetType[]).map((assetType) => (
              <button key={assetType} type="button" onClick={() => setView('assets')}>
                <span className="legend-dot" style={{ background: typeMeta[assetType].color }} />
                <span className="bar-label">{typeMeta[assetType].label}</span>
                <span className="bar-track"><i style={{ width: `${Math.max(8, (counts[assetType] / maxCount) * 100)}%`, background: typeMeta[assetType].color }} /></span>
                <strong>{counts[assetType]}</strong>
              </button>
            ))}
          </div>
        </div>
      </article>
      <article className="panel trend-panel">
        <div className="panel-head"><div><h3>调用趋势</h3><p>近 7 日资产调用变化</p></div><span className="pill">全部资产</span></div>
        <div className="trend-chart" aria-label="近七日调用趋势图">
          {[42, 56, 51, 67, 62, 79, 88].map((height, index) => <div key={index} className="trend-column"><i style={{ height: `${height}%` }} /><span>{['一', '二', '三', '四', '五', '六', '日'][index]}</span></div>)}
          <svg viewBox="0 0 700 180" preserveAspectRatio="none" aria-hidden="true"><polyline points="10,125 125,98 240,107 355,77 470,88 585,48 690,27" /></svg>
        </div>
      </article>
    </div>
    <div className="overview-grid lower-grid">
      <article className="panel">
        <div className="panel-head"><div><h3>重点资产</h3><p>按调用量排序</p></div><button className="text-button" onClick={() => setView('assets')} type="button">查看全部 →</button></div>
        <div className="asset-mini-list">{assets.slice(0, 5).map((asset) => <button key={asset.id} onClick={() => onAsset(asset)} type="button"><TypeIcon type={asset.asset_type} /><span><strong>{asset.name}</strong><small>{asset.source} · {scopeLabels[asset.scope]}</small></span><span className="mini-stat"><strong>{formatNumber(Number(asset.calls))}</strong><small>调用</small></span><span className={asset.is_online ? 'status online' : 'status'}>{asset.is_online ? '运行中' : '未上线'}</span></button>)}</div>
      </article>
      <article className="panel activity-panel">
        <div className="panel-head"><div><h3>运营动态</h3><p>来自 InsForge 的最新事件</p></div></div>
        <div className="timeline">{data.events.slice(0, 6).map((event) => <div key={event.id}><span className={`event-dot ${event.severity}`} /><span><strong>{event.title}</strong><p>{event.detail}</p><small>{relativeTime(event.created_at)}</small></span></div>)}</div>
      </article>
    </div>
  </>;
}

function MetricCard({ label, value, suffix, delta, tone, icon }: { label: string; value: string | number; suffix: string; delta: string; tone: string; icon: string }) {
  return <article className={`metric-card ${tone}`}><div className="metric-icon">{icon}</div><div><p>{label}</p><h3>{value}<small>{suffix}</small></h3><span>↗ {delta}</span></div></article>;
}

function TypeIcon({ type }: { type: AssetType }) {
  return <span className="type-icon" style={{ color: typeMeta[type].color, background: `${typeMeta[type].color}16` }}>{typeMeta[type].icon}</span>;
}

function AssetCatalog({ assets, query, scope, type, onQuery, onScope, onType, onAsset, onPromote, role, submitting }: {
  assets: Asset[];
  query: string;
  scope: ScopeFilter;
  type: TypeFilter;
  onQuery: (query: string) => void;
  onScope: (scope: ScopeFilter) => void;
  onType: (type: TypeFilter) => void;
  onAsset: (asset: Asset) => void;
  onPromote: (asset: Asset) => void;
  role: Role;
  submitting: boolean;
}) {
  return <>
    <div className="section-heading"><div><h2>统一资产目录</h2><p>管理智能体、应用、Skills、知识库与 MCP</p></div><ScopeTabs scope={scope} onScope={onScope} /></div>
    <article className="panel catalog-panel">
      <div className="catalog-toolbar">
        <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索资产名称、来源或团队" /></label>
        <select value={type} onChange={(event) => onType(event.target.value as TypeFilter)} aria-label="资产类型">
          <option value="all">全部类型</option>{(Object.keys(typeMeta) as AssetType[]).map((item) => <option key={item} value={item}>{typeMeta[item].label}</option>)}
        </select>
        <span className="result-count">共 {assets.length} 项</span>
      </div>
      <div className="table-wrap"><table><thead><tr><th>资产</th><th>范围 / 所属</th><th>运行状态</th><th>本月调用</th><th>成功率</th><th>更新时间</th><th>操作</th></tr></thead><tbody>
        {assets.map((asset) => {
          const canPromote = (role === 'personal' && asset.scope === 'personal') || (role === 'team_admin' && asset.scope === 'team');
          return <tr key={asset.id}><td><button className="asset-name" onClick={() => onAsset(asset)} type="button"><TypeIcon type={asset.asset_type} /><span><strong>{asset.name}</strong><small>{typeMeta[asset.asset_type].label} · {asset.version}</small></span></button></td><td><span className={`scope-chip ${asset.scope}`}>{scopeLabels[asset.scope]}</span><small className="table-subtext">{asset.team_name}</small></td><td><span className={asset.is_online ? 'status online' : 'status'}>{asset.is_online ? '运行中' : asset.lifecycle}</span></td><td><strong>{formatNumber(Number(asset.calls))}</strong></td><td><span className="success-number">{Number(asset.success_rate).toFixed(2)}%</span></td><td><span>{relativeTime(asset.updated_at)}</span></td><td><div className="row-actions"><button onClick={() => onAsset(asset)} type="button">详情</button>{canPromote && <button disabled={submitting} onClick={() => void onPromote(asset)} type="button">晋级</button>}</div></td></tr>;
        })}
      </tbody></table>{assets.length === 0 && <EmptyState title="没有匹配的资产" description="调整搜索词或筛选条件后再试" />}</div>
    </article>
  </>;
}

function ApprovalCenter({ approvals, assets, role, onApproval, submitting }: { approvals: ApprovalRequest[]; assets: Asset[]; role: Role; onApproval: (request: ApprovalRequest, approve: boolean) => void; submitting: boolean }) {
  return <>
    <div className="section-heading"><div><h2>资产晋级审批</h2><p>个人资产先进入团队，团队资产再申请成为通用资产</p></div><span className="role-context">当前：{roleLabels[role]}</span></div>
    <div className="approval-summary">
      <article><span className="approval-icon pending">⌛</span><div><strong>{approvals.filter((item) => item.status === 'pending').length}</strong><small>待我处理</small></div></article>
      <article><span className="approval-icon approved">✓</span><div><strong>{approvals.filter((item) => item.status === 'approved').length}</strong><small>已通过</small></div></article>
      <article><span className="approval-icon total">◇</span><div><strong>{assets.filter((item) => item.scope !== 'personal').length}</strong><small>共享资产</small></div></article>
    </div>
    <article className="panel approval-list">
      <div className="panel-head"><div><h3>{role === 'personal' ? '我的申请' : '审批队列'}</h3><p>审批结果将实时写回 InsForge</p></div></div>
      {approvals.length === 0 ? <EmptyState title="当前没有审批记录" description="切换演示身份，或先从资产目录提交晋级" /> : approvals.map((request) => {
        const asset = assets.find((item) => item.id === request.asset_id);
        const canHandle = request.status === 'pending' && role !== 'personal' && request.approver_role === role;
        return <div className="approval-row" key={request.id}>
          <TypeIcon type={asset?.asset_type || 'agent'} />
          <div className="approval-main"><div><strong>{request.asset_name}</strong><span className={`approval-status ${request.status}`}>{request.status === 'pending' ? '待审批' : request.status === 'approved' ? '已通过' : '已驳回'}</span></div><p>{request.note}</p><small>{request.requester} · {relativeTime(request.submitted_at)}</small></div>
          <div className="scope-flow"><span className={`scope-chip ${request.from_scope}`}>{scopeLabels[request.from_scope]}</span><b>→</b><span className={`scope-chip ${request.target_scope}`}>{scopeLabels[request.target_scope]}</span></div>
          {canHandle ? <div className="approval-actions"><button disabled={submitting} onClick={() => void onApproval(request, false)} type="button">驳回</button><button className="approve" disabled={submitting} onClick={() => void onApproval(request, true)} type="button">通过</button></div> : <span className="handled-time">{request.handled_at ? relativeTime(request.handled_at) : '等待处理'}</span>}
        </div>;
      })}
    </article>
  </>;
}

function Cockpit({ data }: { data: DashboardData }) {
  const metrics = summarizeAssets(data.assets);
  const counts = countByType(data.assets);
  return <div className="cockpit">
    <div className="cockpit-title"><span /><div><p>AI ASSET OPERATION CENTER</p><h2>集团 AI 资产运营驾驶舱</h2></div><span /></div>
    <div className="cockpit-kpis"><article><small>资产总量</small><strong>{data.assets.length}</strong><span>项</span></article><article><small>本月调用</small><strong>{formatNumber(metrics.calls)}</strong><span>次</span></article><article><small>在线服务</small><strong>{metrics.online}</strong><span>个</span></article><article><small>稳定成功率</small><strong>{metrics.successRate.toFixed(2)}</strong><span>%</span></article></div>
    <div className="cockpit-grid">
      <article className="cockpit-panel"><h3>资产能力矩阵</h3><div className="radar-wrap"><div className="radar"><i /><i /><i /><span>AI</span></div><div className="radar-labels">{(Object.keys(typeMeta) as AssetType[]).map((item) => <p key={item}><span style={{ background: typeMeta[item].color }} />{typeMeta[item].label}<strong>{counts[item]}</strong></p>)}</div></div></article>
      <article className="cockpit-panel map-panel"><h3>全域运营热力</h3><div className="network-map">{data.assets.slice(0, 10).map((asset, index) => <span key={asset.id} style={{ '--x': `${12 + ((index * 29) % 76)}%`, '--y': `${15 + ((index * 37) % 68)}%`, '--c': typeMeta[asset.asset_type].color } as React.CSSProperties} title={asset.name}><i /></span>)}<div className="map-center">AI<br /><small>资产中枢</small></div></div></article>
      <article className="cockpit-panel"><h3>实时运行动态</h3><div className="cockpit-feed">{data.events.slice(0, 6).map((event) => <div key={event.id}><time>{new Date(event.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time><span><strong>{event.title}</strong><small>{event.detail}</small></span></div>)}</div></article>
    </div>
    <div className="cockpit-bottom"><div><span>服务状态</span><strong><i /> 正常</strong></div><div><span>待审批</span><strong>{data.approvals.filter((item) => item.status === 'pending').length}</strong></div><div><span>InsForge</span><strong><i /> 已连接</strong></div><div><span>数据更新时间</span><strong>{new Date().toLocaleTimeString('zh-CN')}</strong></div></div>
  </div>;
}

function AssetDrawer({ asset, role, onClose, onPromote, submitting }: { asset: Asset; role: Role; onClose: () => void; onPromote: (asset: Asset) => void; submitting: boolean }) {
  const canPromote = (role === 'personal' && asset.scope === 'personal') || (role === 'team_admin' && asset.scope === 'team');
  return <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}><aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
    <div className="drawer-head"><TypeIcon type={asset.asset_type} /><div><small>{typeMeta[asset.asset_type].label} · {asset.version}</small><h2>{asset.name}</h2></div><button onClick={onClose} type="button">×</button></div>
    <div className="drawer-status"><span className={asset.is_online ? 'status online' : 'status'}>{asset.is_online ? '运行中' : asset.lifecycle}</span><span className={`scope-chip ${asset.scope}`}>{scopeLabels[asset.scope]}</span></div>
    <section><h3>资产说明</h3><p>{asset.description}</p></section>
    <section><h3>运营表现</h3><div className="detail-metrics"><div><small>本月调用</small><strong>{formatNumber(Number(asset.calls))}</strong></div><div><small>成功率</small><strong>{Number(asset.success_rate).toFixed(2)}%</strong></div><div><small>平均响应</small><strong>{Number(asset.avg_latency).toFixed(2)}s</strong></div><div><small>月度成本</small><strong>{formatMoney(Number(asset.monthly_cost))}</strong></div></div></section>
    <section><h3>基本信息</h3><dl><div><dt>资产来源</dt><dd>{asset.source}</dd></div><div><dt>负责人</dt><dd>{asset.owner_name}</dd></div><div><dt>所属团队</dt><dd>{asset.team_name}</dd></div><div><dt>业务领域</dt><dd>{asset.domain}</dd></div><div><dt>生命周期</dt><dd>{asset.lifecycle}</dd></div><div><dt>最近更新</dt><dd>{relativeTime(asset.updated_at)}</dd></div></dl></section>
    {canPromote && <button className="primary-button drawer-action" disabled={submitting} onClick={() => void onPromote(asset)} type="button">申请晋级为{asset.scope === 'personal' ? '团队' : '通用'}资产</button>}
  </aside></div>;
}

function LoadingState() {
  return <div className="loading-state"><div className="loading-logo">A</div><strong>正在连接 InsForge</strong><span>读取资产、审批与运营动态…</span></div>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span>◇</span><strong>{title}</strong><p>{description}</p></div>;
}

export default App;
