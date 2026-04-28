package com.konomioke.app

import android.app.Application
import android.os.StrictMode
import androidx.webkit.WebViewCompat

class KonomiokApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Log WebView version for debugging
        val wvPkg = WebViewCompat.getCurrentWebViewPackage(this)
        android.util.Log.d("Konomioke", "WebView: ${wvPkg?.packageName} ${wvPkg?.versionName}")
    }
}
