package ch.personalhealthy.app

import android.content.Context
import android.graphics.Bitmap
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * The photo Scan with the person's own AI subscription (terms v21, asked by Human). Off until the person pastes the API
 * key of their own provider: Claude (Anthropic), ChatGPT (OpenAI), Gemini (Google) or Kimi (Moonshot).
 * - The key stays on this phone only, encrypted with a key of the Android Keystore; HINT 365's server never sees it.
 * - Each Scan sends the photo of the display straight from the phone to the chosen provider, with that key, and gets
 *   back three numbers. Nothing else is sent (no name, no account). The cost is on the person's subscription.
 * - The numbers are always shown to the person and saved only after they confirm them (MainActivity, PhotoScreen).
 */
object AiScan {
    enum class Provider(val id: String, val label: String, val keysUrl: String) {
        CLAUDE("claude", "Claude", "https://console.anthropic.com/settings/keys"),
        CHATGPT("chatgpt", "ChatGPT", "https://platform.openai.com/api-keys"),
        GEMINI("gemini", "Gemini", "https://aistudio.google.com/apikey"),
        KIMI("kimi", "Kimi", "https://platform.moonshot.ai/console/api-keys");
        companion object { fun of(id: String?) = entries.firstOrNull { it.id == id } }
    }

    /** The provider of the saved key, or null while the Scan is still locked. Compose reads it, so the Scan button follows. */
    var active by mutableStateOf<Provider?>(null)
        private set

    private const val PREFS = "battito"
    private const val ALIAS = "hint_ai_key"

    fun load(ctx: Context) {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        active = if (p.getString("aiKey", null) != null) Provider.of(p.getString("aiProvider", null)) else null
    }

    /** A guess from the first letters of a pasted key; null when they say nothing (ChatGPT and Kimi keys both start with sk-). */
    fun guess(key: String): Provider? = when {
        key.startsWith("sk-ant-") -> Provider.CLAUDE
        key.startsWith("AIza") -> Provider.GEMINI
        key.startsWith("sk-proj-") || key.startsWith("sk-svcacct-") -> Provider.CHATGPT
        else -> null
    }

    sealed class Check {
        object Ok : Check()
        /** reason: key (refused by the provider), network, model (no model able to read photos), error */
        data class Failed(val reason: String) : Check()
    }

    /**
     * Checks the key with the provider (the list of its models: free, no photo sent) and keeps it only if accepted,
     * together with the model that will read the photos.
     */
    suspend fun activate(ctx: Context, provider: Provider, rawKey: String): Check = withContext(Dispatchers.IO) {
        val key = rawKey.trim()
        if (key.length < 20 || key.any { it.isWhitespace() }) return@withContext Check.Failed("key")
        val models = try { listModels(provider, key) } catch (e: HttpFail) {
            return@withContext Check.Failed(if (e.code == 401 || e.code == 403 || e.code == 400) "key" else "error")
        } catch (e: java.io.IOException) { return@withContext Check.Failed("network") }
        val model = pickModel(provider, models) ?: return@withContext Check.Failed("model")
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("aiKey", encrypt(key)).putString("aiProvider", provider.id).putString("aiModel", model).apply()
        active = provider
        Check.Ok
    }

