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
   so the request waits and runs once it has. Each script answers true once
   it has run, so a request that reaches a page which has just died (iOS
   can stop it in the background) waits for the reload instead of being
   lost. */
final class WebRouter {
    static let shared = WebRouter()
    weak var coordinator: WebCoordinator?
    private var pendingScript: String?

    func openSearchResult(_ identifier: String) {
        guard identifier.hasPrefix(ParkIndexer.prefix) else { return }
        let parkID = String(identifier.dropFirst(ParkIndexer.prefix.count))
        run("typeof window.onsiteOpenPark === 'function' && (window.onsiteOpenPark(\(Self.literal(parkID))), true)")
    }

    func search(_ query: String) {
        run("typeof window.onsiteSearch === 'function' && (window.onsiteSearch(\(Self.literal(query))), true)")
    }

    func pageDidLoad() {
        guard let script = pendingScript else { return }
        pendingScript = nil
        run(script)
    }

    private func run(_ script: String) {
        guard let coordinator = coordinator, coordinator.isPageReady else {
            pendingScript = script
            return
        }
        coordinator.evaluate(script) { [weak self] ran in
            if !ran { self?.pendingScript = script }
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
    private var hasPage = false   // a document has committed and is on screen
    private var downloadURL: URL?
    private var language = "en"
    private var interfaceStyle: UIUserInterfaceStyle = .unspecified

    // `ran` hears whether the script ran and answered true.
    func evaluate(_ script: String, ran: ((Bool) -> Void)? = nil) {
        guard let webView = webView else { ran?(false); return }
        webView.evaluateJavaScript(script) { result, error in
            ran?(error == nil && (result as? Bool) == true)
        }
    }

    // MARK: - Page lifecycle

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        isPageReady = false
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        hasPage = true
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isPageReady = true
        applyInterfaceStyle()
        WebRouter.shared.pageDidLoad()
    }

    // A navigation that fails before it commits leaves the previous page in
    // place; let the requests waiting for a page through to it. A cancelled
    // one was replaced by a newer navigation, whose didFinish runs them.
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        let failure = error as NSError
        guard hasPage,
              !(failure.domain == NSURLErrorDomain && failure.code == NSURLErrorCancelled) else { return }
        isPageReady = true
        WebRouter.shared.pageDidLoad()
    }

    // iOS can stop the page's process to free memory. Load the page again
    // rather than leave a blank screen; the journal is saved as it is written.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        hasPage = false
        isPageReady = false
        if webView.url == nil {
            webView.load(URLRequest(url: Self.startURL))
        } else {
            webView.reload()
        }
    }

    // MARK: - Navigation policy

    // Handler types are spelled as the SDK declares them (@MainActor
    // @Sendable); a plain @escaping still matches but draws a warning.
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
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
                  completionHandler: @escaping @MainActor @Sendable (URL?) -> Void) {
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

        presentShareSheet(items: items, from: anchorRect(body["rect"])) { [weak self] status in
            self?.removeTemporary(folder)
            self?.resolveShare(id: id, status: status)
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

    // MARK: - JS dialogs (the add-a-site prompt uses one)
    // WebKit stalls the page's JS until a dialog is answered, and throws if
    // the handler is released unanswered (an alert UIKit refused to show) or
    // answered twice. DialogAnswer replies exactly once, with the fallback
    // when the alert goes away unanswered.

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping @MainActor @Sendable () -> Void) {
        let answer = DialogAnswer<Void>(fallback: ()) { _ in completionHandler() }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: okTitle, style: .default) { _ in answer(()) })
        presentOnTop(alert)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping @MainActor @Sendable (Bool) -> Void) {
        let answer = DialogAnswer<Bool>(fallback: false) { completionHandler($0) }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: cancelTitle, style: .cancel) { _ in answer(false) })
        alert.addAction(UIAlertAction(title: okTitle, style: .default) { _ in answer(true) })
        presentOnTop(alert)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping @MainActor @Sendable (String?) -> Void) {
        let answer = DialogAnswer<String?>(fallback: nil) { completionHandler($0) }
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: cancelTitle, style: .cancel) { _ in answer(nil) })
        alert.addAction(UIAlertAction(title: okTitle, style: .default) { [weak alert] _ in
            answer(alert?.textFields?.first?.text)
        })
        presentOnTop(alert)
    }

    // MARK: - Helpers

    /// Presents on the topmost view controller. False when UIKit cannot
    /// present right now (no window, or another presentation mid-transition).
    @discardableResult
    private func presentOnTop(_ controller: UIViewController) -> Bool {
        guard let top = topViewController(), top.viewIfLoaded?.window != nil,
              !top.isBeingPresented, !top.isBeingDismissed else { return false }
        top.present(controller, animated: true)
        return controller.presentingViewController != nil
    }

    // The control the page shared from, in page points, if it said. A rect
    // as large as the page itself is no control; the fallback is used.
    private func anchorRect(_ value: Any?) -> CGRect? {
        guard let r = value as? [String: Any],
              let x = r["x"] as? Double, let y = r["y"] as? Double,
              let w = r["w"] as? Double, let h = r["h"] as? Double, w > 0, h > 0,
              let bounds = webView?.bounds, w < bounds.width || h < bounds.height else { return nil }
        return CGRect(x: x, y: y, width: w, height: h)
    }

    /// Presents the share sheet; the completion hears "shared", "cancel" or
    /// "error" (UIKit could not present it) exactly once.
    private func presentShareSheet(items: [Any], from anchor: CGRect? = nil, completion: ((String) -> Void)?) {
        let activity = UIActivityViewController(activityItems: items, applicationActivities: nil)
        let outcome = ShareOutcome(completion)
        // As in WebKit's own navigator.share (WKShareSheet.mm), the handler can
        // run more than once before the sheet is dismissed, so the page's
        // promise is settled, and its files deleted, only once the sheet is gone.
        activity.completionWithItemsHandler = { [weak activity] _, completed, _, _ in
            if completed { outcome.shared = true }
            if let sheet = activity, sheet.presentingViewController != nil,
               !sheet.isBeingDismissed { return }
            outcome.settle()
        }
        if let popover = activity.popoverPresentationController, let webView = webView {
            // on iPad the popover points at the button that was tapped (the
            // share button on the rating sheet, the Export row), else low
            // and centred
            popover.sourceView = webView
            popover.sourceRect = anchor ?? CGRect(x: webView.bounds.midX,
                                                  y: webView.bounds.maxY - 80, width: 1, height: 1)
        }
        // Never leave the completion unsettled: the page's share promise
        // would stay pending forever. A sheet UIKit refused is an error,
        // not a cancel, so the page can say the share did not happen.
        if !presentOnTop(activity) { outcome.failed = true; outcome.settle() }
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

/// Replies to a JS dialog exactly once: with the button tapped, or with the
/// fallback if the alert is released unanswered.
private final class DialogAnswer<Value> {
    private var reply: ((Value) -> Void)?
    private let fallback: Value

    init(fallback: Value, _ reply: @escaping (Value) -> Void) {
        self.fallback = fallback
        self.reply = reply
    }

    func callAsFunction(_ value: Value) {
        reply?(value)
        reply = nil
    }

    deinit { reply?(fallback) }
}

/// One share sheet's result, reported to the page exactly once.
private final class ShareOutcome {
    var shared = false
    var failed = false
    private var completion: ((String) -> Void)?

    init(_ completion: ((String) -> Void)?) { self.completion = completion }

    func settle() {
        completion?(failed ? "error" : shared ? "shared" : "cancel")
        completion = nil
    }

    // the safety net: settled at the latest when UIKit releases the sheet
    deinit { settle() }
}
