import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Archive, Copy, FileText, GitCompare, Info, Layers3, Loader2, Search, ShieldCheck, Sparkles, Star, TrendingUp, Wand2, XCircle } from 'lucide-react'
import { archiveContentGroup, createOptimizeTask, fetchContentGroupDetail, fetchContentGroups, fetchContentStatistics, fetchContentTasks, fetchContentVersions } from '../api/endpoints'
import { PLATFORMS, type ContentGroupDetail, type ContentResultItem } from '../types'
import { DetailModal } from '../components/DetailModal'
import { parseContentPreview } from '../utils/contentPreview'

const PAGE_SIZES = [5, 10, 20, 50]
const COLORS = ['#665cf6', '#f5b63f', '#aeb4c3', '#ef5350']
const SCORE_LABELS: Record<string, string> = {
  accuracy: '准确性',
  accuracy_score: '准确性',
  relevance: '相关性',
  relevance_score: '相关性',
  structure: '结构性',
  structure_score: '结构性',
  appeal: '吸引力',
  appeal_score: '吸引力',
  engagement: '互动性',
  engagement_score: '互动性',
  originality: '原创性',
  originality_score: '原创性',
  readability: '可读性',
  readability_score: '可读性',
  content_quality: '内容质量',
  keyword_coverage: '关键词覆盖',
  brand_fit: '品牌契合度',
  compliance: '合规性',
}
const HIDDEN_SCORE_KEYS = new Set(['content_index', 'overall_score'])

function historyCount(versionCount: number | null | undefined) {
  return Math.max(0, (versionCount ?? 0) - 1)
}

function getVersionLabel(version: ContentResultItem | null | undefined) {
  return version ? `v${version.version_no}` : '—'
}

function getCompareRows(left: ContentResultItem, right: ContentResultItem) {
  const leftPreview = parseContentPreview(left.body)
  const rightPreview = parseContentPreview(right.body)
  const rows = [
    { label: '标题', left: left.title || '无标题', right: right.title || '无标题' },
    { label: '正文', left: leftPreview.body || '暂无正文', right: rightPreview.body || '暂无正文' },
    { label: '标签', left: leftPreview.hashtags, right: rightPreview.hashtags },
    { label: '摘要', left: leftPreview.summary || '暂无摘要', right: rightPreview.summary || '暂无摘要' },
  ]

  return rows.filter(row => JSON.stringify(row.left) !== JSON.stringify(row.right))
}

function getPlatformLabel(platform: string | null | undefined) {
  return PLATFORMS.find(item => item.value === platform)?.label ?? platform ?? '—'
}

