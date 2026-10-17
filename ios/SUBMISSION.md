# Submitting ON site to the App Store

Everything App Store Connect will ask for, with the answer already worked
out and checked against the app as it is in this repo (v0.238).

Checked against the App Review Guidelines last updated 16 October 2026 and the
Program License Agreement revised 13 October 2026. On the day you submit,
glance at both pages again in case either has moved.

Every box of text you paste into App Store Connect is in a code block below.
On GitHub each block has a copy button; the text is unwrapped on purpose, so
paste it as it is.

## Where things stand

Done in the repo:

- Version 0.238, build 1. `MARKETING_VERSION` matches the version the app
  shows in Profile (tap the avatar), and `node tools/check.js` fails if they
  ever drift.
- Privacy, terms and support pages inside the app (More, then Legal),
  written for the app: no network requests, works in airplane mode.
- Permission prompts in English and French, including the one for Save to
  Photos.
- Parks in the Home Screen search (Core Spotlight), with Search in App.
- One window on iPad, iOS 17 or later, launch screen in the app's own colour
  for light and dark.
- A crisp 1024 px icon with no transparency. Its source is `ios/AppIcon.svg`.
- Nothing hidden apart from the two read-only consoles, disclosed in the
  review notes below.

Left for you, in order: test in Xcode, archive and upload, fill in App Store
Connect, take screenshots, submit. The checklist at the end has every step.

## 1. Before you open Xcode

- **Apple Developer Program:** enrolled.
- **Agreement:** sign in at https://developer.apple.com/account as the
  Account Holder and accept the latest Program License Agreement if a banner
  asks. App Store Connect blocks new apps until it is accepted. A free app
  needs no paid-apps agreement, tax or banking forms.
- **Digital Services Act:** in App Store Connect, Business, then Compliance,
  then Digital Services Act, choose **This is not a trader account**. ON site
  is free, has no in-app purchases and no ads.
- **Mac and Xcode:** uploads need **Xcode 26 or later** (Apple's rule since
  28 April 2026). Use the current release (27.1 at the time of writing) on an
  Apple silicon Mac, with the iOS platform and the iPhone and iPad simulators
  installed. Add your Apple Account under Xcode, Settings, Accounts.
- **Your own journal:** this app keeps its data in its own container, so it
  starts empty even if you have been using the web version or an older build.
  First export a backup from whichever one holds your journal now (More, Your
  data, Export a backup), then use Import a backup in the new app.

## 2. What is already set in the project

| Setting | Value |
| --- | --- |
| Display name | `ON site` |
| Bundle ID | `io.github.katsuma0.oncamp` (fixed forever after the first upload) |
| Version / build | `MARKETING_VERSION = 0.238`, `CURRENT_PROJECT_VERSION = 1` |
| Minimum iOS | 17.0 |
| Devices | iPhone and iPad (`TARGETED_DEVICE_FAMILY = 1,2`) |
| iPhone orientation | Portrait. iPad: all four. |
| Languages | English and French |
| Swift | Swift 5 language mode, minimal concurrency checking |
| Export compliance | `ITSAppUsesNonExemptEncryption = NO`, so App Store Connect does not ask |
| Signing | Automatic. No team is committed; you pick yours. |

Keep iPad. Once a version that runs on iPad is on the store, an update can
never drop it, and the iPad layout is already done. It does mean iPad
screenshots (section 7).

## 3. Test in Xcode

1. Clone https://github.com/katsuma0/on-site at the release commit and open
   `ios/OnCamp.xcodeproj`.
2. If Xcode offers **Update to recommended settings**, review the list and
   **untick User Script Sandboxing**. The Bundle Web App build phase copies
   the web files into the app and fails when that sandbox is on. Leave the
   Swift language version at Swift 5.
3. Select the OnCamp target, open **Signing & Capabilities**, tick
   **Automatically manage signing** and choose your paid team, not
   "(Personal Team)". Keep the bundle ID above.
4. Run it on a real iPhone (Developer Mode must be on: Settings, Privacy &
   Security, Developer Mode).

Then go through this list on the iPhone, and on an iPad if you have one:

- [ ] Airplane mode on, Wi-Fi off, cold launch: the parks list appears.
- [ ] Rate a site, add a note, take a photo with **Camera** and add one with
      **Add photos**. Each permission prompt reads as in section 6.
- [ ] Delete the app, reinstall, and tap **Don't Allow** on the camera:
      everything else still works.
- [ ] Open a photo, long-press it and save it to Photos.
- [ ] On a rated site, tap the share button at the bottom left of the
      sheet: the share sheet offers one line of text, and Messages sends it.
- [ ] Type a long note at text size M and XL: the line you are typing stays
      above the keyboard.
- [ ] More, Your data: **Export a backup** to Files, **Reset all data**, then
      **Import a backup**: everything comes back, photos too.
