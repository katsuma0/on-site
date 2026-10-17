/* The single full-screen web view, plus everything that makes the web app
   feel native:
     - navigation policy: the app stays inside its local scheme; http(s)
       links (official park pages, katsuma.ca, the sibling app) open in
       Safari, and mail/tel links go to the system.
     - share bridge: the injected script (Bridge.swift) forwards
       navigator.share() here, and the files it carries (the journal backup)
       are handed to a real UIActivityViewController.
     - downloads: <a download> or blob: links become a share sheet with the
       file.
     - haptics: the web app's taps come through as light impact feedback.
     - JS dialogs: alert/confirm/prompt map to UIAlertController, with the
       buttons in the app's language.
     - appearance: the in-app theme (Auto, Light, Dark) also sets the status
       bar, alerts and the share sheet.
     - iPhone search: the page sends its parks to ParkIndexer, and WebRouter
       opens the one picked in search. */

import SwiftUI
import WebKit
import UIKit

struct WebScreen: UIViewRepresentable {
    func makeCoordinator() -> WebCoordinator { WebCoordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let coordinator = context.coordinator

        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(LocalSchemeHandler(), forURLScheme: "app")
        config.allowsInlineMediaPlayback = true
        config.websiteDataStore = .default()

        let controller = config.userContentController
        for name in WebCoordinator.messageNames {
            controller.add(coordinator, name: name)
        }
        controller.addUserScript(WKUserScript(source: NativeBridge.script,
                                              injectionTime: .atDocumentStart,
                                              forMainFrameOnly: true))

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = coordinator
        webView.uiDelegate = coordinator
        // The page's own background (light #F2F2F7, dark #010409), so the
        // launch, the first paint and a bounce past the edge are one colour.
        let background = UIColor(named: "LaunchBackground") ?? .systemBackground
        webView.isOpaque = false
        webView.backgroundColor = background
        webView.scrollView.backgroundColor = background
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.keyboardDismissMode = .interactive
        #if DEBUG
        webView.isInspectable = true   // Safari's Develop menu, Web Inspector
        #endif

        coordinator.webView = webView
        WebRouter.shared.coordinator = coordinator
        webView.load(URLRequest(url: WebCoordinator.startURL))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

/* Requests from the system (a park picked in iPhone search, Search in App)
   arrive as user activities. On a cold launch the page has not loaded yet,
   so the request waits and runs once it has. */
final class WebRouter {
    static let shared = WebRouter()
    weak var coordinator: WebCoordinator?
    private var pendingScript: String?

    func openSearchResult(_ identifier: String) {
        guard identifier.hasPrefix(ParkIndexer.prefix) else { return }
        let parkID = String(identifier.dropFirst(ParkIndexer.prefix.count))
        run("window.onsiteOpenPark && window.onsiteOpenPark(\(Self.literal(parkID)));")
    }

    func search(_ query: String) {
        run("window.onsiteSearch && window.onsiteSearch(\(Self.literal(query)));")
    }

    func pageDidLoad() {
        guard let script = pendingScript else { return }
        pendingScript = nil
        coordinator?.evaluate(script)
    }

    private func run(_ script: String) {
        if let coordinator = coordinator, coordinator.isPageReady {
            coordinator.evaluate(script)
        } else {
            pendingScript = script
        }
    }

    // A JavaScript string literal, escaped the way JSON escapes it.
    private static func literal(_ text: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [text]),
              let json = String(data: data, encoding: .utf8),
              json.count >= 2 else { return "''" }
        return String(json.dropFirst().dropLast())
    }
}

final class WebCoordinator: NSObject, WKNavigationDelegate, WKUIDelegate,
                            WKScriptMessageHandler, WKDownloadDelegate {
    static let messageNames = ["share", "haptic", "spotlight", "appearance"]
    static let startURL = URL(string: "app://localhost/index.html")!

    weak var webView: WKWebView?
    private(set) var isPageReady = false
    private var downloadURL: URL?
    private var language = "en"
    private var interfaceStyle: UIUserInterfaceStyle = .unspecified

    func evaluate(_ script: String) {
        webView?.evaluateJavaScript(script, completionHandler: nil)
    }

    // MARK: - Page lifecycle

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        isPageReady = false
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isPageReady = true
        applyInterfaceStyle()
        WebRouter.shared.pageDidLoad()
    }

