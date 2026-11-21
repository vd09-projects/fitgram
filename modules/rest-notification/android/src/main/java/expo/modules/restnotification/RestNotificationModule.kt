package expo.modules.restnotification

// The rest countdown on the Android lock screen (TICKET-079). TSX decides when and what end
// time; this module only posts, swaps and clears. Every entry point returns false and logs
// instead of throwing: a missing React context or launch intent must never reach the rest
// timer in the app, which works without any of this.

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import android.widget.RemoteViews
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

private const val TAG = "RestNotification"
private const val CHANNEL_ID = "rest_timer"
// One done channel per sound (TICKET-098): a channel's sound cannot change once it exists, and deleting
// and recreating the same id brings the old sound back. So a change to how a sound is chosen needs a new
// id. The first sound's id says which sound it is, like the others, so none is a bare "rest_done".
private const val DONE_CHANNEL_ID = "rest_done_notification"
private val DONE_CHANNEL_IDS = listOf(DONE_CHANNEL_ID, "rest_done_alarm", "rest_done_ringtone")
private const val NOTIFICATION_ID = 4242
private const val ALARM_REQUEST = 4243
private const val WAKE_LOCK_TAG = "fitgram:rest"

// How long past the end time the wake lock may outlive a missed release (TICKET-097, A2).
private const val WAKE_GRACE_MS = 5_000L

// Every string comes from the caller (one config file in TSX); none is written here.
class RestCopy : Record {
  @Field var channelName: String = ""
  @Field var doneChannelName: String = ""
  @Field var subText: String = ""
  @Field var title: String = ""
  @Field var text: String = ""
  @Field var titleDone: String = ""
  @Field var textDone: String = ""
  // One of REST_SOUNDS in src/config/restNotification.ts. Any other name is the default.
  @Field var sound: String = "notification"
}

/**
 * Everything that posts, shared by the module and the alarm receiver. A top-level object because the
 * receiver can run in a process the module never started in (TICKET-097), and because the Handler
 * swap and the alarm can both fire for one rest: one lock and one record of which rest has already
 * made its sound, so it sounds once.
 */
internal object RestNotifier {
  val lock = Any()

  // The rest in progress: its end time, set by `show`, cleared by `clear`. Null in a fresh process.
  var currentEndMs: Long? = null

  // The end time of the rest `clear` last ended (Skip, finish, remove). `currentEndMs` alone cannot tell
  // "cleared" from "no rest began in this process", and a receiver already running when Skip is tapped
  // must not ring for the rest the user just ended. Caller holds `lock`.
  var endedMs: Long? = null

  // The end time of the last rest whose done post was allowed to make a sound.
  private var alertedEndMs: Long? = null

  // Held for the length of a rest so the CPU stays awake and the Handler at the end time runs on time:
  // its clock is uptime, which stops while a phone sleeps with the screen off (TICKET-097, A2).
  private var wakeLock: PowerManager.WakeLock? = null

  fun manager(context: Context): NotificationManager =
    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  /** The channel a sound's done post goes out on. An unknown name is the default's. */
  fun doneChannelId(sound: String): String = when (sound) {
    "alarm" -> "rest_done_alarm"
    "ringtone" -> "rest_done_ringtone"
    else -> DONE_CHANNEL_ID
  }

