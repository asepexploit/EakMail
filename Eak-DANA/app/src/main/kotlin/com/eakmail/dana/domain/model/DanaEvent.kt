package com.eakmail.dana.domain.model

/** One DANA notification event — stored locally and synced to EakMail backend. */
data class DanaEvent(
    val id: Long = 0,
    val notificationId: String,
    val deviceId: String,
    val timestamp: String,
    val rawTitle: String,
    val rawBody: String,
    val parsedAmount: Long?,
    val parsedDescription: String?,
    val syncStatus: SyncStatus,
    val serverEventId: String?,
    val serverStatus: String?,
    val retryCount: Int,
    val createdAt: Long,
    val syncedAt: Long?,
)

enum class SyncStatus {
    PENDING,   // not yet sent to backend
    SYNCED,    // successfully sent and acknowledged
    FAILED,    // max retries exceeded
}
