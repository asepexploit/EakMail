package com.eakmail.dana.service

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.eakmail.dana.data.local.DanaEventEntity
import com.eakmail.dana.data.preferences.ConfigPreferences
import com.eakmail.dana.data.repository.DanaEventRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.time.Instant
import javax.inject.Inject

/**
 * Listens to all system notifications and filters for DANA app.
 * Requires the user to grant Notification Access in Android settings.
 *
 * Cannot be auto-granted via APK install — user must toggle manually.
 */
@AndroidEntryPoint
class DanaNotificationListener : NotificationListenerService() {

    @Inject lateinit var repository: DanaEventRepository
    @Inject lateinit var configPreferences: ConfigPreferences

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (!DanaNotificationParser.isDanaPackage(sbn.packageName)) return

        val notification = sbn.notification ?: return
        val extras = notification.extras ?: return

        val title = extras.getCharSequence("android.title")?.toString() ?: ""
        val body = extras.getCharSequence("android.text")?.toString() ?: ""

        if (title.isBlank() && body.isBlank()) return

        scope.launch {
            processNotification(sbn.key, title, body, sbn.postTime)
        }
    }

    private suspend fun processNotification(
        sbnKey: String,
        title: String,
        body: String,
        postTime: Long,
    ) {
        val config = configPreferences.load() ?: return

        val notificationId = buildNotificationId(sbnKey, postTime)
        val timestamp = Instant.ofEpochMilli(postTime).toString()

        val parsed = DanaNotificationParser.parse(title, body)

        val entity = DanaEventEntity(
            notificationId = notificationId,
            deviceId = config.deviceId,
            timestamp = timestamp,
            rawTitle = title,
            rawBody = body,
            parsedAmount = parsed.parsedAmount,
            parsedDescription = parsed.parsedDescription,
            syncStatus = "PENDING",
        )

        val inserted = repository.insert(entity)
        if (inserted > 0) {
            EventSyncWorker.enqueueImmediate(applicationContext)
        }
    }

    /** SHA-256(sbnKey + postTime) gives a stable, unique ID per notification. */
    private fun buildNotificationId(sbnKey: String, postTime: Long): String {
        val input = "$sbnKey:$postTime"
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(input.toByteArray()).joinToString("") { "%02x".format(it) }.take(64)
    }
}
