/**
 * Parses a human-readable page range string into a sorted, deduplicated array
 * of 0-indexed page numbers.
 *
 * Examples:
 *   parsePageRange('1-5, 8, 12-15', 20) → [0,1,2,3,4,7,11,12,13,14]
 *   parsePageRange('', 10)              → [0,1,2,3,4,5,6,7,8,9]  (empty = all pages)
 *   parsePageRange('50', 10)            → []                       (out-of-range → excluded)
 *
 * @param input      The raw string from the page range input field.
 * @param totalPages Total number of pages in the PDF (1-indexed max).
 * @returns Sorted, deduplicated array of 0-indexed page indices.
 */
export function parsePageRange(input: string, totalPages: number): number[] {
  if (!input.trim()) {
    return Array.from({ length: totalPages }, (_, i) => i)
  }
  const indices = new Set<number>()
  const segments = input.split(',')
  for (const seg of segments) {
    const trimmed = seg.trim()
    const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10)
      const end = parseInt(rangeMatch[2], 10)
      for (let p = Math.min(start, end); p <= Math.max(start, end); p++) {
        const idx = p - 1
        if (idx >= 0 && idx < totalPages) indices.add(idx)
      }
    } else {
      const single = parseInt(trimmed, 10)
      if (!isNaN(single)) {
        const idx = single - 1
        if (idx >= 0 && idx < totalPages) indices.add(idx)
      }
    }
  }
  return [...indices].sort((a, b) => a - b)
}
