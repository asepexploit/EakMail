package com.eakmail.dana.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "dana_events",
    indices = [
        Index("notificationId", unique = true),
        Index("syncStatus"),
        Index("createdAt"),
    ]
)
data class DanaEventEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val notificationId: String,
    val deviceId: String,
    val timestamp: String,
    val rawTitle: String,
    val rawBody: String,
    val parsedAmount: Long?,
    val parsedDescription: String?,
    /** PENDING | SYNCED | FAILED */
    val syncStatus: String = "PENDING",
    val serverEventId: String? = null,
    val serverStatus: String? = null,
    val retryCount: Int = 0,
    val createdAt: Long = System.currentTimeMillis(),
    val syncedAt: Long? = null,
)
