// ============================================================================
// 模型配置页 - 展示模型列表 & 能力路由
// ============================================================================
import { useState } from 'react'
import { Loader2, Cpu, GitBranch, ChevronDown, ChevronUp } from 'lucide-react'
import { CAPABILITY_MAP, MODEL_STATUS_MAP, MODEL_TYPE_MAP } from '../types'
import { useModels, useRoutes } from '../hooks/useQueries'

export function SettingsPage() {
  const { data: modelsResp, isLoading: modelsLoading, error: modelsError } = useModels()
  const { data: routesResp, isLoading: routesLoading } = useRoutes()
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    models: true,
    routes: true,
  })

  const toggle = (key: string) =>
    setExpandedSections((s) => ({ ...s, [key]: !s[key] }))

  const models = modelsResp?.data ?? []
  const routes = routesResp?.data ?? []

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 24 }}>
        <Cpu size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
        模型配置
      </h1>

      {/* ── 模型列表 ── */}
      <section style={section}>
        <button
          onClick={() => toggle('models')}
          style={sectionHeaderBtn}
        >
          {expandedSections.models ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          模型列表 ({models.length})
        </button>
        {expandedSections.models && (
          modelsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : modelsError ? (
            <p style={{ color: '#ef4444', fontSize: 13, padding: '12px 0' }}>加载失败</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={table}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={th}>模型 ID</th>
                    <th style={th}>显示名称</th>
                    <th style={th}>Provider</th>
                    <th style={th}>模型名</th>
                    <th style={th}>类型</th>
                    <th style={th}>状态</th>
                    <th style={th}>RPM 限制</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr key={m.model_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{m.model_id.slice(0, 12)}...</td>
                      <td style={td}>{m.display_name}</td>
                      <td style={td}>{m.provider}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{m.model_name}</td>
                      <td style={td}>{MODEL_TYPE_MAP[m.model_type] ?? m.model_type}</td>
                      <td style={td}>
                        <span style={{
                          ...badge,
                          background: m.status === 'ENABLED' ? '#10b98118' : '#f59e0b18',
                          color: m.status === 'ENABLED' ? '#10b981' : '#f59e0b',
                        }}>
                          {MODEL_STATUS_MAP[m.status] ?? m.status}
                        </span>
                      </td>
                      <td style={td}>{m.rpm_limit ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>

      {/* ── 能力路由 ── */}
      <section style={section}>
        <button
          onClick={() => toggle('routes')}
          style={sectionHeaderBtn}
        >
          {expandedSections.routes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <GitBranch size={14} style={{ marginLeft: 8 }} />
          能力路由 ({routes.length})
        </button>
        {expandedSections.routes && (
          routesLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={table}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={th}>路由 ID</th>
                    <th style={th}>能力</th>
                    <th style={th}>模型 ID</th>
                    <th style={th}>优先级</th>
                    <th style={th}>权重</th>
                    <th style={th}>回退顺序</th>
                    <th style={th}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r) => (
                    <tr key={r.route_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{r.route_id.slice(0, 16)}...</td>
                      <td style={td}>{CAPABILITY_MAP[r.capability] ?? r.capability}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{r.model_id.slice(0, 12)}...</td>
                      <td style={td}>{r.priority}</td>
                      <td style={td}>{r.weight}</td>
                      <td style={td}>{r.fallback_order}</td>
                      <td style={td}>
                        <span style={{
                          ...badge,
                          background: r.status === 'ENABLED' ? '#10b98118' : '#f59e0b18',
                          color: r.status === 'ENABLED' ? '#10b981' : '#f59e0b',
                        }}>
                          {MODEL_STATUS_MAP[r.status] ?? r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── 样式 ──

const section: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#fff',
  marginBottom: 16,
  overflow: 'hidden',
}

const sectionHeaderBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '14px 20px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 600,
  color: '#1f2937',
}

const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 14px',
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
}

const td: React.CSSProperties = {
  padding: '10px 14px',
  color: '#374151',
}

const badge: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 500,
}
