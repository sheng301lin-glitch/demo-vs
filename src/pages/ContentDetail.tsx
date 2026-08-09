// ============================================================================
// 内容详情页 - 版本对比 + 优化
// 默认展示当前版本，可选择一个旧版本进行 side-by-side 对比。
// 优化操作会创建一个新版本并跳转到对比视图。
// ============================================================================
import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import { ArrowLeft, Loader2, Wand2, Clock, Star, Hash, ExternalLink, GitCompare, ArrowRightLeft, CheckCircle2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchContentGroupDetail,
  fetchContentVersions,
  createOptimizeTask,
  fetchTaskDetail,
} from '../api/endpoints'
import type { ContentResultItem } from '../types'
import { PLATFORMS } from '../types'

// ── JSON body 解析工具 ──
function parseBodyJson(body: string): Record<string, unknown> {
  try { return JSON.parse(body) } catch { return { body } }
}

function getBodyText(content: ContentResultItem | null | undefined): string {
  if (!content?.body) return ''
  const parsed = parseBodyJson(content.body)
  return String(parsed.body || content.body || '')
}

function getHashtags(content: ContentResultItem | null | undefined): string[] {
  if (!content?.body) return []
  try {
    const parsed = JSON.parse(content.body)
    return Array.isArray(parsed.hashtags) ? parsed.hashtags : []
  } catch { return [] }
}

type JsonDiff = { key: string; label: string; old: unknown; next: unknown }[]

// ── 计算两个版本的差异 ──
function computeDiff(
  leftBody: string | undefined,
  rightBody: string | undefined
): JsonDiff {
  const left = leftBody ? parseBodyJson(leftBody) : {}
  const right = rightBody ? parseBodyJson(rightBody) : {}
  const allKeys = new Set([...Object.keys(left), ...Object.keys(right)])
  const diffs: JsonDiff = []
  for (const key of allKeys) {
    const lv = JSON.stringify(left[key] ?? null)
    const rv = JSON.stringify(right[key] ?? null)
    if (lv !== rv) {
      diffs.push({
        key,
        label: key === 'body' ? '正文' : key === 'title' ? '标题' : key === 'hashtags' ? '标签' : key,
        old: left[key],
        next: right[key],
      })
    }
  }
  return diffs
}

// ── 页面组件 ──

