package ch.personalhealthy.app

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Anthropic page where a person creates their own key. */
const val KEYS_URL = "https://console.anthropic.com/settings/keys"
/** Anthropic sign-up / sign-in page (the console). */
const val ANTHROPIC_SIGNUP_URL = "https://console.anthropic.com/"

fun openUrl(ctx: Context, url: String): Boolean = try {
    ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    true
} catch (e: ActivityNotFoundException) {
    android.widget.Toast.makeText(ctx, t(R.string.no_browser), android.widget.Toast.LENGTH_LONG).show()
    false
}

/* ---------------- A friend's own Anthropic key ---------------- */

/**
 * Guided steps, all inside the app, for each person to pay their own photo readings: what it costs, where to
 * load credit, how to create a key, then paste it (one tap takes it from the clipboard). The server tests the key
 * and stores it encrypted; it never comes back to the phone.
 */
@Composable
fun KeyScreen(
    hasKey: Boolean, busy: Boolean, error: String?, errorCode: String?,
    onSave: (key: String, amount: Double?) -> Unit, onRecharge: () -> Unit, onLater: () -> Unit,
    welcome: Boolean = false
) {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    var key by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    val amountValue = amount.replace(',', '.').toDoubleOrNull()
    // the first time the balance is needed to count the photos; when replacing the key it can stay as it is
    val canSave = !busy && key.length >= 20 && (amountValue != null || (hasKey && amount.isBlank()))

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp)) {
        if (welcome) {
            // first start: what the app does, the two ways to record, and that scanning is optional
            Header(t(R.string.welcome_title), t(R.string.welcome_sub))
            Panel {
                Text(t(R.string.welcome_what), color = C.Ink, fontSize = 15.sp)
                Spacer(Modifier.height(10.dp))
                Text(t(R.string.welcome_voice_title), color = C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Text(t(R.string.welcome_voice_text), color = C.Muted, fontSize = 14.sp)
                Spacer(Modifier.height(10.dp))
                Text(t(R.string.welcome_scan_title), color = C.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Text(t(R.string.welcome_scan_text), color = C.Muted, fontSize = 14.sp)
            }
            // the way out, before the steps: this part is not required, and it can be turned on later
            BigButton(t(R.string.welcome_skip), color = C.Surface2, textColor = C.Ink, onClick = onLater)
            Text(t(R.string.welcome_later), color = C.Muted, fontSize = 13.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            Text(t(R.string.welcome_steps_intro), color = C.Muted, fontSize = 14.sp, modifier = Modifier.padding(start = 4.dp, top = 10.dp, bottom = 2.dp))
        } else if (!hasKey) {
            // Upgrade: short, just what it unlocks and the steps
            Header(t(R.string.upgrade), null, t(R.string.later), onLater)
            Panel {
                Text(t(R.string.upgrade_sub), color = C.Muted, fontSize = 14.sp)
                Spacer(Modifier.height(8.dp))
                listOf(R.string.upgrade_f1, R.string.upgrade_f2).forEach {
                    Text(t(it), color = C.Ink, fontSize = 15.sp, modifier = Modifier.padding(vertical = 2.dp))
                }
                Spacer(Modifier.height(8.dp))
                Text(t(R.string.upgrade_cost), color = C.Muted, fontSize = 13.sp)
            }
        } else {
            Header(t(R.string.key_title_replace), null, t(R.string.later), onLater)
        }
        Panel {
            StepTitle(1, t(R.string.key_step0_title))
            Text(t(R.string.key_step0_text), color = C.Muted, fontSize = 14.sp)
            BigButton(t(R.string.key_step0_button), color = C.Surface2, textColor = C.Ink) { openUrl(ctx, ANTHROPIC_SIGNUP_URL) }
        }
        Panel {
            StepTitle(2, t(R.string.key_step1_title))
            Text(t(R.string.key_step1_text), color = C.Muted, fontSize = 14.sp)
            BigButton(t(R.string.open_anthropic), color = C.Surface2, textColor = C.Ink) { openUrl(ctx, RECHARGE_URL) }
        }
        Panel {
            StepTitle(3, t(R.string.key_step2_title))
            Text(t(R.string.key_step2_text), color = C.Muted, fontSize = 14.sp)
            BigButton(t(R.string.create_my_key), color = C.Surface2, textColor = C.Ink) { openUrl(ctx, KEYS_URL) }
        }
        Panel {
            StepTitle(4, t(R.string.key_step3_title))
            OutlinedTextField(
                value = key, onValueChange = { key = it.trim() }, singleLine = true,
                label = { Text(t(R.string.key_field)) },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                colors = OutlinedTextFieldDefaults.colors(focusedTextColor = C.Ink, unfocusedTextColor = C.Ink, focusedBorderColor = C.Sys, unfocusedBorderColor = C.Line),
                modifier = Modifier.fillMaxWidth()
            )
            // copied on Anthropic's page: one tap puts it here (read only when tapped)
            TextButton(onClick = {
                val cm = ctx.getSystemService(android.content.ClipboardManager::class.java)
                val clip = cm?.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(ctx)?.toString()?.trim().orEmpty()
                if (clip.startsWith("sk-ant-")) key = clip
                else android.widget.Toast.makeText(ctx, t(R.string.key_clipboard_empty), android.widget.Toast.LENGTH_LONG).show()
            }) { Text(t(R.string.key_paste), color = C.Sys, fontSize = 14.sp, fontWeight = FontWeight.SemiBold) }
            Spacer(Modifier.height(4.dp))
            Text(t(if (hasKey) R.string.key_amount_optional else R.string.correct_q), color = C.Muted, fontSize = 14.sp)
            AmountField(amount) { amount = it }
            Spacer(Modifier.height(6.dp))
            BigButton(if (busy) t(R.string.key_checking) else t(R.string.key_save), enabled = canSave) { onSave(key, amountValue) }
            if (error != null) {
                Text(error, color = C.Alert, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp))
                if (errorCode == "friend_no_credit") BigButton(t(R.string.recharge), color = C.Surface2, textColor = C.Ink) { openUrl(ctx, RECHARGE_URL) }
            }
        }
        Text(t(R.string.key_privacy), color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(start = 4.dp, end = 4.dp, top = 6.dp, bottom = 12.dp))
        if (welcome) BigButton(t(R.string.welcome_skip), color = C.Surface2, textColor = C.Ink, onClick = onLater)
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun StepTitle(n: Int, text: String) {
    Text(t(R.string.step_fmt, n, text), color = C.Ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 4.dp))
}
