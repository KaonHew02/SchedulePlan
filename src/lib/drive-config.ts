/**
 * SchedulePlan — where the Drive copy lives, and who is allowed to write it.
 *
 * Both values are safe to publish, and both are meant to be. An OAuth client
 * ID is not a secret — it only names the app; Google will not hand it a token
 * without you signing in and agreeing, and it only works from the web
 * addresses you registered against it. A folder ID is likewise just a name:
 * without permission on the folder, knowing its ID gets you nothing.
 *
 * What must NEVER appear in this file is a **client secret**. The browser flow
 * this app uses does not need one, and Google does not issue one for this
 * client type. If you ever find yourself pasting something labelled "secret"
 * in here, stop — you have created the wrong kind of credential.
 *
 * Setup is a few minutes of clicking, once. See docs/DRIVE.md.
 */

export const SP_DRIVE = {
  /**
   * Google Cloud → APIs & Services → Credentials → OAuth client ID (Web
   * application), from the SchedulePlan project. It ends in
   * `.apps.googleusercontent.com`.
   *
   * Register two origins on it: `https://kaonhew02.github.io` for the live
   * site and `http://localhost:5173` for the dev server. Scheme and host only,
   * no path.
   *
   * Until this is replaced, the Drive buttons say so instead of failing
   * oddly. Export and Import work regardless — they need no account at all.
   */
  clientId: 'PASTE-YOUR-CLIENT-ID.apps.googleusercontent.com',

  /**
   * The folder the file is kept in, taken from its Drive URL — the part after
   * `/folders/` and before any `?`:
   *
   *     https://drive.google.com/drive/folders/125Xwua…OoS-I?usp=sharing
   *                                            └──── this ────┘
   *
   * Keep this folder **Restricted** in Drive's Share settings. "Anyone with
   * the link" means anyone with the link can read your schedule.
   */
  folderId: '1pM0q9zuGBdfNxWlcPsyfUTLxcN4dfDNB',

  /** The one file SchedulePlan writes. Renaming it in Drive starts a new one. */
  filename: 'scheduleplan-data.json',
}

/** False until both values above are filled in, which the UI checks before offering Drive. */
export const driveIsConfigured = (): boolean =>
  !SP_DRIVE.clientId.startsWith('PASTE-') && !SP_DRIVE.folderId.startsWith('PASTE-')