- [ ] Leave the app, swipe down on the Home Screen, type a park's name and
      tap the result: the app opens on that park. Type any other word and tap
      **Search in App**: the app's search shows it.
- [ ] Force-quit the app (swipe it away), then do the same two searches: the
      app launches straight onto the park, and onto the search.
- [ ] Switch the iPhone to French (Settings, General, Language & Region): the
      app and its permission prompts are in French.
- [ ] Light and dark: the in-app Theme setting and the system setting both
      look right, status bar and alerts included.
- [ ] An official park link, the katsuma.ca links and on-fishing open in
      Safari.
- [ ] Force-quit and relaunch: everything is still there.
- [ ] iPad: portrait, landscape and a resized window; Export a backup and the
      rating's share button each open the share sheet as a popover pointing
      at the button that was tapped.

## 4. Archive and upload

1. Choose **Any iOS Device (arm64)** as the destination, then Product,
   Archive.
2. In the Organizer, right-click the archive, Show in Finder, then Show
   Package Contents on the archive and on `Products/Applications/OnCamp.app`.
   `Web/index.html` must be there. Without it the app opens blank.
3. **Validate App**, then **Distribute App**, App Store Connect, Upload.
4. Wait for the email saying the build has finished processing, then install
   it through TestFlight (internal testing needs no review) and run the list
   in section 3 once more on that exact build.
5. Every later upload needs a higher build number: raise
   `CURRENT_PROJECT_VERSION` (2, 3, ...). A new app version raises
   `APP_VERSION` in `app.js` and `MARKETING_VERSION` together.

## 5. App Store Connect

### New app record

Apps, then the plus button, then New App.

| Field | Value |
| --- | --- |
| Platforms | iOS |
| Name | `ON site` (if that name is taken: `ON site: Campsite Journal`) |
| Primary language | English (Canada) |
| Bundle ID | `io.github.katsuma0.oncamp` |
| SKU | `onsite-ios` |
| User access | Full access |

Rename the version on the record to **0.238**.

### App Information

| Field | Value |
| --- | --- |
| Subtitle | `Rate Ontario park campsites` |
| Category | Travel. Secondary: Reference. |
| Content Rights | Yes, it contains third-party content, and you have the rights (see section 9). |
| Age Rating | Answer as below. The result is **4+**. |

Age rating questionnaire. Answer **None** or **No** to every question:

- Parental controls, age assurance: **No**. Neither exists in the app.
- Unrestricted web access: **No**. There is no in-app browser; links leave
  for Safari.
- User-generated content, messaging and chat: **No**. Notes and photos stay
  on the device, and nobody else ever sees them.
- Advertising: **No**.
- Medical or treatment information: **None**. Health or wellness topics:
  **No**. The Learn notes are outdoor safety (bears, ticks, campfires, cold
  water), prevention only, with no medical advice.
- Profanity, horror, alcohol or drugs, sexual content, violence, weapons,
  gambling, contests, loot boxes: **None** or **No**.
- **Made for Kids:** leave it unselected.

### Pricing and Availability

- Price: **Free**, base country Canada.
- Availability: **Canada** only to start, since the app is about Ontario.
  Untick the box that adds future countries automatically. If you add the
  United States later, read Apple's current notes on the US state
  age-assurance laws first.
- Untick **iPhone and iPad Apps on Apple Silicon Macs** and **Apple Vision
  Pro**. Neither has been tested, and Vision Pro has no camera.

### App Privacy

- Privacy Policy URL: `https://katsuma.ca/privacy.html`
- Data collection: **No, we do not collect data from this app**, then
  Publish.

Why that answer is true:

- No account, no analytics, no advertising and no third-party code of any
  kind. The app makes no network requests of its own.
- Ratings, notes, photos, favourites and the optional display name are stored
  inside the app's container and are never transmitted.
- The Home Screen search index lives on the device. Only the guide's own park
  names and regions go into it, never anything the person wrote.
- A backup file goes only where the person sends it, through the share sheet.
- There is no tracking, so no App Tracking Transparency prompt and no
  `NSUserTrackingUsageDescription`.

Skip the **Accessibility Nutrition Labels** for now. They can only be
published once a version is live. After launch, claim only what a full
VoiceOver and device pass has confirmed, and never Larger Text: the in-app
text sizes stop well short of the 200% Apple asks for.

### Version page

**Promotional text** (95 of 170 characters):

```text
Walk the campground, rate each site out of five, and next year you will know which one to book.
```

**Description** (1,499 of 4,000):

