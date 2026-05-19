# Agentrix

Agentrix é um aplicativo desktop para rodar agentes de código, como Codex CLI, Claude Code e Gemini CLI, em terminais embutidos e organizados por workspace.

Ele foi pensado para quem trabalha com vários projetos locais e quer abrir agentes de IA sem depender de janelas externas de terminal. Você seleciona uma pasta, cria um workspace Codex, Claude ou Gemini, e acompanha tudo dentro do próprio app.

## O que o app faz

- Abre workspaces locais a partir de uma pasta do seu computador.
- Roda Codex CLI, Claude Code e Gemini CLI em terminais embutidos.
- Permite manter vários terminais/agentes abertos ao mesmo tempo.
- Suporta layout único ou em grid para comparar agentes.
- Verifica instalação e login dos CLIs separadamente.
- Funciona em macOS e Windows.
- Usa menu nativo no macOS, com opções em pt-BR.
- Salva configurações locais, como pasta padrão, tema, layout, tamanho de fonte e preferências do terminal.

## Principais recursos

### Workspaces

Um workspace representa uma pasta local de projeto. Ao criar um workspace, o Agentrix abre um terminal isolado naquela pasta e inicia o CLI escolhido.

Você pode criar:

- Workspace Codex
- Workspace Claude Code
- Workspace Gemini CLI

### Terminal embutido

O terminal usa xterm.js no frontend e PTY nativo no backend Tauri. Isso permite rodar CLIs interativos dentro da interface do Agentrix.

### Validação de CLIs

Na tela de Settings, o app valida:

- Se o CLI está instalado.
- Qual versão foi encontrada.
- Qual executável está sendo usado.
- Se o login/autenticação está válido.

Para Codex, o app considera autenticado quando:

- `codex login status` retorna sucesso, ou
- `OPENAI_API_KEY` está disponível no ambiente do app.

Para Claude Code, o app considera autenticado quando:

- `claude auth status --text` retorna sucesso.

Para Gemini CLI, o app considera autenticado quando:

- `GEMINI_API_KEY`, `GOOGLE_API_KEY` ou `GOOGLE_APPLICATION_CREDENTIALS` existe no ambiente do app, ou
- `~/.gemini/oauth_creds.json` existe depois do login interativo.

### Menu macOS

Na versão macOS, o menu nativo do app foi localizado para pt-BR. O menu `Janela` inclui opções comuns do macOS, como:

- Minimizar
- Aplicar Zoom
- Preencher
- Centralizar
- Entrar em Tela Cheia

## Stack

- Tauri 2
- Rust
- React 18
- Vite
- TypeScript
- Tailwind CSS
- xterm.js
- portable-pty
- Zustand

## Requisitos

### Obrigatórios

- Node.js 18 ou superior
- npm
- Rust stable

### macOS

No macOS, o runtime web já vem com o sistema.

Instale o Rust, se ainda não tiver:

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Windows

No Windows, use PowerShell.

Requisitos adicionais:

- Microsoft Edge WebView2 Runtime
- Rust stable
- Build Tools do Visual Studio com suporte a C++
- Node.js 18+

Claude Code no Windows pode precisar de Git for Windows ou WSL, conforme o modo de instalação usado.

## Instalação do projeto

Clone o repositório:

```sh
git clone <URL_DO_REPOSITORIO>
cd agentrix
```

Instale as dependências:

```sh
npm install
```

## Rodando em desenvolvimento

### macOS

```sh
npm run tauri:dev
```

### Windows

Abra o PowerShell dentro da pasta do projeto e rode:

```powershell
npm run tauri:dev
```

## Build do aplicativo

### Build macOS

```sh
npm run build
npm run tauri:build:mac
```

O `.app` será gerado em:

```text
src-tauri/target/release/bundle/macos/
```

### Build Windows

No PowerShell:

```powershell
npm run build
npm run tauri:build:windows
```

Os instaladores serão gerados em:

