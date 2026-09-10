# The Drive copy

The schedule lives in one browser. Drive is how it survives that browser.

Two buttons in **More**:

- **Save to Drive** — writes everything to one file, replacing what was there.
- **Load from Drive** — reads it back, replacing everything on this device.

Neither runs by itself. There is no background sync, so the copy is as fresh as
the last time you pressed the button.

**Export and Import work without any of this.** They need no Google account, no
setup and no internet. If you never want to do the setup below, use those.

---

## Setup, once

You chose a **new Google Cloud project for SchedulePlan**, so the consent
window says the app's own name. Roughly five minutes of clicking.

### 1. Make the project

[console.cloud.google.com](https://console.cloud.google.com) → the project
dropdown at the top → **New project** → name it `SchedulePlan` → Create, then
switch to it.

### 2. Turn on the Drive API

**APIs & Services → Library** → search `Google Drive API` → **Enable**.

### 3. Fill in the consent screen

**APIs & Services → OAuth consent screen**

- User type: **External**. (Internal needs a Workspace account.)
- App name: `SchedulePlan` — this is the name in the sign-in window.
- User support email and developer email: your own.
- Scopes: **add nothing here.** The app asks for `drive.file` at sign-in time,
  and that scope is not sensitive, so it needs no review.
- Test users: **add your own Google address.** While the app is in Testing,
  only listed addresses can sign in — and Testing is fine forever for one
  person. Do not press "Publish app"; that starts a verification you do not
  need.

### 4. Create the client ID

**APIs & Services → Credentials → Create credentials → OAuth client ID**

- Application type: **Web application**
- Name: anything, `SchedulePlan web` will do
- **Authorised JavaScript origins** — add both, scheme and host only, no path
  and no trailing slash:

      https://kaonhew02.github.io
      http://localhost:5173

- **Authorised redirect URIs: leave empty.** This app uses the token flow,
  which does not redirect.

Copy the client ID. It ends in `.apps.googleusercontent.com`. There is also a
client secret on that screen — **ignore it**. This app does not use one, and it
must never be committed.

### 5. Make the Drive folder

In [drive.google.com](https://drive.google.com), make a folder — `SchedulePlan`
is the obvious name. Open it and take the id out of the URL:

    https://drive.google.com/drive/folders/125Xwua…OoS-I?usp=sharing
                                           └──── this ────┘

Leave the folder **Restricted** in Share settings. "Anyone with the link" means
anyone with the link can read your schedule.

### 6. Paste both into the app

In [`src/lib/drive-config.ts`](../src/lib/drive-config.ts):

```ts
clientId: '…….apps.googleusercontent.com',
folderId: '…….',
```

Commit and push. The Drive buttons in More turn on by themselves — the app
checks whether both values are still placeholders and stays disabled until they
are not.

---

## What the app can and cannot see

The scope is **`drive.file`**, the narrow one: the app reaches only files it
created itself. It cannot read the rest of your Drive, and Google does not
review apps for it.

The access token lives in memory for the hour Google grants it and is never
written to storage. Closing the tab signs you out.

## When something goes wrong

| What you see | What it usually is |
| --- | --- |
| The buttons are greyed out | `drive-config.ts` still has the placeholders |
| "Google sign-in was cancelled or refused" | The popup was closed, or your address is not in Test users |
| "Couldn't open the Google sign-in window" | The browser blocked the popup |
| "Google Drive refused that" | The folder id is wrong, or the origin is not registered on the client |
| "There is no SchedulePlan file in that folder yet" | Press Save to Drive first |

An origin mismatch is the common one, and it is exact: `https://kaonhew02.github.io`
is not the same entry as `https://kaonhew02.github.io/SchedulePlan/`. Host only.

## The trap worth knowing

`filename` in `drive-config.ts` is how the app finds its file. **Renaming the
file in Drive starts a new one** and orphans the old — the old data is still
there, but nothing points at it. Same for moving it out of the folder. If you
want to reorganise, do it by changing `drive-config.ts`, not Drive.