function VersionValue({ value }: { value: string | string[] }) {
  if (Array.isArray(value)) {
    return <div className="content-hashtags compact-tags">{value.length > 0 ? value.map(tag => <span className="badge purple" key={tag}>#{tag}</span>) : <span>暂无标签</span>}</div>
  }

  return <p>{value}</p>
}

function ScoreRows({ current }: { current: ContentResultItem | null | undefined }) {
  const detail = current?.evaluation_detail ?? {}
  const dimensionDetails = Array.isArray(detail.dimension_details) ? detail.dimension_details as Record<string, unknown>[] : []
  const dimensions = detail.dimensions
  const rawWeights = detail.weights ?? detail.dimension_weights
  const weights = rawWeights && typeof rawWeights === 'object' && !Array.isArray(rawWeights)
    ? rawWeights as Record<string, unknown>
    : {}
  const scoreSource = dimensions && typeof dimensions === 'object' && !Array.isArray(dimensions)
    ? dimensions as Record<string, unknown>
    : detail
  const entries = dimensionDetails.length > 0
    ? dimensionDetails
      .filter(item => typeof item.dimension === 'string' && typeof item.score === 'number')
      .map(item => ({ key: item.dimension as string, label: SCORE_LABELS[item.dimension as string] ?? item.dimension as string, value: item.score as number, weight: formatScoreWeight(item.weight) }))
    : Object.entries(scoreSource)
      .filter(([key, value]) => typeof value === 'number' && !HIDDEN_SCORE_KEYS.has(key))
      .map(([key, value]) => ({ key, label: SCORE_LABELS[key] ?? key, value: value as number, weight: formatScoreWeight(weights[key]) }))

  if (entries.length === 0) {
    return <div className="empty-state compact">暂无维度评分</div>
  }

  return <div className="score-list">{entries.map(entry => <div className="score-row" key={entry.key}><span>{entry.label}{entry.weight && <em>权重 {entry.weight}</em>}</span><div className="progress"><i style={{ width: `${Math.min(100, entry.value)}%` }} /></div><b>{entry.value}</b></div>)}</div>
}

function formatScoreWeight(value: unknown) {
  if (typeof value !== 'number') return null
  const percent = value <= 1 ? value * 100 : value
  return `${Number.isInteger(percent) ? percent : Number(percent.toFixed(1))}%`
}

function getOverallScore(current: ContentResultItem | null | undefined) {
  const detailScore = current?.evaluation_detail?.overall_score
  return current?.score ?? (typeof detailScore === 'number' ? detailScore : '—')
}

function getContentCopyText(content: ContentResultItem | null | undefined) {
  const title = content?.title || '无标题'
  const preview = parseContentPreview(content?.body)
  const lines = [`# ${title}`]
  if (preview.body) lines.push('', preview.body)
  if (preview.hashtags.length > 0) lines.push('', preview.hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' '))
  return lines.join('\n')
}

export function ContentListPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState('')
  const [scoreMin, setScoreMin] = useState('')
  const [scoreMax, setScoreMax] = useState('')
  const [keyword, setKeyword] = useState('')
  const [instruction, setInstruction] = useState('')
  const [leftVersionId, setLeftVersionId] = useState<string | null>(null)
  const [rightVersionId, setRightVersionId] = useState<string | null>(null)
  const [copyNotice, setCopyNotice] = useState('')
  const copyNoticeTimer = useRef<number | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('group')
  const taskFilter = searchParams.get('task') ?? ''

  const groupsQuery = useQuery({
    queryKey: ['contentGroups', taskFilter, platform, status, scoreMin, scoreMax, keyword, page, pageSize],
    queryFn: () => fetchContentGroups({
      task_id: taskFilter || undefined,
      platform: platform || undefined,
      status: status || undefined,
      score_min: scoreMin ? Number(scoreMin) : undefined,
      score_max: scoreMax ? Number(scoreMax) : undefined,
      keyword: keyword || undefined,
      page,
      size: pageSize,
    }),
  })
  const tasksQuery = useQuery({ queryKey: ['contentTasks', platform, keyword], queryFn: () => fetchContentTasks({ platform: platform || undefined, keyword: keyword || undefined, page: 1, size: 50 }) })
  const statsQuery = useQuery({ queryKey: ['contentStatistics'], queryFn: fetchContentStatistics, refetchInterval: 30_000 })
  const detailQuery = useQuery({ queryKey: ['contentGroup', selectedId], queryFn: () => fetchContentGroupDetail(selectedId!), enabled: !!selectedId })
  const versionsQuery = useQuery({ queryKey: ['contentVersions', selectedId], queryFn: () => fetchContentVersions(selectedId!), enabled: !!selectedId })
  const versions = versionsQuery.data?.data ?? []

  useEffect(() => {
    setLeftVersionId(null)
    setRightVersionId(null)
  }, [selectedId])

  useEffect(() => {
    if (!selectedId || versions.length < 2 || leftVersionId || rightVersionId) return
    setLeftVersionId(versions[0].content_id)
    setRightVersionId(versions[1].content_id)
  }, [leftVersionId, rightVersionId, selectedId, versions])

  useEffect(() => () => {
    if (copyNoticeTimer.current) window.clearTimeout(copyNoticeTimer.current)
  }, [])

  const selectContent = (groupId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('group', groupId)
    setSearchParams(next)
  }

  const closeContent = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('group')
    setSearchParams(next, { replace: true })
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['contentGroups'] })
    qc.invalidateQueries({ queryKey: ['contentStatistics'] })
    qc.invalidateQueries({ queryKey: ['contentGroup'] })
    qc.invalidateQueries({ queryKey: ['contentVersions'] })
  }

  const archive = useMutation({ mutationFn: archiveContentGroup, onSuccess: refresh })
  const optimize = useMutation({ mutationFn: createOptimizeTask, onSuccess: refresh })
  const groups = groupsQuery.data?.data?.items ?? []
  const contentTasks = tasksQuery.data?.data?.items ?? []
  const total = groupsQuery.data?.data?.total ?? 0
  const stats = statsQuery.data?.data
  const detail = detailQuery.data?.data
  const scoreData = useMemo(() => Object.entries(stats?.score_distribution ?? {}).map(([range, count]) => ({ range, count })), [stats])
  const statusData = useMemo(() => Object.entries(stats?.status_distribution ?? {}).map(([name, value]) => ({ name, value })), [stats])
  const current = detail?.current_content
  const preview = parseContentPreview(current?.body)
  const leftVersion = leftVersionId ? versions.find(version => version.content_id === leftVersionId) ?? null : null
  const rightVersion = rightVersionId ? versions.find(version => version.content_id === rightVersionId) ?? null : null
  const compareRows = leftVersion && rightVersion ? getCompareRows(leftVersion, rightVersion) : []
  const updateTaskFilter = (taskId: string) => {
    const next = new URLSearchParams(searchParams)
    if (taskId) next.set('task', taskId)
    else next.delete('task')
    next.delete('group')
    setPage(1)
    setSearchParams(next)
  }
  const overallScore = getOverallScore(current)
  const copyContent = async (content: ContentResultItem | null | undefined) => {
    await navigator.clipboard?.writeText(getContentCopyText(content))
    setCopyNotice('复制成功，可直接粘贴发布')
    if (copyNoticeTimer.current) window.clearTimeout(copyNoticeTimer.current)
    copyNoticeTimer.current = window.setTimeout(() => setCopyNotice(''), 2200)
  }

  const startOptimize = (contentId: string) => optimize.mutate({
    request_id: `req_opt_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
    source_content_ids: [contentId],
    instruction,
    quality: {
      route_strategy: 'AUTO',
      threshold: 85,
      enable_evaluation: true,
      enable_auto_optimize: false,
      max_iteration: 0,
    },
    image_generation: { mode: 'KEEP' },
  })

  const kpis = [
    { label: '总内容数', value: stats?.total_groups ?? 0, hint: '按逻辑内容组统计', icon: FileText },
    { label: '今日新增', value: stats?.today_new_groups ?? 0, hint: '今日新建内容组', icon: TrendingUp },
    { label: '平均评分', value: stats?.average_current_score ?? '—', hint: '仅统计当前版本', icon: Star },
    { label: '已优化', value: stats?.optimized_groups ?? 0, hint: '拥有历史版本的内容组', icon: Sparkles },
    { label: '已归档', value: stats?.archived_groups ?? 0, hint: '软归档内容', icon: Archive },
  ]

  return <div className="page">
    {copyNotice && <div className="copy-toast" role="alert">{copyNotice}</div>}
    <div className="page-heading"><div><h1 className="page-title">内容列表</h1><p className="page-subtitle">每行代表一个内容组，当前版本与历史版本始终保留</p></div></div>
    <div className="kpi-grid">{kpis.map(item => <div className="card kpi-card" key={item.label}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="kpi-label">{item.label}</span><item.icon size={17} color="var(--primary)" /></div><div className="kpi-value">{item.value}</div><div className="kpi-hint">{item.hint}</div></div>)}</div>
    <div className="card toolbar"><select className="select" aria-label="来源任务" value={taskFilter} onChange={event => updateTaskFilter(event.target.value)}><option value="">全部来源任务</option>{contentTasks.map(task => <option value={task.task_id} key={task.task_id}>{task.task_name} · {task.content_count} 条</option>)}</select><select className="select" value={platform} onChange={e => { setPlatform(e.target.value); setPage(1) }}><option value="">全部平台</option>{PLATFORMS.map(p => <option value={p.value} key={p.value}>{p.label}</option>)}</select><select className="select" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="">全部状态</option><option value="ACTIVE">有效</option><option value="ARCHIVED">已归档</option></select><input className="field" type="number" min="0" max="100" value={scoreMin} onChange={e => setScoreMin(e.target.value)} placeholder="最低分" /><input className="field" type="number" min="0" max="100" value={scoreMax} onChange={e => setScoreMax(e.target.value)} placeholder="最高分" /><div style={{ position: 'relative' }}><Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#9aa2b3' }} /><input className="field search-field" style={{ paddingLeft: 30 }} value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1) }} placeholder="搜索标题、正文或 ID" /></div></div>
    <div>
      <section className="card"><div className="table-wrap">{groupsQuery.isLoading ? <div className="empty-state"><Loader2 size={28} /><div>加载内容...</div></div> : groups.length === 0 ? <div className="empty-state"><Layers3 size={36} /><div>暂无符合条件的内容</div></div> : <table className="data-table content-table"><thead><tr><th>内容 ID</th><th>标题</th><th>平台</th><th>来源任务</th><th>当前版本</th><th>历史版本</th><th>评分</th><th>状态</th><th>更新时间</th></tr></thead><tbody>{groups.map((group: ContentGroupDetail) => <tr key={group.content_group_id} className={selectedId === group.content_group_id ? 'is-selected' : ''} tabIndex={0} onClick={() => selectContent(group.content_group_id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectContent(group.content_group_id) } }}><td>{group.content_group_id}</td><td><div className="content-title-cell"><b>{group.current_content?.title || '无标题'}</b>{group.current_content && <button type="button" className="icon-button content-copy-button" aria-label={`复制内容 ${group.current_content.title || '无标题'}`} onClick={event => { event.stopPropagation(); copyContent(group.current_content) }} onKeyDown={event => event.stopPropagation()}><Copy size={13} /></button>}</div></td><td>{getPlatformLabel(group.platform)}</td><td>{group.root_task_id}</td><td>v{group.current_version_no}</td><td>{historyCount(group.version_count)} 个</td><td>{group.current_content?.score != null ? <span className={group.current_content.score >= 80 ? 'badge green' : 'badge orange'}>{group.current_content.score}</span> : '—'}</td><td><span className={`badge ${group.status === 'ACTIVE' ? 'green' : 'red'}`}>{group.status === 'ACTIVE' ? (group.version_count > 1 ? '已优化' : '有效') : '已归档'}</span></td><td>{group.updated_at ? new Date(group.updated_at).toLocaleString('zh-CN') : '-'}</td></tr>)}</tbody></table>}</div><div className="pagination"><div className="pagination-size"><span>每页</span><select className="select" aria-label="每页条数" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>{PAGE_SIZES.map(s => <option value={s} key={s}>{s}</option>)}</select><span>条</span></div><div className="pagination-pages"><button disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button><button className="is-active">{page}</button><button disabled={page * pageSize >= total} onClick={() => setPage(page + 1)}>›</button></div></div></section>
      <DetailModal open={!!selectedId} title="内容详情" onClose={closeContent} size="content">{detailQuery.isLoading ? <div className="empty-state"><Loader2 size={28} /></div> : detail ? <div className="content-detail-layout">
        <section className="content-hero">
          <div>
            <h3>{current?.title || '无标题'}</h3>
            <span className="badge green">{detail.status === 'ACTIVE' ? '有效' : '已归档'}</span>
            <div className="content-hero-meta"><span>小红书</span><i /><span>{current?.model_name || '—'}</span><i /><span>v{detail.current_version_no} / 共 {detail.version_count} 个版本</span></div>
          </div>
          <div className="score-hero-card"><div className="score-shield"><ShieldCheck size={30} /></div><div><span>综合评分</span><b>{overallScore}</b><em>/100</em></div></div>
        </section>

        <section className="content-detail-grid">
          <article className="content-panel content-preview-panel">
            <h4><FileText size={15} />内容预览</h4>
            <p className="content-preview">{preview.body || '暂无正文'}</p>
            {preview.hashtags.length > 0 && <div className="content-hashtags">{preview.hashtags.map(tag => <span className="badge purple" key={tag}>#{tag}</span>)}</div>}
            {preview.summary && <div className="content-summary">{preview.summary}</div>}
          </article>

          <aside className="content-side-stack">
            <section className="content-panel">
              <h4><Info size={15} />基础信息</h4>
              <dl className="detail-meta rich-meta"><dt>内容 ID</dt><dd>{detail.content_group_id}<Copy size={13} /></dd><dt>当前版本</dt><dd>v{detail.current_version_no}</dd><dt>历史版本</dt><dd>{historyCount(detail.version_count)} 个</dd><dt>平台</dt><dd>{getPlatformLabel(detail.platform)}</dd><dt>模型</dt><dd>{current?.model_name || '—'}</dd></dl>
            </section>
            <section className="content-panel score-panel">
              <h4><ShieldCheck size={15} />内容评分</h4>
              <div className="score-inline"><span>综合评分</span><b>{overallScore}</b><em>/100</em></div>
              <ScoreRows current={current} />
            </section>
          </aside>
        </section>

        {versions.length > 1 && <section className="content-panel version-compare">
          <div className="version-compare-title"><GitCompare size={14} /><h4>{getVersionLabel(leftVersion)} 对比 {getVersionLabel(rightVersion)}</h4><span>{compareRows.length} 处差异</span></div>
          <div className="version-picker-row"><label>版本 A<select className="select" aria-label="选择版本 A" value={leftVersionId ?? ''} onChange={event => setLeftVersionId(event.target.value)}>{versions.map(version => <option key={version.content_id} value={version.content_id}>v{version.version_no} · {version.score ?? '未评分'}</option>)}</select></label><label>版本 B<select className="select" aria-label="选择版本 B" value={rightVersionId ?? ''} onChange={event => setRightVersionId(event.target.value)}>{versions.map(version => <option key={version.content_id} value={version.content_id}>v{version.version_no} · {version.score ?? '未评分'}</option>)}</select></label></div>
          {compareRows.length === 0 ? <div className="empty-state compact">两个版本内容一致</div> : <div className="version-compare-list compact">{compareRows.map(row => <div className="version-compare-row" key={row.label}><div className="version-compare-label">{row.label}</div><div className="version-compare-columns"><div><b>{getVersionLabel(leftVersion)}</b><VersionValue value={row.left} /></div><div><b>{getVersionLabel(rightVersion)}</b><VersionValue value={row.right} /></div></div></div>)}</div>}
        </section>}

        <section className="content-panel version-track-panel">
          <h4><GitCompare size={15} />版本轨迹</h4>
          <div className="version-track-list">{versions.map(version => {
            const isLeft = version.content_id === leftVersionId
            const isRight = version.content_id === rightVersionId
            const isCurrent = version.content_id === current?.content_id
            return <div className={`version-track-item ${isLeft || isRight ? 'is-selected' : ''}`} key={version.content_id}><div className="version-track-dot" /><div className="version-track-card"><div><b>v{version.version_no} · {version.score ?? '未评分'}</b>{isCurrent && <span className="badge purple">当前</span>}{isLeft && <span className="badge green">A</span>}{isRight && <span className="badge orange">B</span>}<p>{version.created_at ? new Date(version.created_at).toLocaleString('zh-CN') : ''}</p></div><div className="version-actions"><button className="button" onClick={() => setLeftVersionId(version.content_id)}><GitCompare size={12} />设为版本 A</button><button className="button" onClick={() => setRightVersionId(version.content_id)}><GitCompare size={12} />设为版本 B</button><button className="button" onClick={() => startOptimize(version.content_id)} disabled={optimize.isPending}><Wand2 size={12} />从此版本优化</button></div></div></div>
          })}</div>
        </section>

        <section className="content-optimize-panel">
          <h4><Sparkles size={15} />优化要求</h4>
          <div className="textarea-wrap"><textarea className="textarea" maxLength={500} value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="请输入优化要求，例如：标题更抓眼，正文更口语化，减少营销感..." /><span>{instruction.length} / 500</span></div>
        </section>

        <div className="detail-modal-actions content-footer-actions"><button className="button danger" disabled={detail.status === 'ARCHIVED'} onClick={() => archive.mutate(detail.content_group_id)}><Archive size={12} />归档</button>{current && <button className="button primary" onClick={() => startOptimize(current.content_id)} disabled={optimize.isPending}><Wand2 size={12} />优化当前版本</button>}</div>
      </div> : <div className="empty-state"><XCircle size={32} />内容详情加载失败</div>}</DetailModal>
    </div>
    <div className="chart-grid"><section className="card chart-card"><div className="card-header">内容状态分布</div><div className="card-body"><ResponsiveContainer><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72}>{statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></section><section className="card chart-card"><div className="card-header">评分分布</div><div className="card-body"><ResponsiveContainer><BarChart data={scoreData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="range" tick={{ fontSize: 9 }} /><YAxis hide /><Tooltip /><Bar dataKey="count" fill="#665cf6" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></section><section className="card chart-card"><div className="card-header">近 30 日新增趋势</div><div className="card-body"><ResponsiveContainer><LineChart data={stats?.daily_trend ?? []}><XAxis dataKey="date" tick={{ fontSize: 9 }} /><YAxis hide /><Tooltip /><Line type="monotone" dataKey="count" stroke="#665cf6" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></section></div>
  </div>
}