```text
Choosing a campsite you have never seen is a gamble. Some are lovely, some back onto the road, and a year later you cannot remember which was which. ON site is the notebook for that.

Walk a campground and rate each site out of five. Add a note or a photo, and mark the ones worth booking again. You can rate the campgrounds, the trails and the park itself too.

The guide covers Ontario's provincial parks: 124 parks, 372 campgrounds and about 20,000 individual campsites, including backcountry sites at parks like Killarney, French River and The Massasauga, plus 211 trails. Algonquin's interior is not in the app yet.

It works with no signal, which is the point, because campground loops are where service runs out.

Your journal is yours. Everything stays on your device. There is no account, no advertising and no tracking. Export a backup to a file whenever you like, and load it on another device.

Also in the app:
• Favourites, for the parks you keep going back to
• A journal of everything you have rated, with filters and sorting for finding the sites worth booking
• Trailer sites marked as such, counted or set aside to suit how you camp
• Any park, one search away from the Home Screen
• Notes on bear safety, ticks, campfires, leave no trace and cold water
• Share a rating as a message, straight from the site
• Light and dark appearance, adjustable text size, and a French interface

Not affiliated with Ontario Parks or the Government of Ontario. Book through their official site.
```

**Keywords** (95 of 100 bytes). Words already in the name and subtitle are
searched anyway, so they are left out:

```text
provincial,camping,campground,ratings,journal,offline,trails,tent,trailer,notes,review,outdoors
```

| Field | Value |
| --- | --- |
| Support URL | `https://katsuma.ca/support.html` |
| Marketing URL | `https://katsuma.ca/projects/on-site/` (optional) |
| Version | `0.238` |
| Copyright | `2026 Katsuma Onishi` (no ©; Apple adds it. Use your legal name.) |
| Build | The 0.238 build you tested through TestFlight |
| Sign-in required | Unticked |
| Contact | Your name, an email you check, and a phone number as `+1 ...` |
| Version release | **Manually release this version** |

What's New is not shown for a first version. Leave the standard Apple
licence agreement (EULA) in place.

**App Review notes** (2,534 of 4,000 bytes):

```text
ON site is a private campsite journal for Ontario's provincial parks. You rate each campsite out of five, add notes and photos, and mark the sites worth booking again.

How it is built: the interface is HTML and JavaScript bundled inside the app and rendered locally by WKWebView from a custom app:// scheme. Nothing is loaded from the internet. The park guide (124 parks, 372 campgrounds, about 20,000 campsites, 211 trails) is bundled in the binary, and the app works fully in airplane mode. There is no account, no server, no analytics and no advertising. The Profile screen holds only an optional display name, kept on the device.

Native features: parks are indexed for Home Screen search with Core Spotlight, and Search in App continues a query inside the app. The camera and photo library attach site photos, Save to Photos keeps one, the share sheet exports a backup file and sends a rating as a message, taps have haptics, and the app follows the system language (English or French) and appearance. A free web version also exists; the app adds these features and works offline from the first launch.

To test (airplane mode is fine, and is the main use case):
1. Parks tab: open Grundy Lake, then the Hemlock campground, and tap site 101.
2. Tap a score, then "Add a note or photo". Type a note, tap Camera or Add photos. The share button at the bottom left offers the rating as text (for example "Grundy Lake · Hemlock · Site 101 · 4/5"). Tap Done.
3. Journal tab: Grundy Lake is listed. Tap it to see the site, its score and the note.
4. On the Grundy Lake page, tap Favourite. The park now appears in the Favourites tab.
5. Leave the app, swipe down on the Home Screen and type Killbear. Tap the ON site result: the app opens on Killbear.
6. More, Your data, Export a backup: the share sheet offers a .json file.

Hidden diagnostics (guideline 2.5.19): typing the single word debugsearch or statsearch in the Parks search field shows a read-only text card. debugsearch lists diagnostics (parks loaded, a search self-test, recent script errors); statsearch lists counts of the user's own ratings. Neither changes data, unlocks anything or contacts a server. There are no other hidden features.

Permissions: the camera and photos are requested only when the user attaches or saves a photo, and declining leaves everything else working. The app never asks for location.

Not affiliated with Ontario Parks or the Government of Ontario. The app says so under More and in its terms, and directs booking to the official site.
```

## 6. Permission prompts

Set as `INFOPLIST_KEY_*` in `OnCamp.xcodeproj/project.pbxproj`, with the
English and French text in `App/en.lproj` and `App/fr.lproj`
(`InfoPlist.strings`). `node tools/check.js` fails if the English copies
disagree. Guideline 5.1.1(ii) asks that each one says exactly what the access
is for.

| Key | English | French |
| --- | --- | --- |
| `NSCameraUsageDescription` | Add photos of a campsite to your journal. | Ajoutez des photos d’un emplacement à votre journal. |
| `NSPhotoLibraryUsageDescription` | Pick campsite photos from your library for your journal. | Choisissez des photos d’emplacements dans votre photothèque pour votre journal. |
| `NSPhotoLibraryAddUsageDescription` | Save campsite photos to your photo library when you choose to. | Enregistrez des photos d’emplacements dans votre photothèque quand vous le choisissez. |

