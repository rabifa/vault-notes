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

// A source already carries its own scheme (http(s), data:, vault-file:, ...)
// rather than being a path relative to the note - leave those alone instead
// of trying to resolve them against noteDir.
const ABSOLUTE_SRC_REGEX = /^([a-z][a-z0-9+.-]*:)/i

// Notes live in a flat vault (no subfolders), so noteDir is always the
// vault root - but paths still arrive OS-specific (backslashes on
// Windows), so this only ever does plain string surgery, never touches
// the filesystem or Node's path module (unavailable in the renderer).
function dirnameOf(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx === -1 ? '' : normalized.slice(0, idx)
}

// Converts a path relative to the note (e.g. "attachments/x.png", as
// stored in the saved Markdown) into a "vault-file://" URL the editor can
// actually load - see the protocol handler registered in the main
// process, which serves it back from disk regardless of whether the
// renderer's own origin is http(s) (dev) or file (prod).
//
// The absolute path goes entirely inside the query string ("?p=...") as a
// single encodeURIComponent-escaped token, deliberately never touching the
// URL's host/path structure: a Windows path put there directly (even as
// "vault-file:///C:/...") gets its drive letter mangled into a bogus host
// ("c", colon stripped) by Chromium's generic parser for custom schemes -
// only "file:" gets the spec's dedicated drive-letter handling.
function resolveImageDisplayUrl(src: string, noteDir: string): string {
  if (!noteDir || ABSOLUTE_SRC_REGEX.test(src)) return src
  const absolute = `${noteDir}/${src}`
  return `vault-file://local/?p=${encodeURIComponent(absolute)}`
}

// Public entry point for the same conversion, for a freshly-attached image:
// once vault:save-image returns the note-relative path it was copied to,
// this turns it into the URL to hand the editor right away (setImage's
// src), without waiting for a reload of the note through markdownToHtml.
export function resolveNoteImageUrl(relativePath: string, notePath: string): string {
  return resolveImageDisplayUrl(relativePath, dirnameOf(notePath))
}

// The inverse, applied when saving: turns a "vault-file://" display URL
// back into the note-relative path that belongs in the Markdown, so the
// saved file never bakes in an absolute, machine-specific location.
function toRelativeImageSrc(src: string, noteDir: string): string {
  if (!src.startsWith('vault-file://')) return src
  const param = new URL(src).searchParams.get('p')
  if (!param) return src
  const prefix = `${noteDir}/`
  return param.startsWith(prefix) ? param.slice(prefix.length) : param
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

// Splits a single pipe-table row ("| a | b |" or "a | b") into trimmed
// cell strings, honoring an escaped pipe ("\|") as literal cell content
// rather than a column separator.
export function splitTableRow(line: string): string[] {
  let trimmed = line.trim()
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) trimmed = trimmed.slice(0, -1)

  const cells: string[] = []
  let current = ''
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (ch === '\\' && trimmed[i + 1] === '|') {
      current += '|'
      i++
    } else if (ch === '|') {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

// A GFM table separator row: each cell is dashes, optionally with a
// leading/trailing colon for alignment (":---", "---:", ":---:").
export function isTableSeparatorRow(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed.includes('-')) return false
  const cells = splitTableRow(trimmed)
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell))
}

export function parseInline(text: string, noteDir = ''): string {
  let html = text

  // A resized image (ResizableImage's drag handle) is saved as a literal
  // HTML <img> tag instead of "![]()" - see nodeToMarkdown's 'img' case -
  // since plain Markdown image syntax has no room for a width. Matched
  // first and re-emitted whole, so none of the passes below (which assume
  // plain text, not attribute values) get a chance to mangle its quotes.
  html = html.replace(
    /<img src="([^"]*)" alt="([^"]*)" width="(\d+)"\s*\/?>/g,
    (_, src, alt, width) =>
      `<img src="${escapeHtml(resolveImageDisplayUrl(src, noteDir))}" alt="${escapeHtml(alt)}" width="${width}">`
  )

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

  // Images ![alt](src) - matched before links below, since a link's own
  // "[text](url)" pattern would otherwise also match inside it, leaving a
  // stray "!" in front of a wrongly-created <a> tag.
  html = html.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_, alt, src) =>
      `<img src="${escapeHtml(resolveImageDisplayUrl(src, noteDir))}" alt="${escapeHtml(alt)}">`
  )

  // Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, label, url) => `<a href="${escapeHtml(url)}">${label}</a>`
  )

  return html
}

export function markdownToHtml(markdown: string, notePath = ''): string {
  if (!markdown) return ''
  const noteDir = dirnameOf(notePath)
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

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
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
      result.push(`<h${level}>${parseInline(headingMatch[2], noteDir)}</h${level}>`)
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
      result.push(`<blockquote>${parseInline(quoteMatch[1], noteDir)}</blockquote>`)
      continue
    }

    // Check table: a row containing at least one pipe, immediately
    // followed by a GFM separator row (e.g. "| --- | --- |").
    if (
      trimmed.includes('|') &&
      lineIndex + 1 < lines.length &&
      isTableSeparatorRow(lines[lineIndex + 1])
    ) {
      closeList()
      const headerCells = splitTableRow(trimmed)
      const rowsHtml = [
        `<tr>${headerCells.map((cell) => `<th>${parseInline(cell, noteDir)}</th>`).join('')}</tr>`
      ]
      let bodyIndex = lineIndex + 2
      while (
        bodyIndex < lines.length &&
        lines[bodyIndex].trim() !== '' &&
        lines[bodyIndex].includes('|')
      ) {
        const rowCells = splitTableRow(lines[bodyIndex])
        rowsHtml.push(
          `<tr>${rowCells.map((cell) => `<td>${parseInline(cell, noteDir)}</td>`).join('')}</tr>`
        )
        bodyIndex++
      }
      result.push(`<table><tbody>${rowsHtml.join('')}</tbody></table>`)
      lineIndex = bodyIndex - 1
      blankRun = 0
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
        `<li data-type="taskItem" data-checked="${checked}">${parseInline(taskMatch[2], noteDir)}</li>`
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
      result.push(`<li>${parseInline(bulletMatch[1], noteDir)}</li>`)
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
      result.push(`<li>${parseInline(orderedMatch[2], noteDir)}</li>`)
      continue
    }

    // If it's a normal paragraph line, check if we are in a list. If so, close it.
    if (currentListType) {
      closeList()
    }
    result.push(`<p>${parseInline(line, noteDir)}</p>`)
  }

  // An unterminated fence (file ends before a closing ```) still renders
  // as a code block rather than silently dropping everything typed into it.
  if (inCodeBlock) {
    pushCodeBlock()
  }

  closeList()
  return result.join('\n')
}

