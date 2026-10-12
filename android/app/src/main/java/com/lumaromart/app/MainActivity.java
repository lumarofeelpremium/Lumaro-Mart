package com.lumaromart.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    public static final String ORDER_CHANNEL_ID = "lumaro_orders_channel";
    public static final String GENERAL_CHANNEL_ID = "lumaro_general_channel";
    private static final int PERMISSION_REQ_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Initialize high-priority notification channels (Android 8.0+)
        createNotificationChannels();

        // Register Native Android Print, Notification & Permissions Channels (JavascriptInterface)
        // Enables window.AndroidPrint, window.AndroidNotification, and window.AndroidPermissions directly from React / Web
        try {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                // Enable Geolocation in WebView
                webView.getSettings().setGeolocationEnabled(true);

                webView.addJavascriptInterface(new AndroidPrintInterface(this, webView), "AndroidPrint");
                webView.addJavascriptInterface(new AndroidNotificationInterface(this), "AndroidNotification");
                webView.addJavascriptInterface(new AndroidPermissionsInterface(this), "AndroidPermissions");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Creates high-priority notification channels with custom sound & vibration.
     * Essential for heads-up order alerts in Android 8.0+ (Oreo to Android 14+).
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            // 1. Order Alert Channel (HIGH / URGENT priority for Admin orders)
            CharSequence orderChannelName = "Order Alerts";
            String orderDescription = "Naye order aane par high-priority ringtone aur popup notification";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel orderChannel = new NotificationChannel(ORDER_CHANNEL_ID, orderChannelName, importance);
            orderChannel.setDescription(orderDescription);
            orderChannel.enableVibration(true);
            orderChannel.setVibrationPattern(new long[]{0, 400, 200, 400, 200, 400});
            orderChannel.enableLights(true);

            Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .build();
            orderChannel.setSound(defaultSoundUri, audioAttributes);
            manager.createNotificationChannel(orderChannel);

            // 2. General Notification Channel
            NotificationChannel generalChannel = new NotificationChannel(
                    GENERAL_CHANNEL_ID,
                    "General Updates",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            generalChannel.setDescription("Offers, promotions aur updates");
            manager.createNotificationChannel(generalChannel);
        }
    }

    /**
     * Native Android Notification Channel (JavascriptInterface):
     * Allows the Web app to trigger instant OS-level heads-up notifications,
     * status bar popups, vibrations, and sounds directly.
     */
    public static class AndroidNotificationInterface {
        private final Context context;

        public AndroidNotificationInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void showNotification(final String title, final String body, final String orderId) {
            if (context == null) return;

            try {
                NotificationManager notificationManager =
                        (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (notificationManager == null) return;

                Intent intent = new Intent(context, MainActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                if (orderId != null && !orderId.trim().isEmpty()) {
                    intent.putExtra("orderId", orderId);
                    intent.putExtra("route", "/admin");
                }

                int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
                }

                PendingIntent pendingIntent = PendingIntent.getActivity(
                        context,
                        (int) System.currentTimeMillis(),
                        intent,
                        pendingFlags
                );

                Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

                NotificationCompat.Builder builder = new NotificationCompat.Builder(context, ORDER_CHANNEL_ID)
                        .setSmallIcon(R.mipmap.ic_launcher)
                        .setContentTitle(title != null ? title : "Lumaro Mart Alert")
                        .setContentText(body != null ? body : "Naya order prapt hua hai!")
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                        .setAutoCancel(true)
                        .setSound(defaultSoundUri)
                        .setVibrate(new long[]{0, 400, 200, 400, 200, 400})
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setContentIntent(pendingIntent);

                int notificationId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
                notificationManager.notify(notificationId, builder.build());
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void triggerVibration(final int durationMs) {
            if (context == null) return;
            try {
                Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    v.vibrate(durationMs > 0 ? durationMs : 500);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    /**
     * Native Android Print Channel:
     * Connects Android WebView with the OS PrintManager / Print Spooler.
     * Supports Bluetooth thermal printers, WiFi printers, and PDF saving.
     */
    public static class AndroidPrintInterface {
        private final Context context;
        private final WebView webView;

        public AndroidPrintInterface(Context context, WebView webView) {
            this.context = context;
            this.webView = webView;
        }

        @JavascriptInterface
        public void printDocument(final String jobName) {
            if (context == null || webView == null) return;

            webView.post(new Runnable() {
                @Override
                public void run() {
                    try {
                        PrintManager printManager = (PrintManager) context.getSystemService(Context.PRINT_SERVICE);
                        if (printManager != null) {
                            String printJobName = (jobName != null && !jobName.trim().isEmpty())
                                    ? jobName
                                    : "LumaroMart_Receipt";
                            PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(printJobName);
                            printManager.print(printJobName, printAdapter, new PrintAttributes.Builder().build());
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }
    }

    /**
     * Native Android Runtime Permissions Channel (JavascriptInterface):
     * Exposes OS-level permission checking, direct runtime requesting, and app settings launcher
     * for Microphone, Storage/Media, Camera, Location, Notifications, and Bluetooth printers.
     */
    public static class AndroidPermissionsInterface {
        private final Activity activity;

        public AndroidPermissionsInterface(Activity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public boolean checkPermission(final String permissionType) {
            if (activity == null || permissionType == null) return false;

            String type = permissionType.toLowerCase().trim();
            if (type.equals("microphone") || type.equals("mic") || type.equals("audio")) {
                return ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
            } else if (type.equals("camera")) {
                return ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
            } else if (type.equals("storage") || type.equals("photos") || type.equals("media")) {
                if (Build.VERSION.SDK_INT >= 33) {
                    return ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED;
                } else {
                    return ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
                }
            } else if (type.equals("location")) {
                return ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                        || ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            } else if (type.equals("notification") || type.equals("notifications")) {
                if (Build.VERSION.SDK_INT >= 33) {
                    return ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
                }
                return true;
            } else if (type.equals("bluetooth")) {
                if (Build.VERSION.SDK_INT >= 31) {
                    return ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
                }
                return ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED;
            }
            return false;
        }

        @JavascriptInterface
        public void requestPermission(final String permissionType) {
            if (activity == null) return;
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    List<String> permissions = new ArrayList<>();
                    String type = permissionType != null ? permissionType.toLowerCase().trim() : "all";

                    if (type.equals("microphone") || type.equals("mic") || type.equals("audio")) {
                        permissions.add(Manifest.permission.RECORD_AUDIO);
                        permissions.add(Manifest.permission.MODIFY_AUDIO_SETTINGS);
                    } else if (type.equals("camera")) {
                        permissions.add(Manifest.permission.CAMERA);
                    } else if (type.equals("storage") || type.equals("photos") || type.equals("media")) {
                        if (Build.VERSION.SDK_INT >= 33) {
                            permissions.add(Manifest.permission.READ_MEDIA_IMAGES);
                            permissions.add(Manifest.permission.READ_MEDIA_VIDEO);
                            permissions.add(Manifest.permission.READ_MEDIA_AUDIO);
                        } else {
                            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE);
                            permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
                        }
                    } else if (type.equals("location")) {
                        permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
                        permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);
                    } else if (type.equals("notification") || type.equals("notifications")) {
                        if (Build.VERSION.SDK_INT >= 33) {
                            permissions.add(Manifest.permission.POST_NOTIFICATIONS);
                        }
                    } else if (type.equals("bluetooth")) {
                        if (Build.VERSION.SDK_INT >= 31) {
                            permissions.add(Manifest.permission.BLUETOOTH_CONNECT);
                            permissions.add(Manifest.permission.BLUETOOTH_SCAN);
                        } else {
                            permissions.add(Manifest.permission.BLUETOOTH);
                            permissions.add(Manifest.permission.BLUETOOTH_ADMIN);
                        }
                    } else if (type.equals("all")) {
                        permissions.add(Manifest.permission.RECORD_AUDIO);
                        permissions.add(Manifest.permission.CAMERA);
                        permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
                        permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);
                        if (Build.VERSION.SDK_INT >= 33) {
                            permissions.add(Manifest.permission.POST_NOTIFICATIONS);
                            permissions.add(Manifest.permission.READ_MEDIA_IMAGES);
                            permissions.add(Manifest.permission.READ_MEDIA_VIDEO);
                            permissions.add(Manifest.permission.READ_MEDIA_AUDIO);
                        } else {
                            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE);
                            permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
                        }
                        if (Build.VERSION.SDK_INT >= 31) {
                            permissions.add(Manifest.permission.BLUETOOTH_CONNECT);
                            permissions.add(Manifest.permission.BLUETOOTH_SCAN);
                        }
                    }

                    if (!permissions.isEmpty()) {
                        ActivityCompat.requestPermissions(
                                activity,
                                permissions.toArray(new String[0]),
                                PERMISSION_REQ_CODE
                        );
                    }
                }
            });
        }

        @JavascriptInterface
        public void openAppSettings() {
            if (activity == null) return;
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                Uri uri = Uri.fromParts("package", activity.getPackageName(), null);
                intent.setData(uri);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}