  /**
   * The phone's own default sound of that kind. Built in, so no file to ship (TICKET-098).
   *
   * A phone whose default for that kind is "None" has no actual default (found on a OnePlus 7T, whose
   * notification sound was None: the channel was posted and vibrated, and made no sound). The end of a
   * rest must be heard, so that falls back to the alarm default, the ringtone default, the first sound
   * installed on the phone, and last the system's own default URI (which is the None again).
   * Chosen over staying silent because a silent cue is the bug this exists to fix; rejected: a sound
   * bundled in the app, which needs a file (TICKET-098's other option).
   */
  fun doneSound(context: Context, sound: String): Uri {
    val type = when (sound) {
      "alarm" -> RingtoneManager.TYPE_ALARM
      "ringtone" -> RingtoneManager.TYPE_RINGTONE
      else -> RingtoneManager.TYPE_NOTIFICATION
    }
    return RingtoneManager.getActualDefaultRingtoneUri(context, type)
      ?: RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_RINGTONE)
      ?: firstInstalled(context)
      ?: RingtoneManager.getDefaultUri(type)
  }

  /** The first notification sound installed on the phone, for a phone whose three defaults are all None. */
  private fun firstInstalled(context: Context): Uri? = try {
    val ringtones = RingtoneManager(context).apply { setType(RingtoneManager.TYPE_NOTIFICATION) }
    ringtones.cursor.use { if (it.count > 0) ringtones.getRingtoneUri(0) else null }
  } catch (e: Throwable) {
    Log.w(TAG, "no installed sound", e)
    null
  }

  /** Played as a notification whatever the kind, so volume, silent mode and Do Not Disturb treat all three alike. */
  val soundAttributes: AudioAttributes = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
    .build()

  /**
   * Two channels, because a channel's sound cannot be changed once it exists, and the countdown must
   * never make a noise while the end of the rest must.
   *
   * `rest_timer`: IMPORTANCE_DEFAULT with sound, vibration and badge off, not LOW. Device test
   * (emulator, Android 16, lock-screen setting left at its default): a LOW channel's notification
   * was posted but hidden from the lock screen; a DEFAULT one showed. Its first and only id.
   *
   * The done channel (TICKET-097): IMPORTANCE_HIGH with the chosen sound and vibration. Played as a
   * notification even for the alarm and ringtone sounds (`soundAttributes`), so it follows the phone's
   * volume, silent mode and Do Not Disturb, and the user can change it on the channel's own settings
   * page. Only the chosen sound's channel exists: the others are deleted, so Android's settings page
   * lists one "Rest over" (TICKET-098; a user's own tweaks to a deleted channel go with it). Each
   * channel is touched only when it is missing or stale: deleting one also drops the notification
   * posted on it, and this runs on every post.
   */
  private fun ensureChannels(context: Context, manager: NotificationManager, name: String, doneName: String, sound: String) {
    if (manager.getNotificationChannel(CHANNEL_ID) == null) {
      val timer = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_DEFAULT)
      timer.setSound(null, null)
      timer.enableVibration(false)
      timer.enableLights(false)
      timer.setShowBadge(false)
      timer.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      manager.createNotificationChannel(timer)
    }

    val doneId = doneChannelId(sound)
    DONE_CHANNEL_IDS
      .filter { it != doneId && manager.getNotificationChannel(it) != null }
      .forEach { manager.deleteNotificationChannel(it) }
    if (manager.getNotificationChannel(doneId) == null) {
      val done = NotificationChannel(doneId, doneName, NotificationManager.IMPORTANCE_HIGH)
      done.setSound(doneSound(context, sound), soundAttributes)
      done.enableVibration(true)
      done.enableLights(false)
      done.setShowBadge(false)
      done.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      manager.createNotificationChannel(done)
    }
  }

  /** `alert` false on a done post means "the sound already played for this rest": update, stay quiet. */
  private fun build(context: Context, copy: RestCopy, endAtMs: Long?, alert: Boolean, subText: String): Notification? {
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

    return Notification.Builder(context, if (done) doneChannelId(copy.sound) else CHANNEL_ID)
      .setSmallIcon(res.getIdentifier("ic_rest_pulse", "drawable", pkg))
      .setColor(context.getColor(res.getIdentifier("rest_accent", "color", pkg)))
      .setSubText(subText)
      .setStyle(Notification.DecoratedCustomViewStyle())
      .setCustomContentView(views)
      .setContentIntent(tap)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setCategory(if (done) Notification.CATEGORY_REMINDER else Notification.CATEGORY_PROGRESS)
      // The countdown never alerts. The first done post must: the done post REPLACES the countdown
      // (same id), and the system treats a replacement of an existing notification as an update, which
      // `onlyAlertOnce` would silence. A repeat of the done post is the one that must stay quiet.
      .setOnlyAlertOnce(!done || !alert)
      .setShowWhen(false)
      // Not ongoing at 0:00: a user who never opens the app can swipe it away.
      .setOngoing(!done)
      .build()
  }

  /** The countdown. Caller holds `lock`. */
  fun postCountdown(context: Context, copy: RestCopy, endAtMs: Long): Boolean {
    val manager = manager(context)
    if (!manager.areNotificationsEnabled()) return false
    ensureChannels(context, manager, copy.channelName, copy.doneChannelName, copy.sound)
    val notification = build(context, copy, endAtMs, alert = false, subText = copy.subText) ?: return false
    manager.notify(NOTIFICATION_ID, notification)
    return true
  }

  /**
   * The end of the rest, from any of three paths: the alarm, the Handler, or JS noticing. Whichever
   * comes first makes the sound; the others only repaint.
   *
   * Posts nothing, and returns false, when:
   * - there is no end time: there is no rest to speak for, and a made-up key would let the first such
   *   call ring and every later one stay silent;
   * - the rest was ended by `clear` (Skip, finish) or replaced by add-time since this call was started;
   * - the sound already played for this end and the post has since been swiped away: `onlyAlertOnce`
   *   silences an update of a notification that is showing, not a new one, which would ring again.
   *
   * A post that goes out also cancels the alarm: the Handler or the app got here first, and a late
   * alarm would otherwise post it again.
   */
  fun postDone(context: Context, copy: RestCopy, endMs: Long?): Boolean {
    if (endMs == null) return false
    synchronized(lock) {
      val manager = manager(context)
      if (!manager.areNotificationsEnabled()) return false
      if (endMs == endedMs) return false
      val current = currentEndMs
      if (current != null && endMs != current) return false
      val first = alertedEndMs != endMs
      if (!first && manager.activeNotifications.none { it.id == NOTIFICATION_ID }) {
        releaseAwake()
        cancelAlarm(context)
        return false
      }
      ensureChannels(context, manager, copy.channelName, copy.doneChannelName, copy.sound)
      val notification = build(context, copy, null, alert = first, subText = copy.subText)
        ?: return false
      manager.notify(NOTIFICATION_ID, notification)
      alertedEndMs = endMs
      releaseAwake()
      cancelAlarm(context)
      return true
    }
  }

  /**
   * Keep the CPU awake until `endMs` plus a grace. Timed, so a release that never comes (a crash, a
   * path missed here) cannot drain the battery. Not reference counted: a later call replaces the
   * timeout, which is what add-time needs. Caller holds `lock`.
   */
  fun holdAwake(context: Context, endMs: Long) {
    val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    val held = wakeLock ?: power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG).also {
      it.setReferenceCounted(false)
      wakeLock = it
    }
    held.acquire(maxOf(0L, endMs - System.currentTimeMillis()) + WAKE_GRACE_MS)
  }

  /** Caller holds `lock`. */
  fun releaseAwake() {
    wakeLock?.let { if (it.isHeld) it.release() }
  }

  /**
   * The alarm that wakes the phone at the end of the rest. Inexact (`setAndAllowWhileIdle`): no
   * permission, runs in Doze, may be late there. The one place the alarm is chosen: an exact alarm
   * (SCHEDULE_EXACT_ALARM, granted by hand) would be a change to this function only (TICKET-097, option B).
   * The same PendingIntent every time, so a new end replaces the old alarm.
   */
  fun scheduleAlarm(context: Context, copy: RestCopy, endMs: Long) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val intent = Intent(context, RestDoneReceiver::class.java)
      .putExtra("endMs", endMs)
      .putExtra("channelName", copy.channelName)
      .putExtra("doneChannelName", copy.doneChannelName)
      .putExtra("subText", copy.subText)
      .putExtra("titleDone", copy.titleDone)
      .putExtra("textDone", copy.textDone)
      .putExtra("sound", copy.sound)
    val pending = PendingIntent.getBroadcast(context, ALARM_REQUEST, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endMs, pending)
  }

  fun cancelAlarm(context: Context) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pending = PendingIntent.getBroadcast(
      context, ALARM_REQUEST, Intent(context, RestDoneReceiver::class.java), PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
    )
    if (pending != null) {
      alarms.cancel(pending)
      pending.cancel()
    }
  }
}

