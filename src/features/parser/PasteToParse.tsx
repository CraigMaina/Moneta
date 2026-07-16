import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { ReceiptIcon, WarnIcon } from '../../components/ui/icons'
import { cn } from '../../lib/cn'

export type PasteToParseStatus = 'idle' | 'pending' | 'error'

export interface PasteToParseProps {
  /** Fires with the trimmed textarea contents when the user taps "Read message". The lead wires the actual parser + LLM fallback and drives `status` back in via props. */
  onParse: (text: string) => void
  /** Controlled by the caller: `'idle'` (nothing tried yet, or ready to retry), `'pending'` (parsing in flight), `'error'` (parse failed / message unmatched). Default `'idle'`. */
  status?: PasteToParseStatus
  /** Shown in the calm fallback when `status === 'error'`. Defaults to a generic, non-technical line — never dump a parser/LLM error string here. */
  errorMessage?: string
  /** The unparseable-message fallback: opens manual entry (prefilled with this text, at the lead's discretion). Only shown when `status === 'error'`. */
  onEnterManually: () => void
  className?: string
}

const DEFAULT_ERROR_MESSAGE = "We couldn't read that message."

/**
 * The paste affordance for the Add sheet (PRD F1/F2 wow moment, first half).
 * A warm, teaching empty prompt; a textarea; a "Read message" trigger; a
 * calm pending surface; and a non-shaming "enter manually" fallback when the
 * parser can't make sense of it. Presentational only — parsing itself, and
 * the LLM fallback, are the lead's to wire via `onParse`.
 */
export function PasteToParse({ onParse, status = 'idle', errorMessage, onEnterManually, className }: PasteToParseProps) {
  const [text, setText] = useState('')
  const isPending = status === 'pending'
  const isError = status === 'error'
  const canRead = text.trim().length > 0 && !isPending

  const handlePasteFromClipboard = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return
    try {
      const clipboardText = await navigator.clipboard.readText()
      if (clipboardText) setText(clipboardText)
    } catch {
      // Clipboard permission denied/unavailable — the textarea's own manual
      // paste (Ctrl/Cmd+V, or a long-press paste on Android) still works;
      // this button is a convenience shortcut, never the only path in.
    }
  }

  const handleRead = () => {
    const trimmed = text.trim()
    if (!trimmed || isPending) return
    onParse(trimmed)
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-coral-100 text-coral-600"
          aria-hidden="true"
        >
          <ReceiptIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[15px] font-semibold text-ink-900">Paste your M-PESA message</p>
          <p className="text-[13px] text-ink-600">Copy the confirmation SMS, then paste it below.</p>
        </div>
      </div>

      <div>
        <label htmlFor="paste-sms" className="sr-only">
          M-PESA message
        </label>
        <textarea
          id="paste-sms"
          rows={5}
          value={text}
          onChange={(event) => setText(event.target.value)}
          // Keep the sheet's drag-to-dismiss from swallowing taps on iOS.
          onPointerDown={(event) => event.stopPropagation()}
          placeholder="e.g. QGH7XXXXX1 Confirmed. You have received Ksh1,500.00 from..."
          className="w-full resize-none rounded-card bg-paper-50 p-4 text-[15px] leading-relaxed text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-0"
        />
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={handlePasteFromClipboard} className="flex-1">
          Paste from clipboard
        </Button>
        <Button onClick={handleRead} disabled={!canRead} loading={isPending} className="flex-1">
          Read message
        </Button>
      </div>

      {isPending && (
        <p role="status" className="text-[13px] text-ink-600">
          Reading your message…
        </p>
      )}

      {isError && (
        <div className="flex items-start gap-3 rounded-card bg-amber-600/10 p-4">
          <span className="mt-0.5 flex-shrink-0" aria-hidden="true">
            <WarnIcon className="h-5 w-5 text-amber-600" />
          </span>
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-ink-900">{errorMessage ?? DEFAULT_ERROR_MESSAGE}</p>
            <p className="mt-1 text-[13px] text-ink-600">Enter it manually and it&apos;ll still count.</p>
            <Button variant="secondary" size="md" onClick={onEnterManually} className="mt-3">
              Enter manually
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
