import { useEffect, useRef, useState } from 'react'
import { DependentDocumentAttachment, type DependentContext, type DocumentSelection } from './DocumentAuthorization'

type Props = {
  context: DependentContext
  onSelect: (selection: DocumentSelection) => Promise<void>
}

// A troca de contexto desmonta a sessão, inclusive em uma sequência A → B → A.
export function DocumentSelectionAdapter(props: Props) {
  const { churchId, dependentId, guardianId } = props.context
  return <SelectionSession key={JSON.stringify([churchId, dependentId, guardianId])} {...props}/>
}

function SelectionSession({ context, onSelect }: Props) {
  const [state, setState] = useState<'idle' | 'pending' | 'error'>('idle')
  const generation = useRef(0)
  useEffect(() => () => { generation.current += 1 }, [])

  async function select(selection: DocumentSelection) {
    const current = ++generation.current
    setState('pending')
    try {
      await onSelect(selection)
      if (current === generation.current) setState('idle')
    } catch {
      // Nunca projetar a mensagem externa: pode conter dados do documento.
      if (current === generation.current) setState('error')
    }
  }

  return <div aria-busy={state === 'pending'}>
    <DependentDocumentAttachment context={context} state="available" onSelect={select}/>
    {state === 'pending' && <p role="status">Processando seleção do documento… Nenhum envio ou aprovação foi confirmado.</p>}
    {state === 'error' && <p role="alert">Não foi possível processar a seleção. Nenhum envio foi confirmado. Selecione novamente para tentar.</p>}
  </div>
}