/** Runs at the end of the rest, even when the app's process is gone: posts the done notification with its sound. */
class RestDoneReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    try {
      val copy = RestCopy().apply {
        channelName = intent.getStringExtra("channelName") ?: ""
        doneChannelName = intent.getStringExtra("doneChannelName") ?: ""
        subText = intent.getStringExtra("subText") ?: ""
        titleDone = intent.getStringExtra("titleDone") ?: ""
        textDone = intent.getStringExtra("textDone") ?: ""
        sound = intent.getStringExtra("sound") ?: "notification"
      }
      val endMs = intent.getLongExtra("endMs", 0L).takeIf { it > 0L }
      RestNotifier.postDone(context, copy, endMs)
    } catch (e: Throwable) {
      Log.w(TAG, "alarm receiver failed", e)
    }
  }
}

class RestNotificationModule : Module() {
  private val handler = Handler(Looper.getMainLooper())
  // Guards `swap` and the post it makes. show/clear run on the JS thread, the swap on the main
  // looper, and removeCallbacks cannot stop a swap that has already started: without the lock a
  // Skip tapped at the end time could be followed by a "done" post for the rest it ended.
  private val lock get() = RestNotifier.lock
  private var swap: Runnable? = null
  // The sound the settings screen is playing. Main-looper only.
  private var preview: Ringtone? = null

