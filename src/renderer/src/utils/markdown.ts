// Strips common Markdown syntax (headings, lists, checkboxes, emphasis,
// links, code, blockquotes, rules) plus any embedded HTML tags down to
// plain text, for use in note-list previews. Run before collapsing
// whitespace, since it relies on line boundaries.
export function toPreviewText(content: string, maxLength = 150): string {
  const plain = content
    .replace(/```[^\n]*\n?([\s\S]*?)```/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/gm, '')
    // Table separator rows ("| --- | --- |", "---|---") carry no
    // content and would otherwise show up as literal dashes/pipes;
    // drop them outright. Remaining pipes (the header/data row
    // dividers) just become spaces - good enough for a plain-text
    // preview without needing a full table parse.
    .replace(/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.slice(0, maxLength)
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function textToHtml(text: string): string {
  if (!text) return '<p></p>'
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

export function parseInline(text: string): string {
  let html = text

  // Combined bold+italic (*** or ___) must be handled before the plain
  // bold/italic patterns below: matching "**" out of "***text***" first
  // left one asterisk dangling, which the italic pass then paired with
  // the wrong side of the string, closing <strong> and <em> out of order
  // - the malformed HTML the browser "recovered" from by silently
  // dropping the bold.
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>')

  // Bold (** or __)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>')

  // Italic (* or _)
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  html = html.replace(/_(.*?)_/g, '<em>$1</em>')

  // Inline code (`)
  html = html.replace(/`(.*?)`/g, '<code>$1</code>')

  // Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, label, url) => `<a href="${escapeHtml(url)}">${label}</a>`
  )

  return html
}

export function markdownToHtml(markdown: string): string {
  if (!markdown) return ''
  const lines = markdown.split(/\r?\n/)
  const result: string[] = []
  let currentListType: 'ul' | 'ol' | 'task' | null = null

  const closeList = () => {
    if (currentListType === 'ul') {
      result.push('</ul>')
    } else if (currentListType === 'ol') {
      result.push('</ol>')
    } else if (currentListType === 'task') {
      result.push('</ul>')
    }
    currentListType = null
  }

  // htmlToMarkdown always separates consecutive block elements (a list
  // followed by a paragraph, two paragraphs, ...) with exactly one blank
  // line as a structural separator - it doesn't mean there was an actual
  // empty paragraph there. Only a *second* consecutive blank line (i.e.
  // the user genuinely left an empty line) should turn into one.
  let blankRun = 0

  // Fenced code block state (``` ... ```). Lines inside a fence are kept
  // completely raw - none of the other markdown rules below (headings,
  // lists, blank-line collapsing, ...) apply while a fence is open.
  let inCodeBlock = false
  let codeLang = ''
  let codeLines: string[] = []

  const pushCodeBlock = (): void => {
    const cls = codeLang ? ` class="language-${codeLang}"` : ''
    result.push(`<pre><code${cls}>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
    inCodeBlock = false
    codeLang = ''
    codeLines = []
    blankRun = 0
  }

  for (const line of lines) {
    if (inCodeBlock) {
      if (/^```\s*$/.test(line.trim())) {
        pushCodeBlock()
      } else {
        codeLines.push(line)
      }
      continue
    }

    const trimmed = line.trim()

    const fenceMatch = trimmed.match(/^```(\S*)$/)
    if (fenceMatch) {
      closeList()
      inCodeBlock = true
      codeLang = fenceMatch[1] || ''
      codeLines = []
      continue
    }

    // Empty lines
    if (trimmed === '') {
      blankRun += 1
      closeList()
      if (blankRun > 1) {
        result.push('<p></p>')
      }
      continue
    }
    blankRun = 0

    // Check headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      closeList()
      const level = headingMatch[1].length
      result.push(`<h${level}>${parseInline(headingMatch[2])}</h${level}>`)
      continue
    }

    // Check horizontal rule
    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      closeList()
      result.push('<hr />')
      continue
    }

    // Check blockquote
    const quoteMatch = line.match(/^>\s+(.*)$/)
    if (quoteMatch) {
      closeList()
      result.push(`<blockquote>${parseInline(quoteMatch[1])}</blockquote>`)
      continue
    }

    // Check task list item: - [ ] or - [x] or * [ ] or * [x]
    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/)
    if (taskMatch) {
      if (currentListType !== 'task') {
        closeList()
        result.push('<ul data-type="taskList">')
        currentListType = 'task'
      }
      const checked = taskMatch[1].toLowerCase() === 'x'
      result.push(
        `<li data-type="taskItem" data-checked="${checked}">${parseInline(taskMatch[2])}</li>`
      )
      continue
    }

    // Check bullet list item: - item or * item
    const bulletMatch = line.match(/^[-*]\s+(.*)$/)
    if (bulletMatch) {
      if (currentListType !== 'ul') {
        closeList()
        result.push('<ul>')
        currentListType = 'ul'
      }
      result.push(`<li>${parseInline(bulletMatch[1])}</li>`)
      continue
    }

    // Check ordered list item: 1. item
    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/)
    if (orderedMatch) {
      if (currentListType !== 'ol') {
        closeList()
        result.push('<ol>')
        currentListType = 'ol'
      }
      result.push(`<li>${parseInline(orderedMatch[2])}</li>`)
      continue
    }

    // If it's a normal paragraph line, check if we are in a list. If so, close it.
    if (currentListType) {
      closeList()
    }
    result.push(`<p>${parseInline(line)}</p>`)
  }

  // An unterminated fence (file ends before a closing ```) still renders
  // as a code block rather than silently dropping everything typed into it.
  if (inCodeBlock) {
    pushCodeBlock()
  }

  closeList()
  return result.join('\n')
}

export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const rawMarkdown = childrenToMarkdown(doc.body)

  // Clean up excessive consecutive newlines (more than 2)
  return rawMarkdown.replace(/\n{3,}/g, '\n\n').trim()
}

// Converts a single DOM node (text or element) to its markdown representation.
function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || ''
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const el = node as HTMLElement
  const tagName = el.tagName.toLowerCase()

  switch (tagName) {
    case 'h1':
      return `# ${childrenToMarkdown(el)}\n\n`
    case 'h2':
      return `## ${childrenToMarkdown(el)}\n\n`
    case 'h3':
      return `### ${childrenToMarkdown(el)}\n\n`
    case 'h4':
      return `#### ${childrenToMarkdown(el)}\n\n`
    case 'h5':
      return `##### ${childrenToMarkdown(el)}\n\n`
    case 'h6':
      return `###### ${childrenToMarkdown(el)}\n\n`
    case 'p': {
      const parentName = el.parentElement?.tagName.toLowerCase()
      if (parentName === 'li') {
        return childrenToMarkdown(el)
      }
      return `${childrenToMarkdown(el)}\n\n`
    }
    case 'strong':
    case 'b':
      return `**${childrenToMarkdown(el)}**`
    case 'em':
    case 'i':
      return `*${childrenToMarkdown(el)}*`
    case 'u':
      return `<u>${childrenToMarkdown(el)}</u>`
    case 'code':
      return `\`${el.textContent}\``
    case 'a': {
      const href = el.getAttribute('href') || ''
      return `[${childrenToMarkdown(el)}](${href})`
    }
    case 'br':
      return '\n'
    case 'ul': {
      let markdown = childrenToMarkdown(el)
      if (el.parentElement?.tagName.toLowerCase() !== 'li') {
        markdown += '\n'
      }
      return markdown
    }
    case 'ol': {
      let counter = 1
      for (let c = 0; c < el.childNodes.length; c++) {
        const li = el.childNodes[c]
        if (li.nodeName.toLowerCase() === 'li') {
          ;(li as ChildNode & { _olIndex?: number })._olIndex = counter++
        }
      }
      let markdown = childrenToMarkdown(el)
      if (el.parentElement?.tagName.toLowerCase() !== 'li') {
        markdown += '\n'
      }
      return markdown
    }
    case 'li': {
      const isTaskItem =
        el.getAttribute('data-type') === 'taskItem' || el.hasAttribute('data-checked')
      if (isTaskItem) {
        const checked = el.getAttribute('data-checked') === 'true'
        return `- [${checked ? 'x' : ' '}] ${childrenToMarkdown(el)}\n`
      }
      const olIndex = (el as HTMLElement & { _olIndex?: number })._olIndex
      if (olIndex !== undefined) {
        return `${olIndex}. ${childrenToMarkdown(el)}\n`
      }
      return `- ${childrenToMarkdown(el)}\n`
    }
    case 'span': {
      const style = el.getAttribute('style')
      if (style) {
        return `<span style="${style}">${childrenToMarkdown(el)}</span>`
      }
      return childrenToMarkdown(el)
    }
    case 'blockquote':
      return `> ${childrenToMarkdown(el)}\n\n`
    case 'hr':
      return '---\n\n'
    case 'pre': {
      // TipTap's CodeBlock always nests a <code> child; read straight from
      // it (skipping parseInline/childrenToMarkdown) so markdown syntax
      // inside the code text is never reinterpreted as formatting.
      const codeEl = el.querySelector('code') ?? el
      const language = codeEl.getAttribute('class')?.match(/language-(\S+)/)?.[1] ?? ''
      return `\`\`\`${language}\n${codeEl.textContent}\n\`\`\`\n\n`
    }
    default:
      if (el.getAttribute('style') || el.getAttribute('class')) {
        const serializedChildren = childrenToMarkdown(el)
        const tagMatch = el.outerHTML.match(/^<[a-zA-Z0-9]+[^>]*>/)
        if (tagMatch) {
          return `${tagMatch[0]}${serializedChildren}</${tagName}>`
        }
        return childrenToMarkdown(el)
      }
      return childrenToMarkdown(el)
  }
}

function childrenToMarkdown(element: HTMLElement): string {
  let markdown = ''
  for (let i = 0; i < element.childNodes.length; i++) {
    markdown += nodeToMarkdown(element.childNodes[i])
  }
  return markdown
}
