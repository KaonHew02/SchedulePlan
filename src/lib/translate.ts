/**
 * Turning a phrase into another language, and saying it out loud.
 *
 * Two halves, with completely different failure modes.
 *
 * **Translating** is a fetch, and it goes through a list of providers the same
 * way the rates do, for the same reason: there is nowhere on a static site to
 * hide a key, so the only usable service is one that does not want one. The
 * first provider is Google's own web endpoint — unofficial, undocumented, and
 * the better of the two by a distance. It is first because it is better and
 * second-guessed because it is unofficial: the day it stops answering,
 * MyMemory (which is a published free API) answers instead, and the screen
 * says which one replied.
 *
 * **Speaking** is the browser's, and this is the part that cannot be fixed in
 * code. `speechSynthesis` can only speak a language the *device* has a voice
 * for. A Windows laptop with no language pack has three American English
 * voices and nothing else, and handing "Xin chào" to an American voice
 * produces confident nonsense — worse than silence, because it sounds like it
 * worked. So the voice is looked up before the button is offered, and when
 * there is none the screen says so and offers the text at reading-across-a-
 * counter size instead. That is the flag-emoji rule from the README applied to
 * sound: do not lean on something one platform does not have.
 */

export interface Language {
  /** What the translators want. */
  code: string
  name: string
  /** What it calls itself, which is what somebody reading the screen wants. */
  native: string
  /** What `speechSynthesis` wants, which is not always the same string. */
  speech: string
}

