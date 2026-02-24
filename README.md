# PDF Chisel

Lightweight Windows desktop utility for reshaping PDF files locally — extract pages, split into parts, merge, and convert to images without uploading to any cloud service.

## Prerequisites

- [Git](https://git-scm.com/downloads)
- [nvm-windows](https://github.com/coreybutler/nvm-windows/releases) — use this to manage Node versions on Windows

Install Node 22 LTS:

```sh
nvm install 22
nvm use 22
```

> [!WARNING]
> Using a Node version outside `^20.19.0 || >=22.12.0` can cause Electron native module rebuild failures. Node 22 LTS is the recommended version.

## Clone and install

```sh
git clone https://github.com/YOUR_USERNAME/pdf-chisel.git
cd pdf-chisel
npm install
```

## Run in dev mode

```sh
npm run dev
```

> [!NOTE]
> Unsigned Electron dev builds may trigger a Windows Defender SmartScreen warning. This is expected — dismiss it to continue.

## Build for production

```sh
npm run build:win
```
