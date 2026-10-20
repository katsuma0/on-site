# ON site for iPhone and iPad

The App Store app for ON site. The web app in this repo is bundled into it at
build time, so it works offline from the first launch and keeps the journal
inside the app on the device. Submitting it is covered step by step in
[SUBMISSION.md](SUBMISSION.md).

## Run it on your phone

On a Mac with **Xcode 26 or newer** (the current release, on Apple silicon)
and a paid Apple Developer account:

1. Get the code and open the project:

       git clone https://github.com/katsuma0/on-site.git
       cd on-site
       open ios/ONsite.xcodeproj

2. Click the blue project icon, pick the ONsite target, open
   **Signing & Capabilities**, tick **Automatically manage signing** and
   choose your team. Keep the bundle ID `ca.katsuma.onsite`: it is the
   App Store app's identity and cannot change after the first upload. (For a
   throwaway test on a free Personal Team you can change it, but never commit
   that.)

3. If Xcode offers **Update to recommended settings**, untick **User Script
   Sandboxing**: the build phase that copies the web app fails with it on.
   Keep the Swift language version at Swift 5.

4. Plug in your iPhone, choose it in the device menu at the top, and press
   Run.

5. First time only, on the phone:
   - Settings, Privacy & Security, Developer Mode: turn it on (it restarts).
   - If the launch is blocked: Settings, General, VPN & Device Management,
     and trust your developer certificate.

## How it works

- `App/` is a small SwiftUI shell around one full-screen WKWebView, served
  from a local custom scheme (`app://localhost/`) by `LocalSchemeHandler`, so
  localStorage and IndexedDB live in the app's own container and nothing is
  loaded from the network.
- The **Bundle Web App** build phase copies the web files from the repo root
  into the app (`ONsite.app/Web`) on every build. Edit the web app, press
  Run, done. The service worker is not bundled; the app never needs it.
- `Bridge.swift` is injected before the page's own code. It sets
  `window.Capacitor`, which is how the web app knows it is inside the app
  (`IN_APP` in `app.js`), and connects `navigator.share` (the backup file goes
  to the real share sheet), haptics and the installed-app signal.
- `Spotlight.swift` puts the guide's parks into the Home Screen search. The
  page sends the list after it loads and again when the language changes.
  `App.swift` hands a picked result, or a Search in App query, back to the
  page through `WebRouter`.
- The in-app theme (Auto, Light, Dark) and language reach the shell too, so
  the status bar, alerts and share sheet match the page.
- Links to official park pages, katsuma.ca and on-fishing open in Safari;
  mail links open Mail.
- Permission prompts are in `App/en.lproj` and `App/fr.lproj`
  (`InfoPlist.strings`), with the English copies also set as
  `INFOPLIST_KEY_*` build settings. `App/Info.plist` holds only what build
  settings cannot: one window on iPad, the launch colour and Search in App.
- `Logo/ONsite-logo.png` is the icon's source. The 1024 px PNG in
  `Assets.xcassets` and the web icons (`icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`) are scaled from it, with no transparency.

## Debugging on a device

Debug builds are inspectable: on the Mac, Safari, Develop, then your iPhone,
then the page. The read-only consoles work in the app too: type `debugsearch`
or `statsearch` into the Parks search.

## Releasing an update

Bump `APP_VERSION` in `app.js` and `MARKETING_VERSION` in the project
together (`node tools/check.js` checks they match), raise
`CURRENT_PROJECT_VERSION` for every upload, then Product, Archive.
