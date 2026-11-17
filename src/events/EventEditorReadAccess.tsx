import type { ReactNode } from 'react'
import { ResourceAccess } from '../authorization'
/** Singular event data needed by its editor, without granting general lists. */
export default function EventEditorReadAccess({ church, children, allowCreate = false }: { church: string; children: ReactNode; allowCreate?: boolean }) {
  return <ResourceAccess permissionCode="EVENT_VIEW" resourceType="CHURCH" resourceId={church} optional preserveDuringRecheck fallback={<ResourceAccess permissionCode="EVENT_EDIT" resourceType="CHURCH" resourceId={church} preserveDuringRecheck optional={allowCreate} fallback={allowCreate ? <ResourceAccess permissionCode="EVENT_CREATE" resourceType="CHURCH" resourceId={church} preserveDuringRecheck>{children}</ResourceAccess> : null}>{children}</ResourceAccess>}>{children}</ResourceAccess>
}
