package com.eakmail.dana.data.repository

import com.eakmail.dana.data.local.DanaEventDao
import com.eakmail.dana.data.local.DanaEventEntity
import com.eakmail.dana.data.preferences.ConfigPreferences
import com.eakmail.dana.data.remote.DanaApiService
import com.eakmail.dana.data.remote.DanaEventRequest
import com.eakmail.dana.data.remote.DanaStatusResponse
import com.eakmail.dana.data.remote.RetrofitFactory
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DanaEventRepository @Inject constructor(
    private val dao: DanaEventDao,
    private val configPreferences: ConfigPreferences,
) {

    fun observeRecent(limit: Int = 50): Flow<List<DanaEventEntity>> =
        dao.observeRecent(limit)

    fun observePendingCount(): Flow<Int> =
        dao.observePendingCount()

    suspend fun getPending(limit: Int = 50): List<DanaEventEntity> =
        dao.getPending(limit)

    suspend fun insert(event: DanaEventEntity): Long =
        dao.insert(event)

    suspend fun markSynced(id: Long, serverEventId: String?, serverStatus: String?) {
        dao.updateSyncResult(
            id = id,
            status = "SYNCED",
            serverEventId = serverEventId,
            serverStatus = serverStatus,
            syncedAt = System.currentTimeMillis(),
        )
    }

    suspend fun incrementRetry(id: Long) = dao.incrementRetry(id)

    suspend fun markExhaustedAsFailed(maxRetries: Int = 5) =
        dao.markExhaustedAsFailed(maxRetries)

    suspend fun countRetryable(maxRetries: Int = 5): Int =
        dao.countRetryable(maxRetries)

    /** Send one event to the backend; returns true on success (200 or 409-duplicate). */
    suspend fun syncEvent(event: DanaEventEntity): SyncResult {
        val config = configPreferences.load() ?: return SyncResult.NoConfig
        val api = RetrofitFactory.create(config.backendUrl, config.timeoutSeconds)
        val bearer = "Bearer ${config.deviceToken}"

        return try {
            val request = DanaEventRequest(
                notification_id = event.notificationId,
                device_id = event.deviceId,
                timestamp = event.timestamp,
                raw_title = event.rawTitle,
                raw_body = event.rawBody,
                parsed_amount = event.parsedAmount,
                parsed_description = event.parsedDescription,
            )
            val response = api.sendEvent(bearer, request)
            when {
                response.isSuccessful -> {
                    val body = response.body()
                    SyncResult.Success(body?.event_id, body?.status)
                }
                response.code() == 409 -> SyncResult.Duplicate
                else -> SyncResult.HttpError(response.code())
            }
        } catch (e: Exception) {
            SyncResult.NetworkError(e)
        }
    }

    /** Check connectivity / device status from the backend. */
    suspend fun fetchStatus(): retrofit2.Response<DanaStatusResponse>? {
        val config = configPreferences.load() ?: return null
        val api = RetrofitFactory.create(config.backendUrl, config.timeoutSeconds)
        return api.getStatus("Bearer ${config.deviceToken}")
    }
}

sealed class SyncResult {
    data class Success(val serverEventId: String?, val serverStatus: String?) : SyncResult()
    object Duplicate : SyncResult()
    object NoConfig : SyncResult()
    data class HttpError(val code: Int) : SyncResult()
    data class NetworkError(val cause: Exception) : SyncResult()
}
