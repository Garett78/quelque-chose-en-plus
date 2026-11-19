package fr.quelquechoseenplus.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Heureux Qui Communique (© 2026 Nawafale REZGUI – Éducs Clés Formations) : l'application web (dossier assets/www) affichée en plein écran,
 * avec la caméra, le micro, la voix du téléphone et l'ajout de photos.
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final int REQ_WEB_PERMS = 1;
    private static final int REQ_CAMERA_PHOTO = 2;
    private static final int REQ_FILE = 3;

    private WebView web;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;

    private PermissionRequest pendingWebPermission;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0F1A24);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                tts.setLanguage(Locale.FRANCE);
                tts.setSpeechRate(0.9f);
                ttsReady = true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                return serveAsset(u.getPath());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !HOST.equals(request.getUrl().getHost());
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> handleWebPermission(request));
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                if (params != null && params.isCaptureEnabled()) {
                    if (has(Manifest.permission.CAMERA)) launchCamera();
                    else requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA_PHOTO);
                } else {
                    launchPicker(params);
                }
                return true;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl("https://" + HOST + "/index.html");
    }

    /* ---------- Fichiers de l'application (assets/www) ---------- */

    private WebResourceResponse serveAsset(String path) {
        if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
        if (path.endsWith("/")) path = path + "index.html";
        String mime = mimeFor(path);
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Cache-Control", "no-cache");
        try {
            InputStream in = getAssets().open("www" + path);
            WebResourceResponse r = new WebResourceResponse(mime, isText(mime) ? "utf-8" : null, in);
            r.setResponseHeaders(headers);
            return r;
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers,
                    new ByteArrayInputStream(new byte[0]));
        }
    }

    private static boolean isText(String mime) {
        return mime.startsWith("text/") || mime.equals("application/javascript") || mime.equals("application/manifest+json");
    }

    private static String mimeFor(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".webmanifest") || p.endsWith(".json")) return "application/manifest+json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".wasm")) return "application/wasm";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    /* ---------- Caméra et micro pour la page ---------- */

    private boolean has(String permission) {
        return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void handleWebPermission(PermissionRequest request) {
        List<String> missing = new ArrayList<>();
        for (String r : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && !has(Manifest.permission.CAMERA)) {
                missing.add(Manifest.permission.CAMERA);
            }
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && !has(Manifest.permission.RECORD_AUDIO)) {
                missing.add(Manifest.permission.RECORD_AUDIO);
            }
        }
        if (missing.isEmpty()) {
            request.grant(request.getResources());
        } else {
            if (pendingWebPermission != null) pendingWebPermission.deny();
            pendingWebPermission = request;
            requestPermissions(missing.toArray(new String[0]), REQ_WEB_PERMS);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQ_WEB_PERMS && pendingWebPermission != null) {
            List<String> granted = new ArrayList<>();
            for (String r : pendingWebPermission.getResources()) {
                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && has(Manifest.permission.CAMERA)) granted.add(r);
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && has(Manifest.permission.RECORD_AUDIO)) granted.add(r);
            }
            if (granted.isEmpty()) pendingWebPermission.deny();
            else pendingWebPermission.grant(granted.toArray(new String[0]));
            pendingWebPermission = null;
        } else if (requestCode == REQ_CAMERA_PHOTO) {
            if (has(Manifest.permission.CAMERA)) launchCamera();
            else launchGallery();
        }
    }

    /* ---------- Ajouter une photo : appareil photo ou galerie ---------- */

    private void launchCamera() {
        try {
            File dir = new File(getCacheDir(), "photos");
            if (!dir.exists()) dir.mkdirs();
            File f = new File(dir, "photo_" + System.currentTimeMillis() + ".jpg");
            cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", f);
            Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            i.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
            i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(i, REQ_FILE);
        } catch (Exception e) {
            cameraUri = null;
            launchGallery();
        }
    }

    private void launchPicker(WebChromeClient.FileChooserParams params) {
        String type = "image/*";
        if (params != null && params.getAcceptTypes() != null) {
            for (String t : params.getAcceptTypes()) {
                if (t != null && !t.trim().isEmpty()) { type = t.trim(); break; }
            }
        }
        openPicker(type);
    }

    private void launchGallery() {
        openPicker("image/*");
    }

    private void openPicker(String type) {
        cameraUri = null;
        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(type);
        try {
            startActivityForResult(Intent.createChooser(i, type.startsWith("audio") ? "Choisir un son" : "Choisir une image"), REQ_FILE);
        } catch (ActivityNotFoundException e) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getData() != null) result = new Uri[]{data.getData()};
            else if (cameraUri != null) result = new Uri[]{cameraUri};
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
        cameraUri = null;
    }

    /* ---------- Voix du téléphone ---------- */

    public class Bridge {
        @JavascriptInterface
        public void speak(String text) {
            if (ttsReady && text != null) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "qcep");
        }

        @JavascriptInterface
        public void stop() {
            if (ttsReady) tts.stop();
        }
    }

    /* ---------- Cycle de vie ---------- */

    @Override
    public void onBackPressed() {
        String js = "(window.qcepBack ? window.qcepBack() : 'exit')";
        web.evaluateJavascript(js, value -> {
            if (value != null && value.contains("exit")) finish();
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
        if (ttsReady) tts.stop();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (tts != null) tts.shutdown();
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
