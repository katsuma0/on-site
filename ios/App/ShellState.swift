/* What the native shell draws over the web view: the Liquid Glass tab bar
   and the Map tab. The page reports which tab it is on and when a sheet
   covers it (the "chrome" message); the shell switches the page's tab by
   calling window.onsiteShowTab. The Map tab is native and never reaches
   the page, except to open a park picked on the map. */

import SwiftUI
import UIKit

enum AppTab: String, CaseIterable, Identifiable {
    case parks, map, favs, journal, more

    var id: String { rawValue }

    /// The page's own name for the tab (showTab in app.js); nil for Map.
    var webTab: String? {
        switch self {
        case .parks: return "guide"
        case .map: return nil
        case .favs: return "favs"
        case .journal: return "journal"
        case .more: return "more"
        }
    }

    var symbol: String {
        switch self {
        case .parks: return "tent"
        case .map: return "map"
        case .favs: return "heart"
        case .journal: return "book.closed"
        case .more: return "ellipsis"
        }
    }

    func title(_ lang: String) -> String {
        let fr = lang == "fr"
        switch self {
        case .parks: return fr ? "Parcs" : "Parks"
        case .map: return fr ? "Carte" : "Map"
        case .favs: return fr ? "Favoris" : "Favourites"
        case .journal: return "Journal"
        case .more: return fr ? "Plus" : "More"
        }
    }

    /// The tab the page's own tab names belong to; search and the shared
    /// screen keep whatever was selected.
    init?(webTab: String) {
        switch webTab {
        case "guide": self = .parks
        case "favs": self = .favs
        case "journal": self = .journal
        case "more", "photos": self = .more
        default: return nil
        }
    }
}

final class ShellState: ObservableObject {
    static let shared = ShellState()

    @Published var tab: AppTab = .parks
    @Published var modalOpen = false
    @Published var language = "en"
    @Published var mapShown = false
    @Published var favourites: Set<String> = []
    @Published var visited: Set<String> = []

    var barHidden: Bool { modalOpen && tab != .map }

    // MARK: from the page

    func apply(chrome body: [String: Any]) {
        // the page only changes tab when asked to: by this bar, by a park
        // opened from the map or from iPhone search, so it always wins
        if let web = body["tab"] as? String, let t = AppTab(webTab: web), tab != t {
            tab = t
        }
        if let modal = body["modal"] as? Bool, modal != modalOpen {
            modalOpen = modal
        }
    }

    // MARK: from the bar

    func select(_ next: AppTab) {
        if next == .map {
            mapShown = true
            refreshMapState()
        } else if let web = next.webTab {
            run("typeof window.onsiteShowTab === 'function' && window.onsiteShowTab('\(web)')")
        }
        tab = next
    }

    // MARK: from the map

    func openPark(_ guideID: String) {
        tab = .parks
        let safe = guideID.filter { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
        run("typeof window.onsiteOpenPark === 'function' && (window.onsiteOpenPark('\(safe)'), true)")
    }

    func openAlgonquin() {
        tab = .parks
        run("typeof window.onsiteShowRegion === 'function' && window.onsiteShowRegion('Algonquin')")
    }

    /// Favourite and visited parks, so the pins can say which is which.
    func refreshMapState() {
        WebRouter.shared.coordinator?.evaluateValue(
            "typeof window.onsiteMapState === 'function' ? window.onsiteMapState() : ''"
        ) { [weak self] value in
            guard let self = self, let json = value as? String, let data = json.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
            self.favourites = Set(obj["fav"] as? [String] ?? [])
            self.visited = Set(obj["visited"] as? [String] ?? [])
            if let lang = obj["lang"] as? String { self.language = (lang == "fr") ? "fr" : "en" }
        }
    }

    private func run(_ script: String) {
        WebRouter.shared.coordinator?.evaluate(script)
    }
}
