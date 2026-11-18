import { useContext, useEffect } from 'react'
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom'
const defaultMessage = 'Há alterações não salvas. Sair e descartar o rascunho?'
function RouterGuard({ dirty, message }: { dirty: boolean; message: string }) {
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(message)) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker, message])
  return null
}
export default function UnsavedChangesGuard({ dirty, message = defaultMessage }: { dirty: boolean; message?: string }) {
  const router = useContext(UNSAFE_DataRouterContext)
  useEffect(() => {
    if (!dirty) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const click = (event: MouseEvent) => {
      if (router || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download') || anchor.target && anchor.target !== '_self' || anchor.href === window.location.href) return
      if (!window.confirm(message)) { event.preventDefault(); event.stopPropagation() }
    }
    window.addEventListener('beforeunload', unload); document.addEventListener('click', click, true)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true) }
  }, [dirty, message, router])
  return router ? <RouterGuard dirty={dirty} message={message}/> : null
}
