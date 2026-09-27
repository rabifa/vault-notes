import { TableView } from '@tiptap/extension-table'
import {
  addRowAfter,
  addColumnAfter,
  deleteRow,
  deleteColumn,
  deleteTable
} from '@tiptap/pm/tables'
import { Selection } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView, NodeView } from '@tiptap/pm/view'

type TableViewInstance = InstanceType<typeof TableView>

// Same icon as lucide-react's <TableProperties /> (used by the toolbar's
// old in-place "Editar Tabela" button), reproduced as a raw SVG string
// since this NodeView is plain DOM, not React.
const TABLE_PROPERTIES_ICON_SVG = `
  <path d="M15 3v18"></path>
  <rect width="18" height="18" x="3" y="3" rx="2"></rect>
  <path d="M21 9H3"></path>
  <path d="M21 15H3"></path>
`

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

// Places the selection inside this table before running a row/column
// command, but only when it isn't there already - row/column commands act
// on the cell the selection is currently in, and with several tables in a
// note the selection may still be sitting in a different one (or nowhere)
// when this table's own button is clicked.
function ensureSelectionInTable(view: EditorView, tableEl: HTMLTableElement): void {
  const { node: domNode } = view.domAtPos(view.state.selection.from)
  if (tableEl.contains(domNode)) return
  const pos = view.posAtDOM(tableEl, 0)
  const $pos = view.state.doc.resolve(pos)
  view.dispatch(view.state.tr.setSelection(Selection.near($pos, 1)))
}

type TableCommand = (state: EditorView['state'], dispatch: EditorView['dispatch']) => boolean

interface MenuItemConfig {
  label: string
  command: TableCommand
  danger?: boolean
}

// Adds an "edit table" button to tables via a plain DOM NodeView, following
// the same pattern as CodeBlockWithCopy's copy button: a small floating
// control anchored to the node's own wrapper instead of living in the main
// toolbar, so it stays available (and only meaningful) right where the
// table is, rather than needing the cursor placed inside it first.
export class TableViewWithEditButton implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private inner: TableViewInstance
  private menu: HTMLDivElement
  private editButton!: HTMLButtonElement
  private handleOutsideClick = (event: MouseEvent): void => {
    if (!this.menuContainer.contains(event.target as Node)) {
      this.closeMenu()
    }
  }
  private menuContainer: HTMLDivElement

  constructor(
    node: PMNode,
    cellMinWidth: number,
    view: EditorView,
    HTMLAttributes: Record<string, unknown> = {}
  ) {
    this.inner = new TableView(node, cellMinWidth, view, HTMLAttributes)
    this.contentDOM = this.inner.contentDOM

    const outer = document.createElement('div')
    outer.className = 'table-node-wrapper'
    outer.appendChild(this.inner.dom)

    const menuContainer = document.createElement('div')
    menuContainer.className = 'table-edit-menu-container'
    this.menuContainer = menuContainer

    const editButton = document.createElement('button')
    editButton.type = 'button'
    editButton.className = 'table-edit-btn'
    editButton.title = 'Editar Tabela'
    editButton.appendChild(svgIcon(TABLE_PROPERTIES_ICON_SVG))
    editButton.addEventListener('mousedown', (event) => event.preventDefault())
    editButton.addEventListener('click', (event) => {
      event.preventDefault()
      this.toggleMenu()
    })
    this.editButton = editButton

    const menu = document.createElement('div')
    menu.className = 'dropdown-menu table-edit-dropdown'
    menu.style.display = 'none'
    this.menu = menu

    const tableEl = this.inner.table
    const run = (command: TableCommand) => {
      ensureSelectionInTable(view, tableEl)
      command(view.state, view.dispatch)
      view.focus()
      this.closeMenu()
    }

    const items: MenuItemConfig[] = [
      { label: 'ADICIONAR LINHA ABAIXO', command: addRowAfter },
      { label: 'ADICIONAR COLUNA À DIREITA', command: addColumnAfter }
    ]
    const dangerItems: MenuItemConfig[] = [
      { label: 'EXCLUIR LINHA', command: deleteRow, danger: true },
      { label: 'EXCLUIR COLUNA', command: deleteColumn, danger: true },
      { label: 'EXCLUIR TABELA', command: deleteTable, danger: true }
    ]

    for (const item of items) {
      menu.appendChild(this.createMenuItem(item, run))
    }
    const divider = document.createElement('div')
    divider.className = 'dropdown-divider-thin'
    menu.appendChild(divider)
    for (const item of dangerItems) {
      menu.appendChild(this.createMenuItem(item, run))
    }

    menuContainer.appendChild(editButton)
    menuContainer.appendChild(menu)
    outer.appendChild(menuContainer)

    this.dom = outer
  }

  private createMenuItem(
    { label, command, danger }: MenuItemConfig,
    run: (command: TableCommand) => void
  ): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `dropdown-item${danger ? ' danger' : ''}`
    button.textContent = label
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', (event) => {
      event.preventDefault()
      run(command)
    })
    return button
  }

  private toggleMenu(): void {
    if (this.menu.style.display === 'none') this.openMenu()
    else this.closeMenu()
  }

  private openMenu(): void {
    this.menu.style.display = 'flex'
    this.editButton.classList.add('active')
    // Deferred so the click that opened the menu doesn't immediately
    // bubble into this same listener and close it right back.
    window.setTimeout(() => document.addEventListener('mousedown', this.handleOutsideClick), 0)
  }

  private closeMenu(): void {
    this.menu.style.display = 'none'
    this.editButton.classList.remove('active')
    document.removeEventListener('mousedown', this.handleOutsideClick)
  }

  update(node: PMNode): boolean {
    return this.inner.update(node)
  }

  ignoreMutation(record: Parameters<TableViewInstance['ignoreMutation']>[0]): boolean {
    // The inner TableView's own ignoreMutation only knows about its own dom
    // (the tableWrapper) - our edit button and menu live outside it, as a
    // sibling, so mutations there (opening/closing the menu, etc.) need to
    // be ignored here directly instead of delegating.
    if (this.menuContainer.contains(record.target)) return true
    return this.inner.ignoreMutation(record)
  }

  destroy(): void {
    document.removeEventListener('mousedown', this.handleOutsideClick)
  }
}

export default TableViewWithEditButton
