package ch.personalhealthy.app

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

/**
 * Unlock the AI features (today: the photo Scan) with the key of the person's own AI subscription. Opened from the grey
 * Scan button and from Gestore. The key is checked with the provider and kept encrypted on this phone only (AiScan).
 */
@Composable
fun AiScreen(onClose: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var provider by remember { mutableStateOf(AiScan.active ?: AiScan.Provider.CLAUDE) }
    var key by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var problem by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        Header(t(R.string.ai_title), null, t(R.string.cancel), onClose)
        Panel {
            Text(t(R.string.ai_intro), color = C.Ink, fontSize = 15.sp)
            Text(t(R.string.ai_privacy), color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
        }

        AiScan.active?.let { on ->
            // already unlocked: which provider, and the way to remove the key
            Panel {
                Text(t(R.string.ai_active, on.label), color = C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                TextButton(onClick = { AiScan.remove(ctx); key = "" }) { Text(t(R.string.ai_remove), color = C.Alert) }
            }
        }

        SectionTitle(t(R.string.ai_provider))
        Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AiScan.Provider.entries.forEach { p ->
                val on = p == provider
                Box(
                    Modifier.weight(1f).height(44.dp).clip(RoundedCornerShape(14.dp))
                        .background(if (on) C.Sys else C.Surface2).clickable { provider = p; problem = null },
                    contentAlignment = Alignment.Center
                ) { Text(p.label, color = if (on) Color.White else C.Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1) }
            }
        }
        Text(
            t(R.string.ai_where_key, provider.label), color = C.Sys, fontSize = 13.sp, textDecoration = TextDecoration.Underline,
            modifier = Modifier.padding(vertical = 6.dp, horizontal = 4.dp).clickable {
                try { openInBrowser(ctx, provider.keysUrl) } catch (e: Exception) { ErrorReport.report("Ai/keys", e) }
            }
        )

        SectionTitle(t(R.string.ai_key_label))
        OutlinedTextField(
            value = key, singleLine = true,
            onValueChange = { v -> key = v.trim(); problem = null; AiScan.guess(key)?.let { provider = it } },
            placeholder = { Text(t(R.string.ai_key_hint), color = C.Muted) },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrect = false),
            colors = OutlinedTextFieldDefaults.colors(focusedTextColor = C.Ink, unfocusedTextColor = C.Ink, focusedBorderColor = C.Sys, unfocusedBorderColor = C.Line),
            modifier = Modifier.fillMaxWidth()
        )
        Text(t(R.string.ai_key_note), color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp, start = 4.dp))
        problem?.let { Text(it, color = C.Alert, fontSize = 14.sp, modifier = Modifier.padding(top = 8.dp, start = 4.dp)) }
        Spacer(Modifier.height(8.dp))
        BigButton(if (busy) t(R.string.ai_checking) else t(R.string.ai_activate), enabled = !busy && key.length >= 20) {
            busy = true
            scope.launch {
                when (val r = AiScan.activate(ctx, provider, key)) {
                    is AiScan.Check.Ok -> { key = ""; toast(ctx, t(R.string.ai_done)); onClose() }
                    is AiScan.Check.Failed -> problem = t(when (r.reason) {
                        "key" -> R.string.ai_err_key
                        "network" -> R.string.ai_err_network
                        "model" -> R.string.ai_err_model
                        else -> R.string.ai_err_other
                    })
                }
                busy = false
            }
        }
    }
}
