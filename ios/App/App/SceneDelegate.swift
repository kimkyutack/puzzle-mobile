import UIKit
import Capacitor
import WebKit
#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = GardenStartupViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        #if canImport(GoogleSignIn)
        for context in URLContexts {
            if GIDSignIn.sharedInstance.handle(context.url) { return }
        }
        #endif
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// Keep the launch artwork above WKWebView until its first visible web frame.
/// This does not wait for authentication, API requests or the game asset atlas.
private final class GardenStartupViewController: CAPBridgeViewController {
    private var startupCover: UIImageView?
    private var firstWebFrameReady = false

    override func viewDidLoad() {
        super.viewDidLoad()
        guard !firstWebFrameReady else { return }

        let cover = UIImageView(image: UIImage(named: "Splash"))
        cover.frame = view.bounds
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.contentMode = .scaleAspectFill
        cover.clipsToBounds = true
        cover.backgroundColor = UIColor(red: 36 / 255, green: 138 / 255, blue: 199 / 255, alpha: 1)
        cover.isUserInteractionEnabled = true
        cover.accessibilityIdentifier = "garden-startup-cover"
        view.addSubview(cover)
        startupCover = cover
    }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        let handler = GardenStartupMessageHandler { [weak self] in self?.revealWebContent() }
        configuration.userContentController.add(handler, name: "gardenStartupReady")
        configuration.userContentController.addUserScript(WKUserScript(
            source: Self.firstFrameScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true
        ))
        return super.webView(with: frame, configuration: configuration)
    }

    private func revealWebContent() {
        guard !firstWebFrameReady else { return }
        firstWebFrameReady = true
        guard let cover = startupCover else { return }
        UIView.animate(withDuration: 0.18, delay: 0, options: [.beginFromCurrentState, .curveEaseOut], animations: {
            cover.alpha = 0
        }, completion: { [weak self] _ in
            cover.removeFromSuperview()
            self?.startupCover = nil
        })
    }

    // Native injection also covers already-bundled web versions. A decoded
    // poster plus two animation frames avoids exposing the WebView background.
    // Recheck after both frames because React can replace the initial HTML.
    private static let firstFrameScript = """
    (() => {
      const decoded = new WeakSet();
      const decoding = new WeakSet();
      const decodeFailures = new WeakSet();
      let finished = false;
      let scheduled = false;
      const visible = element => {
        if (!element) return false;
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return bounds.width > 0 && bounds.height > 0 && style.display !== 'none' &&
          style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const ready = () => {
        if (document.hidden) return false;
        const root = document.getElementById('root');
        const poster = root?.querySelector('.app-splash img, .startup-poster img');
        if (poster && visible(poster) && poster.complete && poster.naturalWidth > 0) {
          if (typeof poster.decode !== 'function' || decoded.has(poster)) return true;
          if (!decoding.has(poster)) {
            decoding.add(poster);
            poster.decode().then(() => { decoded.add(poster); schedule(); }).catch(() => {
              decodeFailures.add(poster); schedule();
            });
          }
        }
        // A missing poster must not hide an actionable error/admission screen.
        const content = root?.querySelector('[role="dialog"], .language-choice, .story-loading-bottom, .game-shell') ||
          document.getElementById('freeze-probe');
        return (!poster || poster.complete && poster.naturalWidth === 0 || decodeFailures.has(poster)) &&
          visible(content) && !!content.textContent.trim();
      };
      const schedule = () => {
        if (finished || scheduled || !ready()) return;
        scheduled = true;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          scheduled = false;
          if (!ready()) return;
          finished = true;
          observer.disconnect();
          document.removeEventListener('load', schedule, true);
          document.removeEventListener('error', schedule, true);
          document.removeEventListener('visibilitychange', schedule);
          window.webkit.messageHandlers.gardenStartupReady.postMessage('first-frame-ready');
        }));
      };
      const observer = new MutationObserver(schedule);
      observer.observe(document.documentElement, {childList: true, subtree: true, attributes: true,
        attributeFilter: ['src', 'srcset', 'class', 'style']});
      document.addEventListener('load', schedule, true);
      document.addEventListener('error', schedule, true);
      document.addEventListener('visibilitychange', schedule);
      schedule();
    })();
    """
}

/// WKUserContentController retains its handler; the callback captures the VC weakly.
private final class GardenStartupMessageHandler: NSObject, WKScriptMessageHandler {
    private let onReady: () -> Void
    init(onReady: @escaping () -> Void) { self.onReady = onReady }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.name == "gardenStartupReady",
              message.body as? String == "first-frame-ready" else { return }
        onReady()
    }
}
