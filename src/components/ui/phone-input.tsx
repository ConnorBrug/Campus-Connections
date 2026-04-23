'use client';

/**
 * US-only phone input that shows "(555) 555-5555" to the user but emits the
 * E.164 form (+15555555555) to the surrounding form. Works as a drop-in
 * replacement for <Input type="tel" /> inside a react-hook-form FormField.
 *
 * The raw stored value is always E.164 — either "" or "+1XXXXXXXXXX". The
 * visual mask is computed on every render from the stored digits, so even
 * programmatic setValue() calls display correctly without a useEffect loop.
 *
 * Editing model:
 *   - User types any digit; non-digits are silently dropped.
 *   - After 10 US digits (we strip a leading 1 automatically), further keys
 *     are ignored.
 *   - Backspace works by deleting trailing digits; formatting parentheses and
 *     dashes are cosmetic and can't be "stuck on".
 */
import * as React from 'react';
import { Input } from '@/components/ui/input';

export type PhoneInputProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'inputMode' | 'autoComplete'
> & {
  /** Stored value in E.164 (e.g. "+15555551234"). Empty string means unset. */
  value: string | null | undefined;
  /** Called with the new E.164 value ("" when cleared, "+1XXXXXXXXXX" once complete). */
  onChange: (next: string) => void;
};

/** Extract US digits from any string. A leading country-code "1" is dropped. */
function extractUsDigits(raw: string): string {
  const digits = raw.replace(/\D+/g, '');
  const trimmed = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return trimmed.slice(0, 10);
}

/** Format up to 10 digits as "(XXX) XXX-XXXX" progressively. */
function formatForDisplay(digits: string): string {
  const d = digits.slice(0, 10);
  if (d.length === 0) return '';
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

/** Convert stored E.164 back to the 10-digit US core, or "" if malformed. */
function storedToDigits(stored: string | null | undefined): string {
  if (!stored) return '';
  const digits = stored.replace(/\D+/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return digits.slice(0, 10);
}

/** Convert the 10-digit US core back to E.164. Empty → "". */
function digitsToStored(digits: string): string {
  return digits.length === 0 ? '' : `+1${digits}`;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput({ value, onChange, placeholder, ...rest }, ref) {
    const digits = storedToDigits(value);
    const display = formatForDisplay(digits);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextDigits = extractUsDigits(e.target.value);
      onChange(digitsToStored(nextDigits));
    };

    // Paste of "+1 (555) 123-4567" or "5551234567" or "15551234567" all work
    // because extractUsDigits normalizes everything.
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text');
      if (!text) return;
      e.preventDefault();
      const nextDigits = extractUsDigits(text);
      onChange(digitsToStored(nextDigits));
    };

    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={placeholder ?? '(555) 555-5555'}
        value={display}
        onChange={handleChange}
        onPaste={handlePaste}
        maxLength={14 /* "(XXX) XXX-XXXX" */}
        {...rest}
      />
    );
  },
);
