import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Ban, Clock3, ListChecks, Loader2, RefreshCw, RotateCcw, Search, ShieldCheck, TimerReset, XCircle } from 'lucide-react'
import { cancelTask, fetchTaskDetail, fetchTaskEvents, fetchTasks, fetchTaskStatistics, retryTask, updateTaskPriority } from '../api/endpoints'
import { PLATFORMS, STATUS_MAP, type TaskListItem } from '../types'
import { formatDuration, getTaskStage, isTaskControllable } from '../utils/dashboard'
import { DetailModal } from '../components/DetailModal'

const PAGE_SIZE = 20
const TABS = [
  ['','全部任务'], ['QUEUED','排队中'], ['RUNNING','执行中'], ['QUALITY','质检中'], ['OPTIMIZE','优化中'], ['FAILED','失败重试'], ['SUCCESS','已完成'],
] as const

export function TasksPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState('')
  const [platform, setPlatform] = useState('')
  const [priority, setPriority] = useState('')
  const [keyword, setKeyword] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('task')
  const selectTask = (taskId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('task', taskId)
    setSearchParams(next)
  }
  const closeTask = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('task')
    setSearchParams(next, { replace: true })
  }
  const status = ['QUALITY','OPTIMIZE'].includes(tab) ? undefined : tab || undefined
  const currentNode = tab === 'QUALITY' ? 'quality' : tab === 'OPTIMIZE' ? 'feedback' : undefined
  const tasksQuery = useQuery({ queryKey: ['tasks', status, currentNode, platform, priority, keyword, page], queryFn: () => fetchTasks({ status, current_node: currentNode, platform: platform || undefined, priority: priority || undefined, keyword: keyword || undefined, page, size: PAGE_SIZE }), refetchInterval: query => query.state.data?.data?.items.some(task => ['PENDING','QUEUED','RUNNING'].includes(task.status)) ? 3000 : false })
  const statsQuery = useQuery({ queryKey: ['taskStatistics'], queryFn: fetchTaskStatistics, refetchInterval: 10_000 })
  const detailQuery = useQuery({ queryKey: ['task', selectedId], queryFn: () => fetchTaskDetail(selectedId!), enabled: !!selectedId, refetchInterval: query => ['PENDING','QUEUED','RUNNING'].includes(query.state.data?.data?.status ?? '') ? 2500 : false })
  const eventsQuery = useQuery({ queryKey: ['taskEvents', selectedId], queryFn: () => fetchTaskEvents(selectedId!, { size: 100 }), enabled: !!selectedId })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['taskStatistics'] }) }
  const cancel = useMutation({ mutationFn: cancelTask, onSuccess: refresh })
  const retry = useMutation({ mutationFn: retryTask, onSuccess: refresh })
  const priorityMutation = useMutation({ mutationFn: ({ id, value }: { id: string; value: 'LOW'|'NORMAL'|'HIGH' }) => updateTaskPriority(id, value), onSuccess: refresh })
  const tasks = tasksQuery.data?.data?.items ?? []
  const total = tasksQuery.data?.data?.total ?? 0
  const stats = statsQuery.data?.data
  const detail = detailQuery.data?.data
  const events = eventsQuery.data?.data ?? []

  const kpis = [
    { label: '总任务数', value: stats?.total ?? 0, hint: '全部生成与优化任务', icon: ListChecks },
    { label: '排队中', value: stats?.queued ?? 0, hint: `Redis 深度 ${stats?.queue_depth ?? 0}`, icon: Clock3 },
    { label: '执行中', value: stats?.running ?? 0, hint: '后台 Worker 正在处理', icon: Activity },
    { label: '平均等待时长', value: formatDuration(stats?.average_wait_ms), hint: '从创建到开始执行', icon: TimerReset },
    { label: '失败重试', value: stats?.failed ?? 0, hint: `重试中 ${stats?.retrying ?? 0}`, icon: XCircle },
  ]
  return <div className="page">
    <div className="page-heading"><div><h1 className="page-title">任务队列</h1><p className="page-subtitle">查看排队、执行、质检和失败任务</p></div><button className="button" onClick={refresh}><RefreshCw size={14} />刷新</button></div>
    <div className="kpi-grid">{kpis.map(item => <div className="card kpi-card" key={item.label}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="kpi-label">{item.label}</span><item.icon size={17} color="var(--primary)" /></div><div className="kpi-value">{item.value}</div><div className="kpi-hint">{item.hint}</div></div>)}</div>
    <div className="card" style={{ marginBottom: 12 }}><div className="card-header"><span>队列健康度 <span className={`badge ${stats?.queue_health === 'healthy' ? 'green' : stats?.queue_health === 'degraded' ? 'orange' : 'red'}`}>{stats?.queue_health === 'healthy' ? '良好' : stats?.queue_health === 'degraded' ? '降级' : '不可用'}</span></span><span className="page-subtitle"><ShieldCheck size={12} /> 实时统计</span></div><div className="card-body" style={{ height: 122 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={stats?.trend ?? []}><defs><linearGradient id="queueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#665cf6" stopOpacity={.28}/><stop offset="1" stopColor="#665cf6" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="hour" tickFormatter={v => String(v).slice(11,16)} tick={{ fontSize: 9 }} axisLine={false}/><YAxis hide/><Tooltip/><Area type="monotone" dataKey="queued" stroke="#665cf6" fill="url(#queueFill)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></div>
    <div className="card toolbar"><select className="select" value={platform} onChange={e => { setPlatform(e.target.value); setPage(1) }}><option value="">全部平台</option>{PLATFORMS.map(p => <option value={p.value} key={p.value}>{p.label}</option>)}</select><select className="select" value={priority} onChange={e => { setPriority(e.target.value); setPage(1) }}><option value="">全部优先级</option><option value="HIGH">高</option><option value="NORMAL">普通</option><option value="LOW">低</option></select><div style={{ position: 'relative' }}><Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#9aa2b3' }} /><input className="field search-field" style={{ paddingLeft: 30 }} value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1) }} placeholder="搜索任务名称或 ID" /></div></div>
    <div>
      <section className="card"><div className="tabs">{TABS.map(([value,label]) => <button className={`tab ${tab === value ? 'is-active' : ''}`} onClick={() => { setTab(value); setPage(1) }} key={value}>{label}</button>)}</div><div className="table-wrap">
        {tasksQuery.isLoading ? <div className="empty-state"><Loader2 size={28}/><div>加载任务...</div></div> : tasks.length === 0 ? <div className="empty-state"><ListChecks size={35}/><div>暂无符合条件的任务</div></div> : <table className="data-table tasks-table"><thead><tr><th>任务名称</th><th>平台</th><th>优先级</th><th>当前阶段</th><th>队列状态</th><th>进度</th><th>模型</th><th>创建时间</th></tr></thead><tbody>{tasks.map((task: TaskListItem) => { const state = STATUS_MAP[task.status]; return <tr key={task.task_id} className={selectedId === task.task_id ? 'is-selected' : ''} tabIndex={0} onClick={() => selectTask(task.task_id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectTask(task.task_id) } }}><td><b>{task.task_name}</b><div className="kpi-hint">{task.task_id}</div></td><td>{PLATFORMS.find(p => p.value === task.platform)?.label ?? task.platform}</td><td><span className={`badge ${task.priority === 'HIGH' ? 'red' : task.priority === 'LOW' ? 'green' : 'orange'}`}>{task.priority}</span></td><td><span className="badge purple">{getTaskStage(task.current_node, task.status)}</span></td><td><span className={`badge ${task.status === 'FAILED' ? 'red' : task.status === 'SUCCESS' ? 'green' : 'purple'}`}>{state?.label ?? task.status}</span></td><td><div className="progress-cell"><div className="progress"><i style={{ width: `${task.progress}%` }} /></div>{task.progress}%</div></td><td>-</td><td>{task.created_at ? new Date(task.created_at).toLocaleString('zh-CN') : '-'}</td></tr>})}</tbody></table>}
      </div><div className="pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button><button className="is-active">{page}</button><button disabled={page * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}>›</button></div></section>
      <DetailModal open={!!selectedId} title="任务详情" onClose={closeTask} size="task">{detailQuery.isLoading ? <div className="empty-state"><Loader2 size={28}/></div> : detail ? <><div className="card-body"><h3 className="detail-title">{detail.task_name}</h3><p><span className="badge purple">{getTaskStage(detail.current_node, detail.status)}</span></p><dl className="detail-meta"><dt>任务 ID</dt><dd>{detail.task_id}</dd><dt>平台</dt><dd>{detail.platform}</dd><dt>优先级</dt><dd>{detail.priority}</dd><dt>等待时长</dt><dd>{formatDuration(detail.queue_wait_ms)}</dd><dt>模型</dt><dd>{detail.model_summary?.join('、') || '暂无调用'}</dd><dt>Token</dt><dd>{(detail.usage_summary?.total_input_tokens ?? 0) + (detail.usage_summary?.total_output_tokens ?? 0)}</dd><dt>预计费用</dt><dd>${Number(detail.usage_summary?.total_cost ?? 0).toFixed(4)}</dd></dl><h4>执行进度</h4><div className="progress" style={{ width: '100%', height: 7 }}><i style={{ width: `${detail.progress}%` }} /></div><div className="timeline" style={{ marginTop: 20 }}>{events.slice(0,8).map(event => <div className="timeline-item" key={event.event_id}><b>{event.message || event.event_type}</b><div className="kpi-hint">{event.created_at ? new Date(event.created_at).toLocaleString('zh-CN') : ''}</div></div>)}</div></div><div className="card-body detail-modal-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><button className="button danger" disabled={!isTaskControllable(detail.status,'cancel')} onClick={() => cancel.mutate(detail.task_id)}><Ban size={13}/>取消</button><button className="button" disabled={!isTaskControllable(detail.status,'retry')} onClick={() => retry.mutate(detail.task_id)}><RotateCcw size={13}/>重试</button><select className="select" style={{ width: 120 }} disabled={!isTaskControllable(detail.status,'priority')} value={detail.priority} onChange={e => priorityMutation.mutate({ id: detail.task_id, value: e.target.value as 'LOW'|'NORMAL'|'HIGH' })}><option value="LOW">低优先级</option><option value="NORMAL">普通</option><option value="HIGH">高优先级</option></select></div></> : <div className="empty-state">任务详情加载失败</div>}</DetailModal>
    </div>
  </div>
}
