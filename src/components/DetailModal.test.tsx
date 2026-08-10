import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DetailModal } from './DetailModal'

describe('DetailModal', () => {
  it('renders an accessible modal and closes from its close button', () => {
    const onClose = vi.fn()

    render(
      <DetailModal open title="任务详情" onClose={onClose}>
        <p>任务内容</p>
      </DetailModal>,
    )

    expect(screen.getByRole('dialog', { name: '任务详情' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭任务详情' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves focus to the close button when it opens', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()

    render(
      <DetailModal open title="任务详情" onClose={vi.fn()}>
        <p>任务内容</p>
      </DetailModal>,
    )

    expect(screen.getByRole('button', { name: '关闭任务详情' })).toHaveFocus()
    trigger.remove()
  })

  it('restores focus to the trigger when it closes or unmounts', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const onClose = vi.fn()
    const { rerender, unmount } = render(
      <DetailModal open title="任务详情" onClose={onClose}>
        <p>任务内容</p>
      </DetailModal>,
    )

    rerender(
      <DetailModal open={false} title="任务详情" onClose={onClose}>
        <p>任务内容</p>
      </DetailModal>,
    )
    expect(trigger).toHaveFocus()

    rerender(
      <DetailModal open title="任务详情" onClose={onClose}>
        <p>任务内容</p>
      </DetailModal>,
    )
    unmount()
    expect(trigger).toHaveFocus()
    trigger.remove()
  })

  it('keeps Tab and Shift+Tab inside the modal, including a single focusable element', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <DetailModal open title="任务详情" onClose={onClose}>
        <button>继续</button>
      </DetailModal>,
    )
    const closeButton = screen.getByRole('button', { name: '关闭任务详情' })
    const continueButton = screen.getByRole('button', { name: '继续' })

    continueButton.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(closeButton).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(continueButton).toHaveFocus()

    rerender(
      <DetailModal open title="任务详情" onClose={onClose}>
        <p>任务内容</p>
      </DetailModal>,
    )
    closeButton.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(closeButton).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(closeButton).toHaveFocus()
  })

  it('keeps inner focus on callback rerender and uses the latest Escape callback', () => {
    const initialOnClose = vi.fn()
    const latestOnClose = vi.fn()
    const { rerender } = render(
      <DetailModal open title="任务详情" onClose={initialOnClose}>
        <textarea aria-label="备注" />
      </DetailModal>,
    )
    const textarea = screen.getByRole('textbox', { name: '备注' })
    textarea.focus()

    rerender(
      <DetailModal open title="任务详情" onClose={latestOnClose}>
        <textarea aria-label="备注" />
      </DetailModal>,
    )

    expect(screen.getByRole('textbox', { name: '备注' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(initialOnClose).not.toHaveBeenCalled()
    expect(latestOnClose).toHaveBeenCalledTimes(1)
  })

  it('locks and restores the app scroll container with its existing inline overflow', () => {
    const onClose = vi.fn()
    const modal = (open: boolean) => (
      <main className="app-main" style={{ overflow: 'auto' }}>
        <DetailModal open={open} title="任务详情" onClose={onClose}>
          <p>任务内容</p>
        </DetailModal>
      </main>
    )
    const { container, rerender, unmount } = render(modal(true))
    const appMain = container.querySelector<HTMLElement>('.app-main')!

    expect(document.body.style.overflow).toBe('hidden')
    expect(appMain.style.overflow).toBe('hidden')

    rerender(modal(false))
    expect(document.body.style.overflow).toBe('')
    expect(appMain.style.overflow).toBe('auto')

    rerender(modal(true))
    unmount()
    expect(document.body.style.overflow).toBe('')
    expect(appMain.style.overflow).toBe('auto')
  })

  it('closes on Escape and backdrop click but not content click', () => {
    const onClose = vi.fn()

    render(
      <DetailModal open title="内容详情" onClose={onClose}>
        <button>内部按钮</button>
      </DetailModal>,
    )

    fireEvent.click(screen.getByRole('button', { name: '内部按钮' }))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.mouseDown(screen.getByTestId('detail-modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
