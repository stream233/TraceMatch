export const APPLICATION_EXPIRY_DATE = '2027-12-31'

export function isApplicationExpired(now: Date = new Date()): boolean {
  const expiry = new Date(2027, 11, 31, 23, 59, 59, 999)
  return now.getTime() > expiry.getTime()
}
