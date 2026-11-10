package expo.modules.restnotification

// The rest countdown on the Android lock screen (TICKET-079). TSX decides when and what end
// time; this module only posts, swaps and clears. Every entry point returns false and logs
// instead of throwing: a missing React context or launch intent must never reach the rest
// timer in the app, which works without any of this.

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.widget.RemoteViews
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

private const val TAG = "RestNotification"
private const val CHANNEL_ID = "rest_timer"
private const val NOTIFICATION_ID = 4242

// Every string comes from the caller (one config file in TSX); none is written here.
class RestCopy : Record {
  @Field var channelName: String = ""
  @Field var subText: String = ""
  @Field var title: String = ""
  @Field var text: String = ""
  @Field var titleDone: String = ""
  @Field var textDone: String = ""
}

class RestNotificationModule : Module() {
  private val handler = Handler(Looper.getMainLooper())
  // Guards `swap` and the post it makes. show/clear run on the JS thread, the swap on the main
  // looper, and removeCallbacks cannot stop a swap that has already started: without the lock a
  // Skip tapped at the end time could be followed by a "done" post for the rest it ended.
  private val lock = Any()
  private var swap: Runnable? = null

  private fun context(): Context? = appContext.reactContext

  private fun manager(context: Context): NotificationManager =
    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  /**
   * IMPORTANCE_DEFAULT with sound, vibration and badge off, not LOW. Device test (emulator,
   * Android 16, lock-screen setting left at its default): a LOW channel's notification was
   * posted but hidden from the lock screen; a DEFAULT one showed. A channel's importance
   * cannot be raised after creation, so this is its first and only id.
   */
  private fun ensureChannel(manager: NotificationManager, name: String) {
    val channel = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_DEFAULT)
    channel.setSound(null, null)
    channel.enableVibration(false)
    channel.enableLights(false)
    channel.setShowBadge(false)
    channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    manager.createNotificationChannel(channel)
  }

  private fun build(context: Context, copy: RestCopy, endAtMs: Long?): Notification? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    if (launch == null) {
      Log.w(TAG, "no launch intent for ${context.packageName}")
      return null
    }
    val tap = PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_IMMUTABLE)
    val res = context.resources
    val pkg = context.packageName
    val done = endAtMs == null

    val views = RemoteViews(pkg, res.getIdentifier(if (done) "rest_notification_done" else "rest_notification", "layout", pkg))
    views.setTextViewText(res.getIdentifier("rest_title", "id", pkg), if (done) copy.titleDone else copy.title)
    views.setTextViewText(res.getIdentifier("rest_text", "id", pkg), if (done) copy.textDone else copy.text)
    if (endAtMs != null) {
      // The chronometer counts toward an elapsedRealtime base, not a wall-clock one.
      val chrono = res.getIdentifier("rest_time", "id", pkg)
      views.setChronometerCountDown(chrono, true)
      views.setChronometer(chrono, SystemClock.elapsedRealtime() + (endAtMs - System.currentTimeMillis()), null, true)
    }

    return Notification.Builder(context, CHANNEL_ID)
      .setSmallIcon(res.getIdentifier("ic_rest_pulse", "drawable", pkg))
      .setColor(context.getColor(res.getIdentifier("rest_accent", "color", pkg)))
      .setSubText(copy.subText)
      .setStyle(Notification.DecoratedCustomViewStyle())
      .setCustomContentView(views)
      .setContentIntent(tap)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setCategory(Notification.CATEGORY_PROGRESS)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      // Not ongoing at 0:00: a user who never opens the app can swipe it away.
      .setOngoing(!done)
      .build()
  }

  // Caller holds `lock`.
  private fun cancelSwap() {
    swap?.let { handler.removeCallbacks(it) }
    swap = null
  }

  private fun post(copy: RestCopy, endAtMs: Long?): Boolean {
    val context = context()
    if (context == null) {
      Log.w(TAG, "no react context")
      return false
    }
    val manager = manager(context)
    if (!manager.areNotificationsEnabled()) return false
    ensureChannel(manager, copy.channelName)
    val notification = build(context, copy, endAtMs) ?: return false
    manager.notify(NOTIFICATION_ID, notification)
    return true
  }

  override fun definition() = ModuleDefinition {
    Name("RestNotification")

    Function("isEnabled") {
      try {
        context()?.let { manager(it).areNotificationsEnabled() } ?: false
      } catch (e: Throwable) {
        Log.w(TAG, "isEnabled failed", e)
        false
      }
    }

    // Mechanism A of TICKET-079 settle-first 2: a Handler on the main looper swaps to the
    // done layout at the end time, with no JS running. Add-time is another show() with the
    // later end, which replaces the pending swap. If the process dies the swap dies with it;
    // JS re-posts the done layout when it next sees the rest over.
    Function("show") { endAtMs: Double, copy: RestCopy ->
      try {
        synchronized(lock) {
          cancelSwap()
          val end = endAtMs.toLong()
          if (!post(copy, end)) return@Function false
          val runnable = object : Runnable {
            override fun run() {
              synchronized(lock) {
                // Replaced or cleared since it was scheduled: that rest is no longer this one.
                if (swap !== this) return
                try {
                  post(copy, null)
                } catch (e: Throwable) {
                  Log.w(TAG, "swap to done failed", e)
                }
              }
            }
          }
          swap = runnable
          handler.postDelayed(runnable, maxOf(0L, end - System.currentTimeMillis()))
          true
        }
      } catch (e: Throwable) {
        Log.w(TAG, "show failed", e)
        false
      }
    }

    // The in-app path to the same layout, for when JS sees the rest over and the swap did not run.
    Function("showDone") { copy: RestCopy ->
      try {
        synchronized(lock) {
          cancelSwap()
          post(copy, null)
        }
      } catch (e: Throwable) {
        Log.w(TAG, "showDone failed", e)
        false
      }
    }

    Function("clear") {
      try {
        synchronized(lock) {
          cancelSwap()
          val context = context() ?: return@Function false
          manager(context).cancel(NOTIFICATION_ID)
          true
        }
      } catch (e: Throwable) {
        Log.w(TAG, "clear failed", e)
        false
      }
    }
  }
}
