const numericSuffixPattern = /^\d+$/

export function acceptanceOrderNumberPrefix(date = new Date()): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `YS${year}${month}${day}-`
}

export function nextAcceptanceOrderNumber(orderNumbers: Iterable<string>, date = new Date()): string {
  const prefix = acceptanceOrderNumberPrefix(date)
  let highestSequence = 0

  for (const orderNumber of orderNumbers) {
    if (!orderNumber.startsWith(prefix)) continue
    const suffix = orderNumber.slice(prefix.length)
    if (!numericSuffixPattern.test(suffix)) continue
    const sequence = Number(suffix)
    if (Number.isSafeInteger(sequence) && sequence > highestSequence) highestSequence = sequence
  }

  return `${prefix}${String(highestSequence + 1).padStart(3, '0')}`
}
