import { Extension, InputRule } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

// Link's own `markdownLinks` option (added in @tiptap/extension-link 3.29.0)
// is supposed to convert [text](url) into a real link the moment it's
// typed, but in this app it silently no-ops while typing - the syntax only
// ever became a link once the note was closed and reopened, which goes
// through this project's own markdown parser instead of the live editor.
// That option's input rule uses a custom function-based `find` (rather
// than a plain regex); this reimplements just the live-typing half with a
// plain regex `find`, the same mechanism the table input rule already
// relies on successfully in this editor.
const MARKDOWN_LINK_INPUT_REGEX = /\[([^[\]]+)\]\((\S+)\)$/

export const LinkMarkdownInputRule = Extension.create({
  name: 'linkMarkdownInputRule',

  addInputRules() {
    return [
      new InputRule({
        find: MARKDOWN_LINK_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const [, label, href] = match
          const linkType = state.schema.marks.link
          if (!linkType) return null

          state.tr
            .delete(range.from, range.to)
            .insertText(label, range.from)
            .addMark(range.from, range.from + label.length, linkType.create({ href }))
          return null
        }
      })
    ]
  },

  addProseMirrorPlugins() {
    // The input rule above only fires while the closing ")" is the very
    // last character typed - it doesn't cover typing the skeleton "[]()"
    // first and going back to fill the label and URL in either order,
    // which never puts the cursor right after that ")" while typing. This
    // instead converts a *finished* [label](url) the moment the cursor
    // moves away from it, regardless of the order it was filled in - a
    // still-open one (cursor inside it) is left alone.
    const MARKDOWN_LINK_REGEX = /\[([^[\]]+)\]\((\S+)\)/g

    return [
      new Plugin({
        key: new PluginKey('linkMarkdownOnLeave'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged || tr.selectionSet)) {
            return null
          }

          const linkType = newState.schema.marks.link
          if (!linkType) return null

          const { from: cursorFrom, to: cursorTo } = newState.selection
          let tr: typeof newState.tr | null = null

          newState.doc.descendants((node, pos) => {
            if (!node.isTextblock) return
            const regex = new RegExp(MARKDOWN_LINK_REGEX)
            let match: RegExpExecArray | null
            // eslint-disable-next-line no-cond-assign
            while ((match = regex.exec(node.textContent))) {
              const matchStart = pos + 1 + match.index
              const matchEnd = matchStart + match[0].length
              // Cursor/selection still touches this span - still being
              // edited, don't convert out from under the user.
              if (cursorFrom <= matchEnd && cursorTo >= matchStart) continue

              const base = tr ?? newState.tr
              const start = base.mapping.map(matchStart)
              const end = base.mapping.map(matchEnd)
              const [, label, href] = match
              base.delete(start, end).insertText(label, start)
              base.addMark(start, start + label.length, linkType.create({ href }))
              tr = base
            }
          })

          return tr
        }
      })
    ]
  }
})

export default LinkMarkdownInputRule
