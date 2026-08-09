// ============================================================================
// 侧栏导航
// ============================================================================
import { NavLink } from 'react-router'
import { Wand2, Settings, Activity, FileText, Layers3, Sparkles } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'

const navGroups = [
  { label: '内容生成', items: [
    { to: '/', label: '新建任务', icon: Wand2 },
    { to: '/tasks', label: '任务队列', icon: FileText },
    { to: '/content', label: '内容列表', icon: Layers3 },
  ] },
  { label: '系统管理', items: [
    { to: '/settings', label: '模型配置', icon: Settings },
    { to: '/health', label: '系统状态', icon: Activity },
  ] },
]

export function Sidebar() {
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen)
  const closeMobileSidebar = () => {
    if (window.matchMedia('(max-width: 760px)').matches) setSidebarOpen(false)
  }

  return (
    <nav className="sidebar-nav">
      <div className="brand">
        <span className="brand-mark"><Sparkles size={18} /></span>
        <span>AI 内容工作台<small>Python Agent Runtime</small></span>
      </div>
      {navGroups.map((group) => <div className="nav-group" key={group.label}>
        <div className="nav-group-label">{group.label}</div>
        {group.items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={closeMobileSidebar} className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}>
            <item.icon size={17} />{item.label}
          </NavLink>
        ))}
      </div>)}
      <div className="sidebar-version">Python Agent Runtime<br />v1.7</div>
    </nav>
  )
}
