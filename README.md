# Vault Notes

Um app de notas para desktop, rápido e com boa experiência de teclado, com visual escuro e detalhes neon. As notas ficam salvas como arquivos Markdown (ou `.txt`) numa pasta do seu disco — o seu próprio "vault" — então elas continuam portáveis e legíveis fora do app também.

<div align="center">

  ![Vault Notes Screenshot](./VaultNotes.png "Vault Notes Screenshot")

  <a href="./LICENSE" target="_blank">
      <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-8A2BE2?style=for-the-badge&labelColor=1C1E26&color=8A2BE2">
  </a>
  <img alt="Electron" src="https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9&labelColor=1C1E26">
  <img alt="React" src="https://img.shields.io/badge/React-2B2E3A?style=for-the-badge&logo=react&logoColor=61DAFB&labelColor=1C1E26">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-2B2E3A?style=for-the-badge&logo=typescript&logoColor=3178C6&labelColor=1C1E26">
  <img alt="Tiptap" src="https://img.shields.io/badge/Tiptap-2B2E3A?style=for-the-badge&logo=tiptap&logoColor=FFFFFF&labelColor=1C1E26">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-2B2E3A?style=for-the-badge&logo=vite&logoColor=BD34FE&labelColor=1C1E26">
</div>

## Funcionalidades

- **Vaults** — escolha qualquer pasta do disco como vault e alterne entre vários vaults; as notas são salvas como arquivos `.md`/`.txt` de verdade, não presas num banco de dados.
- **Edição de texto rica** — negrito, itálico, sublinhado, família e tamanho de fonte, cor de texto personalizada, alinhamento de texto e checklists, com tudo baseado em Markdown para o formato ir e voltar do disco sem perdas.
- **Sidebar** — busca de notas, favoritos, renomear direto na lista, excluir para a lixeira e redimensionar a largura da sidebar como preferir.
- **Estatísticas ao vivo** — contagem de palavras e caracteres atualizada enquanto você digita.
- **Layout responsivo** — a janela redimensiona até 400px de largura, escondendo a sidebar automaticamente quando não há espaço para ela e o editor juntos.
- **Temas** — escolha entre Vault Notes (padrão, ciano/magenta neon), Tokyo Night, Catppuccin, Nord, Hackerman e Dracula, todos em variantes dark, direto por um popup ao lado do seletor de vault.
- **Tabelas** — crie e edite tabelas via Markdown, com um botão flutuante de edição posicionado no próprio canto da tabela.
- **Imagens e vídeos** — anexe imagens no meio da nota, redimensione-as arrastando um handle, e incorpore vídeos do YouTube/Vimeo ou arquivos de vídeo locais.
- **Links** — crie links, abra com Ctrl/Cmd+click e digite a sintaxe Markdown de link que ela vira link automaticamente.
- **Blocos de código** — blocos cercados por ``` com botão de copiar.

## Desenvolvimento

### IDE recomendada

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

### Instalar

```bash
npm install
```

### Rodar em modo dev

```bash
npm run dev
```

### Build

```bash
# Para Windows
npm run build:win

# Para macOS
npm run build:mac

# Para Linux
npm run build:linux
```
