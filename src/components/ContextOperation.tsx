import { useLayoutEffect, useState, type ReactNode } from 'react'

export type ContextOperationState<T> =
  | { kind: 'loading' }
  | { kind: 'success'; data: T }
  | { kind: 'error'; error: unknown }

interface ContextOperationProps<T> {
  contextId: string
  operation: (contextId: string, signal: AbortSignal) => Promise<T>
  children: (state: ContextOperationState<T>) => ReactNode
}

// Mount inside ContextSelection's children. The caller supplies authorization,
// keeps operation stable, and interprets errors; this adapter grants no access.
export function ContextOperation<T>(props: ContextOperationProps<T>) {
  return <OperationScope key={props.contextId} {...props} />
}

function OperationScope<T>({ contextId, operation, children }: ContextOperationProps<T>) {
  const [result, setResult] = useState<{
    operation: ContextOperationProps<T>['operation']
    state: ContextOperationState<T>
  }>()

  useLayoutEffect(() => {
    setResult(undefined)
    const controller = new AbortController()
    let active = true
    const run = async () => {
      try {
        const data = await operation(contextId, controller.signal)
        if (active) setResult({ operation, state: { kind: 'success', data } })
      } catch (error: unknown) {
        if (active) setResult({ operation, state: { kind: 'error', error } })
      }
    }
    void run()
    return () => {
      active = false
      controller.abort()
    }
  }, [contextId, operation])

  return children(result?.operation === operation ? result.state : { kind: 'loading' })
}
