/** Small stroked icons, sized by the parent's font size or an explicit class. */
type Props = { className?: string }

const base = 'shrink-0'

export const ChevronLeft = ({ className = 'w-5 h-5' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
)

export const ChevronRight = ({ className = 'w-5 h-5' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
)

export const Plus = ({ className = 'w-6 h-6' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const Close = ({ className = 'w-5 h-5' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export const CalendarIcon = ({ className = 'w-6 h-6' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
)

export const WalletIcon = ({ className = 'w-6 h-6' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8a3 3 0 0 1 3-3h11a2 2 0 0 1 2 2v1" />
    <rect x="3" y="7" width="18" height="13" rx="3" />
    <path d="M16.5 13.5h.01" />
  </svg>
)

export const MoreIcon = ({ className = 'w-6 h-6' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </svg>
)

export const PinIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)

export const TrashIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
)

export const PencilIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
  </svg>
)

export const BellIcon = ({ className = 'w-6 h-6' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 10a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
    <path d="M10.3 20a2 2 0 0 0 3.4 0" />
  </svg>
)

export const ClockIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 1.8" />
  </svg>
)

export const PaperclipIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 11.5 12.2 19.3a5 5 0 0 1-7.1-7.1l8.5-8.4a3.3 3.3 0 1 1 4.7 4.7l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6" />
  </svg>
)

export const CameraIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8h3l1.5-2h7L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
)

/** A page with corner brackets: the document scanner. */
export const ScanIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
    <path d="M7 12h10" />
  </svg>
)

export const ImageIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m3.5 17 4.8-4.5a2 2 0 0 1 2.7 0L16 17M14 14.5l1.8-1.6a2 2 0 0 1 2.7 0l2 1.9" />
  </svg>
)

export const FileIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
  </svg>
)

export const CloudIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 18h10.5a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.6-1.3A4 4 0 0 0 7 18Z" />
  </svg>
)

export const CloudUpIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17h10.5a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.6-1.3A4 4 0 0 0 7 17Z" />
    <path d="M12 21v-7M9.5 16.5 12 14l2.5 2.5" />
  </svg>
)

export const CloudDownIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 16h10.5a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.6-1.3A4 4 0 0 0 7 16Z" />
    <path d="M12 13v8M9.5 18.5 12 21l2.5-2.5" />
  </svg>
)

export const DownloadIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 20h16" />
  </svg>
)

export const UploadIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M4 20h16" />
  </svg>
)

export const RefreshIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 11a8 8 0 0 0-13.7-5.1L3 9M3 5v4h4M4 13a8 8 0 0 0 13.7 5.1L21 15M21 19v-4h-4" />
  </svg>
)

/** A stack of platters: where the data physically lives. */
export const DatabaseIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </svg>
)

export const SwapIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8h13M14 5l3 3-3 3M20 16H7M10 13l-3 3 3 3" />
  </svg>
)

export const UsersIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20a6 6 0 0 1 12 0M16.5 5.2a3.2 3.2 0 0 1 0 5.9M18 14.5a6 6 0 0 1 3 5.5" />
  </svg>
)

export const CheckIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 13 4 4L19 7" />
  </svg>
)

export const ChevronDown = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const TagIcon = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11V4h7l10 10-7 7L3 11Z" />
    <circle cx="7.5" cy="7.5" r="1.3" />
  </svg>
)

/** Google's G, flat — the four brand colours, no gradients. */
export const GoogleG = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className}`} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.6 5-4.5 7l7 5.4C42.6 36 45 30.6 45 24Z" />
    <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7-5.4C29.7 36.5 27.1 37.4 24 37.4c-5.8 0-10.7-3.9-12.5-9.1l-7.2 5.6C8 41 15.4 46 24 46Z" />
    <path fill="#FBBC05" d="M11.5 28.3a13.3 13.3 0 0 1 0-8.6l-7.2-5.6a22 22 0 0 0 0 19.8l7.2-5.6Z" />
    <path fill="#EA4335" d="M24 10.6c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4 30 2 24 2 15.4 2 8 7 4.3 14.1l7.2 5.6C13.3 14.5 18.2 10.6 24 10.6Z" />
  </svg>
)

/** An indeterminate spinner, for work with no known length. */
export const Spinner = ({ className = 'w-4 h-4' }: Props) => (
  <svg className={`${base} ${className} animate-spin`} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
)
