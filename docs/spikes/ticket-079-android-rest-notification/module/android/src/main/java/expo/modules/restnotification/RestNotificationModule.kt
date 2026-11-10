package expo.modules.restnotification

// TEMPORARY (TICKET-079 spike). Not the production design: it exists to show whether an
// ongoing notification with a native countdown ticks on the lock screen with no JS running.
// This is a reference copy under docs/spikes. Delete that folder when the build lands (TICKET-079).

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CHANNEL_ID = "rest_spike"
private const val NOTIFICATION_ID = 4242

class RestNotificationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("no react context")

  private val manager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  override fun definition() = ModuleDefinition {
    Name("RestNotification")

    // Whether the system will show our notifications right now (permission + channel + app toggle).
    Function("canPost") { manager.areNotificationsEnabled() }

    // endAtMs: wall-clock epoch ms when the rest ends. Returns false if nothing was posted.
    Function("show") { endAtMs: Double, title: String ->
      if (!manager.areNotificationsEnabled()) return@Function false

      val builder: Notification.Builder
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        // LOW: no sound or heads-up. Found in the spike: at this emulator's default setting a LOW
        // channel was not shown on the lock screen at all (TICKET-079, settle first 1), so the
        // build is expected to use a normal-importance channel with sound and vibration off.
        val channel = NotificationChannel(CHANNEL_ID, "Rest timer (spike)", NotificationManager.IMPORTANCE_LOW)
        channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        manager.createNotificationChannel(channel)
        builder = Notification.Builder(context, CHANNEL_ID)
      } else {
        builder = Notification.Builder(context)
      }

      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      val tap = PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_IMMUTABLE)

      val notification = builder
        .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
        .setContentTitle(title)
        .setContentText("Rest left")
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setShowWhen(true)
        .setWhen(endAtMs.toLong())
        .setUsesChronometer(true)
        .setChronometerCountDown(true)
        .setVisibility(Notification.VISIBILITY_PUBLIC)
        .setContentIntent(tap)
        .build()

      // Same id: a second call replaces the first, which is how add-time would work.
      manager.notify(NOTIFICATION_ID, notification)
      true
    }

    Function("clear") { manager.cancel(NOTIFICATION_ID) }
  }
}
