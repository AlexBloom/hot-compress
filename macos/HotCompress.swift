import AppKit
import WebKit

final class HotCompressApp: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var engine: Process?
    var engineOrigin: URL?
    var outputBuffer = ""
    var quitting = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Hot Compress", action: #selector(about), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit Hot Compress", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        menu.addItem(appItem)
        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        for (title, action, key) in [("Undo", "undo:", "z"), ("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] {
            editMenu.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        editItem.submenu = editMenu
        menu.addItem(editItem)
        NSApp.mainMenu = menu

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1400, height: 900), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Hot Compress"
        window.minSize = NSSize(width: 640, height: 600)
        window.center()
        let config = WKWebViewConfiguration()
        web = WKWebView(frame: window.contentView!.bounds, configuration: config)
        web.autoresizingMask = [.width, .height]
        web.navigationDelegate = self
        web.uiDelegate = self
        window.contentView = web
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        startEngine()
    }
    @objc func about() {
        let alert = NSAlert()
        alert.messageText = "Hot Compress"
        alert.informativeText = "Local image, RAW and video compression.\nDeveloper build · not notarized.\nSystem codecs: ImageMagick, FFmpeg, LibRaw; JPEG XL optional."
        alert.runModal()
    }
    func showError(_ message: String) {
        let alert = NSAlert(); alert.messageText = "Hot Compress needs attention"; alert.informativeText = message
        alert.addButton(withTitle: "Quit"); alert.runModal(); NSApp.terminate(nil)
    }
    func startEngine() {
        guard let resources = Bundle.main.resourceURL else { showError("Application resources are missing."); return }
        let node = resources.appendingPathComponent("runtime/node")
        let cli = resources.appendingPathComponent("engine/bin/hot-compress.mjs")
        let env = ProcessInfo.processInfo.environment
        let workspace = env["HOT_COMPRESS_WORKSPACE"].map { URL(fileURLWithPath: $0) } ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Pictures/Hot Compress", isDirectory: true)
        do { try FileManager.default.createDirectory(at: workspace, withIntermediateDirectories: true) } catch { showError("Cannot create the output folder: \(error.localizedDescription)"); return }
        var childEnv = env
        childEnv["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:" + (env["PATH"] ?? "")
        let check = Process(); check.executableURL = node; check.arguments = [cli.path, "doctor", "--json"]; check.environment = childEnv
        let checkOut = Pipe(); check.standardOutput = checkOut; check.standardError = Pipe()
        do {
            try check.run()
            let data = checkOut.fileHandleForReading.readDataToEndOfFile(); check.waitUntilExit()
            if let rows = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
                let missing = rows.filter { ($0["available"] as? Bool) == false }.compactMap { $0["tool"] as? String }
                if !missing.isEmpty {
                    let alert = NSAlert(); alert.messageText = "Install local compression tools"
                    alert.informativeText = "Missing: \(missing.joined(separator: ", ")).\n\nInstall Homebrew from brew.sh, then run:\n\nbrew install imagemagick ffmpeg libraw jpeg-xl\n\nYou can continue, but formats requiring missing tools will report an error."
                    alert.addButton(withTitle: "Continue"); alert.addButton(withTitle: "Quit")
                    if alert.runModal() == .alertSecondButtonReturn { NSApp.terminate(nil); return }
                }
            } else { showError("Could not inspect the bundled engine."); return }
        } catch { showError("The bundled runtime could not start: \(error.localizedDescription)"); return }
        let task = Process(); task.executableURL = node
        task.arguments = [cli.path, "gui", "--port", "0", "--no-open"]
        task.currentDirectoryURL = workspace; task.environment = childEnv
        let pipe = Pipe(); task.standardOutput = pipe; task.standardError = pipe
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData; if data.isEmpty { handle.readabilityHandler = nil; return }
            guard let text = String(data: data, encoding: .utf8) else { return }
            DispatchQueue.main.async { self?.readOutput(text) }
        }
        task.terminationHandler = { [weak self] process in
            DispatchQueue.main.async {
                guard let self = self, !self.quitting else { return }
                self.showError("The local engine stopped (exit \(process.terminationStatus)).\n\(self.outputBuffer.suffix(1200))")
            }
        }
        engine = task
        do { try task.run() } catch { showError(error.localizedDescription) }
    }
    func readOutput(_ text: String) {
        outputBuffer += text
        while let newline = outputBuffer.range(of: "\n") {
            let line = String(outputBuffer[..<newline.lowerBound]); outputBuffer.removeSubrange(..<newline.upperBound)
            let prefix = "Hot Compress is running locally: "
            if line.hasPrefix(prefix), let url = URL(string: String(line.dropFirst(prefix.count))) {
                engineOrigin = URL(string: "http://127.0.0.1:\(url.port!)")
                fputs("Loading local interface on port \(url.port!)\n", stderr)
                web.load(URLRequest(url: url))
            }
        }
        if outputBuffer.count > 8000 { outputBuffer = String(outputBuffer.suffix(8000)) }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.host == "127.0.0.1" && url.port == engineOrigin?.port { decisionHandler(navigationAction.shouldPerformDownload ? .download : .allow); return }
        if url.scheme == "https" || url.scheme == "http" { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if isDownloadNavigation(error) { return }
        showError("The local interface could not load: \(error.localizedDescription)")
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if isDownloadNavigation(error) { return }
        showError("The local interface stopped loading: \(error.localizedDescription)")
    }
    func isDownloadNavigation(_ error: Error) -> Bool {
        let failure = error as NSError
        return (failure.domain == "WebKitErrorDomain" && failure.code == 102) || (failure.domain == NSURLErrorDomain && failure.code == NSURLErrorCancelled)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, ["http", "https"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        return nil
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel(); panel.canChooseFiles = !parameters.allowsDirectories; panel.canChooseDirectories = parameters.allowsDirectories
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = suggestedFilename
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.url : nil) }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { quitting = true; engine?.terminate() }
}
let app = NSApplication.shared
let delegate = HotCompressApp()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
