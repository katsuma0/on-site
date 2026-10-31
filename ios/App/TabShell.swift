/* The app's tab bar is the system's own: a UITabBarController, which iOS 26
   draws in Liquid Glass (and iOS 17 and 18 in their standard bar). Parks,
   Favourites, Journal and More are the web page; the one web view moves to
   whichever of those tabs is selected and the page switches to it. Map is
   native MapKit. The page reports its tab and its sheets (ShellState), so
   the bar follows a park opened from search, and steps aside while a
   rating sheet or a photo covers the page. */

import SwiftUI
import UIKit
import WebKit
import Combine

struct TabShell: UIViewControllerRepresentable {
    func makeCoordinator() -> Controller { Controller() }

    func makeUIViewController(context: Context) -> UITabBarController {
        context.coordinator.tabs
    }

    func updateUIViewController(_ controller: UITabBarController, context: Context) {}

    final class Controller: NSObject, UITabBarControllerDelegate {
        let tabs = UITabBarController()
        private let shell = ShellState.shared
        private let web = WebCoordinator()
        private let webView: WKWebView
        private var screens: [AppTab: UIViewController] = [:]
        private var watchers = Set<AnyCancellable>()

        override init() {
            webView = WebScreen.makeWebView(coordinator: web)
            super.init()

            let background = UIColor(named: "LaunchBackground") ?? .systemBackground
            var controllers: [UIViewController] = []
            for tab in AppTab.allCases {
                let screen: UIViewController
                if tab == .map {
                    screen = UIHostingController(rootView: ParkMapView())
                } else {
                    screen = UIViewController()
                    screen.view.backgroundColor = background
                }
                screen.tabBarItem = Self.item(for: tab, lang: shell.language)
                screens[tab] = screen
                controllers.append(screen)
            }
            tabs.viewControllers = controllers
            tabs.delegate = self
            tabs.view.backgroundColor = background
            // the bar at the bottom on iPad too, as on iPhone
            tabs.traitOverrides.horizontalSizeClass = .compact
            if #unavailable(iOS 26.0) {
                // before Liquid Glass: the translucent bar, always, since the
                // page scrolls in its own view and never reaches the bar's edge
                let look = UITabBarAppearance()
                look.configureWithDefaultBackground()
                tabs.tabBar.standardAppearance = look
                tabs.tabBar.scrollEdgeAppearance = look
            }
            if let parks = screens[.parks] { hold(webIn: parks) }

            shell.$tab.removeDuplicates().sink { [weak self] tab in
                self?.show(tab)
            }.store(in: &watchers)
            shell.$language.removeDuplicates().sink { [weak self] lang in
                self?.retitle(lang)
            }.store(in: &watchers)
            shell.$modalOpen.removeDuplicates().sink { [weak self] covered in
                self?.setBarHidden(covered)
            }.store(in: &watchers)
        }

        private static func item(for tab: AppTab, lang: String) -> UITabBarItem {
            let image = UIImage(systemName: tab.symbol)
            let selected = UIImage(systemName: tab.symbol + ".fill") ?? image
            return UITabBarItem(title: tab.title(lang), image: image, selectedImage: selected)
        }

        // MARK: the bar

        func tabBarController(_ tabBarController: UITabBarController,
                              didSelect viewController: UIViewController) {
            guard let tab = screens.first(where: { $0.value === viewController })?.key else { return }
            if tab != .map { hold(webIn: viewController) }
            // also on a second tap of the same tab: the page goes back to the
            // top of that tab, as the web version's bar does
            shell.select(tab)
        }

        // MARK: the page and the map

        private func show(_ tab: AppTab) {
            guard let screen = screens[tab] else { return }
            if tabs.selectedViewController !== screen { tabs.selectedViewController = screen }
            if tab == .map { shell.refreshMapState() } else { hold(webIn: screen) }
        }

        private func hold(webIn screen: UIViewController) {
            guard webView.superview !== screen.view else { return }
            webView.removeFromSuperview()
            webView.translatesAutoresizingMaskIntoConstraints = false
            screen.view.addSubview(webView)
            NSLayoutConstraint.activate([
                webView.topAnchor.constraint(equalTo: screen.view.topAnchor),
                webView.bottomAnchor.constraint(equalTo: screen.view.bottomAnchor),
                webView.leadingAnchor.constraint(equalTo: screen.view.leadingAnchor),
                webView.trailingAnchor.constraint(equalTo: screen.view.trailingAnchor),
            ])
        }

        private func retitle(_ lang: String) {
            for (tab, screen) in screens { screen.tabBarItem.title = tab.title(lang) }
        }

        private func setBarHidden(_ hidden: Bool) {
            if #available(iOS 18.0, *) {
                tabs.setTabBarHidden(hidden, animated: true)
            } else {
                UIView.transition(with: tabs.tabBar, duration: 0.25, options: .transitionCrossDissolve) {
                    self.tabs.tabBar.isHidden = hidden
                }
            }
        }
    }
}
