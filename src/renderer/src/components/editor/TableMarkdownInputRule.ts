import { Extension, InputRule } from '@tiptap/core'
import type { NodeType } from '@tiptap/pm/model'

import { splitTableRow, isTableSeparatorRow } from '../../utils/markdown'

// Matches a complete GFM table separator row followed by the Enter key
// that finishes it - NOT mid-keystroke. Tiptap's input-rule runner also
// re-checks every rule on Enter (see its `handleKeyDown`, used elsewhere
// for things like fenced code blocks), simulating it as if a trailing
// "\n" had been typed; matching that "\n" here is what anchors this rule
// to "the user is done with this line" instead of "some valid-looking
// prefix of it now exists".
//
// A per-keystroke rule (matching on the row's own trailing "|") was tried
// first and had to be reverted: typing "| --- | --- |" passes through
// "| --- |" along the way, which is *already* a valid one-column
// separator on its own - so it fired mid-row, before the second column
// existed, corrupting the line the user was still typing.
//
// Capture group 1 is the separator text without the trailing newline.
const SEPARATOR_INPUT_REGEX = /^(\|\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?)\n$/

// Converts typed Markdown table syntax into a real table: type a header
// row ("| Name | Age |"), press Enter, type the separator row
// ("|---|---|"), press Enter again - that Enter is what turns the two
// paragraphs into an actual table, no reload required.
export const TableMarkdownInputRule = Extension.create({
  name: 'tableMarkdownInputRule',

  addInputRules() {
    return [
      new InputRule({
        find: SEPARATOR_INPUT_REGEX,
        // The runner only dispatches `state.tr` if this handler does NOT
        // return null, and only if `tr` ends up with steps on it - so the
        // table has to be built by mutating `state.tr` directly (matching
        // how Tiptap's own nodeInputRule/wrappingInputRule do it, not via
        // a separate chain()/run() call). Returning null is reserved for
        // "this isn't actually a table, bail out and let Enter behave
        // normally" cases.
        handler: ({ state, range, match }) => {
          const separatorText = match[1]
          if (!isTableSeparatorRow(separatorText)) return null

          const $separator = state.doc.resolve(range.from)
          const separatorParagraph = $separator.parent
          if (separatorParagraph.type.name !== 'paragraph') return null

          const separatorStart = $separator.before($separator.depth)
          const headerNode = state.doc.resolve(separatorStart).nodeBefore
          if (!headerNode || headerNode.type.name !== 'paragraph') return null

          const headerText = headerNode.textContent
          if (!headerText.includes('|')) return null

          const { schema } = state
          const { table, tableRow, tableHeader, tableCell, paragraph } = schema.nodes
          if (!table || !tableRow || !tableHeader || !tableCell) return null

          const headerCells = splitTableRow(headerText)
          const headerStart = separatorStart - headerNode.nodeSize
          // range.to already sits at the separator paragraph's real end -
          // the matched "\n" is a simulated Enter keypress, not text that
          // was actually inserted into the document, so no length
          // adjustment is needed here (unlike a per-keystroke match).
          const separatorEnd = range.to + 1

          const makeCell = (cellType: NodeType, content: string) =>
            cellType.create(
              null,
              paragraph.create(null, content ? schema.text(content) : undefined)
            )

          const headerRow = tableRow.create(
            null,
            headerCells.map((cell) => makeCell(tableHeader, cell))
          )
          const bodyRow = tableRow.create(
            null,
            headerCells.map(() => makeCell(tableCell, ''))
          )
          const tableNode = table.create(null, [headerRow, bodyRow])

          state.tr.replaceWith(headerStart, separatorEnd, tableNode)
          return undefined
        }
      })
    ]
  }
})

export default TableMarkdownInputRule
