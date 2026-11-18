import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
// Native navigation prompts default to discarding client-only drafts in existing flow fixtures.
beforeEach(()=>vi.stubGlobal('confirm',vi.fn(()=>true)))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
