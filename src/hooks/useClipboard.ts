import { useState, useCallback } from 'react';

interface UseClipboardReturn {
  copied: boolean;
  supported: boolean;
  copy: (text: string) => Promise<boolean>;
  reset: () => void;
}

/**
 * useClipboard
 *
 * Attempts navigator.clipboard.writeText() first (modern browsers).
 * Falls back to document.execCommand('copy') for environments where
 * clipboard API is unavailable (some mobile browsers, HTTP contexts).
 */
export function useClipboard(resetAfterMs = 3000): UseClipboardReturn {
  const [copied, setCopied] = useState(false);
  const supported =
    typeof navigator !== 'undefined' &&
    (!!navigator.clipboard || !!document.execCommand);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (!text) return false;

      // Attempt modern Clipboard API
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          if (resetAfterMs > 0) {
            setTimeout(() => setCopied(false), resetAfterMs);
          }
          return true;
        } catch {
          // Fall through to execCommand
        }
      }

      // Fallback: create a temporary textarea
      try {
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(el);
        if (ok) {
          setCopied(true);
          if (resetAfterMs > 0) {
            setTimeout(() => setCopied(false), resetAfterMs);
          }
          return true;
        }
      } catch {
        // Both methods failed
      }

      return false;
    },
    [resetAfterMs]
  );

  const reset = useCallback(() => setCopied(false), []);

  return { copied, supported, copy, reset };
}
