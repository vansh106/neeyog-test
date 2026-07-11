const ONES = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
] as const

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'] as const

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n]
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return `${TENS[tens]}${ones ? ` ${ONES[ones]}` : ''}`.trim()
}

function indianIntWords(n: number): string {
  if (n === 0) return 'Zero'
  if (n < 0) return `Minus ${indianIntWords(-n)}`
  const parts: string[] = []
  let rem = n
  const crore = Math.floor(rem / 10_000_000)
  rem %= 10_000_000
  const lakh = Math.floor(rem / 100_000)
  rem %= 100_000
  const thousand = Math.floor(rem / 1000)
  rem %= 1000
  const hundred = Math.floor(rem / 100)
  rem %= 100
  if (crore) parts.push(`${indianIntWords(crore)} Crore`)
  if (lakh) parts.push(`${twoDigitWords(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`)
  if (hundred) parts.push(`${ONES[hundred]} Hundred`)
  if (rem) parts.push(twoDigitWords(rem))
  return parts.join(' ')
}

export function formatAmountInWordsInr(amount: number): string {
  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)
  const rupeeWords = indianIntWords(rupees)
  if (paise > 0) {
    return `Rupees ${rupeeWords} and ${indianIntWords(paise)} Paise Only`
  }
  return `Rupees ${rupeeWords} Only`
}
