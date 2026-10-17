/* iPhone search (Spotlight). The page sends the parks in its guide once it
   has loaded, and again when the language changes; each park becomes a
   searchable item, so typing a park's name in the Home Screen search finds
   it, and tapping the result opens that park in the app (see App.swift).
   Only the guide's own data is indexed, never the reader's ratings, notes or
   photos. Items keep the same identifiers from one launch to the next, so an
   update keeps their place in the results; a park that leaves the guide is
   removed using the list of identifiers saved after the last run. */

import Foundation
import CoreSpotlight
import UniformTypeIdentifiers

enum ParkIndexer {
    static let domain = "parks"
    static let prefix = "park:"

    static func update(from body: Any) {
        guard CSSearchableIndex.isIndexingAvailable(),
              let message = body as? [String: Any],
              let parks = message["parks"] as? [[String: Any]], !parks.isEmpty else { return }

        var items: [CSSearchableItem] = []
        var identifiers: [String] = []
        for park in parks {
            guard let id = park["id"] as? String, !id.isEmpty,
                  let name = park["name"] as? String, !name.isEmpty else { continue }
            let attributes = CSSearchableItemAttributeSet(contentType: UTType.content)
            attributes.title = name
            attributes.displayName = name
            attributes.contentDescription = park["text"] as? String
            attributes.keywords = (park["keywords"] as? [Any])?.compactMap { $0 as? String }
            let item = CSSearchableItem(uniqueIdentifier: prefix + id,
                                        domainIdentifier: domain,
                                        attributeSet: attributes)
            // the default is a month; the guide does not go stale like that
            item.expirationDate = Date.distantFuture
            items.append(item)
            identifiers.append(prefix + id)
        }
        guard !items.isEmpty else { return }

        let index = CSSearchableIndex.default()
        let stale = Set(savedIdentifiers()).subtracting(identifiers)
        if !stale.isEmpty {
            index.deleteSearchableItems(withIdentifiers: Array(stale), completionHandler: nil)
        }
        index.indexSearchableItems(items) { [identifiers] error in
            if error == nil { save(identifiers) }
        }
    }

    // MARK: - The identifiers indexed last time (Application Support)

    private static var listURL: URL? {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("spotlight-parks.json")
    }

    private static func savedIdentifiers() -> [String] {
        guard let url = listURL,
              let data = try? Data(contentsOf: url),
              let list = try? JSONSerialization.jsonObject(with: data) as? [String] else { return [] }
        return list
    }

    private static func save(_ identifiers: [String]) {
        guard let url = listURL,
              let data = try? JSONSerialization.data(withJSONObject: identifiers) else { return }
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(),
                                                 withIntermediateDirectories: true)
        try? data.write(to: url, options: .atomic)
    }
}
