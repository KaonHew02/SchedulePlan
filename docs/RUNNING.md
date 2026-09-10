# Running it locally

There is no server and no database to install. One command.

First time only:

```
cd C:/Users/MIS/Documents/SchedulePlan
npm install
```

Then, every time:

```
cd C:/Users/MIS/Documents/SchedulePlan
npm run dev
```

Open **http://localhost:5173/SchedulePlan/** — note the `/SchedulePlan/` on the
end. The dev server uses the same base path as the live site so the two behave
identically; without it you get a blank page.

The terminal also prints a `Network:` address like `http://192.168.1.5:5173/SchedulePlan/`.
Open that on your phone while it is on the same wifi.

## The thing that surprises people

**Local and live are two different sets of data.** The schedule is kept in the
browser's storage, and storage is per-origin:

| Where | Its own separate schedule |
| --- | --- |
| `localhost:5173` | yes |
| `kaonhew02.github.io` | yes |
| Your phone's browser | yes |
| A different browser on this PC | yes |

Nothing is wrong when the live site looks empty after you have been adding
things locally. Move data across with **Export → Import**, or with **Save to
Drive → Load from Drive**. See [DRIVE.md](DRIVE.md).

## Other commands

```
npm run build
```

Type-checks and builds into `dist/`. The Pages workflow runs exactly this, so
if it passes here it will pass there.

```
npm run preview
```

Serves the built `dist/` — worth a look before pushing if you changed anything
about the build.
