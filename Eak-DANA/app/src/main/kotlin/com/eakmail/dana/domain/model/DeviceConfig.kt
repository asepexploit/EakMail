package com.eakmail.dana.domain.model

/** User-configured settings for the EakMail backend connection. */
data class DeviceConfig(
    val backendUrl: String,    // e.g. https://vps.example.com
    val deviceToken: String,   // Bearer token issued by EakMail dashboard
    val deviceId: String,      // matches token's device ID
    val timeoutSeconds: Int = 15,
)
