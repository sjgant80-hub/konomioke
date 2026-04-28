package com.konomioke.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.konomioke.app.databinding.ActivityMainBinding
import com.konomioke.app.service.AudioSessionService

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    // ── permission request launcher ──────────────────────────────────────────
    private val micPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            binding.webView.reload()
        } else {
            Toast.makeText(this, getString(R.string.mic_rationale), Toast.LENGTH_LONG).show()
        }
    }

    // ── WebChromeClient mic/camera grant callback ─────────────────────────────
    private var webPermissionRequest: PermissionRequest? = null
    private val webPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val granted = results.filter { it.value }.keys.mapNotNull { androidPermToWebkit(it) }
        if (granted.isNotEmpty()) webPermissionRequest?.grant(granted.toTypedArray())
        else webPermissionRequest?.deny()
        webPermissionRequest = null
    }

    // ── lifecycle ─────────────────────────────────────────────────────────────
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupWebView()
        setupOfflineBanner()
        handleBackPress()
        startAudioService()

        // Load initial URL (or deep-link URL if launched from intent)
        val url = intent?.data?.toString()?.takeIf { it.startsWith("https://konomioke.com") }
            ?: KONOMIOKE_URL
        binding.webView.loadUrl(url)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.data?.toString()?.takeIf { it.startsWith("https://konomioke.com") }
            ?.let { binding.webView.loadUrl(it) }
    }

    override fun onDestroy() {
        binding.webView.destroy()
        super.onDestroy()
    }

    // ── WebView setup ─────────────────────────────────────────────────────────
    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        binding.webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowContentAccess = true
            allowFileAccess = false          // no local file access needed
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            userAgentString = "${userAgentString} KonomiokAndroid/1.0"
        }

        binding.webView.webViewClient = KonomiokWebViewClient()
        binding.webView.webChromeClient = KonomiokChromeClient()
        binding.webView.addJavascriptInterface(AndroidBridge(this), "KonomiokAndroid")
    }

    // ── offline banner ────────────────────────────────────────────────────────
    private fun setupOfflineBanner() {
        binding.retryBtn.setOnClickListener {
            if (isOnline()) {
                binding.offlineBanner.visibility = View.GONE
                binding.webView.reload()
            } else {
                Toast.makeText(this, "Still offline…", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun handleBackPress() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.webView.canGoBack()) binding.webView.goBack()
                else finish()
            }
        })
    }

    private fun startAudioService() {
        val svc = Intent(this, AudioSessionService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(svc)
        else startService(svc)
    }

    // ── helpers ───────────────────────────────────────────────────────────────
    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val cap = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return cap.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun androidPermToWebkit(androidPerm: String): String? = when (androidPerm) {
        Manifest.permission.RECORD_AUDIO -> PermissionRequest.RESOURCE_AUDIO_CAPTURE
        Manifest.permission.CAMERA -> PermissionRequest.RESOURCE_VIDEO_CAPTURE
        else -> null
    }

    // ── inner: WebViewClient ──────────────────────────────────────────────────
    private inner class KonomiokWebViewClient : WebViewClient() {

        override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
            binding.offlineBanner.visibility = View.GONE
        }

        override fun onReceivedError(
            view: WebView?, request: WebResourceRequest?, error: WebResourceError?
        ) {
            if (request?.isForMainFrame == true && !isOnline()) {
                binding.offlineBanner.visibility = View.VISIBLE
            }
        }

        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
            val url = request?.url?.toString() ?: return false
            // Keep konomioke.com and github pages URLs inside the WebView
            return if (url.startsWith("https://konomioke.com") ||
                url.startsWith("https://teslasolar.github.io/moosic")
            ) false
            else {
                startActivity(Intent(Intent.ACTION_VIEW, request.url))
                true
            }
        }
    }

    // ── inner: ChromeClient (mic/cam permission, JS dialogs) ──────────────────
    private inner class KonomiokChromeClient : WebChromeClient() {

        override fun onPermissionRequest(request: PermissionRequest) {
            webPermissionRequest = request
            val needed = request.resources.mapNotNull { webkitPermToAndroid(it) }
                .filter { ContextCompat.checkSelfPermission(this@MainActivity, it) != PackageManager.PERMISSION_GRANTED }

            if (needed.isEmpty()) {
                request.grant(request.resources)
                return
            }

            // Show rationale for mic before launching the system dialog
            if (needed.contains(Manifest.permission.RECORD_AUDIO) &&
                shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO)
            ) {
                AlertDialog.Builder(this@MainActivity)
                    .setTitle(getString(R.string.app_name))
                    .setMessage(getString(R.string.mic_rationale))
                    .setPositiveButton("OK") { _, _ -> webPermLauncher.launch(needed.toTypedArray()) }
                    .setNegativeButton("Not now") { _, _ -> request.deny(); webPermissionRequest = null }
                    .show()
            } else {
                webPermLauncher.launch(needed.toTypedArray())
            }
        }

        override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
            AlertDialog.Builder(this@MainActivity)
                .setMessage(message).setPositiveButton("OK") { _, _ -> result?.confirm() }.show()
            return true
        }

        override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
            AlertDialog.Builder(this@MainActivity)
                .setMessage(message)
                .setPositiveButton("OK") { _, _ -> result?.confirm() }
                .setNegativeButton("Cancel") { _, _ -> result?.cancel() }
                .show()
            return true
        }

        private fun webkitPermToAndroid(webkitResource: String): String? = when (webkitResource) {
            PermissionRequest.RESOURCE_AUDIO_CAPTURE -> Manifest.permission.RECORD_AUDIO
            PermissionRequest.RESOURCE_VIDEO_CAPTURE -> Manifest.permission.CAMERA
            else -> null
        }
    }

    companion object {
        private const val KONOMIOKE_URL = "https://konomioke.com"
    }
}
