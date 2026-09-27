import Image from '@tiptap/extension-image'

const MIN_WIDTH = 40

// Adds a drag handle to resize an image, following the same plain-DOM
// NodeView pattern as CodeBlockWithCopy's copy button and the table's edit
// button - this only changes what's rendered live in the editor; the
// node's own renderHTML (used by editor.getHTML(), and in turn
// htmlToMarkdown) still emits a plain <img>, plus a "width" attribute
// whenever one has been set here.
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute('width')
          return value ? parseInt(value, 10) : null
        },
        renderHTML: (attributes) => (attributes.width ? { width: attributes.width } : {})
      }
    }
  },

  addNodeView() {
    return ({ node, view, getPos }) => {
      const wrapper = document.createElement('span')
      wrapper.className = 'resizable-image-wrapper'

      const img = document.createElement('img')
      const applyAttrs = (attrs: typeof node.attrs): void => {
        img.src = attrs.src
        img.alt = attrs.alt || ''
        if (attrs.title) img.title = attrs.title
        img.style.width = attrs.width ? `${attrs.width}px` : ''
      }
      applyAttrs(node.attrs)

      const handle = document.createElement('span')
      handle.className = 'resizable-image-handle'
      handle.addEventListener('mousedown', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const startX = event.clientX
        const startWidth = img.getBoundingClientRect().width

        const onMouseMove = (moveEvent: MouseEvent): void => {
          const next = Math.round(startWidth + (moveEvent.clientX - startX))
          img.style.width = `${Math.max(MIN_WIDTH, next)}px`
        }
        const onMouseUp = (): void => {
          document.removeEventListener('mousemove', onMouseMove)
          document.removeEventListener('mouseup', onMouseUp)
          const pos = typeof getPos === 'function' ? getPos() : undefined
          if (pos === undefined) return
          const finalWidth = Math.max(MIN_WIDTH, Math.round(img.getBoundingClientRect().width))
          view.dispatch(view.state.tr.setNodeAttribute(pos, 'width', finalWidth))
        }
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
      })

      wrapper.appendChild(img)
      wrapper.appendChild(handle)

      return {
        dom: wrapper,
        update: (updatedNode) => {
          if (updatedNode.type !== node.type) return false
          applyAttrs(updatedNode.attrs)
          return true
        }
      }
    }
  }
})

export default ResizableImage
