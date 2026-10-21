package com.eakmail.dana.data.repository

import com.eakmail.dana.data.local.DanaEventDao
import com.eakmail.dana.data.local.DanaEventEntity
import com.eakmail.dana.data.preferences.ConfigPreferences
import com.eakmail.dana.data.remote.DanaEventResponse
import com.eakmail.dana.data.remote.DanaStatusResponse
import com.eakmail.dana.data.remote.DanaApiService
import com.eakmail.dana.data.remote.RetrofitFactory
import com.eakmail.dana.domain.model.DeviceConfig
import io.mockk.*
import io.mockk.impl.annotations.MockK
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import retrofit2.Response

class DanaEventRepositoryTest {

    @MockK lateinit var dao: DanaEventDao
    @MockK lateinit var configPreferences: ConfigPreferences

    private lateinit var repository: DanaEventRepository

    private val sampleConfig = DeviceConfig(
        backendUrl = "https://api.example.com",
        deviceToken = "test-token",
        deviceId = "device-1",
        timeoutSeconds = 15,
    )

    private fun sampleEntity(id: Long = 1L, notificationId: String = "notif-1") = DanaEventEntity(
        id = id,
        notificationId = notificationId,
        deviceId = "device-1",
        timestamp = "2026-10-22T10:00:00Z",
        rawTitle = "Uang Masuk",
        rawBody = "Rp50.000 dari Toko X",
        parsedAmount = 50000,
        parsedDescription = "Toko X",
        syncStatus = "PENDING",
    )

    @Before
    fun setUp() {
        MockKAnnotations.init(this)
        repository = DanaEventRepository(dao, configPreferences)
    }

    @After
    fun tearDown() = clearAllMocks()

    @Test
    fun `observeRecent delegates to dao`() = runTest {
        val entities = listOf(sampleEntity())
        every { dao.observeRecent(50) } returns flowOf(entities)

        val result = mutableListOf<List<DanaEventEntity>>()
        repository.observeRecent(50).collect { result.add(it) }

        assertEquals(listOf(entities), result)
        verify { dao.observeRecent(50) }
    }

    @Test
    fun `observePendingCount delegates to dao`() = runTest {
        every { dao.observePendingCount() } returns flowOf(3)

        val counts = mutableListOf<Int>()
        repository.observePendingCount().collect { counts.add(it) }

        assertEquals(listOf(3), counts)
    }

    @Test
    fun `insert delegates to dao and returns rowId`() = runTest {
        val entity = sampleEntity()
        coEvery { dao.insert(entity) } returns 42L

        val result = repository.insert(entity)
        assertEquals(42L, result)
    }

    @Test
    fun `markSynced calls updateSyncResult with SYNCED status`() = runTest {
        coEvery { dao.updateSyncResult(1L, "SYNCED", "srv-id", "ACCEPTED", any()) } just Runs

        repository.markSynced(1L, "srv-id", "ACCEPTED")

        coVerify { dao.updateSyncResult(1L, "SYNCED", "srv-id", "ACCEPTED", any()) }
    }

    @Test
    fun `markExhaustedAsFailed delegates to dao`() = runTest {
        coEvery { dao.markExhaustedAsFailed(5) } just Runs

        repository.markExhaustedAsFailed(5)

        coVerify { dao.markExhaustedAsFailed(5) }
    }

    @Test
    fun `syncEvent returns NoConfig when configPreferences returns null`() = runTest {
        every { configPreferences.load() } returns null

        val result = repository.syncEvent(sampleEntity())
        assertTrue(result is SyncResult.NoConfig)
    }

    @Test
    fun `getPending delegates to dao`() = runTest {
        val entities = listOf(sampleEntity())
        coEvery { dao.getPending(50) } returns entities

        val result = repository.getPending(50)
        assertEquals(entities, result)
    }

    @Test
    fun `incrementRetry delegates to dao`() = runTest {
        coEvery { dao.incrementRetry(1L) } just Runs

        repository.incrementRetry(1L)

        coVerify { dao.incrementRetry(1L) }
    }

    @Test
    fun `fetchStatus returns null when not configured`() = runTest {
        every { configPreferences.load() } returns null

        val result = repository.fetchStatus()
        assertNull(result)
    }

    @Test
    fun `countRetryable delegates to dao`() = runTest {
        coEvery { dao.countRetryable(5) } returns 2

        val result = repository.countRetryable(5)
        assertEquals(2, result)
    }
}
