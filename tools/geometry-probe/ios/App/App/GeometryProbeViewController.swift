import Capacitor

final class GeometryProbeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(GeometryProbePlugin())
    }
}
