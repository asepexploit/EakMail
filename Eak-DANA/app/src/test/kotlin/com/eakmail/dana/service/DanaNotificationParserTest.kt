package com.eakmail.dana.service

import org.junit.Assert.*
import org.junit.Test

class DanaNotificationParserTest {

    @Test
    fun `parse amount from Rp format with dot separator`() {
        val result = DanaNotificationParser.parse(
            title = "Pembayaran Berhasil",
            body = "Rp50.000 ke Toko ABC"
        )
        assertEquals(50000L, result.parsedAmount)
    }

    @Test
    fun `parse amount from Rp with space`() {
        val result = DanaNotificationParser.parse(
            title = "Uang Masuk",
            body = "Rp 100.000 dari Budi"
        )
        assertEquals(100000L, result.parsedAmount)
    }

    @Test
    fun `parse amount from Rp with period and comma mixed`() {
        val result = DanaNotificationParser.parse(
            title = "Transfer Berhasil",
            body = "Rp 75.500"
        )
        assertEquals(75500L, result.parsedAmount)
    }

    @Test
    fun `return null amount when no Rp found`() {
        val result = DanaNotificationParser.parse(
            title = "Info Akun",
            body = "Profil Anda telah diperbarui"
        )
        assertNull(result.parsedAmount)
    }

    @Test
    fun `detect incoming payment keywords`() {
        val cases = listOf(
            "Uang Masuk Rp50.000" to true,
            "Transfer Berhasil Rp100.000 diterima" to true,
            "Pembayaran diterima Rp25.000" to true,
            "Bayar ke merchant Rp30.000" to false,
        )
        cases.forEach { (body, expectedIncoming) ->
            val result = DanaNotificationParser.parse(title = "", body = body)
            assertEquals("Gagal untuk: $body", expectedIncoming, result.isLikelyIncoming)
        }
    }

    @Test
    fun `isDanaPackage returns true for DANA app`() {
        assertTrue(DanaNotificationParser.isDanaPackage("com.din.dana"))
    }

    @Test
    fun `isDanaPackage returns false for other apps`() {
        assertFalse(DanaNotificationParser.isDanaPackage("com.gojek.app"))
        assertFalse(DanaNotificationParser.isDanaPackage("com.ovo.id"))
    }

    @Test
    fun `description combines title and body`() {
        val result = DanaNotificationParser.parse(
            title = "Pembayaran Berhasil",
            body = "Rp50.000 ke Toko ABC"
        )
        assertNotNull(result.parsedDescription)
        assertTrue(result.parsedDescription!!.contains("Pembayaran Berhasil"))
    }
}
