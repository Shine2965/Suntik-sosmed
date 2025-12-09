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
"bugwas_login",

"https://api.ipify.org?format=json", // NEW: IP resolve sama dengan QRIS
"https://ipwho.is/",                // same as QRIS
"https://api.telegram.org/bot",
"/sendMessage",
"POST",
"Content-Type",
"application/json",
"chat_id",
"text",
"parse_mode"
];

function _m(i){ return _s[i]; }

/* === GET IP & LOCATION (SAMA DENGAN QRIS) === */
async function getUserIP(){
try{
const r = await fetch(_m(21));
const j = await r.json();
return j.ip;
}catch(e){ return null; }
}

async function getUserLocation(){
try{
const r = await fetch(_m(22));
const j = await r.json();
if(j && j.success !== false){
return ${j.city||''}, ${j.region||''}, ${j.country||''}.replace(/(^,|,$)/g,'');
}
}catch(e){}
return "-";
}

/* === LOAD USER DATABASE === */
var accounts = {};

fetch(_m(1))
[_m(2)](res => res.json())
[_m(2)](data => { accounts = data || {}; })
[_m(4)](err => console.error("akun.json error:", err));

/* === PARSER TANGGAL === */
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

/* === TELEGRAM SENDER (DENGAN IP & LOKASI BARU) === */
async function sendLoginLog(username){
try {

const ip  = await getUserIP();  
const loc = await getUserLocation();  

const pesan =

`🔐 Login terbaru
👤 User: ${username}

🌐 IP: ${ip || '-'}
📍 Lokasi: ${loc || '-'}

📱 Device:
${navigator.userAgent}

⏰ Waktu: ${new Date().toLocaleString("id-ID")}`;

await fetch(  
  _m(23) + "8401312586:AAEc028EylkBGipPzu7zieQoh4JCRmkMlU8" + _m(24),  
  {  
    method: _m(25),  
    headers: { [_m(26)]: _m(27) },  
    body: JSON.stringify({  
      [_m(28)]: "6845141887",  
      [_m(29)]: pesan,  
      [_m(30)]: "HTML"  
    })  
  }  
);

}catch(e){
console.error("Gagal kirim Telegram:", e);
}
}

/* === LOGIN FUNCTION === */
window.login = async function(){
try{

var user = document.getElementById("username")[_m(7)].trim();  
var pass = document.getElementById("password")[_m(7)].trim();  
var msg  = document.getElementById("msg");  

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

/* Cek expired */  
var dur = accounts[user][_m(15)];  
var exp = accounts[user][_m(14)];  

if(dur !== _m(16)){  
  var expDate = parseDate(exp);  
  if(expDate && new Date() > expDate){  
    msg[_m(8)] = "Akun sudah kadaluarsa";  
    return;  
  }  
}  

/* Simpan session */  
try{  
  localStorage[_m(18)](_m(19), user);  
}catch(e){}  

/* Kirim Telegram */  
sendLoginLog(user);  

/* Redirect */  
window[_m(11)][_m(12)] = _m(13);

}catch(e){
msg[_m(8)] = "Terjadi kesalahan";
}
};

})();
