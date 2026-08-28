package dev.mikolajwilczek.capacitorchromepreview.geometryprobe;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GeometryProbePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
