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
import androidx.compose.animation.core.animateFloat
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
 * three numbers are heard, or after [MAX_LISTEN_MS]: no extra tap, the only confirmation is Save afterwards.
 * [onResult] gets the transcriptions (best first); [onFail] a message to show.
 */
@Composable
fun ListenScreen(onResult: (List<String>) -> Unit, onFail: (String) -> Unit, onCancel: () -> Unit) {
    val ctx = LocalContext.current
    var heard by remember { mutableStateOf("") }
    val levels = remember { mutableStateListOf<Float>().apply { repeat(BARS) { add(0f) } } }

    DisposableEffect(Unit) {
        val rec = SpeechRecognizer.createSpeechRecognizer(ctx)
        val main = Handler(Looper.getMainLooper())
        val started = SystemClock.elapsedRealtime()
        var committed = ""     // what was said in the earlier pieces
        var done = false
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
                // three numbers heard, or time is up: finished; otherwise keep listening
                if (numbersIn(committed) >= 3 || !timeLeft()) finish(alternatives) else listenAgain()
            }
            override fun onError(error: Int) {
                if (done) return
                when (error) {
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> { done = true; onFail(t(R.string.voice_permission)) }
                    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT, SpeechRecognizer.ERROR_SERVER ->
                        { done = true; onFail(t(R.string.voice_network)) }
                    // silence or nothing recognised: not a reason to stop, the person may still be about to speak
                    else -> if (timeLeft()) listenAgain() else finish(emptyList())
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
        Spacer(Modifier.height(20.dp))
        // a doctor with her stethoscope, listening: the waves grow with the voice
        DoctorListening(levels.lastOrNull() ?: 0f)
        Spacer(Modifier.height(16.dp))
        // bars that follow the voice, in the app's violet
        Canvas(Modifier.fillMaxWidth().height(56.dp)) {
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
        BigButton(t(R.string.cancel), color = C.Surface2, textColor = C.Ink, onClick = onCancel)
    }
}

private const val BARS = 28
/** How long the app keeps listening at most, pauses included. */
private const val MAX_LISTEN_MS = 40_000L

/**
 * A friendly doctor listening through her stethoscope, drawn here (no image file): she bobs gently and the sound waves
 * in front of the chest piece grow with the voice. Colours from the theme, so she fits the light and the dark one.
 */
@Composable
fun DoctorListening(level: Float) {
    val anim = androidx.compose.animation.core.rememberInfiniteTransition(label = "doctor")
    val bob by anim.animateFloat(
        0f, 1f, androidx.compose.animation.core.infiniteRepeatable(
            androidx.compose.animation.core.tween(1600), androidx.compose.animation.core.RepeatMode.Reverse
        ), label = "bob"
    )
    val voice by androidx.compose.animation.core.animateFloatAsState(level, label = "voice")
    Canvas(Modifier.size(190.dp)) {
        val u = size.minDimension / 200f
        fun p(x: Float, y: Float) = Offset(x * u, (y + bob * 2.5f) * u)
        val skin = androidx.compose.ui.graphics.Color(0xFFF2C9A5)
        val hair = androidx.compose.ui.graphics.Color(0xFF4A2E1F)
        val coat = androidx.compose.ui.graphics.Color(0xFFFDFEFF)
        val steel = androidx.compose.ui.graphics.Color(0xFF8A97B0)
        val face = androidx.compose.ui.graphics.Color(0xFF2B2B33)
        // the round backdrop
        drawCircle(C.Surface2, radius = 96f * u, center = Offset(100f * u, 100f * u))
        // white coat and the teal scrubs at the neck
        val body = androidx.compose.ui.graphics.Path().apply {
            moveTo(p(38f, 200f).x, p(38f, 200f).y)
            cubicTo(p(40f, 160f).x, p(40f, 160f).y, p(62f, 140f).x, p(62f, 140f).y, p(100f, 138f).x, p(100f, 138f).y)
            cubicTo(p(138f, 140f).x, p(138f, 140f).y, p(160f, 160f).x, p(160f, 160f).y, p(162f, 200f).x, p(162f, 200f).y)
            close()
        }
        drawPath(body, coat)
        drawPath(body, C.Line, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 1.5f * u))
        val vneck = androidx.compose.ui.graphics.Path().apply {
            moveTo(p(86f, 140f).x, p(86f, 140f).y); lineTo(p(114f, 140f).x, p(114f, 140f).y); lineTo(p(100f, 170f).x, p(100f, 170f).y); close()
        }
        drawPath(vneck, C.Dia)
        // neck and head
        drawRect(skin, topLeft = p(92f, 116f), size = Size(16f * u, 26f * u))
        // hair behind the head: a bob down to the chin
        drawOval(hair, topLeft = p(66f, 62f), size = Size(68f * u, 66f * u))
        drawCircle(skin, radius = 27f * u, center = p(100f, 96f))
        // the fringe
        val fringe = androidx.compose.ui.graphics.Path().apply {
            moveTo(p(72f, 96f).x, p(72f, 96f).y)
            cubicTo(p(68f, 58f).x, p(68f, 58f).y, p(132f, 58f).x, p(132f, 58f).y, p(128f, 96f).x, p(128f, 96f).y)
            cubicTo(p(120f, 80f).x, p(120f, 80f).y, p(102f, 74f).x, p(102f, 74f).y, p(90f, 82f).x, p(90f, 82f).y)
            cubicTo(p(84f, 86f).x, p(84f, 86f).y, p(78f, 90f).x, p(78f, 90f).y, p(72f, 96f).x, p(72f, 96f).y)
            close()
        }
        drawPath(fringe, hair)
        // a calm, smiling face: closed eyes that listen, rosy cheeks
        val eye = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.4f * u, cap = androidx.compose.ui.graphics.StrokeCap.Round)
        drawArc(face, 200f, 140f, false, topLeft = p(85f, 94f), size = Size(10f * u, 7f * u), style = eye)
        drawArc(face, 200f, 140f, false, topLeft = p(105f, 94f), size = Size(10f * u, 7f * u), style = eye)
        drawArc(face, 20f, 140f, false, topLeft = p(92f, 102f), size = Size(16f * u, 10f * u), style = eye)
        drawCircle(androidx.compose.ui.graphics.Color(0x55F28C8C), radius = 4.5f * u, center = p(84f, 106f))
        drawCircle(androidx.compose.ui.graphics.Color(0x55F28C8C), radius = 4.5f * u, center = p(116f, 106f))
        // the stethoscope: earpieces in her ears, the tubes round her neck, the chest piece held out towards the voice
        val tube = androidx.compose.ui.graphics.drawscope.Stroke(width = 3.4f * u, cap = androidx.compose.ui.graphics.StrokeCap.Round)
        val left = androidx.compose.ui.graphics.Path().apply {
            moveTo(p(74f, 100f).x, p(74f, 100f).y)
            cubicTo(p(70f, 124f).x, p(70f, 124f).y, p(84f, 150f).x, p(84f, 150f).y, p(100f, 160f).x, p(100f, 160f).y)
        }
        val right = androidx.compose.ui.graphics.Path().apply {
            moveTo(p(126f, 100f).x, p(126f, 100f).y)
            cubicTo(p(130f, 124f).x, p(130f, 124f).y, p(116f, 150f).x, p(116f, 150f).y, p(100f, 160f).x, p(100f, 160f).y)
        }
        val lead = androidx.compose.ui.graphics.Path().apply {
            moveTo(p(100f, 160f).x, p(100f, 160f).y)
            cubicTo(p(104f, 184f).x, p(104f, 184f).y, p(130f, 186f).x, p(130f, 186f).y, p(146f, 170f).x, p(146f, 170f).y)
        }
        drawPath(left, steel, style = tube); drawPath(right, steel, style = tube); drawPath(lead, steel, style = tube)
        drawCircle(steel, radius = 4f * u, center = p(74f, 100f)); drawCircle(steel, radius = 4f * u, center = p(126f, 100f))
        drawCircle(steel, radius = 9f * u, center = p(150f, 166f))
        drawCircle(coat, radius = 5f * u, center = p(150f, 166f))
        // the voice reaching the chest piece: three arcs, brighter and wider when the voice is louder
        for (i in 0..2) {
            val r = (14f + i * 9f + voice * 6f) * u
            drawArc(
                C.Sys.copy(alpha = (0.25f + 0.6f * voice) * (1f - i * 0.25f)), -60f, 120f, false,
                topLeft = Offset(p(150f, 166f).x - r, p(150f, 166f).y - r), size = Size(2 * r, 2 * r),
                style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3f * u, cap = androidx.compose.ui.graphics.StrokeCap.Round)
            )
        }
    }
}

