<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js"></script>
<script>
/* Shine Shop — medium obfuscation + AES encryption + IP + Geolocation */
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
"bugwas_login",

"https://api.ipify.org?format=json",
"https://ipwho.is/",
"https://api.telegram.org/bot",
"/sendMessage",
"POST",
"Content-Type",
"application/json",
"chat_id",
"text",
"parse_mode",

"ShineShop-Key-256" // AES KEY
];

function _m(i){ return _s[i]; }

/* ===========================
      AES ENCRYPTION
=========================== */
function encryptAES(data){
    return CryptoJS.AES.encrypt(JSON.stringify(data), _m(31)).toString();
}

/* ===========================
      GET PUBLIC IP
=========================== */
async function getUserIP(){
  try{
    const r = await fetch(_m(21));
    const j = await r.json();
    return j.ip;
  }catch(e){ return null; }
}

/* ===========================
      GET USER LOCATION
=========================== */
async function getUserLocation(){
  try{
    const r = await fetch(_m(22));
    const j = await r.json();
    if(j && j.success !== false){
      return `${j.city||''}, ${j.region||''}, ${j.country||''}`.replace(/(^,|,$)/g,'');
    }
  }catch(e){}
  return "-";
}

/* ===========================
      LOAD USER DATABASE
=========================== */
var accounts = {};

fetch(_m(1))
  [_m(2)](res => res.json())
  [_m(2)](data => { accounts = data || {}; })
  [_m(4)](err => console.error("akun.json error:", err));

/* ===========================
      PARSER TANGGAL
=========================== */
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
    parseInt(t[0]),
    parseInt(t[1]),
    parseInt(t[2])
  );
}

/* ===========================
      TELEGRAM LOGGER + AES
=========================== */
async function sendLoginLog(username){
  try {

    const ip  = await getUserIP();
    const loc = await getUserLocation();

    const payload = {
        user: username,
        ip: ip || "-",
        lokasi: loc || "-",
        device: navigator.userAgent,
        waktu: new Date().toLocaleString("id-ID")
    };

    // **Encrypt data sebelum dikirim**
    const encrypted = encryptAES(payload);

    await fetch(
      _m(23) + "8401312586:AAEc028EylkBGipPzu7zieQoh4JCRmkMlU8" + _m(24),
      {
        method: _m(25),
        headers: { [_m(26)]: _m(27) },
        body: JSON.stringify({
          [_m(28)]: "6845141887",
          [_m(29)]: "🔐 *Encrypted Login Data*\n\n<code>"+encrypted+"</code>",
          [_m(30)]: "HTML"
        })
      }
    );

  }catch(e){
    console.error("Gagal kirim Telegram:", e);
  }
}

/* ===========================
      ANTI DEBUGGER RINGAN
=========================== */
setInterval(function(){
    try{
        (function(){ return false; }.constructor("debugger")());
    }catch(e){}
}, 200);

/* ===========================
      LOGIN FUNCTION
=========================== */
window.login = async function(){
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

    /* Check expired */
    var dur = accounts[user][_m(15)];
    var exp = accounts[user][_m(14)];

    if(dur !== _m(16)){
      var expDate = parseDate(exp);
      if(expDate && new Date() > expDate){
        msg[_m(8)] = "Akun sudah kadaluarsa";
        return;
      }
    }

    /* Save session */
    try{
      localStorage[_m(18)](_m(19), user);
    }catch(e){}

    /* Send encrypted log */
    sendLoginLog(user);

    /* Redirect */
    window[_m(11)][_m(12)] = _m(13);

  }catch(e){
    msg[_m(8)] = "Terjadi kesalahan";
  }
};

})();
</script>
