import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  Close,
  SpeakerIcon,
  SpeakerOffIcon,
  Spinner,
  SwapIcon,
  TrashIcon,
  ZoomIcon,
} from '../components/Icons'
import Popover from '../components/Popover'
import {
  COMMON_LANGUAGES,
  LANGUAGES,
  STARTER,
  isRtl,
  languageName,
  languageOf,
  onVoices,
  speak,
  translate,
  voiceFor,
  type Language,
} from '../lib/translate'
import { deletePhrase, savePhrase, usePhrases } from '../lib/store'
import { tr, useLang } from '../lib/i18n'
import type { Phrase } from '../types'

/**
 * Saying something in a language you do not have.
 *
 * Built for one job: standing in front of somebody in Danang with Chinese in
 * your head and nothing usable coming out. So the shape is the converter's —
 * two boxes and a swap — rather than a chat, and the three things you can do
 * with an answer are the three things that are any use at a counter: **say it**
 * if the phone can, **show it** at a size somebody can read across a table, and
 * **keep it** so it is still there tomorrow with no signal.
 *
 * Keeping matters more than it looks. Every translation on this screen needs a
 * connection and the places you need it least have the worst of it — a border
 * queue, a market, a bus. The last five things translated are written into the
 * notebook, so the second time you need one there is no request at all.
 */

function LanguagePicker({
  value,
  onChange,
  label,
  voices,
}: {
  value: string
  onChange: (code: string) => void
  label: string
  voices: SpeechSynthesisVoice[]
}) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const chosen = languageOf(value)
  const lang = useLang()

  /*
   * The ones a trip from here uses, then the rest alphabetically — the same
   * arrangement as the currency list, for the same reason. Five languages fit
   * in a list; fifty do not, and the five that were there before are still the
   * first things on screen. Alphabetical by the name on screen, so in 中文 the
   * rest are in pinyin order rather than in an English order nobody can see.
   */
  const ordered = useMemo(() => {
    const common = COMMON_LANGUAGES.map((code) => languageOf(code)).filter(
      (language): language is Language => Boolean(language),
    )
    const rest = LANGUAGES.filter((language) => !COMMON_LANGUAGES.includes(language.code)).sort(
      (a, b) => (lang === 'zh' ? a.zh.localeCompare(b.zh, 'zh-CN') : a.name.localeCompare(b.name)),
    )
    return [...common, ...rest]
  }, [lang])

  // Matched on every name it has, because half the time you know it as
  // 'Khmer' or 高棉语 and half the time you are looking for ខ្មែរ.
  const matches = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return ordered
    return ordered.filter(
      (language) =>
        language.name.toLowerCase().includes(text) ||
        language.zh.includes(text) ||
        language.native.toLowerCase().includes(text) ||
        language.code.toLowerCase().startsWith(text),
    )
  }, [ordered, query])

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          setQuery('')
          setOpen((was) => !was)
        }}
        className={`flex shrink-0 items-center gap-1 rounded-xl bg-neutral-100 px-3 py-1.5 text-[15px] font-medium transition-colors hover:bg-neutral-200/70 ${
          open ? 'bg-neutral-200/70 ring-2 ring-brand-500/40' : ''
        }`}
      >
        {chosen?.native ?? value}
        <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
      </button>

      {open && (
        <Popover anchor={anchor} label={label} onClose={() => setOpen(false)}>
          <div className="w-[248px] p-2">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tr('Search', '搜索')}
              aria-label={tr('Search languages', '搜索语言')}
              className="mb-1 w-full rounded-lg bg-neutral-100 px-3 py-2 text-[14px] outline-hidden placeholder:text-neutral-400"
            />
            <div className="no-scrollbar max-h-[228px] overflow-y-auto">
              {matches.length === 0 && (
                <p className="px-3 py-4 text-center text-[13px] text-neutral-400">
                  {tr('No language matches that.', '没有符合的语言。')}
                </p>
              )}
              {matches.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  // The crossed-out speaker needs a sentence somewhere, and a
                  // row in a list is not the place to print one.
                  title={
                    voiceFor(language.speech, voices)
                      ? languageName(language)
                      : tr(
                          `${language.name} — this device has no voice for it, so it can be shown but not spoken`,
                          `${language.zh}：这台设备没有这种语音，只能显示，不能朗读`,
                        )
                  }
                  onClick={() => {
                    onChange(language.code)
                    setOpen(false)
                  }}
                  className={`flex w-full items-baseline gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    language.code === value ? 'bg-brand-50' : 'hover:bg-neutral-100'
                  }`}
                >
                  <span
                    className={`text-[14px] ${
                      language.code === value ? 'font-medium text-brand-700' : ''
                    }`}
                  >
                    {language.native}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-400">
                    {languageName(language)}
                  </span>
                  {/* Said here rather than when you press speak, so the choice
                      is made knowing what the phone can do with it. */}
                  {!voiceFor(language.speech, voices) && (
                    <SpeakerOffIcon
                      className="h-3.5 w-3.5 shrink-0 text-neutral-300"
                      aria-label={tr('No voice on this device', '这台设备没有这种语音')}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </Popover>
      )}
    </>
  )
}

