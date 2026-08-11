import { useMemo, useState } from 'react'
import { Controller, useForm, type FieldErrors, type Resolver } from 'react-hook-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { CalendarClock, FileUp, Loader2, Minus, Plus, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { createGenerateTask, estimateTask, fetchHealth, fetchMaterials, uploadMaterial } from '../api/endpoints'
import { CONFIDENCE_MAP, EXECUTION_MODE_MAP, PLATFORMS, PRIORITY_MAP } from '../types'
import { formatCompactNumber, formatDuration } from '../utils/dashboard'

const schema = z.object({
  task_name: z.string().trim().min(1, '请输入任务名称').max(160),
  platform: z.string().min(1), generate_count: z.number().min(1).max(100),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']), content_direction: z.string().min(1, '请输入内容方向'),
  target_audience: z.string(), tone_style: z.string(), content_goal: z.string(), additional_instruction: z.string(),
  keywords: z.array(z.string()), banned_words: z.array(z.string()), material_ids: z.array(z.string()), file_refs: z.array(z.string()),
  quality_threshold: z.number().min(0).max(100), enable_evaluation: z.boolean(), enable_auto_optimize: z.boolean(), max_iteration: z.number().min(0).max(10),
  image_enabled: z.boolean(), image_count: z.number().min(1).max(10), image_aspect_ratio: z.string(),
  execution_mode: z.enum(['IMMEDIATE', 'QUEUE', 'SCHEDULED']), scheduled_at: z.string(),
})
type FormData = z.infer<typeof schema>

const formResolver: Resolver<FormData> = async (values) => {
  const parsed = schema.safeParse(values)
  if (parsed.success) return { values: parsed.data, errors: {} }
  const errors = Object.fromEntries(parsed.error.issues.map(issue => {
    const field = String(issue.path[0])
    return [field, { type: issue.code, message: issue.message }]
  })) as FieldErrors<FormData>
  return { values: {}, errors }
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (value: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('')
  const add = () => { const next = input.trim(); if (next && !value.includes(next)) onChange([...value, next]); setInput('') }
  return <div><div style={{ display: 'flex', gap: 7 }}><input className="field" value={input} placeholder={placeholder} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} /><button className="button" type="button" onClick={add}><Plus size={14} /></button></div><div className="tags">{value.map(tag => <span className="tag" key={tag}>{tag}<button type="button" onClick={() => onChange(value.filter(item => item !== tag))}><X size={11} /></button></span>)}</div></div>
}

