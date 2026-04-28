# Add project specific ProGuard rules here.
# WebView / WebRTC — keep JS interface bridge if added later
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.konomioke.app.bridge.** { *; }
