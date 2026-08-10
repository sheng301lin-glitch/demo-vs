import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Archive, FileText, Layers3, Loader2, Search, Sparkles, Star, TrendingUp, Wand2, XCircle } from 'lucide-react'
import { archiveContentGroup, createOptimizeTask, fetchContentGroupDetail, fetchContentGroups, fetchContentStatistics, fetchContentVersions } from '../api/endpoints'
import { PLATFORMS, type ContentGroupDetail } from '../types'
import { DetailModal } from '../components/DetailModal'
import { parseContentPreview } from '../utils/contentPreview'

const PAGE_SIZE = 20
const COLORS = ['#665cf6','#f5b63f','#aeb4c3','#ef5350']

export function ContentListPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState('')
  const [scoreMin, setScoreMin] = useState('')
  const [scoreMax, setScoreMax] = useState('')
  const [keyword, setKeyword] = useState('')
  const [instruction, setInstruction] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('group')
  const selectContent = (groupId: string) => { const next = new URLSearchParams(searchParams); next.set('group', groupId); setSearchParams(next) }
  const closeContent = () => { const next = new URLSearchParams(searchParams); next.delete('group'); setSearchParams(next, { replace: true }) }
  const groupsQuery = useQuery({ queryKey: ['contentGroups', platform, status, scoreMin, scoreMax, keyword, page], queryFn: () => fetchContentGroups({ platform: platform || undefined, status: status || undefined, score_min: scoreMin ? Number(scoreMin) : undefined, score_max: scoreMax ? Number(scoreMax) : undefined, keyword: keyword || undefined, page, size: PAGE_SIZE }) })
  const statsQuery = useQuery({ queryKey: ['contentStatistics'], queryFn: fetchContentStatistics, refetchInterval: 30_000 })
  const detailQuery = useQuery({ queryKey: ['contentGroup', selectedId], queryFn: () => fetchContentGroupDetail(selectedId!), enabled: !!selectedId })
  const versionsQuery = useQuery({ queryKey: ['contentVersions', selectedId], queryFn: () => fetchContentVersions(selectedId!), enabled: !!selectedId })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['contentGroups'] }); qc.invalidateQueries({ queryKey: ['contentStatistics'] }); qc.invalidateQueries({ queryKey: ['contentGroup'] }); qc.invalidateQueries({ queryKey: ['contentVersions'] }) }
  const archive = useMutation({ mutationFn: archiveContentGroup, onSuccess: refresh })
  const optimize = useMutation({ mutationFn: createOptimizeTask, onSuccess: refresh })
  const groups = groupsQuery.data?.data?.items ?? []
  const total = groupsQuery.data?.data?.total ?? 0
  const stats = statsQuery.data?.data
  const detail = detailQuery.data?.data
  const versions = versionsQuery.data?.data ?? []
  const scoreData = useMemo(() => Object.entries(stats?.score_distribution ?? {}).map(([range,count]) => ({ range, count })), [stats])
  const statusData = useMemo(() => Object.entries(stats?.status_distribution ?? {}).map(([name,value]) => ({ name, value })), [stats])
  const current = detail?.current_content
  const preview = parseContentPreview(current?.body)
  const startOptimize = (contentId: string) => optimize.mutate({ request_id: `req_opt_${Date.now()}_${crypto.randomUUID().slice(0,8)}`, source_content_ids: [contentId], instruction, quality: { route_strategy: 'AUTO', threshold: 85, enable_evaluation: true, enable_auto_optimize: true, max_iteration: 2 }, image_generation: { mode: 'KEEP' } })
  const kpis = [
    { label: '总内容数', value: stats?.total_groups ?? 0, hint: '按逻辑内容组统计', icon: FileText },
    { label: '今日新增', value: stats?.today_new_groups ?? 0, hint: '今日新建内容组', icon: TrendingUp },
    { label: '平均评分', value: stats?.average_current_score ?? '—', hint: '仅统计当前版本', icon: Star },
    { label: '已优化', value: stats?.optimized_groups ?? 0, hint: '拥有多个历史版本', icon: Sparkles },
    { label: '已归档', value: stats?.archived_groups ?? 0, hint: '软归档内容', icon: Archive },
  ]
  return <div className="page">
    <div className="page-heading"><div><h1 className="page-title">内容列表</h1><p className="page-subtitle">每行代表一个内容组，当前版本与历史版本始终保留</p></div></div>
    <div className="kpi-grid">{kpis.map(item => <div className="card kpi-card" key={item.label}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="kpi-label">{item.label}</span><item.icon size={17} color="var(--primary)" /></div><div className="kpi-value">{item.value}</div><div className="kpi-hint">{item.hint}</div></div>)}</div>
    <div className="card toolbar"><select className="select" value={platform} onChange={e => { setPlatform(e.target.value); setPage(1) }}><option value="">全部平台</option>{PLATFORMS.map(p => <option value={p.value} key={p.value}>{p.label}</option>)}</select><select className="select" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="">全部状态</option><option value="ACTIVE">有效</option><option value="ARCHIVED">已归档</option></select><input className="field" type="number" min="0" max="100" value={scoreMin} onChange={e => setScoreMin(e.target.value)} placeholder="最低分"/><input className="field" type="number" min="0" max="100" value={scoreMax} onChange={e => setScoreMax(e.target.value)} placeholder="最高分"/><div style={{ position:'relative' }}><Search size={14} style={{ position:'absolute',left:10,top:11,color:'#9aa2b3' }}/><input className="field search-field" style={{ paddingLeft:30 }} value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1) }} placeholder="搜索标题、正文或 ID"/></div></div>
    <div>
      <section className="card"><div className="table-wrap">{groupsQuery.isLoading ? <div className="empty-state"><Loader2 size={28}/><div>加载内容...</div></div> : groups.length === 0 ? <div className="empty-state"><Layers3 size={36}/><div>暂无符合条件的内容</div></div> : <table className="data-table content-table"><thead><tr><th>内容 ID</th><th>标题</th><th>平台</th><th>来源任务</th><th>当前版本</th><th>历史版本数</th><th>评分</th><th>状态</th><th>更新时间</th></tr></thead><tbody>{groups.map((group: ContentGroupDetail) => <tr key={group.content_group_id} className={selectedId === group.content_group_id ? 'is-selected' : ''} tabIndex={0} onClick={() => selectContent(group.content_group_id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectContent(group.content_group_id) } }}><td>{group.content_group_id}</td><td><b>{group.current_content?.title || '无标题'}</b></td><td>{PLATFORMS.find(p => p.value === group.platform)?.label ?? group.platform}</td><td>{group.root_task_id}</td><td>v{group.current_version_no}</td><td>{group.version_count}</td><td>{group.current_content?.score != null ? <span className={group.current_content.score >= 80 ? 'badge green' : 'badge orange'}>{group.current_content.score}</span> : '—'}</td><td><span className={`badge ${group.status === 'ACTIVE' ? 'green' : 'red'}`}>{group.status === 'ACTIVE' ? (group.version_count > 1 ? '已优化' : '有效') : '已归档'}</span></td><td>{group.updated_at ? new Date(group.updated_at).toLocaleString('zh-CN') : '-'}</td></tr>)}</tbody></table>}</div><div className="pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button><button className="is-active">{page}</button><button disabled={page * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}>›</button></div></section>
      <DetailModal open={!!selectedId} title="内容详情" onClose={closeContent} size="content">{detailQuery.isLoading ? <div className="empty-state"><Loader2 size={28}/></div> : detail ? <><div className="card-body"><h3 className="detail-title">{current?.title || '无标题'}</h3><p><span className="badge green">{detail.status === 'ACTIVE' ? '有效' : '已归档'}</span></p><dl className="detail-meta"><dt>内容 ID</dt><dd>{detail.content_group_id}</dd><dt>当前版本</dt><dd>v{detail.current_version_no}</dd><dt>平台</dt><dd>{detail.platform}</dd><dt>模型</dt><dd>{current?.model_name || '—'}</dd><dt>综合评分</dt><dd>{current?.score ?? '—'}</dd></dl><h4>内容预览</h4><p className="content-preview">{preview.body || '暂无正文'}</p>{preview.hashtags.length > 0 && <div className="content-hashtags">{preview.hashtags.map(tag => <span className="badge purple" key={tag}>#{tag}</span>)}</div>}{preview.summary && <div className="content-summary">{preview.summary}</div>}{current?.evaluation_detail && <><h4>评分维度</h4>{Object.entries(current.evaluation_detail).map(([key,value]) => typeof value === 'number' ? <div key={key} style={{ display:'grid',gridTemplateColumns:'75px 1fr 35px',gap:8,alignItems:'center',fontSize:10,marginBottom:7 }}><span>{key}</span><div className="progress" style={{ width:'100%' }}><i style={{ width:`${Math.min(100,value)}%` }}/></div><b>{value}</b></div> : null)}</>}</div><div className="card-body"><h4>历史版本</h4><div className="timeline">{versions.map(version => <div className="timeline-item" key={version.content_id}><b>v{version.version_no} · {version.score ?? '未评分'}</b><div className="kpi-hint">{version.created_at ? new Date(version.created_at).toLocaleString('zh-CN') : ''}</div><button className="button" style={{ marginTop:6,height:29 }} onClick={() => startOptimize(version.content_id)} disabled={optimize.isPending}><Wand2 size={12}/>从此版本优化</button></div>)}</div><textarea className="textarea" value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="输入优化要求，例如：标题更抓眼，正文更口语化" style={{ marginTop:14 }}/></div><div className="card-body detail-modal-actions"><button className="button danger" disabled={detail.status === 'ARCHIVED'} onClick={() => archive.mutate(detail.content_group_id)}><Archive size={12}/>归档</button>{current && <button className="button primary" onClick={() => startOptimize(current.content_id)} disabled={optimize.isPending}><Wand2 size={12}/>优化当前版本</button>}</div></> : <div className="empty-state"><XCircle size={32}/>内容详情加载失败</div>}</DetailModal>
    </div>
    <div className="chart-grid"><section className="card chart-card"><div className="card-header">内容状态分布</div><div className="card-body"><ResponsiveContainer><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72}>{statusData.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div></section><section className="card chart-card"><div className="card-header">评分分布</div><div className="card-body"><ResponsiveContainer><BarChart data={scoreData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="range" tick={{fontSize:9}}/><YAxis hide/><Tooltip/><Bar dataKey="count" fill="#665cf6" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></section><section className="card chart-card"><div className="card-header">近 30 日新增趋势</div><div className="card-body"><ResponsiveContainer><LineChart data={stats?.daily_trend ?? []}><XAxis dataKey="date" tick={{fontSize:9}}/><YAxis hide/><Tooltip/><Line type="monotone" dataKey="count" stroke="#665cf6" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div></section></div>
  </div>
}
