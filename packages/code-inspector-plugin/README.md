# cursor-grabber: DOM element &rarr; cursor chat

_vibe-fork of [zh-lx/code-inspector](https://github.com/zh-lx/code-inspector), inspired by this [demo](https://x.com/mkliku/status/1987672848253718782?s=20) of [inspector](https://www.tryinspector.com)_

# demo
https://youtu.be/-cykd0pD9p8

# quick(ish)-start
1. clone/fork this repo
2. build
```
cd cursor-grabber
pnpm install && pnpm build
```
3. set up local package link
```
cd cursor-grabber/packages/code-inspector-plugin
pnpm link
```
4. build & install cursor extension
```
cd cursor-grabber/cursor-extension
cursor --install-extension click-to-cursor-extension-0.0.1.vsix
```
(restart extension host if needed `cmd+shift+p` &rarr; Restart Extension Host)

5. add link in your project
```
cd path/to/my-project
npm link code-inspector-plugin
```
6. add configuration to your project

```typescript
// next.config.ts

import type { NextConfig } from "next";
import { codeInspectorPlugin } from 'code-inspector-plugin';

const nextConfig: NextConfig = {
  turbopack: {
    rules: codeInspectorPlugin({
      bundler: 'turbopack',
      editor: 'cursor',
      printServer: true,
      behavior: {
        defaultAction: 'locate',
      },
    })
  }
};

export default nextConfig;
```

# usage
- open your project in cursor
- start your server as normal (`npm run dev`)
- hold `option+shift` then click your target element
- go to cursor, `cmd+v` in the chat, and it'll attach those lines as chat context

# notes / quirks
- i have only tested this with nextjs, but it probably works with everything that is supported by [zh-lx/code-inspector](https://github.com/zh-lx/code-inspector)
- feel free to contribute :) i'd like to eventually publish this as a standalone npm pkg + vscode extension

# development
## changes from original
- removed all demo stuff
- updated client to pass `endLine` instead of just start line number
- removed `launchIDE` call &rarr; replaced with request to vscode server ext
- added vscode ext

## cursor (vscode) extension
you can make changes then build/install like this:
```
cd cursor-grabber/cursor-extension
npm run compile
vsce package --no-yarn
cursor --install-extension click-to-cursor-extension-0.0.1.vsix
```