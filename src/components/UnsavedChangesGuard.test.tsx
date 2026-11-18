import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { useState } from 'react'
import UnsavedChangesGuard from './UnsavedChangesGuard'
function Draft() {
  const [dirty, setDirty] = useState(true)
  return <><UnsavedChangesGuard dirty={dirty}/><p>Rascunho</p><button onClick={() => setDirty(false)}>Salvar</button><Link to="/destino">Sair</Link></>
}
function setup() {
  const router = createMemoryRouter([{ path: '/', element: <Draft/> }, { path: '/destino', element: <p>Destino</p> }], { initialEntries: ['/destino', '/'] })
  render(<RouterProvider router={router}/>)
  return router
}
it('preserva o rascunho ao cancelar e permite descarte confirmado', async () => {
  const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true); vi.stubGlobal('confirm', confirm)
  setup(); fireEvent.click(screen.getByText('Sair'))
  expect(screen.getByText('Rascunho')).toBeInTheDocument()
  fireEvent.click(screen.getByText('Sair'))
  expect(await screen.findByText('Destino')).toBeInTheDocument()
  expect(confirm).toHaveBeenCalledTimes(2)
})
it('protege histórico e recarga enquanto sujo, liberando após salvar', async () => {
  const confirm = vi.fn(() => false); vi.stubGlobal('confirm', confirm)
  const router = setup()
  await act(async () => { await router.navigate(-1) })
  expect(screen.getByText('Rascunho')).toBeInTheDocument()
  const before = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(before)
  expect(before.defaultPrevented).toBe(true)
  fireEvent.click(screen.getByText('Salvar'))
  const after = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(after)
  expect(after.defaultPrevented).toBe(false)
  fireEvent.click(screen.getByText('Sair'))
  expect(await screen.findByText('Destino')).toBeInTheDocument()
  expect(confirm).toHaveBeenCalledTimes(1)
})
