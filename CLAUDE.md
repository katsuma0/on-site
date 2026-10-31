# ON site, project guide for Claude

ON site (once called Site Journal, then on-camp) is Katsuma Onishi's private
journal for Ontario's provincial park campgrounds. Walk a campground, rate each
site out of five, add a note or a photo, mark the sites worth booking again,
and next year you know which one to book. It is used offline, in the parks.

It ships two ways from this one repo:

- **The App Store app** for iPhone and iPad, in `ios/`: a SwiftUI shell around
  one WKWebView with the web app bundled inside. See `ios/README.md`, and
  `ios/SUBMISSION.md` for everything App Store Connect needs.
- **The web app** at https://katsuma.ca/on-site/ (GitHub Pages), installable
  as a PWA.

`HANDOFF.md` has the owner's taste, the writing voice and the history. Read it
before a big change.

## Repo layout

- `index.html`: markup only. Every screen and sheet, plus the Versions list.
- `app.js`: all logic. Also holds the French dictionary `FR`, the in-app
  Learn notes and the legal pages (`LEGAL_PAGES`).
- `assets/ios.css`: the iOS design system (part 1), the app's own styles
  (part 2) and the faces and text sizes (part 3). `styleguide.html` shows it.
- `assets/icons.svg`, the symbol sprite. The type is the system font (San
  Francisco on Apple devices); no fonts are bundled.
- `data/parks.js`: the park data as `window.PARKS_DATA`, loaded first so the
  app starts instantly and offline. `parks-data.json` is the same data as
  plain JSON, for the pipeline and the web version's background refresh.
- `share.js`: the on-* share module. Today it only draws the card when
  someone opens a `#/shared/` review link made by an older version.
- `service-worker.js`, `manifest.json`, icons: the web version's install and
  offline cache. Never used inside the app.
- `pipeline/`: the SQLite data pipeline (Katsuma is learning SQL, so keep it
  approachable). `build_db.py` holds the data and builds `scout.db`;
  `export_to_app.py --all` writes `parks-data.json`.
- `tools/check.js`: the zero-dependency check. Run `node tools/check.js`
  before every commit.
- `ios/`: the Xcode project (`ONsite.xcodeproj`), the Swift shell in `App/`
  and the logo in `Logo/`: `ONsite-logo.png` (yellow on green) is the source
  of the app icon and the web icons, `ONsite-logo-transparent.png` is the green
  wordmark on a clear ground.
- `DESIGN.md`, `FORMAT-SPEC.md`, `SEARCH-SPEC.md`: historical specs from
  v0.17x. Where they disagree with `assets/ios.css`, the CSS wins.

## Every release

1. Bump `APP_VERSION` in `app.js` (`1.N` since the App Store release).
2. Set `MARKETING_VERSION` to the same number in
   `ios/ONsite.xcodeproj/project.pbxproj` (Debug and Release).
3. Bump `CACHE` in `service-worker.js` to `scout-v` plus the version as
   major × 1000 + minor, plus 2 (0.239 went with `scout-v241`, 1.0 goes with
   `scout-v1002`, 1.1 with `scout-v1003`).
4. Add one `.verline` at the top of the Versions sheet in `index.html`: one
   line, plain words, milestones only.
5. `node tools/check.js` must print ALL CHECKS PASSED. It enforces 1 to 3,
   the French apostrophes, no em dashes, and the iOS project's files and
   permission strings.

For an App Store upload, also raise `CURRENT_PROJECT_VERSION` (the build
number) for every upload.

## Updating park data

```
cd pipeline
python3 build_db.py
python3 export_to_app.py --all
cp parks-data.json ../parks-data.json
```

Then regenerate `data/parks.js` from it (wrap the JSON as
`window.PARKS_DATA = <json>;` under its one-line comment), and release as
above. New park text is the owner's own writing, never copied from Ontario
Parks.

## Hard rules

- **No em dashes anywhere** (code, data, UI). Commas and periods.
- **French:** every user-facing string goes through `TL()` (or a `data-i18n`
  attribute, which `applyLang()` fills). `FR` is keyed by the exact English,
  values use the typographic apostrophe (U+2019). Proper nouns (parks,
  campgrounds, ON site, on-fishing) are not translated. The language follows
  the device on first launch and can be changed under More, Appearance.
- **Never rename storage keys.** localStorage: `ontario-scout-v2` (ratings,
  notes, wishlist, pins), `oncamp-favs`, `outdoors-profile`,
  `outdoors-appearance`, `oncamp-lang`, `site-journal-jfilter`,
  `oncamp-pins-to-favs` (a one-time migration marker). IndexedDB:
  `scout-photos`. The retired `site-journal-theme*`, `-unlocks`, `-sort`,
  `-group` and `-origin` keys are still carried by backups and cleared by
  Reset, so old backups restore cleanly. The backup file keeps
  `app:'site-journal'` for the same reason.
