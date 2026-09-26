package ch.personalhealthy.app

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/**
 * Sign in with Google, used only to create the account and to find it again on a new phone.
 * Day to day the app uses its own key, unlocked with fingerprint or face: Google is not asked again.
 */
object GoogleSignIn {
    /** Off until the Google Cloud "Web client ID" is set as a GitHub repository variable. */
    val enabled: Boolean get() = BuildConfig.GOOGLE_CLIENT_ID.isNotBlank()

    /**
     * Shows Google's account chooser and returns the ID token for the server to check,
     * or null if the person closed the window. [ctx] must be the activity.
     */
    suspend fun idToken(ctx: Context): String? {
        val option = GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_CLIENT_ID).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        return try {
            val result = CredentialManager.create(ctx).getCredential(ctx, request)
            GoogleIdTokenCredential.createFrom(result.credential.data).idToken
        } catch (e: GetCredentialCancellationException) {
            null
        } catch (e: NoCredentialException) {
            throw ApiException("google_no_account")
        } catch (e: GetCredentialException) {
            throw ApiException("google_failed")
        }
    }
}
