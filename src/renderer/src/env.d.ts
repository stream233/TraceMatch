/// <reference types="vite/client" />

import type { TraceMatchApi } from '../../shared/types'

declare global {
  interface Window {
    traceMatch: TraceMatchApi
  }
}

export {}
