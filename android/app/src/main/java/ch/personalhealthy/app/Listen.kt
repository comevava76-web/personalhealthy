package ch.personalhealthy.app

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

/**
 * Listening inside the app, instead of the phone's standard speech window: bars that move with the voice,
 * the words appearing while they are said. It gives time: a pause, or silence before starting, does not end it;
 * listening starts again by itself and the pieces are joined ("127 … 80 … 70"). It ends by itself as soon as
 * three numbers are heard, when the person taps Done, or after [MAX_LISTEN_MS].
 * [onResult] gets the transcriptions (best first); [onFail] a message to show.
 */
@Composable
fun ListenScreen(onResult: (List<String>) -> Unit, onFail: (String) -> Unit, onCancel: () -> Unit) {
    val ctx = LocalContext.current
    var heard by remember { mutableStateOf("") }
    val levels = remember { mutableStateListOf<Float>().apply { repeat(BARS) { add(0f) } } }
    val stop = remember { mutableStateOf<(() -> Unit)?>(null) }   // "Done": finish with what was heard

    DisposableEffect(Unit) {
        val rec = SpeechRecognizer.createSpeechRecognizer(ctx)
        val main = Handler(Looper.getMainLooper())
        val started = SystemClock.elapsedRealtime()
        var committed = ""     // what was said in the earlier pieces
        var done = false
        var finishing = false  // Done was tapped: the next result ends it
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
            .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
            // ask for longer pauses before a piece ends (some phones ignore it: listening restarts anyway)
            .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L)
            .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L)
        fun numbersIn(text: String) = Regex("\\d{2,3}").findAll(text).count()
        fun finish(alternatives: List<String>) {
            if (done) return
            done = true
            val all = (listOf(committed.trim()) + alternatives).filter { it.isNotBlank() }.distinct()
            if (all.isEmpty()) onFail(t(R.string.voice_not_understood)) else onResult(all)
        }
        fun listenAgain() = main.postDelayed({ if (!done) rec.startListening(intent) }, 150)
        fun timeLeft() = SystemClock.elapsedRealtime() - started < MAX_LISTEN_MS
        stop.value = { finishing = true; rec.stopListening(); main.postDelayed({ finish(emptyList()) }, 1500) }

        rec.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {
                // about -2 (silence) to 10 (loud): one new bar on the right, the oldest leaves on the left
                levels.removeAt(0)
                levels.add(((rmsdB + 2f) / 12f).coerceIn(0.04f, 1f))
            }
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onPartialResults(partialResults: Bundle?) {
                partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let {
                    heard = (committed + " " + it).trim()
                }
            }
            override fun onResults(results: Bundle?) {
                if (done) return
                val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
                val before = committed
                committed = (committed + " " + (list.firstOrNull() ?: "")).trim()
                heard = committed
                val alternatives = list.map { (before + " " + it).trim() }
                // three numbers heard, Done tapped, or time is up: finished; otherwise keep listening
                if (finishing || numbersIn(committed) >= 3 || !timeLeft()) finish(alternatives) else listenAgain()
            }
            override fun onError(error: Int) {
                if (done) return
                when (error) {
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> { done = true; onFail(t(R.string.voice_permission)) }
                    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT, SpeechRecognizer.ERROR_SERVER ->
                        { done = true; onFail(t(R.string.voice_network)) }
                    // silence or nothing recognised: not a reason to stop, the person may still be about to speak
                    else -> if (!finishing && timeLeft()) listenAgain() else finish(emptyList())
                }
            }
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        rec.startListening(intent)
        onDispose { done = true; main.removeCallbacksAndMessages(null); rec.destroy() }
    }

    Column(
        Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(t(R.string.listening), color = C.Ink, fontSize = 22.sp, fontWeight = FontWeight.Light)
        Text(t(R.string.voice_prompt), color = C.Muted, fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 6.dp))
        Spacer(Modifier.height(36.dp))
        // bars that follow the voice, in the app's coral
        Canvas(Modifier.fillMaxWidth().height(90.dp)) {
            val gap = size.width / (BARS * 2f)
            val w = gap
            levels.forEachIndexed { i, v ->
                val h = size.height * v
                drawRoundRect(
                    C.Sys.copy(alpha = 0.35f + 0.65f * v),
                    topLeft = Offset(gap / 2f + i * 2f * gap, (size.height - h) / 2f),
                    size = Size(w, h), cornerRadius = CornerRadius(w / 2f)
                )
            }
        }
        Spacer(Modifier.height(28.dp))
        // the words as they are recognised
        Text(
            heard.ifBlank { "…" }, color = C.Ink, fontSize = 30.sp, fontWeight = FontWeight.Light,
            textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().height(90.dp)
        )
        Spacer(Modifier.height(24.dp))
        BigButton(t(R.string.voice_done)) { stop.value?.invoke() }
        BigButton(t(R.string.cancel), color = C.Surface2, textColor = C.Ink, onClick = onCancel)
    }
}

private const val BARS = 28
/** How long the app keeps listening at most, pauses included. */
private const val MAX_LISTEN_MS = 40_000L
