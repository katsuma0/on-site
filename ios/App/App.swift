/* Native iOS shell for the web app in this repository.
   The web files are copied into the bundle at build time ("Bundle Web App"
   build phase) and served to a WKWebView over a local custom scheme, so the
   app works offline and keeps its data in the app's own container.
   The tab bar is the system's own UITabBarController, Liquid Glass on
   iOS 26, with Apple Maps on its Map tab (TabShell, ShellState,
   ParkMapView).
   iPhone search hands the app a park (or a query, with Search in App) as a
   user activity; WebRouter passes it to the page once the page is ready. */

import SwiftUI
import CoreSpotlight

@main
struct OnApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                // a park picked in iPhone search (ParkIndexer indexes them)
                .onContinueUserActivity(CSSearchableItemActionType) { activity in
                    if let identifier = activity.userInfo?[CSSearchableItemActivityIdentifier] as? String {
                        WebRouter.shared.openSearchResult(identifier)
                    }
                }
                // Search in App: the query continues in the app's own search
                .onContinueUserActivity(CSQueryContinuationActionType) { activity in
                    if let query = activity.userInfo?[CSSearchQueryString] as? String {
                        WebRouter.shared.search(query)
                    }
                }
        }
    }
}

/// The system tab bar (TabShell) holds the page and the map.
struct RootView: View {
    var body: some View {
        TabShell()
            .ignoresSafeArea()
    }
}
