package com.eakmail.dana.service

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.*
import com.eakmail.dana.data.repository.DanaEventRepository
import com.eakmail.dana.data.repository.SyncResult
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * WorkManager worker that drains the local PENDING queue to EakMail backend.
 * Runs on-demand (enqueueImmediate) and as a periodic fallback every 15 minutes.
 *
 * Retry strategy: exponential backoff, max 5 attempts per event.
 */
@HiltWorker
class EventSyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val repository: DanaEventRepository,
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        // Mark exhausted events as FAILED before processing
        repository.markExhaustedAsFailed(MAX_RETRIES)

        val pending = repository.getPending(limit = 50)
        if (pending.isEmpty()) return@withContext Result.success()

        var anyFailed = false

        for (event in pending) {
            when (val result = repository.syncEvent(event)) {
                is SyncResult.Success -> repository.markSynced(event.id, result.serverEventId, result.serverStatus)
                is SyncResult.Duplicate -> repository.markSynced(event.id, null, "DUPLICATE")
                is SyncResult.NoConfig -> return@withContext Result.success() // nothing to do without config
                is SyncResult.HttpError -> {
                    repository.incrementRetry(event.id)
                    anyFailed = true
                }
                is SyncResult.NetworkError -> {
                    repository.incrementRetry(event.id)
                    anyFailed = true
                }
            }
        }

        if (anyFailed) Result.retry() else Result.success()
    }

    companion object {
        private const val MAX_RETRIES = 5
        private const val WORK_NAME_IMMEDIATE = "dana_sync_immediate"
        private const val WORK_NAME_PERIODIC = "dana_sync_periodic"

        /** Enqueue a one-shot sync attempt (called when a new notification arrives). */
        fun enqueueImmediate(context: Context) {
            val request = OneTimeWorkRequestBuilder<EventSyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                WORK_NAME_IMMEDIATE,
                ExistingWorkPolicy.KEEP,
                request,
            )
        }

        /** Schedule periodic fallback sync (called at app startup). */
        fun schedulePeriodicSync(context: Context) {
            val request = PeriodicWorkRequestBuilder<EventSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME_PERIODIC,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }
    }
}
