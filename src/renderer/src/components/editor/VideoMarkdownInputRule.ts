import { Extension, InputRule } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { detectVideoProvider } from './VideoEmbed'

// Same shape LinkMarkdownInputRule watches for, but only actually converts
// when the URL is a recognized video link (see detectVideoProvider) -
// "![alt](url)" for anything else is left alone, still handled by
// utils/markdown.ts as a plain image on save/reload.
const VIDEO_MARKDOWN_INPUT_REGEX = /!\[([^[\]]*)\]\((\S+)\)$/

export const VideoMarkdownInputRule = Extension.create({
  name: 'videoMarkdownInputRule',

  addInputRules() {
    return [
      new InputRule({
        find: VIDEO_MARKDOWN_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const [, alt, url] = match
          const provider = detectVideoProvider(url)
          if (!provider) return null
          const videoType = state.schema.nodes.videoEmbed
          if (!videoType) return null

          state.tr.replaceWith(range.from, range.to, videoType.create({ src: url, alt, provider }))
          return null
        }
      })
    ]
  },

  addProseMirrorPlugins() {
    // Same rationale as LinkMarkdownInputRule's own "on leave" plugin: the
    // input rule above only fires while the closing ")" is the very last
    // character typed. This instead converts a *finished* ![alt](url) the
    // moment the cursor moves away from it - covers pasting the whole
    // thing as plain text too (which is how it reaches here at all when
    // Link's own linkOnPaste has already turned the URL into a link mark;
    // replacing the range drops that mark along with the rest of the text).
    const VIDEO_MARKDOWN_REGEX = /!\[([^[\]]*)\]\((\S+)\)/g

    return [
      new Plugin({
        key: new PluginKey('videoMarkdownOnLeave'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged || tr.selectionSet)) {
            return null
          }

          const videoType = newState.schema.nodes.videoEmbed
          if (!videoType) return null

          const { from: cursorFrom, to: cursorTo } = newState.selection
          let tr: typeof newState.tr | null = null

          newState.doc.descendants((node, pos) => {
            if (!node.isTextblock) return
            const regex = new RegExp(VIDEO_MARKDOWN_REGEX)
            let match: RegExpExecArray | null
            // eslint-disable-next-line no-cond-assign
            while ((match = regex.exec(node.textContent))) {
              const matchStart = pos + 1 + match.index
              const matchEnd = matchStart + match[0].length
              if (cursorFrom <= matchEnd && cursorTo >= matchStart) continue

              const [, alt, url] = match
              const provider = detectVideoProvider(url)
              if (!provider) continue

              const base = tr ?? newState.tr
              const start = base.mapping.map(matchStart)
              const end = base.mapping.map(matchEnd)
              base.replaceWith(start, end, videoType.create({ src: url, alt, provider }))
              tr = base
            }
          })

          return tr
        }
      })
    ]
  }
})

export default VideoMarkdownInputRule
