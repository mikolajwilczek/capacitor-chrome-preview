import Capacitor
import UIKit
import WebKit

@objc(GeometryProbePlugin)
public final class GeometryProbePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GeometryProbePlugin"
    public let jsName = "GeometryProbe"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "measure", returnType: CAPPluginReturnPromise)
    ]

    @objc public func measure(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else {
                call.reject("Geometry probe was released before measurement.")
                return
            }

            guard let viewController = self.bridge?.viewController else {
                call.reject("Capacitor view controller is unavailable.")
                return
            }

            let rootView = viewController.view
            let window = rootView?.window
            let windowScene = window?.windowScene
            let screen = windowScene?.screen ?? UIScreen.main
            let webView = self.bridge?.webView

            var result: JSObject = [
                "platform": "ios",
                "system": [
                    "name": UIDevice.current.systemName,
                    "version": UIDevice.current.systemVersion,
                    "model": UIDevice.current.model,
                    "interfaceIdiom": self.interfaceIdiomName(UIDevice.current.userInterfaceIdiom),
                    "interfaceOrientation": self.interfaceOrientationName(windowScene?.interfaceOrientation)
                ] as JSObject,
                "screen": [
                    "boundsPoints": self.rectObject(screen.bounds),
                    "nativeBoundsPixels": self.rectObject(screen.nativeBounds),
                    "scale": Double(screen.scale),
                    "nativeScale": Double(screen.nativeScale),
                    "maximumFramesPerSecond": screen.maximumFramesPerSecond
                ] as JSObject
            ]

            if let window {
                result["window"] = [
                    "boundsPoints": self.rectObject(window.bounds),
                    "framePoints": self.rectObject(window.frame),
                    "safeArea": self.insetsObject(window.safeAreaInsets, scale: screen.nativeScale)
                ] as JSObject
            }

            if let rootView {
                result["rootView"] = [
                    "boundsPoints": self.rectObject(rootView.bounds),
                    "framePoints": self.rectObject(rootView.frame),
                    "safeArea": self.insetsObject(rootView.safeAreaInsets, scale: screen.nativeScale),
                    "layoutMarginsPoints": self.insetsPointsObject(rootView.layoutMargins)
                ] as JSObject
            }

            if let webView {
                result["webView"] = self.webViewObject(webView, scale: screen.nativeScale)
            }

            if let statusBarManager = windowScene?.statusBarManager {
                result["statusBar"] = [
                    "hidden": statusBarManager.isStatusBarHidden,
                    "framePoints": self.rectObject(statusBarManager.statusBarFrame)
                ] as JSObject
            }

            call.resolve(result)
        }
    }

    private func webViewObject(_ webView: WKWebView, scale: CGFloat) -> JSObject {
        return [
            "boundsPoints": rectObject(webView.bounds),
            "framePoints": rectObject(webView.frame),
            "safeArea": insetsObject(webView.safeAreaInsets, scale: scale),
            "scrollViewContentInsetPoints": insetsPointsObject(webView.scrollView.contentInset),
            "scrollViewAdjustedContentInsetPoints": insetsPointsObject(webView.scrollView.adjustedContentInset)
        ]
    }

    private func rectObject(_ rect: CGRect) -> JSObject {
        return [
            "x": Double(rect.origin.x),
            "y": Double(rect.origin.y),
            "width": Double(rect.size.width),
            "height": Double(rect.size.height),
            "minX": Double(rect.minX),
            "minY": Double(rect.minY),
            "maxX": Double(rect.maxX),
            "maxY": Double(rect.maxY)
        ]
    }

    private func insetsObject(_ insets: UIEdgeInsets, scale: CGFloat) -> JSObject {
        return [
            "points": insetsPointsObject(insets),
            "pixelsAtNativeScale": [
                "top": Double(insets.top * scale),
                "right": Double(insets.right * scale),
                "bottom": Double(insets.bottom * scale),
                "left": Double(insets.left * scale)
            ] as JSObject
        ]
    }

    private func insetsPointsObject(_ insets: UIEdgeInsets) -> JSObject {
        return [
            "top": Double(insets.top),
            "right": Double(insets.right),
            "bottom": Double(insets.bottom),
            "left": Double(insets.left)
        ]
    }

    private func interfaceIdiomName(_ idiom: UIUserInterfaceIdiom) -> String {
        switch idiom {
        case .phone: return "phone"
        case .pad: return "pad"
        case .mac: return "mac"
        case .tv: return "tv"
        case .vision: return "vision"
        case .carPlay: return "carPlay"
        case .unspecified: return "unspecified"
        @unknown default: return "unknown"
        }
    }

    private func interfaceOrientationName(_ orientation: UIInterfaceOrientation?) -> String {
        switch orientation {
        case .portrait: return "portrait"
        case .portraitUpsideDown: return "portrait-upside-down"
        case .landscapeLeft: return "landscape-left"
        case .landscapeRight: return "landscape-right"
        case .unknown: return "unknown"
        case nil: return "unavailable"
        @unknown default: return "unknown"
        }
    }
}
