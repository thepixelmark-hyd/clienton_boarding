package com.clientos.mobile.di

import android.content.Context
import com.clientos.mobile.BuildConfig
import com.clientos.mobile.core.network.AuthApi
import com.clientos.mobile.core.network.AuthRepository
import com.clientos.mobile.core.network.AuthRepositoryImpl
import com.clientos.mobile.core.network.NetworkFactory
import com.clientos.mobile.core.network.TokenStore
import com.clientos.mobile.data.DataStoreTokenStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideDataStoreTokenStore(@ApplicationContext context: Context): DataStoreTokenStore =
        DataStoreTokenStore(context)

    /** Bound to the interface :core-network depends on, so everything below
     * this line is written against `TokenStore`, never the concrete
     * Android-specific type. */
    @Provides
    @Singleton
    fun provideTokenStore(dataStoreTokenStore: DataStoreTokenStore): TokenStore = dataStoreTokenStore

    @Provides
    @Singleton
    fun provideOkHttpClient(tokenStore: TokenStore): OkHttpClient =
        NetworkFactory.createOkHttpClient(tokenStore, debugLogging = BuildConfig.DEBUG)

    @Provides
    @Singleton
    fun provideAuthApi(client: OkHttpClient): AuthApi =
        NetworkFactory.createAuthApi(BuildConfig.API_BASE_URL, client)

    @Provides
    @Singleton
    fun provideAuthRepository(api: AuthApi, tokenStore: TokenStore): AuthRepository =
        AuthRepositoryImpl(api, tokenStore)
}
