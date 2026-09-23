import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * What the published page is allowed to load, and where it may send anything.
 *
 * This is the thing that actually stops a script that is not ours. The code
 * itself cannot be hidden — a browser has to be handed a script to run it,
 * and the person holding the browser can always read it and change their own
 * copy of the page. What can be controlled is what the page will *trust*: with
 * this in place, a script that got in some other way — a crafted backup
 * file, a poisoned dependency — cannot run from inline markup, cannot load
 * more code from a server of its choosing, and cannot post the notebook
 * anywhere that is not on this list.
 *
 * Every origin is here for one feature, and removing one breaks exactly that:
 *
 *   accounts.google.com/gsi     Drive sign-in (Google's documented CSP set)
 *   www.googleapis.com          Drive read and write
 *   cdn.jsdelivr.net            the OCR engine, its WebAssembly core and the
 *                               English data — fetched on first scan
 *   'wasm-unsafe-eval'          compiling that WebAssembly; it allows wasm
 *                               only, not eval() of JavaScript
 *   open.er-api.com,
 *   api.frankfurter.dev         the two rate feeds
 *   translate.googleapis.com,
 *   api.mymemory.translated.net the two translators
 *   blob: in worker-src         the OCR worker is started from a blob
 *   blob: in frame-src          the PDF viewer
 *   data:/blob: in connect-src  Import decodes attachments with fetch()
 *
 * Adding a feature that talks to a new server means adding it here, and the
 * console will say so the first time it is refused.
 *
 * A <meta> tag rather than a header because GitHub Pages cannot set headers.
 * The two things a meta policy cannot do — `frame-ancestors` and reporting —
 * are not worth a different host.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  [
    "connect-src 'self' data: blob:",
    'https://www.googleapis.com https://accounts.google.com/gsi/',
    'https://cdn.jsdelivr.net',
    'https://open.er-api.com https://api.frankfurter.dev',
    'https://translate.googleapis.com https://api.mymemory.translated.net',
  ].join(' '),
  "img-src 'self' data: blob:",
  "style-src 'self' https://accounts.google.com/gsi/style",
  "font-src 'self'",
  'frame-src blob: https://accounts.google.com/gsi/',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

/**
 * The policy goes into the built page only. The dev server works by running
 * inline scripts and swapping styles in over a websocket — exactly what the
 * policy forbids — so `npm run dev` is left alone, and `npm run build`
 * followed by `npm run preview` is how to see the site as it is published.
 */
function contentSecurityPolicy(): Plugin {
  const charset = '<meta charset="UTF-8" />'
  return {
    name: 'scheduleplan-csp',
    apply: 'build',
    transformIndexHtml(html) {
      // Straight after the charset: before any script, so it governs all of
      // them, and after the charset, which has to sit in the first kilobyte.
      if (!html.includes(charset)) {
        throw new Error('index.html has no charset tag to put the security policy after.')
      }
      return html.replace(
        charset,
        `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      )
    },
  }
}

export default defineConfig({
  // The site is served from https://kaonhew02.github.io/SchedulePlan/, so every
  // asset URL needs that prefix. The dev server uses it too, which keeps the
  // two identical.
  base: '/SchedulePlan/',
  plugins: [react(), contentSecurityPolicy()],
  build: {
    // No source maps on the live site. They would hand anyone the original
    // files with every comment in them; without them the browser gets only the
    // minified bundle. This is tidiness, not protection — the repository is
    // public and the bundle is still readable to anyone patient enough.
    sourcemap: false,
  },
  server: {
    // host: true so the app can be opened from a phone on the same wifi.
    host: true,
    port: 5173,
  },
})
