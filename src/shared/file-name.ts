export function prefixFileName(fileName: string, prefix = ''): string {
  // Keep user input within a single filename, including on Windows.
  const safePrefix = prefix
    .trim()
    .replace(/[<>:"/\\|?*\p{Cc}]/gu, '-')
    .replace(/[. ]+$/u, '')
  return safePrefix ? `${safePrefix}-${fileName}` : fileName
}
