package com.cloudgarden.match;

import com.getcapacitor.BridgeActivity;
import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.activity.EdgeToEdge;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Full-bleed art; Capacitor SystemBars supplies safe-area values to HTML.
        EdgeToEdge.enable(this);
        // Only debuggable builds may reach the loopback HTTP Worker through adb reverse.
        // The debug-only network policy still denies cleartext to all non-loopback hosts.
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            getBridge().getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
    }
}
