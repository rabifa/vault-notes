import { Node, mergeAttributes } from '@tiptap/core'

export type VideoProvider = 'youtube' | 'vimeo' | 'file'

// Recognizes a handful of common video link shapes inside "![alt](url)" -
// YouTube/Vimeo pages (turned into their embeddable player URL) and a
// direct link to a video file (played back with a native <video> tag).
// Anything else stays a plain image, unresolved-video URL included - it'll
// just render as a broken image, same as before this existed.
export function detectVideoProvider(url: string): VideoProvider | null {
  if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(url)) {
    return 'youtube'
  }
  if (/^https?:\/\/(www\.)?vimeo\.com\//i.test(url)) {
    return 'vimeo'
  }
  if (/\.(mp4|webm|ogg|ogv|mov)(\?\S*)?$/i.test(url)) {
    return 'file'
  }
  return null
}

// Turns the URL the user actually typed/pasted into the one that can be
// dropped in an <iframe src>. Returns null for a link that matched the
// provider's domain but not a recognizable video-id shape (e.g. the
// channel's homepage) - that's left as a broken image rather than an
// embed pointed at nothing.
export function toEmbedUrl(url: string, provider: VideoProvider): string | null {
  if (provider === 'file') return url

  if (provider === 'youtube') {
    const idMatch =
      url.match(/[?&]v=([\w-]+)/) ||
      url.match(/youtu\.be\/([\w-]+)/) ||
      url.match(/\/(?:embed|shorts)\/([\w-]+)/)
    return idMatch ? `https://www.youtube.com/embed/${idMatch[1]}` : null
  }

  // vimeo
  const idMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return idMatch ? `https://player.vimeo.com/video/${idMatch[1]}` : null
}

export interface VideoEmbedOptions {
  HTMLAttributes: Record<string, unknown>
}

// A video embed - YouTube/Vimeo as a sandboxed <iframe>, a direct file
// link as a native <video> - stored as its own node (parseHTML/renderHTML
// below) rather than an <img>, so the app's schema doesn't try to render
// the video URL as an image. See utils/markdown.ts for how "![alt](url)"
// gets recognized into this on load, and serialized back on save.
export const VideoEmbed = Node.create<VideoEmbedOptions>({
  name: 'videoEmbed',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      provider: { default: 'file' }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-video-embed]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const { src, alt, provider } = node.attrs
    const wrapperAttrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      'data-video-embed': '',
      'data-src': src,
      'data-alt': alt || '',
      'data-provider': provider,
      class: provider === 'file' ? 'video-embed-file' : 'video-embed-frame'
    })

    if (provider === 'file') {
      return ['div', wrapperAttrs, ['video', { src, controls: 'true' }]]
    }

    const embedUrl = toEmbedUrl(src, provider as VideoProvider)
    return [
      'div',
      wrapperAttrs,
      [
        'iframe',
        {
          src: embedUrl,
          frameborder: '0',
          allow:
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
          allowfullscreen: 'true',
          // Same-origin is needed for the provider's own player UI to work
          // at all - scripts are the provider's, not arbitrary page
          // content the note itself controls.
          sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups'
        }
      ]
    ]
  }
})

export default VideoEmbed
