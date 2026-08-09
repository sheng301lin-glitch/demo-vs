// ============================================================================
// 任务详情页 - 状态、进度、操作、输入参数展示
// ============================================================================
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ArrowLeft, Ban, RotateCcw, Loader2, Clock, CheckCircle2, XCircle, AlertTriangle, Activity, FileText, Star, ExternalLink, GitCompare, ChevronDown, ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTaskDetail, useCancelTask, useRetryTask } from '../hooks/useQueries'
import { fetchTaskEvents, fetchTaskContent } from '../api/endpoints'
import type { TaskEventItem, ContentGroupDetail } from '../types'
import { STATUS_MAP, PLATFORMS } from '../types'

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { data, isLoading, error } = useTaskDetail(taskId ?? null)
  const cancelTask = useCancelTask()
  const retryTask = useRetryTask()

  const task = data?.data
  const isRunning = task ? ['PENDING', 'QUEUED', 'RUNNING'].includes(task.status) : false
  const isDone = task ? ['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED'].includes(task.status) : false

  // 单独拉事件列表，用最新 PROGRESS 事件的进度驱动顶部进度条
  const { data: eventsData } = useQuery({
    queryKey: ['taskEvents', taskId],
    queryFn: () => fetchTaskEvents(taskId!, { size: 200 }),
    refetchInterval: isRunning ? 3000 : false,
    enabled: !!taskId,
  })
  const events: TaskEventItem[] = eventsData?.data ?? []

  // 折叠状态
  const [timelineExpanded, setTimelineExpanded] = useState(false)
  const [paramsExpanded, setParamsExpanded] = useState(false)

  // 取最新 PROGRESS 事件的进度（事件已实时提交，比 task.progress 更及时）
  // events 按 event_seq DESC 排列，find 取第一条匹配即为最新进度
  const eventProgress = events.find(
    (e) => e.event_type === 'PROGRESS' && e.progress != null
  )?.progress
  const displayProgress = eventProgress ?? task?.progress ?? 0

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
        <p>加载中...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <XCircle size={48} style={{ color: '#ef4444', marginBottom: 12 }} />
        <p style={{ color: '#6b7280', marginBottom: 12 }}>任务不存在或加载失败</p>
        <button onClick={() => navigate('/tasks')} style={linkBtn}>
          返回任务列表
        </button>
      </div>
    )
  }

  const st = STATUS_MAP[task.status] || { label: task.status, color: '#6b7280' }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* 返回 */}
      <button
        onClick={() => navigate('/tasks')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          color: '#6b7280',
          marginBottom: 20,
          padding: 0,
        }}
      >
        <ArrowLeft size={16} />
        返回任务列表
      </button>

      {/* 任务标题 & 状态 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
            {task.task_name}
          </h1>
          <p style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace', marginTop: 4 }}>
            ID: {task.task_id}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            ...statusBadge,
            background: st.color + '18',
            color: st.color,
          }}>
            {isRunning && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            {st.label}
          </span>
          {/* 操作按钮 */}
          {isRunning && (
            <button
              onClick={() => cancelTask.mutate(task.task_id)}
              disabled={cancelTask.isPending}
              style={{ ...actionBtn, color: '#ef4444', borderColor: '#fca5a5' }}
            >
              <Ban size={14} />
              取消
            </button>
          )}
          {(task.status === 'FAILED' || task.status === 'PARTIAL_SUCCESS') && (
            <button
              onClick={() => retryTask.mutate(task.task_id)}
              disabled={retryTask.isPending}
              style={{ ...actionBtn, color: '#f59e0b', borderColor: '#fcd34d' }}
            >
              <RotateCcw size={14} />
              重试
            </button>
          )}
        </div>
      </div>

      {/* 双栏布局 */}
      <div className="task-detail-grid">
        {/* ========== 左栏 ========== */}
        <div className="task-detail-column">
          {/* 进度条 —— 与执行事件进度同步 */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>执行进度</span>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{displayProgress}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: '#e5e7eb', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: 5,
                background: st.color,
                width: `${displayProgress}%`,
                transition: 'width 0.5s',
              }} />
            </div>
          </div>

          {/* 统计卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <StatCard icon={<CheckCircle2 size={14} color="#10b981" />} label="成功" value={`${task.success_count}/${task.requested_count}`} />
            <StatCard icon={<XCircle size={14} color="#ef4444" />} label="失败" value={String(task.failed_count)} />
            <StatCard icon={<Clock size={14} color="#6366f1" />} label="平台" value={task.platform} />
            <StatCard icon={<AlertTriangle size={14} color="#f59e0b" />} label="迭代" value={`${task.current_iteration}/${task.max_iteration}`} />
          </div>

          {/* 时间线 */}
          <div style={card}>
            <div
              onClick={() => setTimelineExpanded(!timelineExpanded)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: timelineExpanded ? 12 : 0, cursor: 'pointer' }}
            >
              {timelineExpanded ? <ChevronDown size={14} color="#9ca3af" /> : <ChevronRight size={14} color="#9ca3af" />}
              <Clock size={16} color="#6366f1" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>时间线</span>
            </div>
            {timelineExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <TimeRow label="创建时间" time={task.created_at} />
                <TimeRow label="入队时间" time={task.queued_at} />
                <TimeRow label="开始执行" time={task.started_at} />
                <TimeRow label="完成时间" time={task.completed_at} />
              </div>
            )}
          </div>

          {/* 执行事件 */}
          <EventTimeline taskId={task.task_id} isRunning={isRunning} events={events} />

          {/* 输入参数 */}
          {task.input_params && (
            <div style={card}>
              <div
                onClick={() => setParamsExpanded(!paramsExpanded)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: paramsExpanded ? 12 : 0, cursor: 'pointer' }}
              >
                {paramsExpanded ? <ChevronDown size={14} color="#9ca3af" /> : <ChevronRight size={14} color="#9ca3af" />}
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>任务参数</span>
              </div>
              {paramsExpanded && (
                <pre style={{
                  background: '#f9fafb',
                  padding: 16,
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.6,
                  overflow: 'auto',
                  maxHeight: 400,
                  color: '#374151',
                  margin: 0,
                }}>
                  {JSON.stringify(task.input_params, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* ========== 右栏 ========== */}
        <div className="task-detail-column">
          {/* 生成内容列表 */}
          <ContentSection taskId={task.task_id} isDone={isDone} taskType={task.task_type} />
        </div>
      </div>

      {/* 错误信息 */}
      {task.error_message && (
        <div style={{
          ...card,
          borderColor: '#fca5a5',
          background: '#fef2f2',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>错误信息</div>
          <p style={{ fontSize: 13, color: '#991b1b', margin: 0 }}>{task.error_message}</p>
          {task.error_code && (
            <p style={{ fontSize: 12, color: '#7f1d1d', marginTop: 4 }}>错误码: {task.error_code}</p>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── 子组件 ──

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 8,
      border: '1px solid #e5e7eb',
      background: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        {icon}
        <span style={{ fontSize: 11, color: '#6b7280' }}>{label}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{value}</div>
    </div>
  )
}

function ContentSection({ taskId, isDone, taskType }: { taskId: string; isDone: boolean; taskType?: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['taskContent', taskId],
    queryFn: () => fetchTaskContent(taskId),
    refetchInterval: isDone ? false : 5000,
    enabled: !!taskId,
  })

  const contentGroups: ContentGroupDetail[] = data?.data ?? []

  if (isLoading && contentGroups.length === 0) return null
  if (contentGroups.length === 0 && !isDone) return null

  const getPlatformLabel = (p: string) => PLATFORMS.find((x) => x.value === p)?.label || p

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>
          <FileText size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          生成内容 ({contentGroups.length})
        </span>
      </div>
      {taskType === 'OPTIMIZE' && contentGroups.length > 0 && (
        <div style={{
          padding: '8px 14px', borderRadius: 8, marginBottom: 12,
          background: '#fef3c7', border: '1px solid #fcd34d',
          fontSize: 12, color: '#92400e',
        }}>
          此任务优化了以下内容的版本，点击可查看版本历史与对比。
        </div>
      )}
      {contentGroups.length === 0 ? (
        <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 20 }}>暂无内容</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {contentGroups.map((g) => {
            const title = g.current_content?.title || '(无标题)'
            const score = g.current_content?.score
            return (
              <div
                key={g.content_group_id}
                className="task-content-row"
                onClick={() => navigate(`/content/${g.content_group_id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 8,
                  border: '1px solid #f3f4f6', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f9fafb' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff' }}
              >
                <span style={{ fontSize: 12, color: '#9ca3af', minWidth: 24 }}>#{g.generation_index}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {title}
                </span>
                <span style={{ fontSize: 11, color: '#6b7280', minWidth: 50 }}>{getPlatformLabel(g.platform)}</span>
                {score != null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, color: '#f59e0b', minWidth: 40 }}>
                    <Star size={10} fill="#f59e0b" /> {score}
                  </span>
                )}
                {g.version_count > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/content/${g.content_group_id}?compare=1`)
                    }}
                    title="查看版本对比"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '2px 8px', borderRadius: 6,
                      border: '1px solid #6366f1', background: '#eef2ff',
                      color: '#6366f1', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                    }}
                  >
                    <GitCompare size={10} />
                    对比 v{g.version_count}
                  </button>
                )}
                <ExternalLink size={12} color="#d1d5db" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TimeRow({ label, time }: { label: string; time: string | null | undefined }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color: '#374151' }}>
        {time ? new Date(time).toLocaleString('zh-CN') : '-'}
      </span>
    </div>
  )
}

const EVENT_TYPE_MAP: Record<string, { color: string; label: string }> = {
  NODE_START: { color: '#3b82f6', label: '节点开始' },
  NODE_END: { color: '#10b981', label: '节点完成' },
  PROGRESS: { color: '#8b5cf6', label: '进度更新' },
  ERROR: { color: '#ef4444', label: '错误' },
  CONTENT_STORED: { color: '#10b981', label: '内容已存储' },
}

function EventTimeline({ taskId, isRunning, events }: { taskId: string; isRunning: boolean; events: TaskEventItem[] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={card}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: expanded ? 12 : 0, cursor: 'pointer' }}
      >
        {expanded ? <ChevronDown size={14} color="#9ca3af" /> : <ChevronRight size={14} color="#9ca3af" />}
        <Activity size={16} color="#6366f1" />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>执行事件</span>
        {isRunning && (
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            <Loader2 size={10} style={{ animation: 'spin 1s linear infinite', marginRight: 4, verticalAlign: 'middle' }} />
            自动刷新中
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>{events.length} 条</span>
      </div>
      {expanded && (
        events.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 20 }}>暂无事件</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320, overflow: 'auto' }}>
            {events.map((e) => {
              const meta = EVENT_TYPE_MAP[e.event_type] || { color: '#6b7280', label: e.event_type }
              return (
                <div key={e.event_id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '6px 0', borderBottom: '1px solid #f9fafb',
                }}>
                  <span style={{
                    ...eventBadge, background: meta.color + '18', color: meta.color,
                  }}>
                    {meta.label}
                  </span>
                  <span style={{ fontSize: 12, color: '#6b7280', minWidth: 70 }}>
                    {e.node || '-'}
                  </span>
                  <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>
                    {e.message || ''}
                  </span>
                  {e.progress != null && (
                    <span style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 600 }}>
                      {e.progress}%
                    </span>
                  )}
                  {e.duration_ms != null && (
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      {e.duration_ms}ms
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: '#d1d5db' }}>
                    {e.created_at ? new Date(e.created_at).toLocaleTimeString('zh-CN') : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

// ── 样式 ──

const card: React.CSSProperties = {
  padding: '16px 20px',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  background: '#fff',
  marginBottom: 16,
}

const statusBadge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  borderRadius: 20,
  fontSize: 13,
  fontWeight: 600,
}

const actionBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 14px',
  borderRadius: 8,
  border: '1px solid',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
}

const eventBadge: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 8px',
  borderRadius: 10,
  fontSize: 10,
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

const linkBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
}
