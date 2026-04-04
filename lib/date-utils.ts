// Utility helpers to work in Dhaka time (GMT+6)

// Returns today's date string in Asia/Dhaka time as YYYY-MM-DD
export function getDhakaTodayDateString() {
  const now = new Date()
  const utcMillis = now.getTime() + now.getTimezoneOffset() * 60_000
  const dhakaMillis = utcMillis + 6 * 60 * 60_000
  const dhaka = new Date(dhakaMillis)
  return dhaka.toISOString().split('T')[0]
}

// Given a sheet date (YYYY-MM-DD) representing the "business day",
// returns the UTC start/end timestamps (ISO strings) for the window:
// (previous day 6 PM Dhaka, sheet day 6 PM Dhaka].
//
// Example: sheetDate = '2026-03-11'
//   window: 2026-03-10 18:00 Dhaka (12:00 UTC) exclusive
//        -> 2026-03-11 18:00 Dhaka (12:00 UTC next day) inclusive.
export function getDhakaBusinessDayRangeUtc(sheetDate: string) {
  const [yearStr, monthStr, dayStr] = sheetDate.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1 // JS Date month is 0-based
  const day = Number(dayStr)

  if (!year || monthIndex < 0 || day <= 0) {
    throw new Error('Invalid sheetDate')
  }

  // Dhaka is UTC+6, so 18:00 Dhaka is 12:00 UTC.
  const endUtc = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0))
  const startUtc = new Date(endUtc.getTime() - 24 * 60 * 60 * 1000)

  return {
    startUtc: startUtc.toISOString(),
    endUtc: endUtc.toISOString(),
  }
}