The app never requests location, contacts, tracking or notifications.

## 7. Screenshots

Take them in the Simulator (File, Save Screen, or Cmd-S) with realistic data
you typed in yourself: real-sounding notes, a few photos, a mix of scores. No
people in the photos, and no Ontario Parks logos. Portrait, PNG, no
transparency (check with `sips -g hasAlpha file.png`).

| Display | Simulator | Size (portrait) | Needed |
| --- | --- | --- | --- |
| iPhone, Dynamic Island, medium | iPhone 17 Pro | 1206 × 2622 | Required, 3 to 10 |
| iPhone, Dynamic Island, large | iPhone 17 Pro Max | 1320 × 2868 | Recommended |
| iPad 13-inch | iPad Pro 13-inch | 2064 × 2752 | Required while iPad is supported |

A good set: the parks list, a campground's site grid with scores, the rating
sheet with a note and a photo, the Journal with its filters, and a park page.
iPhone Duo screenshots become required in April 2027, for builds made with
the iOS 27.1 SDK or later.

## 8. Guidelines that come up for an app like this

- **4.2, minimum functionality.** The notes above say plainly that it is a
  WKWebView app, and list what it does that a website cannot: a full offline
  guide in the binary, Home Screen search, camera, Save to Photos, the share
  sheet, haptics, system language and appearance.
- **2.5.19 and 2.3.1, hidden features.** The only ones are `debugsearch` and
  `statsearch`, read-only, disclosed in the notes. Nothing else is hidden,
  dormant or switched on remotely. Keep it that way, or add any new one to the
  notes before submitting.
- **2.5.2, self-contained.** All code ships in the bundle. The app downloads
  no code and loads nothing from the network.
- **1.2, user-generated content.** Does not apply: there is no service and no
  other users. The only things that leave the device are a backup file and a
  rating shared as plain text, both sent by the person themselves through the
  share sheet.
- **5.1.1, privacy.** The policy is linked in App Store Connect and inside the
  app (More, Legal, Privacy policy). There are no accounts, so 5.1.1(v)
  account deletion does not apply, and More, Your data, Reset all data deletes
  everything anyway.
- **5.2 and 2.3, other people's names.** "Ontario Parks" appears only to
  describe what the app covers, and the listing, the app and its terms all
  say it is not affiliated. The icon is a generic tree. Never use their logo
  or photos in screenshots.

## 9. Third-party material, for Content Rights

- **Park data.** Compiled by the developer from Ontario Parks' public website,
  its campground maps and reservations.ontarioparks.ca (site counts checked on
  21 July 2026). The facts are public; the compilation is the developer's own.
  No Ontario Parks text, photos or logos are included.
- **Descriptions.** Every park, campground and trail description is the
  developer's own writing.
- **Fonts.** Lato 1.104 under the SIL Open Font License
  (`assets/fonts/OFL.txt`), and Noto Sans 1.04 under the Apache License 2.0
  (`assets/fonts/LICENSE-Apache-2.0.txt`). Both licences ship inside the app.

## 10. Submit, then release

1. On the version page, check the build is the 0.238 one you tested, the
   contact details are current and the notes are pasted.
2. Open https://katsuma.ca/privacy.html, https://katsuma.ca/support.html and
   the marketing page on your phone over cellular, to be sure they load.
3. **Add for Review**, then **Submit for Review**. The first only queues it.
4. Watch your email. Answer any message in App Store Connect, on the app's
   App Review page.
5. When it says Pending Developer Release, press **Release This Version**.

## Checklist

- [x] Apple Developer Program membership
- [ ] Latest Program License Agreement accepted
- [ ] Digital Services Act: not a trader
- [ ] Xcode 26 or later installed, Apple Account added
- [ ] Your current journal exported, ready to import into the app
- [ ] Signing team chosen; User Script Sandboxing still off
- [ ] Device test list in section 3 passed on iPhone (and iPad)
- [ ] Archive contains `Web/index.html`; validated and uploaded
- [ ] TestFlight build passes the same list
- [ ] App record created: name, English (Canada), bundle ID, SKU
- [ ] App Information: subtitle, categories, Content Rights, age rating 4+
- [ ] Pricing and Availability: Free, Canada, Mac and Vision Pro unticked
- [ ] App Privacy: policy URL, Data Not Collected, published
- [ ] Screenshots: iPhone 1206 × 2622 (and 1320 × 2868), iPad 2064 × 2752
- [ ] Version page: promo, description, keywords, URLs, copyright, build
- [ ] App Review: contact details, sign-in unticked, notes pasted
- [ ] Manual release selected
- [ ] Privacy, support and marketing pages load over cellular
- [ ] Add for Review, then Submit for Review
