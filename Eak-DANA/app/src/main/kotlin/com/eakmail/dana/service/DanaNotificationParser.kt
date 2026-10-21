package com.eakmail.dana.service

/**
 * Parses DANA notification text to extract transaction amount and description.
 *
 * DANA notification formats (observed, may vary):
 *   - "Pembayaran Berhasil\nRp50.000 ke Toko ABC"
 *   - "Uang Masuk Rp 100.000 dari Budi"
 *   - "Transfer Berhasil\nRp 75.500"
 *   - "Pembayaran diterima Rp25.000"
 *
 * Parser is intentionally defensive: returns null amounts rather than guessing.
 */
object DanaNotificationParser {

    private val DANA_PACKAGE = "com.din.dana"

    /** Patterns to extract Rupiah amount from notification text. */
    private val AMOUNT_PATTERNS = listOf(
        Regex("""Rp\.?\s*([\d.,]+)""", RegexOption.IGNORE_CASE),
        Regex("""IDR\s*([\d.,]+)""", RegexOption.IGNORE_CASE),
    )

    /** Keywords that indicate this is an incoming/received payment. */
    private val INCOMING_KEYWORDS = listOf(
        "uang masuk", "diterima", "pembayaran berhasil", "transfer masuk",
        "berhasil diterima", "menerima", "topup berhasil",
    )

    data class ParseResult(
        val parsedAmount: Long?,
        val parsedDescription: String?,
        val isLikelyIncoming: Boolean,
    )

    fun parse(title: String, body: String): ParseResult {
        val fullText = "$title $body"
        val lower = fullText.lowercase()

        val amount = extractAmount(fullText)
        val isIncoming = INCOMING_KEYWORDS.any { lower.contains(it) }
        val description = buildDescription(title, body)

        return ParseResult(
            parsedAmount = amount,
            parsedDescription = description,
            isLikelyIncoming = isIncoming,
        )
    }

    private fun extractAmount(text: String): Long? {
        for (pattern in AMOUNT_PATTERNS) {
            val match = pattern.find(text) ?: continue
            val raw = match.groupValues[1]
                .replace(".", "")   // thousands separator
                .replace(",", "")   // alternate separator
                .trim()
            return raw.toLongOrNull()
        }
        return null
    }

    private fun buildDescription(title: String, body: String): String? {
        val combined = listOfNotNull(
            title.takeIf { it.isNotBlank() },
            body.takeIf { it.isNotBlank() },
        ).joinToString(" — ")
        return combined.take(256).takeIf { it.isNotBlank() }
    }

    fun isDanaPackage(packageName: String): Boolean = packageName == DANA_PACKAGE
}