```text
src-tauri/target/release/bundle/
```

## Instalando os CLIs

O Agentrix pode iniciar o fluxo de instalação/login pela própria tela de Settings, mas você também pode instalar manualmente.

### Codex CLI

```sh
npm install -g @openai/codex
```

Login:

```sh
codex --login
```

Verificar login:

```sh
codex login status
```

Opcionalmente, você pode usar `OPENAI_API_KEY` no ambiente.

### Claude Code

```sh
npm install -g @anthropic-ai/claude-code
```

Login:

```sh
claude auth login
```

Verificar login:

```sh
claude auth status --text
```

No Windows, se `claude` não abrir corretamente, instale Git for Windows ou use WSL.

### Gemini CLI

Instalar:

```bash
npm install -g @google/gemini-cli
```

Login:

```bash
gemini
```

Na primeira execução, escolha `Login with Google` ou configure uma chave via `GEMINI_API_KEY`.

## Como usar o Agentrix

1. Abra o app.
2. Clique em `Settings`.
3. Em `Conexões`, instale/verifique Codex, Claude Code e Gemini CLI.
4. Selecione uma pasta de projeto.
5. Crie um workspace Codex, Claude ou Gemini.
6. Use o terminal embutido para interagir com o agente.

Também é possível selecionar a pasta pelo menu macOS:

```text
Arquivo > Abrir Pasta...
```

## Configurações disponíveis

Na tela de Settings, você pode ajustar:

- Pasta padrão de projetos.
- Shell padrão.
- Tamanho da fonte.
- Layout dos workspaces.
- Tema/acento visual.
- Colar com botão direito.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia apenas o frontend Vite |
| `npm run build` | Compila TypeScript e gera o build web |
| `npm run preview` | Serve o build web localmente |
| `npm run tauri:dev` | Inicia o app desktop em modo desenvolvimento |
| `npm run tauri:build` | Build Tauri padrão |
| `npm run tauri:build:mac` | Gera bundle `.app` no macOS |
| `npm run tauri:build:windows` | Gera instaladores Windows via NSIS/MSI |

## Solução de problemas

### O app não encontra o Codex, Claude ou Gemini

Verifique se o CLI está instalado:

```sh
codex --version
claude --version
gemini --version
```

Se funcionar no terminal, mas não no app, reinicie o Agentrix. Apps desktop podem não herdar imediatamente alterações recentes no `PATH`.

### Codex instalado, mas login pendente

Rode:

```sh
codex --login
codex login status
```

Ou defina `OPENAI_API_KEY` como variável de ambiente persistente antes de abrir o app.

### Claude instalado, mas login pendente

Rode:

```sh
claude auth login
claude auth status --text
```

### Gemini instalado, mas login pendente

Rode:

```bash
gemini
```

Depois escolha `Login with Google` no fluxo oficial ou configure `GEMINI_API_KEY`.

### Windows não encontra `claude`

Instale Git for Windows ou rode Claude Code via WSL. Depois reinicie o Agentrix.

### Erro de ícone no build Windows

O projeto já inclui `src-tauri/icons/icon.ico` e o Tauri está configurado para usá-lo. Se o erro continuar, limpe o build e rode novamente:

```powershell
npm run tauri:build:windows
```

### Build macOS falha ao gerar DMG

Use o script que gera somente o `.app`:

```sh
npm run tauri:build:mac
```

## Estrutura do projeto

```text
agentrix/
  src/                 Interface React
  src/components/      Componentes da UI
  src/lib/             Ponte Tauri e tipos utilitários
  src/store/           Estado global com Zustand
  src-tauri/           Aplicação desktop Tauri/Rust
  src-tauri/icons/     Ícones do app
```

## Status

O Agentrix está em desenvolvimento. A base atual já permite rodar workspaces locais com Codex, Claude Code e Gemini CLI, mas novas funções ainda podem mudar conforme o app evolui.
