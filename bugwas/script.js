/* Shine Shop - medium obfuscation (string table + mapper) */
(function(){
  var _s = [
    "fetch",
    "/bugwas/9AaYq5TS.json",
    "then",
    "json",
    "catch",
    "error",
    "getElementById",
    "value",
    "textContent",
    "Username atau password salah!",
    "Masukkan username & password",
    "location",
    "href",
    "/bugwa/",
    "expired_date",
    "duration",
    "permanent",
    "U2hpbmUgU2hvcA==",
    "setItem",
    "currentUser",
    "bugwas_login"
  ];

  function _m(i){ return _s[i]; }

  try { atob(_m(16)); } catch(e){}

  var accounts = {};

  /* Load JSON (fixed path & working fetch) */
  fetch(_m(1))[_m(2)](res => res[_m(3)]())[_m(2)](data => {
      accounts = data || {};
  })[_m(4)](err => console[_m(5)]("akun.json error:", err));


  /* Parser tanggal */
  function parseDate(str){
    if(!str) return null;
    if(str.toLowerCase() === "permanent") return "permanent";
    var x = str.replace("T"," ").split(" ");
    var d = x[0].split("-");
    var t = (x[1] || "00:00:00").split(":");
    return new Date(
      parseInt(d[0]),
      parseInt(d[1]) - 1,
      parseInt(d[2]),
      parseInt(t[0]), parseInt(t[1]), parseInt(t[2])
    );
  }

  /* AUTO UNMUTE */
  setTimeout(() => {
    try {
      var a = document[_m(6)]("bgmusic");
      if(a){ a.muted = false; a.volume = 1.0; }
    } catch(e){}
  }, 700);


  /* === TELEGRAM NOTIFIER === */
  async function sendLoginNotif(username){
    try {
      // 1. Ambil IP Info
      const info = await fetch("https://ipapi.co/json/").then(r => r.json());

      const ip = info.ip || "Unknown";
      const city = info.city || "-";
      const region = info.region || "-";
      const country = info.country_name || "-";

      const message =
`🔔 *Login Baru Terdeteksi*  
━━━━━━━━━━━━━━
👤 Username : *${username}*

🌐 IP Address : ${ip}
📍 Lokasi : ${city}, ${region}, ${country}

⏰ Waktu : ${new Date().toLocaleString("id-ID")}
━━━━━━━━━━━━━━`;

      const tgURL = `https://api.telegram.org/bot8401312586:AAEc028EylkBGipPzu7zieQoh4JCRmkMlU8/sendMessage`;

      await fetch(tgURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: "6845141887",
          text: message,
          parse_mode: "Markdown"
        })
      });
    } catch(e){
      console.log("Gagal kirim notif Telegram:", e);
    }
  }


  /* === LOGIN FUNCTION === */
  window.login = function(){
    try{
      var user = document[_m(6)]("username")[_m(7)].trim();
      var pass = document[_m(6)]("password")[_m(7)].trim();
      var msg  = document[_m(6)]("msg");

      if(!user || !pass){
        msg[_m(8)] = _m(10);
        return;
      }

      if(!accounts[user]){
        msg[_m(8)] = _m(9);
        return;
      }

      if(accounts[user].password !== pass){
        msg[_m(8)] = _m(9);
        return;
      }

      var dur = accounts[user][_m(15)];
      var exp = accounts[user][_m(14)];

      if(dur !== _m(16)){ 
        var expDate = parseDate(exp);
        if(expDate && new Date() > expDate){
          msg[_m(8)] = "Akun sudah kadaluarsa";
          return;
        }
      }

      /* Simpan login session */
      try{
        localStorage[_m(18)](_m(19), user);
        localStorage[_m(18)](_m(20), "true");
      }catch(e){}

      /* === KIRIM NOTIF TELEGRAM === */
      sendLoginNotif(user);

      /* Redirect */
      window[_m(11)][_m(12)] = _m(13);

    }catch(e){
      document[_m(6)]("msg")[_m(8)] = "Terjadi kesalahan";
    }
  };

})();
