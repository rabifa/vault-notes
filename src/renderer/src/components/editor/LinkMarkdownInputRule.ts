import { Extension, InputRule } from '@tiptap/core'

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
  }
})

export default LinkMarkdownInputRule
