import { ChevronDown, TranslateIcon } from './Icons'
import { LANGS, setLang, useLang, type Lang } from '../lib/i18n'

/**
 * English or 中文, beside Auto in the backup bar.
 *
 * A real <select> under a pill that looks like the buttons next to it. On an
 * iPhone that opens the system's own wheel, which is easier to hit than any
 * menu drawn here, and a keyboard and a screen reader already know it.
 *
 * The pill names the language the app is in, in that language — so someone
 * who opened it by mistake in a language they cannot read still finds
 * "English" or "中文" to tap.
 */
export default function LanguageSelect({ dark = false }: { dark?: boolean }) {
  const lang = useLang()
  const label = LANGS.find((choice) => choice.value === lang)?.label ?? lang

  return (
    <label
      className={`relative flex shrink-0 cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium transition-colors focus-within:ring-2 focus-within:ring-brand-300 ${
        dark
          ? 'rounded-lg text-neutral-300 hover:bg-white/10'
          : 'rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
      }`}
    >
      <TranslateIcon className="h-3.5 w-3.5" />
      <span>{label}</span>
      <ChevronDown className="h-3 w-3 opacity-60" />
      <select
        value={lang}
        onChange={(event) => setLang(event.target.value as Lang)}
        aria-label="Language · 语言"
        // Over the whole pill and invisible: the pill is what is seen, the
        // select is what is tapped. 16px so iOS does not zoom the page in.
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 text-[16px]"
      >
        {LANGS.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  )
}
