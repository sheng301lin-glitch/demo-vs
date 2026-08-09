// ============================================================================
// Zustand 全局状态 - 管理 UI 状态（主题、侧栏、轮询开关等）
// ============================================================================
import { create } from 'zustand'

interface AppState {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  // 自动刷新开关
  autoRefresh: boolean
  setAutoRefresh: (v: boolean) => void
  // 当前选中的任务 ID（用于高亮）
  selectedTaskId: string | null
  setSelectedTaskId: (id: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  autoRefresh: true,
  setAutoRefresh: (v) => set({ autoRefresh: v }),
  selectedTaskId: null,
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
}))