export const LANGUAGES: Language[] = [
  { code: 'zh-CN', name: 'Chinese', native: '华语', speech: 'zh-CN' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', speech: 'vi-VN' },
  { code: 'en', name: 'English', native: 'English', speech: 'en-US' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu', speech: 'ms-MY' },
  { code: 'th', name: 'Thai', native: 'ไทย', speech: 'th-TH' },
]

export const languageOf = (code: string): Language | undefined =>
  LANGUAGES.find((language) => language.code === code)

/** 'zh-CN' → 'zh'. Some services want the region and some choke on it. */
const short = (code: string): string => code.split('-')[0]

// -------------------------------------------------------------- translating

const PROVIDERS = [
  {
    name: 'Google',
    url: (text: string, from: string, to: string) =>
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`,
    read: (body: unknown): string | null => {
      // [[["translated","source",...], ...], ...] — a long sentence comes back
      // split into several rows that have to be put back together in order.
      const rows = (body as [string?][][] | undefined)?.[0]
      if (!Array.isArray(rows)) return null
      return rows.map((row) => row?.[0] ?? '').join('').trim() || null
    },
  },
  {
    name: 'MyMemory',
    url: (text: string, from: string, to: string) =>
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${short(from)}|${short(to)}`,
    read: (body: unknown): string | null => {
      const data = (body as { responseData?: { translatedText?: string } })?.responseData
      const text = data?.translatedText?.trim()
      // It answers 200 with the complaint in the translation field rather than
      // an error status, so a shout in capitals is a failure, not a phrase.
      if (!text || /^(MYMEMORY WARNING|QUERY LENGTH LIMIT)/i.test(text)) return null
      return text
    },
  },
]

export interface Translation {
  text: string
  /** Which provider answered, so the screen can say where it came from. */
  via: string
}

export async function translate(
  text: string,
  from: string,
  to: string,
): Promise<Translation> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Nothing to translate.')
  if (from === to) return { text: trimmed, via: 'no change' }

  let offline = false
  for (const provider of PROVIDERS) {
    try {
      const response = await fetch(provider.url(trimmed, from, to))
      if (!response.ok) throw new Error(`${provider.name} returned ${response.status}`)
      const result = provider.read(await response.json())
      if (result) return { text: result, via: provider.name }
    } catch (error) {
      // A TypeError from fetch is the network, not the provider — worth
      // telling apart, because one is worth retrying in a minute and the
      // other is worth not bothering with until there is signal.
      if (error instanceof TypeError) offline = true
    }
  }

  throw new Error(
    offline
      ? 'No connection. Saved phrases below still work.'
      : 'Neither translator answered. Try again in a moment.',
  )
}

// ----------------------------------------------------------------- speaking

/**
 * The device's voices, which do not all exist at the moment they are asked
 * for: Chrome populates the list asynchronously and fires `voiceschanged`
 * when it has. Asking once at startup reliably returns an empty array.
 */
export function onVoices(handler: (voices: SpeechSynthesisVoice[]) => void): () => void {
  if (typeof speechSynthesis === 'undefined') {
    handler([])
    return () => undefined
  }
  const push = () => handler(speechSynthesis.getVoices())
  push()
  speechSynthesis.addEventListener('voiceschanged', push)
  return () => speechSynthesis.removeEventListener('voiceschanged', push)
}

/**
 * The best voice for a language, or null when the device has none.
 *
 * Null is the whole point of this function. Every browser will happily speak
 * Vietnamese text through an English voice if asked, and the result is an
 * American accent reading the letters — so the caller has to know there is
 * nothing here rather than be handed a plausible substitute.
 */
export function voiceFor(
  speech: string,
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  // Platforms disagree on the separator: 'vi-VN' on Chrome, 'vi_VN' on some
  // Android builds, bare 'vi' elsewhere.
  const wanted = short(speech).toLowerCase()
  const matches = voices.filter(
    (voice) => short(voice.lang.replace('_', '-')).toLowerCase() === wanted,
  )
  if (matches.length === 0) return null
  // An exact region match first — vi-VN over a generic vi — then whatever the
  // device offers, preferring a local voice because it works without signal.
  return (
    matches.find((voice) => voice.lang.replace('_', '-').toLowerCase() === speech.toLowerCase()) ??
    matches.find((voice) => voice.localService) ??
    matches[0]
  )
}

/** Say it. False when the device has no voice for that language. */
export function speak(
  text: string,
  speech: string,
  voices: SpeechSynthesisVoice[],
): boolean {
  const voice = voiceFor(speech, voices)
  if (!voice || !text.trim()) return false

  // Tapping speak twice should not queue two readings on top of each other.
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  // Slightly under normal. This gets read to somebody who is being asked to
  // understand a stranger's phone, not to the person holding it.
  utterance.rate = 0.9
  speechSynthesis.speak(utterance)
  return true
}

// -------------------------------------------------------------- the starter

/**
 * What is in the book before you have translated anything.
 *
 * Chinese to Vietnamese, because that is the trip this was built for, and the
 * dozen things you actually need on it: a greeting, a price, a refusal, a
 * toilet, and the sentence that ends the conversation when none of the others
 * worked. Ordinary phrasebook lines, not machine output — they are here to be
 * right without a signal.
 */
export const STARTER: { from: string; to: string; source: string; result: string }[] = [
  { from: 'zh-CN', to: 'vi', source: '你好', result: 'Xin chào' },
  { from: 'zh-CN', to: 'vi', source: '谢谢', result: 'Cảm ơn' },
  { from: 'zh-CN', to: 'vi', source: '多少钱？', result: 'Bao nhiêu tiền?' },
  { from: 'zh-CN', to: 'vi', source: '太贵了', result: 'Đắt quá' },
  { from: 'zh-CN', to: 'vi', source: '便宜一点可以吗？', result: 'Rẻ hơn được không?' },
  { from: 'zh-CN', to: 'vi', source: '厕所在哪里？', result: 'Nhà vệ sinh ở đâu?' },
  { from: 'zh-CN', to: 'vi', source: '不要辣', result: 'Không cay' },
  { from: 'zh-CN', to: 'vi', source: '不要香菜', result: 'Không rau mùi' },
  { from: 'zh-CN', to: 'vi', source: '买单', result: 'Tính tiền' },
  { from: 'zh-CN', to: 'vi', source: '我想去这里', result: 'Tôi muốn đến đây' },
  { from: 'zh-CN', to: 'vi', source: '我不会说越南语', result: 'Tôi không nói được tiếng Việt' },
  { from: 'zh-CN', to: 'vi', source: '救命！', result: 'Cứu tôi với!' },
]
