export type MarkdownSpecStepKind = 'action' | 'assertion'

export type MarkdownSpecStep = {
  index: number
  text: string
  kind: MarkdownSpecStepKind
}

export type MarkdownSpec = {
  preconditions: string[]
  steps: MarkdownSpecStep[]
  warnings?: string[]
}

export type MarkdownSpecParseErrorCode =
  | 'MARKDOWN_MISSING_PRECONDITIONS'
  | 'MARKDOWN_MISSING_STEPS'
  | 'MARKDOWN_EMPTY_PRECONDITIONS'
  | 'MARKDOWN_EMPTY_STEPS'

export type MarkdownSpecParseError = {
  code: MarkdownSpecParseErrorCode
  message: string
}

export type ParseMarkdownSpecResult =
  | { ok: true; value: MarkdownSpec }
  | { ok: false; error: MarkdownSpecParseError }