/**
 * The answer at the size of a room.
 *
 * The thing K is actually going to do with a Vietnamese sentence is hold the
 * phone out, and a 17px line in a card is not readable at arm's length across
 * a food stall in daylight. This is that sentence and nothing else.
 */
function ShowSheet({
  phrase,
  language,
  onClose,
}: {
  phrase: string
  language: Language | undefined
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      role="dialog"
      aria-label={tr('The phrase, large', '放大的短语')}
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-[13px] text-neutral-400">{language?.native ?? ''}</span>
        <button
          onClick={onClose}
          aria-label={tr('Close', '关闭')}
          className="-mr-1.5 p-1.5 text-neutral-400"
        >
          <Close />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <p
          dir={language && isRtl(language.code) ? 'rtl' : 'ltr'}
          className="text-center text-[30px] font-semibold leading-tight sm:text-[40px]"
        >
          {phrase}
        </p>
      </div>
    </div>
  )
}

function PhraseRow({
  phrase,
  voices,
  onUse,
  onToast,
}: {
  phrase: Phrase
  voices: SpeechSynthesisVoice[]
  onUse: (phrase: Phrase) => void
  onToast: (message: string) => void
}) {
  const target = languageOf(phrase.to)
  const speakable = Boolean(target && voiceFor(target.speech, voices))

  return (
    <div className="flex items-start gap-2 border-b border-neutral-100 py-3">
      <button onClick={() => onUse(phrase)} className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] leading-6">{phrase.result}</span>
        <span className="block text-[13px] leading-5 text-neutral-400">{phrase.source}</span>
      </button>

      {speakable && (
        <button
          onClick={() => speak(phrase.result, target!.speech, voices)}
          aria-label={tr('Say it', '朗读')}
          className="shrink-0 p-1.5 text-neutral-400"
        >
          <SpeakerIcon className="h-[17px] w-[17px]" />
        </button>
      )}

      <button
        onClick={() =>
          void deletePhrase(phrase.id).then(() => onToast(tr('Removed', '已移除')))
        }
        aria-label={tr('Remove', '移除')}
        className="shrink-0 p-1.5 text-neutral-300"
      >
        <TrashIcon className="h-[15px] w-[15px]" />
      </button>
    </div>
  )
}

/**
 * Where an answer came from. `via` holds a translator's name, or 'your book'
 * or 'no change', and is only made into a sentence here, so the line follows
 * a switch of language even for an answer that arrived before it.
 */
function viaLine(via: string): string {
  if (via === 'your book') return tr('via your book', '来自短语本')
  if (via === 'no change') return tr('via no change', '原文不变')
  return tr(`via ${via}`, `由 ${via} 翻译`)
}

