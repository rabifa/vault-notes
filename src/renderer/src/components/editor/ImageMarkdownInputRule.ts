import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

// Matches a finished "![alt](path)" whose path looks like a local absolute
// file - a Windows drive letter or a leading slash - the same shape
// handlePaste in TipTapEditor.tsx already treats as "copy this file in"
// rather than literal text. A remote image URL or anything else is left
// alone; it still becomes a real <img> on save/reload via the app's own
// Markdown parser (see resolveImageDisplayUrl in utils/markdown.ts).
const LOCAL_IMAGE_REGEX = /!\[([^[\]]*)\]\(((?:[a-zA-Z]:[\\/]|\/)[^)\s]+)\)/

// Copying the file into the vault's attachments is async (an IPC round
// trip), which a ProseMirror InputRule/appendTransaction handler can't
// await - this extension is configured with a callback that does that
// work and resolves to the "vault-file://" src to use, or null to leave
// the typed text as-is (e.g. no active note yet, or the copy failed).
type LocalImageResolver = (sourceFilePath: string) => Promise<string | null>

export const ImageMarkdownInputRule = Extension.create<{
  onLocalImagePath: LocalImageResolver | null
}>({
  name: 'imageMarkdownInputRule',

  addOptions() {
    return {
      onLocalImagePath: null
    }
  },

  addProseMirrorPlugins() {
    // Tracks matches whose async copy is still in flight, keyed by their
    // full matched text - without this, every keystroke typed elsewhere
    // before that copy resolves would re-scan the doc, find the same
    // still-unconverted text, and kick off a redundant duplicate copy.
    const inFlight = new Set<string>()

    return [
      new Plugin({
        key: new PluginKey('imageMarkdownOnLeave'),
        // Converts a *finished* ![alt](path) the moment the cursor moves
        // away from it, regardless of the order it was typed in (same
        // rationale as LinkMarkdownInputRule's own "on leave" plugin) - a
        // still-open one (cursor inside it) is left alone.
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged || tr.selectionSet)) {
            return null
          }

          const onLocalImagePath = this.options.onLocalImagePath
          if (!onLocalImagePath) return null

          const { from: cursorFrom, to: cursorTo } = newState.selection
          const view = this.editor.view

          newState.doc.descendants((node, pos) => {
            if (!node.isTextblock) return
            const regex = new RegExp(LOCAL_IMAGE_REGEX, 'g')
            let match: RegExpExecArray | null
            // eslint-disable-next-line no-cond-assign
            while ((match = regex.exec(node.textContent))) {
              const matchStart = pos + 1 + match.index
              const matchEnd = matchStart + match[0].length
              // Cursor/selection still touches this span - still being
              // edited, don't convert out from under the user.
              if (cursorFrom <= matchEnd && cursorTo >= matchStart) continue

              const [fullMatch, alt, sourceFilePath] = match
              if (inFlight.has(fullMatch)) continue
              inFlight.add(fullMatch)

              onLocalImagePath(sourceFilePath).then((src) => {
                inFlight.delete(fullMatch)
                if (!src) return
                const { state, dispatch } = view
                // The async copy may finish after further edits elsewhere -
                // only replace if the text at these positions is still
                // exactly what matched, rather than trusting stale positions.
                if (state.doc.textBetween(matchStart, matchEnd) !== fullMatch) return
                const imageType = state.schema.nodes.image
                if (!imageType) return
                dispatch(state.tr.replaceWith(matchStart, matchEnd, imageType.create({ src, alt })))
              })
            }
          })

          return null
        }
      })
    ]
  }
})

export default ImageMarkdownInputRule