    fun remove(ctx: Context) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("aiKey").remove("aiProvider").remove("aiModel").apply()
        active = null
    }

    /** Reads SYS, DIA and pulse from the photo of the display with the person's provider. */
    suspend fun read(ctx: Context, photo: Bitmap): MonitorScan.Result = withContext(Dispatchers.IO) {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val provider = Provider.of(p.getString("aiProvider", null)) ?: return@withContext MonitorScan.Result.Retake("ai_key")
        val key = p.getString("aiKey", null)?.let { runCatching { decrypt(it) }.getOrNull() }
            ?: return@withContext MonitorScan.Result.Retake("ai_key")
        val model = p.getString("aiModel", null) ?: return@withContext MonitorScan.Result.Retake("ai_key")
        val jpeg = jpegBase64(photo)
        val answer = try {
            when (provider) {
                Provider.CLAUDE -> askClaude(key, model, jpeg)
                Provider.GEMINI -> askGemini(key, model, jpeg)
                Provider.CHATGPT -> askOpenAiLike("https://api.openai.com/v1/chat/completions", key, model, jpeg)
                Provider.KIMI -> askOpenAiLike("https://api.moonshot.ai/v1/chat/completions", key, model, jpeg)
            }
        } catch (e: HttpFail) {
            return@withContext MonitorScan.Result.Retake(when (e.code) { 401, 403 -> "ai_key"; 402, 429 -> "ai_quota"; else -> "ai_error" })
        } catch (e: java.io.IOException) { return@withContext MonitorScan.Result.Retake("ai_network") }
        parse(answer)
    }

    // ---------- the answer ----------

    private const val PROMPT = "This is a photo of the display of a home blood-pressure monitor. Read the three measured " +
        "numbers: SYS (systolic, usually the top and largest), DIA (diastolic, below it) and PUL (pulse, the smallest, " +
        "often next to a heart symbol or PUL/min). Ignore the date, the time, the memory number and any other text. " +
        "Answer with JSON only, no other words: {\"sys\": <number>, \"dia\": <number>, \"pul\": <number>}. If any of the " +
        "three numbers cannot be read with certainty, or this is not a monitor display, answer {\"retake\": \"<reason>\"} " +
        "with reason one of: not_found, unclear, glare, dark, blurry. Never guess a digit."

    /** The JSON in the answer, checked like the other inputs: plausible values only, otherwise a new photo. */
    internal fun parse(answer: String): MonitorScan.Result {
        val start = answer.indexOf('{'); val end = answer.lastIndexOf('}')
        if (start < 0 || end <= start) return MonitorScan.Result.Retake("unclear")
        val o = try { JSONObject(answer.substring(start, end + 1)) } catch (e: Exception) { return MonitorScan.Result.Retake("unclear") }
        if (o.has("retake")) {
            val r = o.optString("retake")
            return MonitorScan.Result.Retake(if (r in setOf("not_found", "unclear", "glare", "dark", "blurry")) r else "unclear")
        }
        val sys = o.optInt("sys", -1); val dia = o.optInt("dia", -1); val pul = o.optInt("pul", -1)
        if (sys !in 60..260 || dia !in 30..160 || dia >= sys || sys - dia < 10 || pul !in 30..220) return MonitorScan.Result.Retake("implausible")
        return MonitorScan.Result.Values(sys, dia, pul, "ai")
    }

    // ---------- the providers ----------

    private class HttpFail(val code: Int) : Exception("http $code")

    private fun http(url: String, headers: Map<String, String>, body: String?): JSONObject {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.connectTimeout = 15_000; c.readTimeout = 90_000
            headers.forEach { (k, v) -> c.setRequestProperty(k, v) }
            if (body != null) {
                c.requestMethod = "POST"; c.doOutput = true
                c.setRequestProperty("content-type", "application/json")
                c.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val code = c.responseCode
            if (code !in 200..299) throw HttpFail(code)
            return JSONObject(c.inputStream.bufferedReader().use { it.readText() })
        } finally { c.disconnect() }
    }

    private fun listModels(p: Provider, key: String): List<String> = when (p) {
        Provider.CLAUDE -> http("https://api.anthropic.com/v1/models?limit=100", mapOf("x-api-key" to key, "anthropic-version" to "2023-06-01"), null)
            .optJSONArray("data").ids("id")
        Provider.CHATGPT -> http("https://api.openai.com/v1/models", mapOf("Authorization" to "Bearer $key"), null).optJSONArray("data").ids("id")
        Provider.KIMI -> http("https://api.moonshot.ai/v1/models", mapOf("Authorization" to "Bearer $key"), null).optJSONArray("data").ids("id")
        Provider.GEMINI -> http("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", mapOf("x-goog-api-key" to key), null)
            .optJSONArray("models").ids("name").map { it.removePrefix("models/") }
    }

    private fun JSONArray?.ids(field: String): List<String> =
        if (this == null) emptyList() else (0 until length()).mapNotNull { optJSONObject(it)?.optString(field)?.takeIf { s -> s.isNotEmpty() } }

    /** The first model, in order of preference, that this key can use and that reads photos. */
    internal fun pickModel(p: Provider, available: List<String>): String? {
        val prefs = when (p) {
            Provider.CLAUDE -> listOf("claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5")
            Provider.CHATGPT -> listOf("gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini", "gpt-4o")
            Provider.GEMINI -> listOf("gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash")
            Provider.KIMI -> listOf("kimi-latest", "moonshot-v1-8k-vision-preview", "moonshot-v1-32k-vision-preview")
        }
        return prefs.firstOrNull { it in available } ?: when (p) {
            Provider.CLAUDE -> available.firstOrNull { it.startsWith("claude-") }
            else -> null
        }
    }

    private fun askClaude(key: String, model: String, jpeg: String): String {
        val body = JSONObject()
            .put("model", model).put("max_tokens", 2000)
            .put("output_config", JSONObject().put("effort", "low"))
            // if a safety check declines the request, the API retries it on another Claude model by itself
            .put("fallbacks", "default")
            .put("messages", JSONArray().put(JSONObject().put("role", "user").put("content", JSONArray()
                .put(JSONObject().put("type", "image").put("source", JSONObject()
                    .put("type", "base64").put("media_type", "image/jpeg").put("data", jpeg)))
                .put(JSONObject().put("type", "text").put("text", PROMPT)))))
        val r = try {
            http("https://api.anthropic.com/v1/messages",
                mapOf("x-api-key" to key, "anthropic-version" to "2023-06-01", "anthropic-beta" to "server-side-fallback-2026-07-01"), body.toString())
        } catch (e: HttpFail) {
            if (e.code != 400) throw e
            // a model or an account that does not take effort or fallbacks: the same request without them
            body.remove("output_config"); body.remove("fallbacks")
            http("https://api.anthropic.com/v1/messages", mapOf("x-api-key" to key, "anthropic-version" to "2023-06-01"), body.toString())
        }
        if (r.optString("stop_reason") == "refusal") return ""
        val content = r.optJSONArray("content") ?: return ""
        return (0 until content.length()).mapNotNull { content.optJSONObject(it) }
            .filter { it.optString("type") == "text" }.joinToString("\n") { it.optString("text") }
    }

    private fun askOpenAiLike(url: String, key: String, model: String, jpeg: String): String {
        val body = JSONObject().put("model", model)
            .put("messages", JSONArray().put(JSONObject().put("role", "user").put("content", JSONArray()
                .put(JSONObject().put("type", "text").put("text", PROMPT))
                .put(JSONObject().put("type", "image_url").put("image_url", JSONObject().put("url", "data:image/jpeg;base64,$jpeg"))))))
        val r = http(url, mapOf("Authorization" to "Bearer $key"), body.toString())
        return r.optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("message")?.optString("content") ?: ""
    }

    private fun askGemini(key: String, model: String, jpeg: String): String {
        val body = JSONObject().put("contents", JSONArray().put(JSONObject().put("parts", JSONArray()
            .put(JSONObject().put("inline_data", JSONObject().put("mime_type", "image/jpeg").put("data", jpeg)))
            .put(JSONObject().put("text", PROMPT)))))
        val r = http("https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent", mapOf("x-goog-api-key" to key), body.toString())
        val parts = r.optJSONArray("candidates")?.optJSONObject(0)?.optJSONObject("content")?.optJSONArray("parts") ?: return ""
        return (0 until parts.length()).joinToString("\n") { parts.optJSONObject(it)?.optString("text") ?: "" }
    }

    /** The photo for the provider: longest side 1280 pixels, JPEG; the display stays readable and the request small. */
    private fun jpegBase64(b: Bitmap): String {
        val f = minOf(1f, 1280f / maxOf(b.width, b.height))
        val s = if (f < 1f) Bitmap.createScaledBitmap(b, (b.width * f).toInt(), (b.height * f).toInt(), true) else b
        val out = ByteArrayOutputStream()
        s.compress(Bitmap.CompressFormat.JPEG, 88, out)
        if (s !== b) s.recycle()
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }

    // ---------- the key, encrypted on the phone ----------

    private fun secret(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        g.init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        return g.generateKey()
    }

    private fun encrypt(plain: String): String {
        val c = Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.ENCRYPT_MODE, secret())
        return Base64.encodeToString(c.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(c.doFinal(plain.toByteArray()), Base64.NO_WRAP)
    }

    private fun decrypt(stored: String): String {
        val (iv, ct) = stored.split(":", limit = 2)
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, secret(), GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
        return String(c.doFinal(Base64.decode(ct, Base64.NO_WRAP)))
    }
}
