/* Native iOS shell for the web app in this repository.
   The web files are copied into the bundle at build time ("Bundle Web App"
   build phase) and served to a WKWebView over a local custom scheme, so the
   app works offline and keeps its data in the app's own container.
   Over the page the shell draws the Liquid Glass tab bar and, on the Map
   tab, Apple Maps (ShellState, GlassTabBar, ParkMapView).
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

/// The page, the map above it on the Map tab, and the tab bar above both.
struct RootView: View {
    @ObservedObject var shell = ShellState.shared

    var body: some View {
        GeometryReader { geo in
            let safeBottom = geo.safeAreaInsets.bottom
            let gap = BarMetrics.bottomGap(safeBottom: safeBottom)
            ZStack(alignment: .bottom) {
                WebScreen()
                    .ignoresSafeArea()

                // built the first time the tab is opened, then kept, so the
                // map keeps its place while you look at other tabs
                if shell.mapShown {
                    ParkMapView(barClearance: max(0, gap + 58 - safeBottom) + 6)
                        .opacity(shell.tab == .map ? 1 : 0)
                        .allowsHitTesting(shell.tab == .map)
                        .accessibilityHidden(shell.tab != .map)
                }

                // the stack ends at the safe area line; the bar is placed
                // from the screen edge instead, `gap` above it (21pt with a
                // home indicator, as in Find My)
                GlassTabBar()
                    .offset(y: (safeBottom - gap) + (shell.barHidden ? 120 : 0))
                    .opacity(shell.barHidden ? 0 : 1)
                    .allowsHitTesting(!shell.barHidden)
                    .accessibilityHidden(shell.barHidden)
            }
            .animation(.spring(response: 0.38, dampingFraction: 0.86), value: shell.barHidden)
            .animation(.easeInOut(duration: 0.2), value: shell.tab)
        }
        // the keyboard covers the bar; it never pushes it up
        .ignoresSafeArea(.keyboard)
    }
}
