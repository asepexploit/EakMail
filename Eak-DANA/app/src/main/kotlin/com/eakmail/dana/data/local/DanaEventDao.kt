package com.eakmail.dana.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface DanaEventDao {

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(event: DanaEventEntity): Long

    @Query("SELECT * FROM dana_events WHERE syncStatus = 'PENDING' ORDER BY createdAt ASC LIMIT :limit")
    suspend fun getPending(limit: Int = 50): List<DanaEventEntity>

    @Query("SELECT * FROM dana_events ORDER BY createdAt DESC LIMIT :limit")
    fun observeRecent(limit: Int = 100): Flow<List<DanaEventEntity>>

    @Query("SELECT * FROM dana_events ORDER BY createdAt DESC LIMIT :limit")
    suspend fun getRecent(limit: Int = 100): List<DanaEventEntity>

    @Query("SELECT COUNT(*) FROM dana_events WHERE syncStatus = 'PENDING'")
    fun observePendingCount(): Flow<Int>

    @Query("""
        UPDATE dana_events
        SET syncStatus = :status, serverEventId = :serverEventId, serverStatus = :serverStatus,
            syncedAt = :syncedAt, retryCount = retryCount + 1
        WHERE id = :id
    """)
    suspend fun updateSyncResult(
        id: Long,
        status: String,
        serverEventId: String?,
        serverStatus: String?,
        syncedAt: Long?,
    )

    @Query("UPDATE dana_events SET retryCount = retryCount + 1 WHERE id = :id")
    suspend fun incrementRetry(id: Long)

    @Query("UPDATE dana_events SET syncStatus = 'FAILED' WHERE syncStatus = 'PENDING' AND retryCount >= :maxRetries")
    suspend fun markExhaustedAsFailed(maxRetries: Int = 5)

    @Query("SELECT COUNT(*) FROM dana_events WHERE syncStatus = 'PENDING' AND retryCount < :maxRetries")
    suspend fun countRetryable(maxRetries: Int = 5): Int
}
