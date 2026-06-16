package mx.ceti.neurodia

import android.app.Application
import mx.ceti.neurodia.data.network.ApiService
import mx.ceti.neurodia.data.network.RetrofitClient
import mx.ceti.neurodia.data.session.SessionManager

class NeuroDiaApp : Application() {

    lateinit var session: SessionManager
        private set

    lateinit var api: ApiService
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        session = SessionManager(this)
        api = RetrofitClient.build(session)
    }

    companion object {
        lateinit var instance: NeuroDiaApp
            private set
    }
}
