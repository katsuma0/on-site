# ON site

A private journal for Ontario's provincial park campgrounds, by Katsuma
Onishi. Walk a campground, rate each site out of five, add a note or a photo,
and next year you will know which one to book.

- **iPhone and iPad:** the App Store app, built from `ios/` (see
  [ios/README.md](ios/README.md) and [ios/SUBMISSION.md](ios/SUBMISSION.md)).
- **Web:** https://katsuma.ca/on-site/, which works offline once it has
  loaded and can be added to the Home Screen.

Not affiliated with Ontario Parks or the Government of Ontario. Book through
their official site.

## What's here

The app follows the same layout as on-fishing: a thin `index.html` that links
out to the styles, the logic and the data. No framework, no build step.

- `index.html`: markup only (the screens, the sheets, the Versions list)
- `assets/ios.css`: the shared iOS design system and the app's styles
- `assets/icons.svg`, `assets/fonts/`: the symbol sprite, and Lato and Noto
  Sans with their licences
- `app.js`: all app logic, the French dictionary and the in-app legal pages
- `data/parks.js`: park, campground, site and trail data as
  `window.PARKS_DATA`, loaded first for an instant offline start
- `parks-data.json`: the same data as plain JSON, for the pipeline and a
  background refresh on the web
- `share.js`: opens review links shared from older versions
- `service-worker.js`, `manifest.json`, icons: install and offline support on
  the web
- `pipeline/`: the SQL data pipeline that generates `parks-data.json`
- `tools/check.js`: run `node tools/check.js` before every commit
- `ios/`: the Xcode project for the App Store app

## Updating park data

```
cd pipeline
python3 build_db.py
python3 export_to_app.py --all
cp parks-data.json ../parks-data.json
```

Then regenerate `data/parks.js` from it (wrap the JSON as
`window.PARKS_DATA = <json>;`) and release as described in `CLAUDE.md`.

Currently: 124 parks, 372 campgrounds, 20,031 sites and 211 trails.
