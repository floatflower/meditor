/** The state of the MCP server as the Settings dialog shows and changes it. */
export interface AiState {
  enabled: boolean
  /** Without this the AI can read but not change anything. */
  allowWrite: boolean
  /** Skip the diff review: the AI's edits are applied at once. */
  directWrite: boolean
  running: boolean
  port: number
  error?: string
}

export type AiPatch = Partial<Pick<AiState, 'enabled' | 'allowWrite' | 'directWrite'>>
