package expo.modules.restnotification

// TEMPORARY design probe (TICKET-080). Throwaway worktree only. Tries three looks on a real device:
// "base" = the spike as it was, "a" = polished standard template, "b" = a + Live Update promotion.

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.os.SystemClock
import android.widget.RemoteViews
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CHANNEL_ID = "rest_probe"
private const val NOTIFICATION_ID = 4242

class RestNotificationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("no react context")

  private val manager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  override fun definition() = ModuleDefinition {
    Name("RestNotification")

    Function("canPost") { manager.areNotificationsEnabled() }

    Function("show") { endAtMs: Double, title: String, text: String, variant: String ->
      if (!manager.areNotificationsEnabled()) return@Function "blocked: notifications disabled"

      // Default importance with sound and vibration off: settle-first 1 candidate.
      val channel = NotificationChannel(CHANNEL_ID, "Rest timer", NotificationManager.IMPORTANCE_DEFAULT)
      channel.setSound(null, null)
      channel.enableVibration(false)
      channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      manager.createNotificationChannel(channel)

      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      val tap = PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_IMMUTABLE)

      val b = Notification.Builder(context, CHANNEL_ID)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setShowWhen(true)
        .setWhen(endAtMs.toLong())
        .setUsesChronometer(true)
        .setChronometerCountDown(true)
        .setVisibility(Notification.VISIBILITY_PUBLIC)
        .setContentIntent(tap)
        .setCategory(Notification.CATEGORY_PROGRESS)

      val res = context.resources
      val pkg = context.packageName
      val done = variant == "done"
      val rv = RemoteViews(pkg, res.getIdentifier(if (done) "rest_notification_done" else "rest_notification", "layout", pkg))
      rv.setTextViewText(res.getIdentifier("rest_title", "id", pkg), title)
      rv.setTextViewText(res.getIdentifier("rest_text", "id", pkg), text)
      if (!done) {
        val chrono = res.getIdentifier("rest_time", "id", pkg)
        rv.setChronometerCountDown(chrono, true)
        rv.setChronometer(chrono, SystemClock.elapsedRealtime() + (endAtMs.toLong() - System.currentTimeMillis()), null, true)
      }
      b.setSmallIcon(res.getIdentifier("ic_rest_pulse", "drawable", pkg))
        .setColor(context.getColor(res.getIdentifier("rest_accent", "color", pkg)))
        .setSubText("Workout")
        .setStyle(Notification.DecoratedCustomViewStyle())
        .setCustomContentView(rv)
        .setShowWhen(false)
        .setUsesChronometer(false)
        .setOngoing(!done)

      manager.notify(NOTIFICATION_ID, b.build())

      val posted = manager.activeNotifications.firstOrNull { it.id == NOTIFICATION_ID }
      val flags = posted?.notification?.flags ?: -1
      val canPromote = try {
        manager.javaClass.getMethod("canPostPromotedNotifications").invoke(manager).toString()
      } catch (e: Throwable) { "n/a(${e.javaClass.simpleName})" }
      "posted $variant flags=0x${Integer.toHexString(flags)} canPromote=$canPromote"
    }

    Function("clear") { manager.cancel(NOTIFICATION_ID) }
  }
}
