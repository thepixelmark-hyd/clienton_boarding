package com.clientos.mobile

import android.app.Application
import com.clientos.mobile.data.DataStoreTokenStore
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class ClientOsApplication : Application() {

    @Inject lateinit var tokenStore: DataStoreTokenStore

    override fun onCreate() {
        super.onCreate()
        // Populate the in-memory cache before anything could possibly fire
        // an authenticated request — see DataStoreTokenStore's own comment
        // on why AuthInterceptor needs a synchronous, already-warm value.
        tokenStore.primeCache()
    }
}
