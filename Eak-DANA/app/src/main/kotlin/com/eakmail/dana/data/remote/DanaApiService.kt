package com.eakmail.dana.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

/** Retrofit interface for EakMail Backend DANA endpoints. */
interface DanaApiService {

    @POST("api/dana/event")
    suspend fun sendEvent(
        @Header("Authorization") bearer: String,
        @Body body: DanaEventRequest,
    ): Response<DanaEventResponse>

    @GET("api/dana/status")
    suspend fun getStatus(
        @Header("Authorization") bearer: String,
    ): Response<DanaStatusResponse>
}

data class DanaEventRequest(
    val notification_id: String,
    val device_id: String,
    val timestamp: String,
    val raw_title: String,
    val raw_body: String,
    val parsed_amount: Long?,
    val parsed_description: String?,
)

data class DanaEventResponse(
    val status: String,   // ACCEPTED | DUPLICATE | NO_MATCH
    val event_id: String,
)

data class DanaStatusResponse(
    val device_id: String,
    val last_event_at: String?,
    val total_events_today: Int,
)
