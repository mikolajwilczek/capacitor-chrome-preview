package dev.mikolajwilczek.capacitorchromepreview.geometryprobe;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.Surface;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.DisplayCutoutCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "GeometryProbe")
public class GeometryProbePlugin extends Plugin {

    @PluginMethod
    public void measure(PluginCall call) {
        Activity activity = getActivity();

        if (activity == null) {
            call.reject("Capacitor activity is unavailable.");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                call.resolve(buildMeasurement(activity));
            } catch (Exception error) {
                call.reject("Native geometry measurement failed.", error);
            }
        });
    }

    @PluginMethod
    public void saveJson(PluginCall call) {
        String filename = call.getString("filename");
        String data = call.getString("data");

        if (filename == null || !filename.matches("[A-Za-z0-9][A-Za-z0-9._-]*\\.json")) {
            call.reject("A safe JSON filename is required.");
            return;
        }

        if (data == null) {
            call.reject("JSON data is required.");
            return;
        }

        try {
            call.resolve(saveJsonFile(filename, data));
        } catch (Exception error) {
            call.reject("Measurement JSON could not be saved.", error);
        }
    }

    private JSObject saveJsonFile(String filename, String data) throws IOException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return saveJsonToDownloads(filename, data);
        }

        return saveJsonToAppStorage(filename, data);
    }

    private JSObject saveJsonToDownloads(String filename, String data) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
        values.put(MediaStore.Downloads.MIME_TYPE, "application/json");
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Geometry Probe");
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri uri = resolver.insert(collection, values);
        if (uri == null) throw new IOException("Android did not create a Downloads entry.");

        try {
            try (OutputStream stream = resolver.openOutputStream(uri, "w")) {
                if (stream == null) throw new IOException("Android did not open the Downloads entry.");
                stream.write(data.getBytes(StandardCharsets.UTF_8));
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
        } catch (Exception error) {
            try {
                resolver.delete(uri, null, null);
            } catch (Exception ignored) {
                // Preserve the original write failure.
            }
            throw new IOException("Measurement JSON could not be written to Downloads.", error);
        }

        JSObject result = new JSObject();
        result.put("uri", uri.toString());
        result.put("location", "Downloads/Geometry Probe/" + filename);
        return result;
    }

    private JSObject saveJsonToAppStorage(String filename, String data) throws IOException {
        File downloads = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        File directory = new File(downloads == null ? getContext().getFilesDir() : downloads, "Geometry Probe");
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("App Downloads directory could not be created.");
        }

        File file = new File(directory, filename);
        try (OutputStream stream = new FileOutputStream(file)) {
            stream.write(data.getBytes(StandardCharsets.UTF_8));
        }

        JSObject result = new JSObject();
        result.put("uri", Uri.fromFile(file).toString());
        result.put("location", file.getAbsolutePath());
        return result;
    }

    private JSObject buildMeasurement(Activity activity) {
        DisplayMetrics displayMetrics = activity.getResources().getDisplayMetrics();
        float density = displayMetrics.density;
        View decorView = activity.getWindow().getDecorView();
        WindowInsetsCompat windowInsets = ViewCompat.getRootWindowInsets(decorView);
        Display display = currentDisplay(activity);

        JSObject result = new JSObject();
        result.put("platform", "android");
        result.put("system", systemObject(activity, display));
        result.put("displayMetrics", displayMetricsObject(displayMetrics));
        result.put("windowBounds", windowBoundsObject(activity, density));
        result.put("decorView", viewObject(decorView, density));

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            JSObject webViewResult = viewObject(webView, density);
            webViewResult.put("userAgent", webView.getSettings().getUserAgentString());
            result.put("webView", webViewResult);
        }

        if (windowInsets != null) {
            result.put("windowInsets", windowInsetsObject(windowInsets, density));
            result.put("displayCutout", displayCutoutObject(windowInsets.getDisplayCutout(), density));
        } else {
            result.put("windowInsetsAvailable", false);
        }

        return result;
    }

    @SuppressWarnings("deprecation")
    private Display currentDisplay(Activity activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return activity.getDisplay();
        }

        return activity.getWindowManager().getDefaultDisplay();
    }

    private JSObject systemObject(Activity activity, Display display) {
        JSObject result = new JSObject();
        result.put("release", Build.VERSION.RELEASE);
        result.put("sdkInt", Build.VERSION.SDK_INT);
        result.put("manufacturer", Build.MANUFACTURER);
        result.put("brand", Build.BRAND);
        result.put("model", Build.MODEL);
        result.put("device", Build.DEVICE);
        result.put("product", Build.PRODUCT);
        result.put("orientation", orientationName(activity.getResources().getConfiguration().orientation));
        result.put("rotation", rotationName(display == null ? Surface.ROTATION_0 : display.getRotation()));
        return result;
    }

    private JSObject displayMetricsObject(DisplayMetrics metrics) {
        JSObject result = new JSObject();
        result.put("widthPixels", metrics.widthPixels);
        result.put("heightPixels", metrics.heightPixels);
        result.put("density", metrics.density);
        result.put("densityDpi", metrics.densityDpi);
        result.put("xdpi", metrics.xdpi);
        result.put("ydpi", metrics.ydpi);
        return result;
    }

    @SuppressWarnings("deprecation")
    private JSObject windowBoundsObject(Activity activity, float density) {
        Rect bounds;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowManager windowManager = activity.getSystemService(WindowManager.class);
            bounds = windowManager.getCurrentWindowMetrics().getBounds();
        } else {
            DisplayMetrics realMetrics = new DisplayMetrics();
            activity.getWindowManager().getDefaultDisplay().getRealMetrics(realMetrics);
            bounds = new Rect(0, 0, realMetrics.widthPixels, realMetrics.heightPixels);
        }

        return rectObject(bounds, density);
    }

    private JSObject viewObject(View view, float density) {
        JSObject result = new JSObject();
        result.put("widthPx", view.getWidth());
        result.put("heightPx", view.getHeight());
        result.put("widthDp", dp(view.getWidth(), density));
        result.put("heightDp", dp(view.getHeight(), density));

        int[] location = new int[2];
        view.getLocationInWindow(location);
        result.put("locationInWindowPx", pointObject(location[0], location[1], density));
        return result;
    }

    private JSObject windowInsetsObject(WindowInsetsCompat windowInsets, float density) {
        JSObject result = new JSObject();
        result.put("statusBars", insetsObject(windowInsets.getInsets(WindowInsetsCompat.Type.statusBars()), density));
        result.put("navigationBars", insetsObject(windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars()), density));
        result.put("systemBars", insetsObject(windowInsets.getInsets(WindowInsetsCompat.Type.systemBars()), density));
        result.put("displayCutout", insetsObject(windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout()), density));
        result.put("systemBarsAndCutout", insetsObject(
            windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()),
            density
        ));
        result.put("systemGestures", insetsObject(windowInsets.getInsets(WindowInsetsCompat.Type.systemGestures()), density));
        result.put("mandatorySystemGestures", insetsObject(
            windowInsets.getInsets(WindowInsetsCompat.Type.mandatorySystemGestures()),
            density
        ));
        result.put("tappableElement", insetsObject(windowInsets.getInsets(WindowInsetsCompat.Type.tappableElement()), density));
        result.put("ime", insetsObject(windowInsets.getInsets(WindowInsetsCompat.Type.ime()), density));
        result.put("statusBarsVisible", windowInsets.isVisible(WindowInsetsCompat.Type.statusBars()));
        result.put("navigationBarsVisible", windowInsets.isVisible(WindowInsetsCompat.Type.navigationBars()));
        result.put("imeVisible", windowInsets.isVisible(WindowInsetsCompat.Type.ime()));
        result.put("systemBarsIgnoringVisibility", insetsObject(
            windowInsets.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.systemBars()),
            density
        ));
        return result;
    }

    private JSObject displayCutoutObject(DisplayCutoutCompat cutout, float density) {
        if (cutout == null) {
            JSObject unavailable = new JSObject();
            unavailable.put("available", false);
            return unavailable;
        }

        JSObject result = new JSObject();
        result.put("available", true);
        result.put("safeInsets", insetsObject(
            Insets.of(
                cutout.getSafeInsetLeft(),
                cutout.getSafeInsetTop(),
                cutout.getSafeInsetRight(),
                cutout.getSafeInsetBottom()
            ),
            density
        ));
        result.put("waterfallInsets", insetsObject(cutout.getWaterfallInsets(), density));

        JSArray bounds = new JSArray();
        for (Rect rect : cutout.getBoundingRects()) {
            bounds.put(rectObject(rect, density));
        }
        result.put("boundingRects", bounds);
        return result;
    }

    private JSObject insetsObject(Insets insets, float density) {
        JSObject result = new JSObject();
        result.put("px", edgeObject(insets.top, insets.right, insets.bottom, insets.left));
        result.put("dp", edgeObject(
            dp(insets.top, density),
            dp(insets.right, density),
            dp(insets.bottom, density),
            dp(insets.left, density)
        ));
        return result;
    }

    private JSObject edgeObject(double top, double right, double bottom, double left) {
        JSObject result = new JSObject();
        result.put("top", top);
        result.put("right", right);
        result.put("bottom", bottom);
        result.put("left", left);
        return result;
    }

    private JSObject rectObject(Rect rect, float density) {
        JSObject result = new JSObject();
        result.put("px", rectangleValues(rect.left, rect.top, rect.right, rect.bottom));
        result.put("dp", rectangleValues(
            dp(rect.left, density),
            dp(rect.top, density),
            dp(rect.right, density),
            dp(rect.bottom, density)
        ));
        return result;
    }

    private JSObject rectangleValues(double left, double top, double right, double bottom) {
        JSObject result = new JSObject();
        result.put("left", left);
        result.put("top", top);
        result.put("right", right);
        result.put("bottom", bottom);
        result.put("width", right - left);
        result.put("height", bottom - top);
        return result;
    }

    private JSObject pointObject(int x, int y, float density) {
        JSObject result = new JSObject();
        result.put("x", x);
        result.put("y", y);
        result.put("xDp", dp(x, density));
        result.put("yDp", dp(y, density));
        return result;
    }

    private double dp(double pixels, float density) {
        if (density == 0) return 0;
        return pixels / density;
    }

    private String orientationName(int orientation) {
        if (orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE) return "landscape";
        if (orientation == android.content.res.Configuration.ORIENTATION_PORTRAIT) return "portrait";
        return "undefined";
    }

    private String rotationName(int rotation) {
        if (rotation == Surface.ROTATION_90) return "90";
        if (rotation == Surface.ROTATION_180) return "180";
        if (rotation == Surface.ROTATION_270) return "270";
        return "0";
    }
}
