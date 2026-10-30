// Copyright (C) 2026 Over9rowth
// SPDX-License-Identifier: GPL-3.0-only
import React, { useState, useEffect } from 'react';
// @ts-ignore
const domain = require('../domain/clipboard-audit.cjs');

interface Finding {
  type: string;
  rawMatch: string;
  maskedPreview: string;
  reason: string;
}

interface Item {
  id: string;
  text: string;
  createdAtMs: number;
  pinned?: boolean;
  hash: string;
  charCount: number;
  inspection: {
    hasSensitive: boolean;
    riskLevel: 'HIGH' | 'MEDIUM' | 'SAFE';
    findings: Finding[];
  };
}

// 首次启动演示的 12 条“诶”点样本数据（精准展示 Luhn 银行卡、身份证、OpenAI Key、高熵密码串及安全日常文本）
const DEMO_ITEMS = [
  {
    id: 'demo-1',
    text: '重要通知：测试环境的临时 OpenAI Key 为 sk-proj-a9F7k2LmQ8vX1zP0yW3nB4cR6tYuIoPq，请在完成联调后立即销毁。',
    createdAtMs: Date.now() - 3600000 * 5,
    pinned: true
  },
  {
    id: 'demo-2',
    text: '财务汇款账户核验（Visa联名）：4532 0151 1283 0366，持卡人：技术部',
    createdAtMs: Date.now() - 3600000 * 4
  },
  {
    id: 'demo-3',
    text: '服务器临时堡垒机紧急解锁凭证：8k#Lp9$vQx!2mZ0@，切勿发送到公开频道！',
    createdAtMs: Date.now() - 3600000 * 3
  },
  {
    id: 'demo-4',
    text: '员工差旅保险登记身份号：11010519491231002X，已通过实名核对。',
    createdAtMs: Date.now() - 3600000 * 2
  },
  {
    id: 'demo-5',
    text: 'https://github.com/Over9rowth/awesome-dev-tools - 推荐大家收藏这个开源合集仓库。',
    createdAtMs: Date.now() - 3600000 * 1.5
  },
  {
    id: 'demo-6',
    text: '订单流水编号：20261029883921049281（非卡号，无Luhn模10加权），请及时向客户确认发票抬头。',
    createdAtMs: Date.now() - 3600000 * 1.2
  },
  {
    id: 'demo-7',
    text: 'AWS 存储桶临时访问凭证：AKIAIOSFODNN7EXAMPLE，有效期至本周五下午 18:00。',
    createdAtMs: Date.now() - 3600000 * 1
  },
  {
    id: 'demo-8',
    text: '本次版本更新修复了文本差异高亮与多行算法同步性能，发布包已放置于 \\\\build-server\\release。',
    createdAtMs: Date.now() - 3600000 * 0.8
  },
  {
    id: 'demo-9',
    text: '紧急值班运维联系电话：+86 13812345678，如有线上告警可直接拨打。',
    createdAtMs: Date.now() - 3600000 * 0.5
  },
  {
    id: 'demo-10',
    text: 'npm install --save-dev electron esbuild typescript react react-dom',
    createdAtMs: Date.now() - 3600000 * 0.3
  },
  {
    id: 'demo-11',
    text: '严禁在代码中硬编码任何生产凭证，每次提交前请务必使用剪贴板考古台与文风体检台自测！',
    createdAtMs: Date.now() - 3600000 * 0.2
  },
  {
    id: 'demo-12',
    text: 'git checkout -b feature/clipboard-audit-v010 && git status',
    createdAtMs: Date.now() - 3600000 * 0.1
  }
];

