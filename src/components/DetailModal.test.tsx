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
