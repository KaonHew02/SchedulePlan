/**
 * The date-holidays library, behind a name of its own.
 *
 * Only ever imported with import(), so it is a separate file in the build that
 * is fetched when a calendar first needs another country's holidays. The file
 * is named after this module, which is why it exists: `holiday-rules-….js` in
 * the offline copy says what it is, where the library's own `index-….js` would
 * not.
 */
export { default } from 'date-holidays'
