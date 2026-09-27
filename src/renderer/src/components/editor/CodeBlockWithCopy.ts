import CodeBlock from '@tiptap/extension-code-block'

// navigator.clipboard.writeText needs a secure/focused context and isn't
// always available (e.g. window briefly unfocused); execCommand is
// deprecated but still works everywhere as a fallback.
function copyText(text: string): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => copyTextFallback(text))
    return
  }
  copyTextFallback(text)
}

function copyTextFallback(text: string): void {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
  } finally {
    textarea.remove()
  }
}

// Same icon as lucide-react's <Copy /> (used by the toolbar's "Duplicar
// Nota" button), reproduced as a raw SVG string since this NodeView is
// plain DOM, not React.
const COPY_ICON_SVG = `
  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
`
const CHECK_ICON_SVG = `<path d="M20 6 9 17l-5-5"></path>`

function svgIcon(inner: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.innerHTML = inner
  return svg
}

// Adds a "copy" button to code blocks via a plain DOM NodeView. This only
// changes what's rendered live in the editor - the node's schema-level
// renderHTML (used by editor.getHTML(), and in turn htmlToMarkdown) is
// untouched, so the saved markdown is unaffected.
export const CodeBlockWithCopy = CodeBlock.extend({
  addNodeView() {
    return ({ node }) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'code-block-wrapper'

      const pre = document.createElement('pre')
      const code = document.createElement('code')
      if (node.attrs.language) {
        code.className = `language-${node.attrs.language}`
      }
      pre.appendChild(code)

      const copyButton = document.createElement('button')
      copyButton.type = 'button'
      copyButton.className = 'code-copy-btn'
      copyButton.title = 'Copiar código'
      const icon = svgIcon(COPY_ICON_SVG)
      copyButton.appendChild(icon)
      // Keep the click from moving the editor's selection/focus into the
      // code text before the copy handler runs.
      copyButton.addEventListener('mousedown', (event) => event.preventDefault())
      copyButton.addEventListener('click', (event) => {
        event.preventDefault()
        copyText(code.textContent || '')
        copyButton.classList.add('copied')
        copyButton.title = 'Copiado!'
        copyButton.replaceChild(svgIcon(CHECK_ICON_SVG), copyButton.firstChild as Node)
        window.setTimeout(() => {
          copyButton.classList.remove('copied')
          copyButton.title = 'Copiar código'
          copyButton.replaceChild(svgIcon(COPY_ICON_SVG), copyButton.firstChild as Node)
        }, 1500)
      })

      wrapper.appendChild(pre)
      wrapper.appendChild(copyButton)

      return {
        dom: wrapper,
        contentDOM: code,
        update: (updatedNode) => updatedNode.type === node.type
      }
    }
  }
})

export default CodeBlockWithCopy
