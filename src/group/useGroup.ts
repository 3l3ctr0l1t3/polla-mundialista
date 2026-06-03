import { useContext } from 'react'
import { GroupContext, type GroupContextValue } from './groupContext'

/**
 * Access the current group context. Must be called inside a `<GroupProvider>` subtree
 * (i.e. under a `/g/:gid/*` route). Returns the group + the viewer's role/status.
 */
export function useGroup(): GroupContextValue {
  const ctx = useContext(GroupContext)
  if (ctx === undefined) {
    throw new Error('useGroup must be used within a <GroupProvider>')
  }
  return ctx
}