export default function TranslateScreen({
  onToast,
}: {
  onToast: (message: string) => void
}) {
  const phrases = usePhrases()

  const [from, setFrom] = useState('zh-CN')
  const [to, setTo] = useState('vi')
  const [source, setSource] = useState('')
  const [result, setResult] = useState<{ text: string; via: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showing, setShowing] = useState<string | null>(null)

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => onVoices(setVoices), [])

  const target = languageOf(to)
  const targetVoice = target ? voiceFor(target.speech, voices) : null

  /*
   * Your last five, newest first. The store keeps no more than that.
   *
   * The basics below are a separate list rather than seed rows in this one.
   * They were mixed in at first, shown only while the book was empty, which
   * meant translating a single thing made 你好 and 多少钱 disappear — the
   * twelve phrases most likely to be wanted, evicted by the first one that
   * wasn't. They are a fixed card in the back of the book now and they stay.
   */
  const book = useMemo(
    () =>
      [...phrases].sort((a, b) => b.savedAt.localeCompare(a.savedAt) || b.id - a.id),
    [phrases],
  )

  const basics = useMemo(
    () =>
      STARTER.map((row, index) => ({
        ...row,
        id: -(index + 1),
        savedAt: '',
      })) as Phrase[],
    [],
  )

  async function run() {
    const text = source.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const answer = await translate(text, from, to)
      setResult(answer)
      // Kept without being asked. The moment worth keeping it is the moment it
      // arrives, and nobody standing at a counter taps save first.
      await savePhrase({ from, to, source: text, result: answer.text })
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('That did not work.', '没有成功。'))
    } finally {
      setBusy(false)
    }
  }

  function swap() {
    setFrom(to)
    setTo(from)
    if (result) setSource(result.text)
    setResult(null)
  }

  function reuse(phrase: Phrase) {
    setFrom(phrase.from)
    setTo(phrase.to)
    setSource(phrase.source)
    setResult({ text: phrase.result, via: 'your book' })
    setError(null)
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm">
        <div className="flex items-center px-5 pb-3 pt-4 lg:px-8">
          <h1 className="text-[19px] font-semibold tracking-tight lg:text-[22px]">
            {tr('Translate', '翻译')}
          </h1>
        </div>
      </header>

      <main className="px-5 pb-28 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:px-8 lg:pb-10">
        <div>
          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <LanguagePicker
                value={from}
                onChange={setFrom}
                label={tr('Translate from', '源语言')}
                voices={voices}
              />
              <button
                onClick={swap}
                aria-label={tr('Swap the two languages', '互换两种语言')}
                className="rounded-full border border-neutral-200 p-2 text-neutral-500 transition-colors hover:bg-neutral-50"
              >
                <SwapIcon className="h-4 w-4" />
              </button>
              <LanguagePicker
                value={to}
                onChange={setTo}
                label={tr('Translate to', '目标语言')}
                voices={voices}
              />
            </div>

            <textarea
              value={source}
              onChange={(event) => setSource(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends, because these are phrases and not paragraphs.
                // Shift+Enter is still there for the rare one that is both.
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void run()
                }
              }}
              rows={2}
              placeholder={tr(
                `Type in ${languageOf(from)?.native ?? ''}`,
                `用${languageOf(from)?.zh ?? ''}输入`,
              )}
              aria-label={tr('What to translate', '要翻译的内容')}
              className="mt-3 w-full resize-none bg-transparent text-[17px] leading-7 outline-hidden placeholder:text-neutral-300"
            />

            <div className="mt-1 flex items-center gap-2">
              {source && (
                <button
                  onClick={() => {
                    setSource('')
                    setResult(null)
                    setError(null)
                  }}
                  className="text-[13px] text-neutral-400"
                >
                  {tr('Clear', '清空')}
                </button>
              )}
              <button
                onClick={() => void run()}
                disabled={!source.trim() || busy}
                className="ml-auto flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-[14px] font-medium text-white transition-opacity disabled:opacity-40"
              >
                {busy && <Spinner className="h-4 w-4" />}
                {tr('Translate', '翻译')}
              </button>
            </div>
          </div>

          {result && (
            <div className="mt-3 rounded-2xl bg-neutral-50 p-4">
              <p
                dir={isRtl(to) ? 'rtl' : 'ltr'}
                className="text-[20px] font-medium leading-8"
              >
                {result.text}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {targetVoice ? (
                  <button
                    onClick={() => speak(result.text, target!.speech, voices)}
                    className="flex items-center gap-1.5 rounded-full bg-brand-500 px-3.5 py-2 text-[13px] font-medium text-white"
                  >
                    <SpeakerIcon className="h-4 w-4" />
                    {tr('Say it', '朗读')}
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-neutral-200/70 px-3.5 py-2 text-[13px] text-neutral-500">
                    <SpeakerOffIcon className="h-4 w-4" />
                    {tr(<>No {target?.name} voice</>, <>没有{target?.zh}语音</>)}
                  </span>
                )}

                <button
                  onClick={() => setShowing(result.text)}
                  className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-[13px] font-medium"
                >
                  <ZoomIcon className="h-4 w-4 text-neutral-400" />
                  {tr('Show it', '放大显示')}
                </button>

                <span className="ml-auto text-[12px] text-neutral-400">{viaLine(result.via)}</span>
              </div>

              {/*
                Said here and not hidden in a settings note, because the reason
                the button is missing is fixable and the fix is not obvious:
                the phone needs the language installed, not the app updated.
              */}
              {!targetVoice && (
                <p className="mt-2 text-[12px] leading-5 text-neutral-400">
                  {tr(
                    <>
                      This device has no {target?.name} voice, so nothing would come out but an
                      English accent reading the letters. Phones normally have one; on Windows it is
                      Settings → Time &amp; Language → Speech → Add voices. Until then, Show it.
                    </>,
                    <>
                      这台设备没有{target?.zh}语音，读出来只会是英语口音在念字母。手机一般都有；Windows
                      上在「设置 → 时间和语言 → 语音 → 添加语音」。在那之前，先用「放大显示」。
                    </>,
                  )}
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[13px] leading-5 text-amber-800">
              {error}
            </p>
          )}
        </div>

        <div>
          {book.length > 0 && (
            <>
              <h2 className="pb-1 pt-8 text-[13px] font-medium text-neutral-400 lg:pt-0">
                {tr('Recent', '最近翻译')}
              </h2>
              <div className="border-t border-neutral-100">
                {book.map((phrase) => (
                  <PhraseRow
                    key={phrase.id}
                    phrase={phrase}
                    voices={voices}
                    onUse={reuse}
                    onToast={onToast}
                  />
                ))}
              </div>
              <p className="pt-3 text-[12px] leading-5 text-neutral-400">
                {tr(
                  'Your last 5 translations, kept so they still work with no signal.',
                  '最近翻译的 5 条，没有信号也能用。',
                )}
              </p>
            </>
          )}

          <h2
            className={`pb-1 text-[13px] font-medium text-neutral-400 ${
              book.length > 0 ? 'pt-8' : 'pt-8 lg:pt-0'
            }`}
          >
            {tr('Travel basics', '旅行常用语')} · 华语 → Tiếng Việt
          </h2>
          <div className="border-t border-neutral-100">
            {/* Not rows in the notebook: there is nothing to star or delete on
                a phrase nobody wrote. Tapping one loads it, which is when it
                becomes something you can say and show. */}
            {basics.map((phrase) => (
              <button
                key={phrase.id}
                onClick={() => reuse(phrase)}
                className="flex w-full items-start border-b border-neutral-100 py-3 text-left active:bg-neutral-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-6">{phrase.result}</span>
                  <span className="block text-[13px] leading-5 text-neutral-400">
                    {phrase.source}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </main>

      {showing && (
        <ShowSheet phrase={showing} language={target} onClose={() => setShowing(null)} />
      )}
    </>
  )
}
