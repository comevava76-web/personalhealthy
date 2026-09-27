package ch.personalhealthy.app

import android.app.Activity
import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.acknowledgePurchase
import com.android.billingclient.api.queryProductDetails
import com.android.billingclient.api.queryPurchasesAsync
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import java.security.MessageDigest
import kotlin.coroutines.resume

/**
 * The yearly subscription, bought through Google Play (paid with Google Pay or any method Google Play offers).
 * Every purchase is sent to the server, which checks it with Google Play; only then is it acknowledged
 * (a purchase not acknowledged within 3 days is refunded by Google). Cancelling is done in Google Play.
 */
object Billing {
    const val PRODUCT = "hint365_annual"
    const val MANAGE_URL = "https://play.google.com/store/account/subscriptions?sku=$PRODUCT&package=ch.personalhealthy.app"

    /** The yearly price as Google Play shows it in the person's currency (null until known). */
    var price by mutableStateOf<String?>(null)
    var busy by mutableStateOf(false)
    /** Called after a purchase has been checked by the server: the app reloads the account. */
    var onChanged: (() -> Unit)? = null
    /** Called with a message to show when something goes wrong. */
    var onError: ((String) -> Unit)? = null

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var client: BillingClient? = null
    private var details: ProductDetails? = null
    private var personId: String? = null

    /** The anonymous account code as Google Play keeps it with the purchase: the same fingerprint the server checks. */
    private fun accountId(pid: String): String =
        MessageDigest.getInstance("SHA-256").digest("hint365-sub:$pid".toByteArray()).joinToString("") { "%02x".format(it) }

    private suspend fun ready(ctx: Context): BillingClient? {
        val c = client ?: BillingClient.newBuilder(ctx.applicationContext)
            .setListener { result, purchases ->
                busy = false
                when (result.responseCode) {
                    BillingClient.BillingResponseCode.OK -> purchases?.forEach { p -> scope.launch { handle(p) } }
                    BillingClient.BillingResponseCode.USER_CANCELED -> {}
                    else -> onError?.invoke(t(R.string.err_billing))
                }
            }
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build().also { client = it }
        if (c.isReady) return c
        return suspendCancellableCoroutine { cont ->
            c.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(r: BillingResult) {
                    if (cont.isActive) cont.resume(if (r.responseCode == BillingClient.BillingResponseCode.OK) c else null)
                }
                override fun onBillingServiceDisconnected() {}
            })
        }
    }

    private suspend fun product(c: BillingClient): ProductDetails? {
        details?.let { return it }
        val r = c.queryProductDetails(
            QueryProductDetailsParams.newBuilder().setProductList(listOf(
                QueryProductDetailsParams.Product.newBuilder().setProductId(PRODUCT).setProductType(BillingClient.ProductType.SUBS).build()
            )).build()
        )
        val d = r.productDetailsList?.firstOrNull() ?: return null
        details = d
        price = d.subscriptionOfferDetails?.firstOrNull()?.pricingPhases?.pricingPhaseList?.lastOrNull()?.formattedPrice
        return d
    }

    /** Reads the price, and hands the server any purchase already made (a renewal, or a new phone). */
    suspend fun restore(ctx: Context, pid: String) {
        personId = pid
        val c = ready(ctx) ?: return
        product(c)
        val r = c.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build())
        r.purchasesList.forEach { handle(it) }
    }

    /** Opens Google Play's own payment sheet. */
    fun buy(activity: Activity, pid: String) {
        personId = pid
        busy = true
        scope.launch {
            val c = ready(activity)
            val d = c?.let { product(it) }
            val offer = d?.subscriptionOfferDetails?.firstOrNull()?.offerToken
            if (c == null || d == null || offer == null) {
                busy = false; onError?.invoke(t(R.string.err_billing_unavailable)); return@launch
            }
            val params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).setOfferToken(offer).build()
                ))
                .setObfuscatedAccountId(accountId(pid))
                .build()
            val r = c.launchBillingFlow(activity, params)
            if (r.responseCode != BillingClient.BillingResponseCode.OK) { busy = false; onError?.invoke(t(R.string.err_billing)) }
        }
    }

    private suspend fun handle(p: Purchase) {
        val pid = personId ?: return
        if (p.purchaseState != Purchase.PurchaseState.PURCHASED) return
        try {
            Repo.subVerify(pid, p.purchaseToken)
            if (!p.isAcknowledged) {
                client?.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.purchaseToken).build())
            }
            AppGate.subExpired = false
            onChanged?.invoke()
        } catch (e: ApiException) {
            onError?.invoke(e.message ?: t(R.string.err_generic))
        }
    }
}