- **Inside the app** (`IN_APP`, which is `!!window.Capacitor`; the stand-in
  object comes from `ios/App/Bridge.swift`):
  - the service worker never registers, and any old one is removed;
  - `refreshParksFromNetwork` returns at once, the bundled data is the truth;
  - the only network use is the native Map tab (Apple Maps images). Links
    open in Safari.
  - The page talks to the shell through five message handlers: `share`,
    `haptic`, `spotlight` (`postSpotlight()`, the parks for the Home Screen
    search), `appearance` (`postAppearance()`, theme and language) and
    `chrome` (`nativeChrome()`: the tab the page shows and whether a sheet
    or the photo viewer covers it).
  - The tab bar is the system UITabBarController (`ios/App/TabShell.swift`,
    Liquid Glass on iOS 26, never a custom imitation): the bridge sets `window.__onNativeTabs`, the page stamps
    `html.native-tabs` and hides its own `#tabbar`, and the shell calls
    `window.onsiteShowTab`, `onsiteOpenPark`, `onsiteShowRegion` and
    `onsiteMapState`. The web version keeps its own bar and has no Map tab.
  - The Map tab is native MapKit (`ios/App/ParkMapView.swift`); its pins are
    `ios/App/MapParks.swift`, generated from the owner's
    ontario-parks-visitable.csv (116 parks, `guideID` links a pin to a park
    in the guide). Regenerate it from the CSV, never by hand.
    `window.onsiteOpenPark` and `window.onsiteSearch` are how the shell opens
    a search result.
- **Nothing hidden.** The only hidden features are the read-only consoles,
  `debugsearch` and `statsearch`, typed into the Parks search. App Review
  guideline 2.5.19 rejects hidden, dormant or undocumented features, so never
  add an unlockable, a secret command, dormant code or a remote switch. Any
  new hidden behaviour must be added to the review notes in
  `ios/SUBMISSION.md` first.
- **Keep the 4+ age rating.** The Learn notes are prevention-only outdoor
  safety. No medical or treatment advice, nothing graphic.
- **Privacy is a promise.** No analytics, no third-party code, no account, no
  network calls from the app. If that ever changes, the in-app privacy page
  (`LEGAL_PAGES` in `app.js`), https://katsuma.ca/privacy.html (repo
  `katsuma0/katsuma0.github.io`) and the App Store privacy answers all change
  with it.
- Fractions, never percentages ("3/652 sites").
- No `:hover` styles (they stick on touch). Press feedback is `:active` only.
- Every control is at least 44px tall (`--ctl`); sizes come from the tokens
  in `ios.css`, never raw values. Cards stack `--stack` apart, the same as
  the side gutter (`--gutter`, or `--pad-l` and `--pad-r` where a device
  reserves its edges).
- Colours come only from the token blocks at the top of `ios.css`, and must
  hold AA contrast in light and dark. Destructive text uses `--red-text`.
- Region strings are `"<Broad> · <Town>"`, with the broad buckets
  `Northern Park`, `Near North Park`, `Algonquin` (plain), `Central Park`,
  `Southeast Park`, `Southwest Park`.
- Algonquin is split into nine parks, one per car campground (`algonquintea`,
  `algonquincanisbay` and so on). `migrateAlgonquin` moves any old keys; keep
  it.

## App behaviour to preserve

- Tabs: Parks (region chips, then A to Z with a letter rail; search is the
  header button), Map (in the app only), Favourites (favourite parks, sites
  you hearted, and parks you have visited that are not already favourites),
  Journal (everything rated, with filters and sorting), More (Learn,
  Appearance, Your data with Photos and Visibility first, About, Legal, and
  one closing line: "Not affiliated with Ontario Parks."). There is no
  Profile; the old display name key is kept untouched.
- The look is iOS itself: system blue tint, system greys and black in dark,
  the system font, and Settings' metrics (16pt margins, 24pt card corners,
  48pt rows with 16pt insets, 17pt semibold section names, glass circle back
  buttons). The tokens are at the end of `assets/ios.css`.
- One row shape for a park everywhere (`parkRowHtml`): the name over a
  footnote line. Parks shows the region, with "N rated" at the right at the
  footnote size; Favourites and the Journal show "N sites rated". A Journal
  row adds the park's average at the right (`avgRateHtml`): a five-cell
  meter in the tint that fills to the nearest half. Stars mean wishlist, and
  only wishlist: the solid orange star everywhere (site chips use an orange
  ring).
- A park can be favourited only from its own page (the Favourite pill).
- Rating sheet: 0 to 5 dots, Wishlist, Trailer site, then "Add a note or
  photo" (the keyboard never opens by itself). The line being typed always
  stays above the keyboard. Done stays reachable at the bottom, with Clear
  beside it and the share button at the left: `shareRating()` sends plain
  text (park, campground, site, score, wishlist, then "ON site") through
  `navigator.share`, which the app's bridge turns into the iOS share sheet;
  a browser without one copies it.
- Swipe right on a park page goes back; sheets swipe down to close.
- Site chips: the site number on the score's colour (`scoreColor()`, the clay
  to green `STOPS` tinted toward the accent); an orange ring (`.wanted`) for
  the wishlist; `.marked` for a note or a photo; a hatched chip for a trailer
  site set aside. The chip's aria-label spells all of it out.
- Progress bars and stats stay hidden until a site in that park is rated.
- Trailer sites: marked per site or a whole campground at once. The Car/tent
  or RV/trailer setting decides whether they count toward progress.
- Fishing pills link to `https://katsuma.ca/on-fishing/#zone=NN`.

## Skipped or declined (do not re-suggest)

- Maps of any kind (removed in v0.234), driving times, park themes and
  unlockables, sample or dummy data, the dedication page, the bear report
  (the on-wildlife app is not active), sharing review cards as images (a
  rating shares as text), a Version row or an on-fishing link in More, and
  Planned features inside the app (they live on katsuma.ca).
- Percentages and hover styles.
