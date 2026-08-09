// ============================================================================
// 系统状态页 - 健康检查展示
// ============================================================================
import { Activity, Database, Radio, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useHealth } from '../hooks/useQueries'

export function HealthPage() {
  const { data, isLoading, isError } = useHealth()
  const health = data?.data

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 24 }}>
        <Activity size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
        系统状态
      </h1>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <p>检测中...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : isError ? (
        <div style={{
          padding: 40,
          textAlign: 'center',
          borderRadius: 12,
          border: '1px solid #fca5a5',
          background: '#fef2f2',
        }}>
          <XCircle size={48} style={{ color: '#ef4444', marginBottom: 12 }} />
          <p style={{ color: '#dc2626', fontWeight: 600 }}>后端服务不可用</p>
          <p style={{ color: '#991b1b', fontSize: 13, marginTop: 8 }}>
            请确认 Python 服务已启动 (uvicorn app.main:app --port 8000)
          </p>
        </div>
      ) : (
        <>
          {/* 总体状态 */}
          <div style={{
            padding: '24px 28px',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            background: '#fff',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: health?.status === 'ok' ? '#10b98118' : '#f59e0b18',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {health?.status === 'ok' ? (
                <CheckCircle2 size={28} color="#10b981" />
              ) : (
                <XCircle size={28} color="#f59e0b" />
              )}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
                {health?.status === 'ok' ? '系统正常' : '部分降级'}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                API 服务运行中
              </div>
            </div>
          </div>

          {/* 组件状态 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ComponentStatus
              icon={<Database size={18} />}
              label="数据库 (MySQL)"
              ok={health?.db === 'connected'}
            />
            <ComponentStatus
              icon={<Radio size={18} />}
              label="缓存 (Redis)"
              ok={health?.redis === 'connected'}
            />
          </div>

          {/* 响应元数据 */}
          {data && (
            <div style={{
              marginTop: 16,
              padding: '12px 16px',
              borderRadius: 8,
              background: '#f9fafb',
              fontSize: 12,
              color: '#6b7280',
            }}>
              Request ID: {data.request_id} &middot; Timestamp: {new Date(data.timestamp).toLocaleString('zh-CN')}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ComponentStatus({ icon, label, ok }: { icon: React.ReactNode; label: string; ok: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 18px',
      borderRadius: 10,
      border: '1px solid #e5e7eb',
      background: '#fff',
    }}>
      <div style={{ color: ok ? '#10b981' : '#ef4444' }}>
        {icon}
      </div>
      <span style={{ flex: 1, fontSize: 14, color: '#374151' }}>{label}</span>
      <span style={{
        ...statusBadge,
        background: ok ? '#10b98118' : '#ef444418',
        color: ok ? '#10b981' : '#ef4444',
      }}>
        {ok ? '正常' : '异常'}
      </span>
    </div>
  )
}

const statusBadge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 12px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
}