export const App: React.FC = () => {
  const [entries, setEntries] = useState<Array<{ id: string; text: string; createdAtMs: number; pinned?: boolean }>>(DEMO_ITEMS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [selectedId, setSelectedId] = useState<string>('demo-1');
  const [statusMsg, setStatusMsg] = useState('已自动装载 12 条内置考古演示样本（包含 3 处高敏凭证）');

  // 计算过滤后的条目
  const historyItems: Item[] = domain.dedupeAndFilterHistory(entries, searchQuery, filterCategory);

  const activeItem = historyItems.find(i => i.id === selectedId) || historyItems[0] || null;

  // 统计信息
  const totalCount = historyItems.length;
  const highRiskCount = historyItems.filter(i => i.inspection.riskLevel === 'HIGH').length;
  const mediumRiskCount = historyItems.filter(i => i.inspection.riskLevel === 'MEDIUM').length;

  const handleReadSystemClipboard = async () => {
    try {
      const api = (window as any).electronAPI;
      let text = '';
      if (api && api.readClipboard) {
        text = await api.readClipboard();
      } else if (navigator.clipboard) {
        text = await navigator.clipboard.readText();
      }
      if (!text || text.trim().length === 0) {
        setStatusMsg('当前系统剪贴板为空或未获取到文本内容');
        return;
      }
      const newItem = {
        id: 'clip-' + Date.now(),
        text,
        createdAtMs: Date.now(),
        pinned: false
      };
      setEntries(prev => [newItem, ...prev]);
      setSelectedId(newItem.id);
      setStatusMsg(`已成功读取并抓取剪贴板内容（${text.length} 字符），已完成 SHA-256 去重与安全体检`);
    } catch (e) {
      setStatusMsg('读取剪贴板异常：' + String(e));
    }
  };

  const handleMaskAndCopy = async (item: Item) => {
    try {
      const maskRes = domain.maskSensitiveText(item.text);
      const api = (window as any).electronAPI;
      if (api && api.writeClipboard) {
        await api.writeClipboard(maskRes.maskedText);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(maskRes.maskedText);
      }
      setStatusMsg(`一键脱敏成功！已将脱敏版本（${maskRes.redactionCount} 处掩码）重新复制到剪贴板`);
    } catch (e) {
      setStatusMsg('复制脱敏文本失败：' + String(e));
    }
  };

  const handleExportJson = async () => {
    try {
      const report = {
        exportedAt: new Date().toISOString(),
        summary: {
          totalEntries: totalCount,
          highRiskCount,
          mediumRiskCount
        },
        items: historyItems
      };
      const api = (window as any).electronAPI;
      if (api && api.exportReport) {
        const ok = await api.exportReport(JSON.stringify(report, null, 2));
        if (ok) setStatusMsg('考古体检报告导出成功！');
      } else {
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `剪贴板考古报告-${Date.now()}.json`;
        a.click();
        setStatusMsg('报告已通过浏览器下载导出！');
      }
    } catch (e) {
      setStatusMsg('导出报告出错：' + String(e));
    }
  };

  return (
    <div className="app-container">
      {/* 顶部标题栏 */}
      <header className="header-bar">
        <div className="brand">
          <span className="brand-icon">🛡️</span>
          <div>
            <div className="title-row">
              <h1>剪贴板考古台</h1>
              <span className="version-pill">v0.1.0</span>
              <span className="badge-offline">100% 离线确定性</span>
            </div>
            <div className="honest-boundary">
              本工具为 100% 本机离线运行的确定性度量与辅助分析仪器，不上传任何用户数据，所有统计与高亮均基于公开透明的数学与编码规则，结果供排查与核验参考。
            </div>
          </div>
        </div>
        <div className="action-buttons">
          <button className="btn btn-primary" onClick={handleReadSystemClipboard}>
            📋 从系统剪贴板读取
          </button>
          <button className="btn btn-secondary" onClick={handleExportJson}>
            💾 导出 JSON 报告
          </button>
        </div>
      </header>

      {/* 指标栏 */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">考古历史总条数</div>
          <div className="stat-value">{totalCount}</div>
        </div>
        <div className="stat-card high-risk">
          <div className="stat-label">高敏高危凭据（Luhn/API/高熵密码）</div>
          <div className="stat-value">{highRiskCount}</div>
        </div>
        <div className="stat-card medium-risk">
          <div className="stat-label">中风险 PII 凭据</div>
          <div className="stat-value">{mediumRiskCount}</div>
        </div>
        <div className="stat-card status-box">
          <div className="stat-label">系统状态</div>
          <div className="stat-msg" id="smoke-status-text">{statusMsg}</div>
        </div>
      </div>

      {/* 主工作区 */}
      <div className="main-content">
        {/* 左侧条目列表 */}
        <aside className="left-panel">
          <div className="filter-controls">
            <input
              type="text"
              placeholder="🔍 检索剪贴板历史..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <div className="filter-tabs">
              <button className={filterCategory === 'ALL' ? 'active' : ''} onClick={() => setFilterCategory('ALL')}>全部</button>
              <button className={filterCategory === 'SENSITIVE' ? 'active' : ''} onClick={() => setFilterCategory('SENSITIVE')}>仅敏感</button>
              <button className={filterCategory === 'SAFE' ? 'active' : ''} onClick={() => setFilterCategory('SAFE')}>仅安全</button>
            </div>
          </div>

          <div className="history-list">
            {historyItems.map(item => (
              <div
                key={item.id}
                className={`history-card ${selectedId === item.id ? 'selected' : ''} ${item.inspection.riskLevel === 'HIGH' ? 'card-high' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="card-top">
                  <span className="card-time">{new Date(item.createdAtMs).toLocaleTimeString()}</span>
                  {item.inspection.riskLevel === 'HIGH' && <span className="risk-tag tag-high">高敏凭证</span>}
                  {item.inspection.riskLevel === 'MEDIUM' && <span className="risk-tag tag-med">中风险</span>}
                  {item.inspection.riskLevel === 'SAFE' && <span className="risk-tag tag-safe">安全</span>}
                </div>
                <div className="card-text-preview">{item.text.slice(0, 90)}</div>
                <div className="card-meta">
                  <span>{item.charCount} 字符</span>
                  <span>SHA: {item.hash.slice(0, 8)}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* 右侧深度显影与脱敏详情 */}
        <main className="detail-panel">
          {activeItem ? (
            <div className="detail-wrapper">
              <div className="detail-header">
                <div>
                  <h2 className="detail-title">记录显影（SHA-256: <code>{activeItem.hash}</code>）</h2>
                  <div className="detail-subtitle">
                    记录时间：{new Date(activeItem.createdAtMs).toLocaleString()} | 字符数：{activeItem.charCount}
                  </div>
                </div>
                <button className="btn btn-mask" onClick={() => handleMaskAndCopy(activeItem)}>
                  🔒 一键掩码并复制
                </button>
              </div>

              {/* 敏感检出高亮清单 */}
              {activeItem.inspection.findings.length > 0 && (
                <div className="findings-section">
                  <h3>🚨 检出高敏凭证哨兵警告（共 {activeItem.inspection.findings.length} 处）</h3>
                  <div className="findings-grid">
                    {activeItem.inspection.findings.map((f, idx) => (
                      <div key={idx} className="finding-box">
                        <div className="finding-top">
                          <span className="finding-type-pill">{f.type}</span>
                          <span className="finding-reason">{f.reason}</span>
                        </div>
                        <div className="finding-values">
                          <div><strong>原始匹配：</strong><code>{f.rawMatch}</code></div>
                          <div><strong>脱敏预览：</strong><span className="masked-highlight">{f.maskedPreview}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 原始内容与掩码对照 */}
              <div className="content-view-section">
                <div className="view-half">
                  <h3>📜 原始内容</h3>
                  <textarea className="text-display" readOnly value={activeItem.text} />
                </div>
                <div className="view-half">
                  <h3>🛡️ 脱敏效果实时预览</h3>
                  <textarea
                    className="text-display text-masked-display"
                    readOnly
                    value={domain.maskSensitiveText(activeItem.text).maskedText}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">请在左侧选择一条考古记录进行深度分析</div>
          )}
        </main>
      </div>
    </div>
  );
};