    // iOS can stop the page's process to free memory. Load the page again
    // rather than leave a blank screen; the journal is saved as it is written.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        isPageReady = false
        if webView.url == nil {
            webView.load(URLRequest(url: Self.startURL))
        } else {
            webView.reload()
        }
    }

    // MARK: - Navigation policy

    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        let scheme = (url.scheme ?? "").lowercased()
        if navigationAction.shouldPerformDownload {
            // WKDownload fetches in the network process, which cannot see the
            // custom scheme handler, so app:// downloads are served straight
            // from the bundle instead. blob: downloads go the normal route.
            if scheme == "app" { decisionHandler(.cancel); shareBundledFile(at: url); return }
            decisionHandler(.download); return
        }
        switch scheme {
        case "app":
            decisionHandler(.allow)
        case "blob":
            decisionHandler(.download)
        case "http", "https", "mailto", "tel", "sms":
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        default:
            decisionHandler(.cancel)
        }
    }

    // An <a download> pointing at a bundled file: hand the file to a share sheet.
    private func shareBundledFile(at url: URL) {
        guard let resourceURL = Bundle.main.resourceURL else { return }
        let webRoot = resourceURL.appendingPathComponent("Web", isDirectory: true).standardizedFileURL
        let path = url.path
        guard !path.isEmpty, path != "/" else { return }
        let fileURL = webRoot.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard fileURL.path.hasPrefix(webRoot.path),
              FileManager.default.fileExists(atPath: fileURL.path) else { return }
        let dir = makeTemporaryDirectory()
        let dest = dir.appendingPathComponent(fileURL.lastPathComponent)
        try? FileManager.default.copyItem(at: fileURL, to: dest)
        presentShareSheet(items: [dest]) { [weak self] _ in self?.removeTemporary(dir) }
    }

    // target="_blank" links (official park pages, katsuma.ca, the sibling app)
    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url,
           let scheme = url.scheme?.lowercased(),
           scheme == "http" || scheme == "https" || scheme == "mailto" {
            UIApplication.shared.open(url)
        }
        return nil
    }

    // MARK: - Downloads (become a share sheet)

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction,
                 didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse,
                 didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        let dir = makeTemporaryDirectory()
        let name = suggestedFilename.isEmpty ? "export" : suggestedFilename
        let url = dir.appendingPathComponent(name)
        downloadURL = url
        completionHandler(url)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let url = downloadURL else { return }
        downloadURL = nil
        let dir = url.deletingLastPathComponent()
        presentShareSheet(items: [url]) { [weak self] _ in self?.removeTemporary(dir) }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if let url = downloadURL { removeTemporary(url.deletingLastPathComponent()) }
        downloadURL = nil
    }

    // MARK: - Bridge messages from the injected script and the page

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        switch message.name {
        case "haptic":
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case "share":
            if let body = message.body as? [String: Any] { handleShare(body) }
        case "spotlight":
            ParkIndexer.update(from: message.body)
        case "appearance":
            if let body = message.body as? [String: Any] { handleAppearance(body) }
        default:
            break
        }
    }

    private func handleShare(_ body: [String: Any]) {
        let id = body["id"] as? String ?? ""
        var items: [Any] = []
        var folder: URL?

        if let files = body["files"] as? [[String: Any]], !files.isEmpty {
            let dir = makeTemporaryDirectory()
            folder = dir
            for file in files {
                // text files (the JSON backup) cross as text, images as base64
                var data: Data?
                if let text = file["text"] as? String {
                    data = Data(text.utf8)
                } else if let b64 = file["data"] as? String {
                    data = Data(base64Encoded: b64)
                }
                guard let contents = data else { continue }
                let rawName = (file["name"] as? String) ?? ""
                var name = (rawName as NSString).lastPathComponent
                if name.isEmpty { name = "file" }
                let url = dir.appendingPathComponent(name)
                do { try contents.write(to: url); items.append(url) } catch {}
            }
        }
        if let text = body["text"] as? String, !text.isEmpty { items.append(text) }
        if items.isEmpty, let urlString = body["url"] as? String, !urlString.isEmpty,
           let url = URL(string: urlString) {
            items.append(url)
        }
        // Nothing could be written: report a failure, not a cancel, so the
        // page can tell the reader the export did not happen.
        guard !items.isEmpty else {
            removeTemporary(folder)
            resolveShare(id: id, status: "error")
            return
        }

        presentShareSheet(items: items) { [weak self] completed in
            self?.removeTemporary(folder)
            self?.resolveShare(id: id, status: completed ? "shared" : "cancel")
        }
    }

    private func resolveShare(id: String, status: String) {
        // ids are bridge-generated alphanumerics; filter anyway before they
        // are interpolated into JavaScript.
        let safe = id.filter { $0.isLetter || $0.isNumber || $0 == "-" }
        evaluate("window.__bridgeShareDone && window.__bridgeShareDone('\(safe)', '\(status)')")
    }

    // MARK: - Appearance (theme and language from the page)

    private func handleAppearance(_ body: [String: Any]) {
        if let lang = body["lang"] as? String { language = (lang == "fr") ? "fr" : "en" }
        switch body["theme"] as? String {
        case "light": interfaceStyle = .light
        case "dark": interfaceStyle = .dark
        default: interfaceStyle = .unspecified
        }
        applyInterfaceStyle()
    }

    // Auto follows the system; Light or Dark holds the whole app to that look.
    private func applyInterfaceStyle() {
        for window in appWindows() where window.overrideUserInterfaceStyle != interfaceStyle {
            window.overrideUserInterfaceStyle = interfaceStyle
        }
    }

    private var okTitle: String { "OK" }
    private var cancelTitle: String { language == "fr" ? "Annuler" : "Cancel" }

    // MARK: - JS dialogs

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        // WebKit stalls the page's JS until the handler is called, so if there
        // is nowhere to present, answer immediately.
        guard let top = topViewController() else { completionHandler(); return }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: okTitle, style: .default) { _ in completionHandler() })
        top.present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        guard let top = topViewController() else { completionHandler(false); return }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: cancelTitle, style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: okTitle, style: .default) { _ in completionHandler(true) })
        top.present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        guard let top = topViewController() else { completionHandler(nil); return }
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: cancelTitle, style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: okTitle, style: .default) { [weak alert] _ in
            completionHandler(alert?.textFields?.first?.text)
        })
        top.present(alert, animated: true)
    }

    // MARK: - Helpers

    private func presentShareSheet(items: [Any], completion: ((Bool) -> Void)?) {
        // Never present without settling the completion; a dropped completion
        // would leave the page's share promise pending forever.
        guard let top = topViewController() else { completion?(false); return }
        let activity = UIActivityViewController(activityItems: items, applicationActivities: nil)
        activity.completionWithItemsHandler = { _, completed, _, _ in completion?(completed) }
        if let popover = activity.popoverPresentationController, let webView = webView {
            popover.sourceView = webView
            popover.sourceRect = CGRect(x: webView.bounds.midX,
                                        y: webView.bounds.maxY - 80, width: 1, height: 1)
        }
        top.present(activity, animated: true)
    }

    private func makeTemporaryDirectory() -> URL {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    // A shared file is copied by whatever received it, so its folder can go.
    private func removeTemporary(_ dir: URL?) {
        guard let dir = dir else { return }
        try? FileManager.default.removeItem(at: dir)
    }

    private func appWindows() -> [UIWindow] {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
    }

    private func topViewController() -> UIViewController? {
        let windows = appWindows()
        let window = windows.first { $0.isKeyWindow } ?? windows.first
        var top = window?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
