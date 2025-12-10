#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const customEditorDir = path.join(rootDir, 'customeditor');
const distDir = path.join(customEditorDir, 'dist', 'assets');
const userscriptPath = path.join(rootDir, 'scribetools.user.js');

const shouldMinify = process.argv.includes('--minify');

function buildCustomEditor() {
    execSync('npm run build', { cwd: customEditorDir, stdio: 'inherit' });
}

function readAssetWithExt(ext) {
    const entries = fs.readdirSync(distDir);
    const file = entries.find(name => name.endsWith(ext));
    if (!file) {
        throw new Error(`No ${ext} asset found in ${distDir}`);
    }
    return fs.readFileSync(path.join(distDir, file), 'utf8');
}

function escapeForTemplateLiteral(content) {
    return content
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$\{/g, '\\${');
}

function updateUserscript(css, js) {
    const source = fs.readFileSync(userscriptPath, 'utf8');
    // Use greedy matching so a previously corrupted block (with duplicated markers)
    // gets fully replaced in one shot.
    const cssPattern = /const CUSTOM_EDITOR_CSS = \/\* CUSTOM_EDITOR_CSS_START \*\/ `[^]*` \/\* CUSTOM_EDITOR_CSS_END \*\//;
    const jsPattern = /const CUSTOM_EDITOR_JS = \/\* CUSTOM_EDITOR_JS_START \*\/ `[^]*` \/\* CUSTOM_EDITOR_JS_END \*\//;

    // Use replacer functions so `$` sequences inside the bundled assets
    // (like `$&`, `$1`) are not treated as special replacement tokens.
    let next = source.replace(
        cssPattern,
        () => `const CUSTOM_EDITOR_CSS = /* CUSTOM_EDITOR_CSS_START */ \`${escapeForTemplateLiteral(css)}\` /* CUSTOM_EDITOR_CSS_END */`
    );

    next = next.replace(
        jsPattern,
        () => `const CUSTOM_EDITOR_JS = /* CUSTOM_EDITOR_JS_START */ \`${escapeForTemplateLiteral(js)}\` /* CUSTOM_EDITOR_JS_END */`
    );

    if (next === source) {
        throw new Error('Failed to inject custom editor assets into scribetools.user.js');
    }

    fs.writeFileSync(userscriptPath, next);
    console.log('✅ Updated scribetools.user.js with built custom editor assets');
}

function maybeMinify(css, js) {
    if (!shouldMinify) return { css, js };
    const { transformSync } = require('esbuild');
    const minifiedCss = transformSync(css, { loader: 'css', minify: true }).code;
    const minifiedJs = transformSync(js, { loader: 'js', minify: true, legalComments: 'none' }).code;
    return { css: minifiedCss, js: minifiedJs };
}

function main() {
    buildCustomEditor();
    let css = readAssetWithExt('.css');
    let js = readAssetWithExt('.js');
    ({ css, js } = maybeMinify(css, js));
    updateUserscript(css, js);
}

main();
