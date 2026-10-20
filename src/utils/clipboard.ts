export async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    // HTTP 局域网地址或剪贴板权限受限时，尝试浏览器的复制命令。
  }

  const activeElement = document.activeElement
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.readOnly = true
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  try {
    textarea.select()
    if (!document.execCommand('copy')) {
      throw new Error('复制失败，请选中内容后手动复制')
    }
  } finally {
    textarea.remove()
    if (activeElement instanceof HTMLElement) activeElement.focus()
  }
}