export function GeneratorPage() {
  const navigate = useNavigate()
  const [notice, setNotice] = useState<string | null>(null)
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: formResolver,
    defaultValues: { task_name: '', platform: 'XHS', generate_count: 10, priority: 'NORMAL', content_direction: '', target_audience: '', tone_style: '', content_goal: '', additional_instruction: '', keywords: [], banned_words: [], material_ids: [], file_refs: [], quality_threshold: 80, enable_evaluation: true, enable_auto_optimize: true, max_iteration: 2, image_enabled: false, image_count: 1, image_aspect_ratio: 'AUTO', execution_mode: 'IMMEDIATE', scheduled_at: '' },
  })
  const values = watch()
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, refetchInterval: 30_000 })
  const materials = useQuery({ queryKey: ['materials'], queryFn: () => fetchMaterials({ size: 100 }) })
  const estimate = useQuery({ queryKey: ['taskEstimate', values.generate_count, values.platform], queryFn: () => estimateTask({ generate_count: values.generate_count, platform: values.platform }), enabled: values.generate_count > 0, staleTime: 30_000 })
  const upload = useMutation({
    mutationFn: (file: File) => uploadMaterial(file, values.platform),
    onSuccess: result => {
      if (result.data) {
        setValue('material_ids', [...values.material_ids, result.data.material_id])
        if (result.data.file_ref) setValue('file_refs', [...values.file_refs, result.data.file_ref])
        materials.refetch()
      }
    },
  })
  const create = useMutation({ mutationFn: createGenerateTask, onSuccess: result => { if (result.data?.task_id) navigate(`/tasks?task=${encodeURIComponent(result.data.task_id)}`) }, onError: () => setNotice('任务创建失败，请检查服务状态后重试。') })
  const estimateData = estimate.data?.data
  const selectedMaterials = useMemo(() => materials.data?.data?.items.filter(item => values.material_ids.includes(item.material_id)) ?? [], [materials.data, values.material_ids])

  const submit = (data: FormData) => create.mutate({
    request_id: `req_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`, task_name: data.task_name, platform: data.platform, generate_count: data.generate_count, priority: data.priority,
    requirement: { content_direction: data.content_direction, target_audience: data.target_audience, tone_style: data.tone_style, keywords: data.keywords, banned_words: data.banned_words, content_goal: data.content_goal, additional_instruction: data.additional_instruction },
    resources: { material_ids: data.material_ids, file_refs: data.file_refs },
    quality: { route_strategy: 'AUTO', threshold: data.quality_threshold, enable_evaluation: data.enable_evaluation, enable_auto_optimize: data.enable_auto_optimize, max_iteration: data.max_iteration },
    image_generation: { enabled: data.image_enabled, count_per_content: data.image_count, aspect_ratio: data.image_aspect_ratio, style_prompt: null, route_strategy: 'AUTO', failure_policy: 'ALLOW_TEXT_SUCCESS' },
    execution: { mode: data.execution_mode, scheduled_at: data.execution_mode === 'SCHEDULED' && data.scheduled_at ? new Date(data.scheduled_at).toISOString() : null },
  })

  return <div className="page">
    <div className="page-heading"><div><h1 className="page-title">新建任务</h1><p className="page-subtitle">配置生成要求、素材、质量策略和执行方式</p></div><span className={`badge ${health.data?.data?.status === 'ok' ? 'green' : 'red'}`}>{health.data?.data?.status === 'ok' ? '运行服务正常' : '运行服务不可用'}</span></div>
    {notice && <div className="card" style={{ padding: 12, color: 'var(--red)', marginBottom: 10 }}>{notice}</div>}
    <form className="form-layout" onSubmit={handleSubmit(submit)}>
      <div className="form-stack">
        <section className="card form-section"><h2 className="section-title"><span className="section-index">1</span>基础信息</h2><div className="form-grid">
          <div className="form-field"><label>任务名称 <span className="required">*</span></label><input className="field" placeholder="请输入任务名称，最多 160 字" {...register('task_name')} />{errors.task_name && <div className="error-text">{errors.task_name.message}</div>}</div>
          <div className="form-field"><label>平台 <span className="required">*</span></label><select className="select" {...register('platform')}>{PLATFORMS.map(p => <option value={p.value} key={p.value}>{p.label}</option>)}</select></div>
          <div className="form-field"><label>生成数量</label><div style={{ display: 'flex' }}><button type="button" className="button" onClick={() => setValue('generate_count', Math.max(1, values.generate_count - 1))}><Minus size={13} /></button><input className="field" type="number" {...register('generate_count', { valueAsNumber: true })} style={{ textAlign: 'center' }} /><button type="button" className="button" onClick={() => setValue('generate_count', Math.min(100, values.generate_count + 1))}><Plus size={13} /></button></div></div>
          <div className="form-field"><label>内容方向 <span className="required">*</span></label><input className="field" placeholder="如：夏季护肤" {...register('content_direction')} />{errors.content_direction && <div className="error-text">{errors.content_direction.message}</div>}</div>
          <div className="form-field"><label>优先级</label><select className="select" {...register('priority')}><option value="LOW">低</option><option value="NORMAL">普通</option><option value="HIGH">高</option></select></div>
        </div></section>
        <section className="card form-section"><h2 className="section-title"><span className="section-index">2</span>需求配置</h2><div className="form-grid cols-2">
          <div className="form-field"><label>目标人群</label><input className="field" placeholder="如：20-30 岁女性" {...register('target_audience')} /></div><div className="form-field"><label>语气风格</label><input className="field" placeholder="真实、轻松、种草感" {...register('tone_style')} /></div>
          <div className="form-field"><label>关键词</label><Controller name="keywords" control={control} render={({ field }) => <TagInput value={field.value} onChange={field.onChange} placeholder="输入后按回车添加" />} /></div><div className="form-field"><label>禁用词</label><Controller name="banned_words" control={control} render={({ field }) => <TagInput value={field.value} onChange={field.onChange} placeholder="输入后按回车添加" />} /></div>
          <div className="form-field"><label>内容目标</label><input className="field" placeholder="提升收藏与互动" {...register('content_goal')} /></div><div className="form-field"><label>补充说明</label><input className="field" placeholder="避免夸大功效" {...register('additional_instruction')} /></div>
        </div></section>
        <section className="card form-section"><h2 className="section-title"><span className="section-index">3</span>素材与文件</h2><div className="form-grid cols-2">
          <div className="form-field">
            <label>上传文件</label>
            <label className="dropzone"><FileUp size={22} /><div>{upload.isPending ? '正在上传解析...' : '点击选择文件上传'}</div><small>PDF / DOCX / TXT / CSV / JSON，最大 50MB</small><input hidden type="file" accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={e => { const file = e.target.files?.[0]; if (file) upload.mutate(file) }} /></label>
            <div className="help">{upload.isSuccess ? '✓ 上传成功' : upload.isError ? '✗ 上传失败，请重试' : ''}</div>
          </div>
          <div className="form-field">
            <label>已选素材</label>
            <select className="select" value="" onChange={e => { if (e.target.value && !values.material_ids.includes(e.target.value)) setValue('material_ids', [...values.material_ids, e.target.value]) }}><option value="">从素材库添加</option>{materials.data?.data?.items.filter(item => !values.material_ids.includes(item.material_id)).map(item => <option value={item.material_id} key={item.material_id}>{item.title}</option>)}</select>
            <div className="tags">{selectedMaterials.map(item => (<span className="tag" key={item.material_id}>{item.filename || item.title}<button type="button" onClick={() => { setValue('material_ids', values.material_ids.filter(id => id !== item.material_id)); if (item.file_ref) setValue('file_refs', values.file_refs.filter(ref => ref !== item.file_ref)) }}><X size={11} /></button></span>))}</div>
          </div>
        </div></section>
        <section className="card form-section"><h2 className="section-title"><span className="section-index">4</span>模型与质量</h2><div className="form-grid">
          <div className="form-field"><label>质量阈值</label><input className="field" type="number" {...register('quality_threshold', { valueAsNumber: true })} /></div><div className="form-field"><label>最大优化轮数</label><input className="field" type="number" {...register('max_iteration', { valueAsNumber: true })} /></div><div className="form-field"><label>图片比例</label><select className="select" {...register('image_aspect_ratio')}><option value="AUTO">自动</option><option value="3:4">3:4</option><option value="1:1">1:1</option><option value="16:9">16:9</option></select></div>
          <label className="form-field"><span><input type="checkbox" {...register('enable_evaluation')} /> 启用质量评估</span></label><label className="form-field"><span><input type="checkbox" {...register('enable_auto_optimize')} /> 自动优化</span></label><label className="form-field"><span><input type="checkbox" {...register('image_enabled')} /> 同时生成配图</span></label>
        </div></section>
        <section className="card form-section"><h2 className="section-title"><span className="section-index">5</span>执行方式</h2><div className="form-grid">
          {([['IMMEDIATE','立即执行'],['QUEUE','加入队列'],['SCHEDULED','定时执行']] as const).map(([value,label]) => <label className={`card ${values.execution_mode === value ? 'badge purple' : ''}`} style={{ padding: 14, cursor: 'pointer' }} key={value}><input type="radio" value={value} {...register('execution_mode')} /> {label}</label>)}
          {values.execution_mode === 'SCHEDULED' && <div className="form-field wide"><label><CalendarClock size={12} /> 执行时间</label><input className="field" type="datetime-local" {...register('scheduled_at')} /></div>}
        </div></section>
      </div>
      <aside className="sticky-column">
        <section className="card"><div className="card-header">任务摘要 <Sparkles size={15} color="var(--primary)" /></div><div className="card-body"><dl className="summary-list"><dt>任务名称</dt><dd>{values.task_name || '待填写'}</dd><dt>平台</dt><dd>{PLATFORMS.find(p => p.value === values.platform)?.label}</dd><dt>内容方向</dt><dd>{values.content_direction || '待填写'}</dd><dt>生成数量</dt><dd>{values.generate_count} 篇</dd><dt>优先级</dt><dd>{PRIORITY_MAP[values.priority] ?? values.priority}</dd><dt>执行方式</dt><dd>{EXECUTION_MODE_MAP[values.execution_mode] ?? values.execution_mode}</dd><dt>素材</dt><dd>{values.material_ids.length} 项</dd></dl></div></section>
        <section className="card"><div className="card-header">预计资源消耗 <ShieldCheck size={15} color="var(--green)" /></div><div className="card-body"><dl className="summary-list"><dt>预计 Token</dt><dd>{estimateData?.estimated_tokens ? `${formatCompactNumber(estimateData.estimated_tokens.min)}–${formatCompactNumber(estimateData.estimated_tokens.max)}` : '暂无历史数据'}</dd><dt>预计时长</dt><dd>{estimateData?.estimated_duration_seconds ? `${formatDuration(estimateData.estimated_duration_seconds.min * 1000)}–${formatDuration(estimateData.estimated_duration_seconds.max * 1000)}` : '暂无历史数据'}</dd><dt>预计成本</dt><dd>{estimateData?.estimated_cost ? `$${estimateData.estimated_cost.min.toFixed(3)}–$${estimateData.estimated_cost.max.toFixed(3)}` : '暂无定价数据'}</dd><dt>可信度</dt><dd>{CONFIDENCE_MAP[estimateData?.confidence ?? ''] ?? estimateData?.confidence ?? '低'}</dd></dl></div></section>
        <button className="button primary" type="submit" disabled={create.isPending || health.data?.data?.status !== 'ok'}>{create.isPending ? <Loader2 size={15} /> : <Send size={15} />}立即创建</button>
      </aside>
    </form>
  </div>
}
