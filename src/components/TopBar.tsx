// ============================================================================
// 顶部栏 - 侧栏开关 + 健康状态 + 标题
// ============================================================================
import { PanelLeft, Circle, Bell, HelpCircle, Search } from 'lucide-react'
import { useLocation } from 'react-router'
import { useAppStore } from '../stores/useAppStore'
import { useHealth } from '../hooks/useQueries'

export function TopBar() {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const { data: health } = useHealth()
  const location = useLocation()
  const isOk = health?.data?.status === 'ok'

  return (
    <header className="topbar">
      <button
        onClick={toggleSidebar}
        className="icon-button"
        title="切换侧栏"
      >
        <PanelLeft size={20} color="#6b7280" />
      </button>

      <span className="breadcrumb">首页 <b>/</b> {location.pathname === '/' ? '新建任务' : location.pathname.startsWith('/tasks') ? '任务队列' : location.pathname.startsWith('/content') ? '内容列表' : '系统管理'}</span>
      <div className="topbar-spacer" />
      <button className="icon-button" aria-label="搜索"><Search size={18} /></button>
      <button className="icon-button" aria-label="通知"><Bell size={18} /></button>
      <button className="icon-button" aria-label="帮助"><HelpCircle size={18} /></button>

      {/* 健康状态指示器 */}
      <div className="health-pill">
        <Circle
          size={8}
          fill={isOk ? '#10b981' : '#ef4444'}
          stroke={isOk ? '#10b981' : '#ef4444'}
        />
        {isOk ? '系统正常' : health?.data ? '部分异常' : '检测中...'}
      </div>
      <div className="user-chip"><span>AI</span><b>AI-Admin<small>超级管理员</small></b></div>
    </header>
  )
}
