import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

const stylesheet = readFileSync('src/styles.css', 'utf8');

beforeAll(() => {
  document.head.innerHTML = `<style>${stylesheet}</style>`;
  document.body.innerHTML = `
    <aside class="sidebar">
      <div class="workspace-copy"><strong>研发中心</strong></div>
      <button class="nav-item">运营概览</button>
    </aside>
    <header class="topbar">
      <div class="topbar-context"><strong>运营概览</strong></div>
      <form class="global-search"><input value="资产搜索" /></form>
    </header>
    <div class="page-intro"><p>页面说明</p></div>
    <div class="policy-copy"><strong>权限边界</strong></div>
    <article class="metric-card"><small>指标说明</small></article>
    <header class="panel-head"><div><p>面板说明</p></div></header>
    <button class="compact-row"><small>资产信息</small></button>
    <div class="asset-table-head">资产表头</div>
    <div class="asset-name-cell"><small>资产元数据</small></div>
    <div class="approval-asset"><span><p>审批理由</p></span></div>
    <form class="modal"><input value="表单内容" /></form>
    <aside class="drawer"><section><p>详情正文</p></section></aside>

    <div class="cockpit-root">
      <div class="cockpit-brand"><div><small>大屏副标题</small></div></div>
      <div class="cockpit-view-tabs"><button><small>视角说明</small></button></div>
      <div class="cockpit-context">数据口径</div>
      <article class="cockpit-kpi"><small>指标名称</small></article>
      <section class="cockpit-panel"><header><h3>面板标题</h3></header></section>
      <div class="lifecycle-list"><div><span>生命周期</span></div></div>
      <span class="hero-core"><small>数字员工</small></span>
      <div class="domain-bar"><span>业务域</span></div>
      <div class="cockpit-approval-list"><div><p><small>审批范围</small></p></div></div>
      <div class="cockpit-domain-grid"><article><dl><div><dt>资产</dt></div></dl></article></div>
      <footer class="cockpit-footer">实时数据</footer>
    </div>
  `;
});

function fontSize(selector: string) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing typography fixture: ${selector}`);
  return Number.parseFloat(getComputedStyle(element).fontSize);
}

describe('readable enterprise typography', () => {
  it.each([
    '.workspace-copy strong',
    '.nav-item',
    '.topbar-context strong',
    '.global-search input',
    '.page-intro p',
    '.policy-copy strong',
    '.metric-card > small',
    '.panel-head p',
    '.compact-row small',
    '.asset-table-head',
    '.asset-name-cell small',
    '.approval-asset p',
    '.modal input',
    '.drawer > section > p',
  ])('keeps management text at least 12px: %s', (selector) => {
    expect(fontSize(selector)).toBeGreaterThanOrEqual(12);
  });

  it.each([
    '.cockpit-brand small',
    '.cockpit-view-tabs small',
    '.cockpit-context',
    '.cockpit-kpi > small',
    '.cockpit-panel > header h3',
    '.lifecycle-list > div > span',
    '.hero-core small',
    '.domain-bar > span',
    '.cockpit-approval-list small',
    '.cockpit-domain-grid dt',
    '.cockpit-footer',
  ])('keeps cockpit text at least 10px: %s', (selector) => {
    expect(fontSize(selector)).toBeGreaterThanOrEqual(10);
  });
});
