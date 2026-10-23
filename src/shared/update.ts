export type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'error' | 'unsupported'

/** What the corner notice and the Settings page show about new versions. */
export interface UpdateState {
  status: UpdateStatus
  currentVersion: string
  /** The newest version, once one newer than this one has been found. */
  version?: string
  error?: string
  autoCheck: boolean
  /** Show the corner notice: a newer version exists and it has not been dismissed yet. */
  notice: boolean
}
