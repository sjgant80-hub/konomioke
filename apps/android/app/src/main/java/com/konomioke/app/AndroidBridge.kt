package com.konomioke.app

import android.content.Context
import android.webkit.JavascriptInterface
import android.widget.Toast

/**
 * JS bridge exposed to the web app as `window.KonomiokAndroid`.
 * Use sparingly — prefer postMessage patterns for cross-origin safety.
 */
class AndroidBridge(private val context: Context) {

    /** Returns "android" — lets the web app know it's inside the native shell. */
    @JavascriptInterface
    fun platform(): String = "android"

    /** App version code for analytics / feature flags. */
    @JavascriptInterface
    fun versionName(): String = context.packageManager
        .getPackageInfo(context.packageName, 0).versionName ?: "unknown"

    /** Toast from JS (debug convenience — strip before prod if noisy). */
    @JavascriptInterface
    fun toast(msg: String) {
        Toast.makeText(context, msg.take(200), Toast.LENGTH_SHORT).show()
    }
}
