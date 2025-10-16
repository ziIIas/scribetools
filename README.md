# scribetools
Helpful tools for editing lyrics on Genius

Installation:
1. Install a script manager if you haven't already [(Violentmonkey reccomended)](https://violentmonkey.github.io/get-it/)
2. [Install the script](https://github.com/ziIIas/scribetools/raw/refs/heads/main/scribetools.user.js)

## Development

This repository now uses a simple Grunt build to make maintaining the userscript manageable.

1. Install dependencies: `npm install`
2. Edit the modular source files inside [`src/`](src)
3. Rebuild the distributable userscript: `npm run build`

`npm run build` concatenates the ordered source files into `scribetools.user.js`, keeping the script compatible with user script managers.