  private fun context(): Context? = appContext.reactContext

  // Caller holds `lock`.
  private fun cancelSwap() {
    swap?.let { handler.removeCallbacks(it) }
    swap = null
  }

  override fun definition() = ModuleDefinition {
    Name("RestNotification")

    // A reloaded module is a new instance with no `swap`, so an old Handler runnable that is still queued
    // would ring for a rest the new instance has since cleared. The alarm and the wake lock outlive the
    // module on purpose: the rest does.
    OnDestroy {
      synchronized(lock) { cancelSwap() }
      handler.post { preview?.stop(); preview = null }
    }

    Function("isEnabled") {
      try {
        context()?.let { RestNotifier.manager(it).areNotificationsEnabled() } ?: false
      } catch (e: Throwable) {
        Log.w(TAG, "isEnabled failed", e)
        false
      }
    }

    // Two things fire at the end time, whichever comes first making the sound (TICKET-097): the
    // alarm, which wakes a sleeping phone and runs without the app, and a Handler on the main
    // looper, on time while the phone is awake (TICKET-079 mechanism A). Add-time is another show()
    // with the later end, which replaces both. JS re-posts the done layout when it next sees the
    // rest over.
    Function("show") { endAtMs: Double, copy: RestCopy ->
      try {
        synchronized(lock) {
          cancelSwap()
          val context = context() ?: run {
            Log.w(TAG, "no react context")
            return@Function false
          }
          val end = endAtMs.toLong()
          if (!RestNotifier.postCountdown(context, copy, end)) {
            // Nothing stands for this rest, so nothing may stand for the one it replaced either.
            RestNotifier.cancelAlarm(context)
            RestNotifier.releaseAwake()
            RestNotifier.currentEndMs = null
            return@Function false
          }
          RestNotifier.currentEndMs = end
          if (RestNotifier.endedMs == end) RestNotifier.endedMs = null
          RestNotifier.scheduleAlarm(context, copy, end)
          // The Handler below matters more than the wake lock: a lock that fails to take must not stop it.
          try {
            RestNotifier.holdAwake(context, end)
          } catch (e: Throwable) {
            Log.w(TAG, "wake lock failed", e)
          }
          val appContext = context.applicationContext
          val runnable = object : Runnable {
            override fun run() {
              synchronized(lock) {
                // Replaced or cleared since it was scheduled: that rest is no longer this one.
                if (swap !== this) return
                try {
                  RestNotifier.postDone(appContext, copy, end)
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
          val context = context() ?: return@Function false
          RestNotifier.postDone(context, copy, RestNotifier.currentEndMs)
        }
      } catch (e: Throwable) {
        Log.w(TAG, "showDone failed", e)
        false
      }
    }

    // The settings screen's preview: the sound as the done post would play it, once. A new one stops the last.
    Function("previewSound") { sound: String ->
      try {
        val context = context() ?: return@Function false
        handler.post {
          try {
            preview?.stop()
            preview = RingtoneManager.getRingtone(context, RestNotifier.doneSound(context, sound))?.also {
              it.audioAttributes = RestNotifier.soundAttributes
              it.play()
            }
          } catch (e: Throwable) {
            Log.w(TAG, "preview failed", e)
          }
        }
        true
      } catch (e: Throwable) {
        Log.w(TAG, "previewSound failed", e)
        false
      }
    }

    Function("stopPreview") {
      try {
        handler.post { preview?.stop(); preview = null }
        true
      } catch (e: Throwable) {
        Log.w(TAG, "stopPreview failed", e)
        false
      }
    }

    Function("clear") {
      try {
        synchronized(lock) {
          cancelSwap()
          val context = context() ?: return@Function false
          RestNotifier.cancelAlarm(context)
          RestNotifier.releaseAwake()
          RestNotifier.endedMs = RestNotifier.currentEndMs ?: RestNotifier.endedMs
          RestNotifier.currentEndMs = null
          RestNotifier.manager(context).cancel(NOTIFICATION_ID)
          true
        }
      } catch (e: Throwable) {
        Log.w(TAG, "clear failed", e)
        false
      }
    }
  }
}
