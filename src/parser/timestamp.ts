import { TZDate } from '@date-fns/tz'

/**
 * M-PESA SMS timestamps ("on 5/7/26 at 3:45 PM") → a correct ISO instant.
 *
 * CLAUDE.md: "All date logic in Africa/Nairobi ... never raw Date math
 * across day boundaries" and "never assume the device zone." Safaricom
 * message dates are day-first (D/M/Y, Kenyan convention) local wall-clock
 * time in Africa/Nairobi. We build the instant with `TZDate` so the offset
 * is resolved against that zone regardless of where this code runs.
 */

export const NAIROBI_TZ = 'Africa/Nairobi'

const DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/
const TIME_PATTERN = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] // Feb=28; the leap-year check below adds the 29th back

/**
 * Parse an M-PESA date string ("5/7/26" or "13/1/2026", D/M/Y) and time
 * string ("3:45 PM") into a correct ISO instant in Africa/Nairobi. Throws on
 * malformed or calendrically-impossible input (e.g. "31/2/26") — the caller
 * treats a throw as "this candidate match doesn't actually parse."
 */
export function parseMpesaTimestamp(dateStr: string, timeStr: string): string {
  const dateMatch = DATE_PATTERN.exec(dateStr.trim())
  if (!dateMatch) {
    throw new TypeError(`timestamp: cannot parse date from "${dateStr}"`)
  }
  const day = Number.parseInt(dateMatch[1] ?? '', 10)
  const month = Number.parseInt(dateMatch[2] ?? '', 10)
  let year = Number.parseInt(dateMatch[3] ?? '', 10)
  if (dateMatch[3] && dateMatch[3].length <= 2) {
    // M-PESA's 2-digit years are always 20xx in the app's operating window.
    year += 2000
  }

  if (month < 1 || month > 12) {
    throw new RangeError(`timestamp: month out of range in "${dateStr}"`)
  }
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const maxDay = month === 2 && isLeap ? 29 : (DAYS_IN_MONTH[month - 1] ?? 31)
  if (day < 1 || day > maxDay) {
    throw new RangeError(`timestamp: day out of range in "${dateStr}"`)
  }

  const timeMatch = TIME_PATTERN.exec(timeStr.trim())
  if (!timeMatch) {
    throw new TypeError(`timestamp: cannot parse time from "${timeStr}"`)
  }
  let hour = Number.parseInt(timeMatch[1] ?? '', 10)
  const minute = Number.parseInt(timeMatch[2] ?? '', 10)
  const meridian = (timeMatch[3] ?? '').toUpperCase()
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    throw new RangeError(`timestamp: time out of range in "${timeStr}"`)
  }
  if (meridian === 'PM' && hour !== 12) hour += 12
  if (meridian === 'AM' && hour === 12) hour = 0

  const zoned = new TZDate(year, month - 1, day, hour, minute, 0, 0, NAIROBI_TZ)
  // `TZDate#toISOString()` renders with the zone's own offset (e.g.
  // "...+03:00"), not UTC — this contract promises a UTC instant, so go
  // through a plain `Date` (same underlying instant, standard "Z" format).
  return new Date(zoned.getTime()).toISOString()
}
