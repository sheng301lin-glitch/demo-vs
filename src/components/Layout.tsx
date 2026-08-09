// ============================================================================
// Layout 组件 - 侧栏 + 顶部状态栏 + 内容区
// ============================================================================
import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useAppStore } from '../stores/useAppStore'

export function Layout() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 760px)')
    const syncSidebar = (event: MediaQueryListEvent | MediaQueryList) => setSidebarOpen(!event.matches)
    syncSidebar(mobile)
    mobile.addEventListener('change', syncSidebar)
    return () => mobile.removeEventListener('change', syncSidebar)
  }, [setSidebarOpen])

  return (
    <div className="app-shell">
      {/* 侧栏 */}
      <div className={`app-sidebar ${sidebarOpen ? '' : 'is-collapsed'}`}>
        <Sidebar />
      </div>
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="关闭侧栏" onClick={() => setSidebarOpen(false)} />}

      {/* 右侧主区域 */}
      <div className="app-workspace">
        <TopBar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