export function htmlToMarkdown(html: string, notePath = ''): string {
  if (!html) return ''
  const noteDir = dirnameOf(notePath)
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const rawMarkdown = childrenToMarkdown(doc.body, noteDir)

  // Clean up excessive consecutive newlines (more than 2)
  return rawMarkdown.replace(/\n{3,}/g, '\n\n').trim()
}

// Converts a single DOM node (text or element) to its markdown representation.
function nodeToMarkdown(node: Node, noteDir: string): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || ''
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const el = node as HTMLElement
  const tagName = el.tagName.toLowerCase()
  const children = (target: HTMLElement = el): string => childrenToMarkdown(target, noteDir)

  switch (tagName) {
    case 'h1':
      return `# ${children()}\n\n`
    case 'h2':
      return `## ${children()}\n\n`
    case 'h3':
      return `### ${children()}\n\n`
    case 'h4':
      return `#### ${children()}\n\n`
    case 'h5':
      return `##### ${children()}\n\n`
    case 'h6':
      return `###### ${children()}\n\n`
    case 'p': {
      const parentName = el.parentElement?.tagName.toLowerCase()
      if (parentName === 'li') {
        return children()
      }
      return `${children()}\n\n`
    }
    case 'strong':
    case 'b':
      return `**${children()}**`
    case 'em':
    case 'i':
      return `*${children()}*`
    case 'u':
      return `<u>${children()}</u>`
    case 'code':
      return `\`${el.textContent}\``
    case 'a': {
      const href = el.getAttribute('href') || ''
      return `[${children()}](${href})`
    }
    case 'img': {
      const alt = el.getAttribute('alt') || ''
      const src = toRelativeImageSrc(el.getAttribute('src') || '', noteDir)
      const width = el.getAttribute('width')
      // Plain Markdown image syntax has no room for a width - once the
      // user has resized one (ResizableImage's drag handle sets this
      // attribute), fall back to a literal HTML <img> tag instead, which
      // parseInline below recognizes on the way back in.
      return width ? `<img src="${src}" alt="${alt}" width="${width}">` : `![${alt}](${src})`
    }
    case 'br':
      return '\n'
    case 'ul': {
      let markdown = children()
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
      let markdown = children()
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
        return `- [${checked ? 'x' : ' '}] ${children()}\n`
      }
      const olIndex = (el as HTMLElement & { _olIndex?: number })._olIndex
      if (olIndex !== undefined) {
        return `${olIndex}. ${children()}\n`
      }
      return `- ${children()}\n`
    }
    case 'span': {
      const style = el.getAttribute('style')
      if (style) {
        return `<span style="${style}">${children()}</span>`
      }
      return children()
    }
    case 'blockquote':
      return `> ${children()}\n\n`
    case 'hr':
      return '---\n\n'
    case 'table':
      return `${tableToMarkdown(el, noteDir)}\n\n`
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
        const serializedChildren = children()
        const tagMatch = el.outerHTML.match(/^<[a-zA-Z0-9]+[^>]*>/)
        if (tagMatch) {
          return `${tagMatch[0]}${serializedChildren}</${tagName}>`
        }
        return children()
      }
      return children()
  }
}

// Serializes a <table> (thead/tbody optional - TipTap's Table extension
// renders header cells as <th> directly inside <tbody>) into a GFM pipe
// table, treating whichever row comes first as the header row.
function tableToMarkdown(tableEl: HTMLElement, noteDir: string): string {
  const rows = Array.from(tableEl.querySelectorAll('tr'))
  if (rows.length === 0) return ''

  const cellText = (cell: Element): string =>
    childrenToMarkdown(cell as HTMLElement, noteDir)
      .replace(/\n+/g, ' ')
      .trim()
      .replace(/\|/g, '\\|')

  const rowsCells = rows.map((row) => Array.from(row.children).map((cell) => cellText(cell)))
  const colCount = Math.max(...rowsCells.map((cells) => cells.length))
  const pad = (cells: string[]): string[] => {
    const padded = [...cells]
    while (padded.length < colCount) padded.push('')
    return padded
  }

  const lines = [
    `| ${pad(rowsCells[0]).join(' | ')} |`,
    `| ${Array(colCount).fill('---').join(' | ')} |`
  ]
  for (let i = 1; i < rowsCells.length; i++) {
    lines.push(`| ${pad(rowsCells[i]).join(' | ')} |`)
  }
  return lines.join('\n')
}

function childrenToMarkdown(element: HTMLElement, noteDir: string): string {
  let markdown = ''
  for (let i = 0; i < element.childNodes.length; i++) {
    markdown += nodeToMarkdown(element.childNodes[i], noteDir)
  }
  return markdown
}