export function ContentDetailPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: groupResp, isLoading } = useQuery({
    queryKey: ['contentGroup', groupId],
    queryFn: () => fetchContentGroupDetail(groupId!),
    enabled: !!groupId,
  })

  const { data: versionsResp, refetch: refetchVersions } = useQuery({
    queryKey: ['contentVersions', groupId],
    queryFn: () => fetchContentVersions(groupId!),
    enabled: !!groupId,
  })

  const group = groupResp?.data
  const allVersions: ContentResultItem[] = versionsResp?.data ?? []

  // 当前版本（最新）
  const currentVersion = allVersions.length > 0 ? allVersions[0] : null
  // 对比模式：用户选择一个旧版本
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null)
  const compareVersion = compareVersionId
    ? allVersions.find((v) => v.content_id === compareVersionId) ?? null
    : null

  // ?compare=1 时自动开启对比模式，选中上一个版本
  useEffect(() => {
    if (searchParams.get('compare') === '1' && allVersions.length > 1) {
      setCompareVersionId(allVersions[1].content_id)
      // 清除 query param 避免重复触发
      const next = new URLSearchParams(searchParams)
      next.delete('compare')
      setSearchParams(next, { replace: true })
    }
  }, [allVersions, searchParams, setSearchParams])

  const isComparing = compareVersion !== null

  // 优化 toast 状态
  const [optimizeToast, setOptimizeToast] = useState<{
    show: boolean; taskId: string; contentId: string;
  } | null>(null)

  // 优化弹窗状态
  const [optimizeModal, setOptimizeModal] = useState(false)
  const [optimizeInstruction, setOptimizeInstruction] = useState('')

  const diff = useMemo(() => {
    if (!currentVersion || !compareVersion) return []
    return computeDiff(currentVersion.body, compareVersion.body)
  }, [currentVersion, compareVersion])

  const optimizeMut = useMutation({
    mutationFn: createOptimizeTask,
    onSuccess: (result) => {
      const taskId = result?.data?.task_id
      const contentId = currentVersion?.content_id
      if (taskId && contentId) {
        setOptimizeToast({ show: true, taskId, contentId })
      }
    },
  })

  const openOptimizeModal = () => {
    if (!currentVersion?.content_id) return
    setOptimizeInstruction('')
    setOptimizeModal(true)
  }

  const handleOptimize = () => {
    if (!currentVersion?.content_id) return
    const contentId = currentVersion.content_id
    setOptimizeModal(false)
    optimizeMut.mutate({
      request_id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      source_content_ids: [contentId],
      instruction: optimizeInstruction,
      quality: {
        route_strategy: 'AUTO', threshold: 80,
        enable_evaluation: true, enable_auto_optimize: true,
        max_iteration: 2,
      },
      image_generation: {},
    })
  }

  // 轮询优化任务状态，完成后刷新版本列表并开启对比
  const { data: optimizeTaskResp } = useQuery({
    queryKey: ['taskDetail', optimizeToast?.taskId],
    queryFn: () => fetchTaskDetail(optimizeToast!.taskId),
    enabled: !!optimizeToast?.taskId,
    refetchInterval: (query) => {
      const task = query.state.data?.data
      if (!task) return 3000
      return ['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED'].includes(task.status) ? false : 3000
    },
  })

  // 优化任务完成时刷新版本并开启对比
  useEffect(() => {
    const task = optimizeTaskResp?.data
    if (!task || !optimizeToast) return
    if (['SUCCESS', 'PARTIAL_SUCCESS'].includes(task.status)) {
      refetchVersions().then((result) => {
        const versions: ContentResultItem[] = result.data?.data ?? []
        if (versions.length > 1) {
          setCompareVersionId(versions[1].content_id)
        }
        setOptimizeToast(null)
      })
    } else if (['FAILED', 'CANCELLED'].includes(task.status)) {
      setOptimizeToast(null)
    }
  }, [optimizeTaskResp])

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!group) {
    return <div style={{ textAlign: 'center', padding: 80, color: '#ef4444' }}>内容不存在</div>
  }

  const getPlatformLabel = (p: string) => PLATFORMS.find((x) => x.value === p)?.label || p

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* 返回 */}
      <button onClick={() => navigate(-1)} style={backBtn}>
        <ArrowLeft size={16} /> 返回
      </button>

      {/* 优化任务 Toast */}
      {optimizeToast?.show && (() => {
        const taskData = optimizeTaskResp?.data
        const progress = taskData?.progress ?? 0
        const statusLabel = taskData?.status === 'RUNNING' ? '执行中' : '处理中'
        return (
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: '#eef2ff', border: '1px solid #6366f1',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
            <span style={{ flex: 1, fontSize: 13, color: '#3730a3' }}>
              优化任务{statusLabel}... {progress}%
            </span>
            <button
              onClick={() => navigate(`/tasks/${optimizeToast.taskId}`)}
              style={{
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid #6366f1', background: '#fff',
                color: '#6366f1', cursor: 'pointer', fontSize: 12,
              }}
            >
              查看
            </button>
            <button
              onClick={() => setOptimizeToast(null)}
              style={{
                padding: '4px 6px', borderRadius: 6,
                border: 'none', background: 'transparent',
                color: '#9ca3af', cursor: 'pointer', fontSize: 14, lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: '#c7d2fe', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2, background: '#6366f1',
              width: `${progress}%`, transition: 'width 0.5s',
            }} />
          </div>
        </div>
        )
      })()}

      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
            {currentVersion?.title || group.current_content?.title || '(无标题)'}
          </h1>
          <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#6b7280', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>平台: {getPlatformLabel(group.platform)}</span>
            <span>版本: {group.current_version_no} / {group.version_count} 历史</span>
            {currentVersion?.score != null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Star size={12} color="#f59e0b" fill="#f59e0b" /> {currentVersion.score}</span>
            )}
            {currentVersion?.model_name && (
              <span>{currentVersion.provider}/{currentVersion.model_name}</span>
            )}
            <span>创建: {currentVersion?.created_at ? new Date(currentVersion.created_at).toLocaleString('zh-CN') : '-'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {allVersions.length > 1 && (
            <button
              onClick={() => setCompareVersionId(isComparing ? null : (allVersions[1]?.content_id ?? null))}
              style={{
                ...actionBtn, background: '#fff', color: isComparing ? '#6366f1' : '#6b7280',
                borderColor: isComparing ? '#6366f1' : '#d1d5db',
              }}
            >
              {isComparing ? <GitCompare size={14} /> : <ArrowRightLeft size={14} />}
              {isComparing ? '退出对比' : '对比版本'}
            </button>
          )}
          <button
            onClick={openOptimizeModal}
            disabled={!currentVersion?.content_id || optimizeMut.isPending}
            style={{
              ...actionBtn,
              background: currentVersion?.content_id ? '#6366f1' : '#d1d5db',
              color: '#fff', borderColor: 'transparent',
              cursor: currentVersion?.content_id ? 'pointer' : 'not-allowed',
            }}
          >
            <Wand2 size={14} />
            {optimizeMut.isPending ? '提交中...' : '优化此内容'}
          </button>
        </div>
      </div>

      {/* 对比模式：选择旧版本对比 */}
      {isComparing && (
        <div style={{ ...card, borderColor: '#6366f1', background: '#f8f9ff', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>
              <GitCompare size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              版本对比：当前 (v{currentVersion?.version_no}) vs
              <select
                value={compareVersionId ?? ''}
                onChange={(e) => setCompareVersionId(e.target.value || null)}
                style={versionSelect}
              >
                {allVersions.filter((v) => v.content_id !== currentVersion?.content_id).map((v) => (
                  <option key={v.content_id} value={v.content_id}>v{v.version_no} — {v.created_at ? new Date(v.created_at).toLocaleString('zh-CN') : ''}</option>
                ))}
              </select>
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>共 {diff.length} 处差异</span>
          </div>

          {/* 差异列表 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {diff.map((d) => (
              <div key={d.key} style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '6px 12px', background: '#f9fafb', fontSize: 11, fontWeight: 600, color: '#6366f1' }}>
                  {d.label}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ padding: '12px', borderRight: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>当前 v{currentVersion?.version_no}</div>
                    {d.key === 'hashtags' && Array.isArray(d.next) ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(d.next as string[]).map((t, i) => (
                          <span key={i} style={tagBadge}>#{t}</span>
                        ))}
                      </div>
                    ) : (
                      <pre style={diffPre}>{String(d.next || '')}</pre>
                    )}
                  </div>
                  <div style={{ padding: '12px', background: '#fffbf0' }}>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>旧版 v{compareVersion?.version_no}</div>
                    {d.key === 'hashtags' && Array.isArray(d.old) ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(d.old as string[]).map((t, i) => (
                          <span key={i} style={{ ...tagBadge, background: '#fef3c7', color: '#92400e' }}>#{t}</span>
                        ))}
                      </div>
                    ) : (
                      <pre style={{ ...diffPre, color: '#92400e' }}>{String(d.old || '')}</pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {diff.length === 0 && (
              <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 16 }}>两个版本完全相同</p>
            )}
          </div>
        </div>
      )}

      {/* 当前内容展示（非对比模式） */}
      {!isComparing && currentVersion && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 12 }}>正文</div>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', whiteSpace: 'pre-wrap' }}>
            {getBodyText(currentVersion)}
          </div>
          {getHashtags(currentVersion).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>标签</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {getHashtags(currentVersion).map((tag, i) => (
                  <span key={i} style={tagBadge}>#{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 版本历史 */}
      {allVersions.length > 1 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 12 }}>
            <Clock size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            版本历史 ({allVersions.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {allVersions.map((v, idx) => {
              const isCurrent = idx === 0
              return (
                <div
                  key={v.content_id}
                  onClick={() => {
                    if (!isCurrent) {
                      setCompareVersionId(isComparing && compareVersionId === v.content_id ? null : v.content_id)
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 12px', borderRadius: 8,
                    border: isCurrent ? '1px solid #6366f1' : compareVersionId === v.content_id ? '1px solid #8b5cf6' : '1px solid #f3f4f6',
                    background: isCurrent ? '#eef2ff' : compareVersionId === v.content_id ? '#f5f3ff' : '#fff',
                    cursor: isCurrent ? 'default' : 'pointer',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 13, color: isCurrent ? '#6366f1' : '#374151', minWidth: 30 }}>
                    v{v.version_no}
                  </span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{v.model_name}</span>
                  {v.score != null && (
                    <span style={{ fontSize: 12, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Star size={10} fill="#f59e0b" /> {v.score}
                    </span>
                  )}
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    {v.created_at ? new Date(v.created_at).toLocaleString('zh-CN') : '-'}
                  </span>
                  {isCurrent && <span style={{ ...tagBadge, background: '#eef2ff', color: '#6366f1', fontSize: 10 }}>当前</span>}
                  {!isCurrent && compareVersionId === v.content_id && (
                    <span style={{ ...tagBadge, background: '#f5f3ff', color: '#8b5cf6', fontSize: 10 }}>对比中</span>
                  )}
                  {!isCurrent && compareVersionId !== v.content_id && (
                    <span style={{ fontSize: 10, color: '#d1d5db' }}>点击对比</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 优化弹窗 */}
      {optimizeModal && (
        <div
          onClick={() => setOptimizeModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.4)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, padding: '24px 28px',
              width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              <Wand2 size={16} style={{ marginRight: 8, verticalAlign: 'middle', color: '#6366f1' }} />
              优化此内容
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              描述你希望如何优化这篇内容，例如：改得更活泼、增加产品卖点、缩短篇幅等。
            </p>
            <textarea
              value={optimizeInstruction}
              onChange={(e) => setOptimizeInstruction(e.target.value)}
              placeholder="输入优化需求（可选）..."
              autoFocus
              rows={4}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
                resize: 'vertical', lineHeight: 1.6,
                boxSizing: 'border-box',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleOptimize()
                }
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setOptimizeModal(false)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db',
                  background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280',
                }}
              >
                取消
              </button>
              <button
                onClick={handleOptimize}
                disabled={optimizeMut.isPending}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: '#6366f1', cursor: 'pointer', fontSize: 13,
                  color: '#fff', fontWeight: 500,
                }}
              >
                {optimizeMut.isPending ? '提交中...' : '确认优化'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 样式 ──

const card: React.CSSProperties = {
  padding: '20px 24px', borderRadius: 12, border: '1px solid #e5e7eb',
  background: '#fff', marginBottom: 16,
}

const backBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 13, color: '#6b7280', marginBottom: 16, padding: 0,
}

const actionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8,
  border: '1px solid #d1d5db', cursor: 'pointer',
  fontSize: 13, fontWeight: 500,
}

const versionSelect: React.CSSProperties = {
  marginLeft: 8, padding: '2px 8px', borderRadius: 6,
  border: '1px solid #6366f1', fontSize: 12, outline: 'none',
  background: '#fff', color: '#6366f1',
}

const diffPre: React.CSSProperties = {
  margin: 0, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap',
  wordBreak: 'break-word', color: '#374151', maxHeight: 200, overflow: 'auto',
}

const tagBadge: React.CSSProperties = {
  display: 'inline-block', padding: '2px 10px', borderRadius: 20,
  fontSize: 11, background: '#eef2ff', color: '#4f46e5',
}
