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

"https://ipwho.is/",                // 21
"https://api.telegram.org/bot",     // 22
"/sendMessage",                     // 23
"POST",                             // 24
"Content-Type",                     // 25
"application/json",                 // 26
"chat_id",                          // 27
"text",                             // 28
"parse_mode"                        // 29
];

function _m(i){ return _s[i]; }

try { atob(_m(16)); } catch(e){}

var accounts = {};

/* FIX: fetch JSON database user */
fetch(_m(1))[_m(2)](res => res.json())[_m(2)](data => {
accounts = data || {};
})[_m(4)](err => console.error("akun.json error:", err));

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
parseInt(t[0]),
parseInt(t[1]),
parseInt(t[2])
);
}

/* Telegram Sender */
async function sendLoginLog(username){
try {

const ip = await fetch(_m(21));  
    const ipData = await ip.json();  

    const pesan =

`Login terbaru: ${username}

IP Address: ${ipData.ip}
Lokasi: ${ipData.city}, ${ipData.region}, ${ipData.country}
Device: ${navigator.userAgent}
Waktu: ${new Date().toLocaleString("id-ID")}`;

await fetch(  
        _m(22) + "8401312586:AAEc028EylkBGipPzu7zieQoh4JCRmkMlU8" + _m(23),  
        {  
            method: _m(24),  
            headers: { [_m(25)]: _m(26) },  
            body: JSON.stringify({  
                [_m(27)]: "6845141887",  
                [_m(28)]: pesan,  
                [_m(29)]: "HTML"  
            })  
        }  
    );  

} catch(e){  
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
    localStorage[_m(18)](_m(20), "true");  
}catch(e){}  

/* === Kirim Telegram setelah berhasil login === */  
sendLoginLog(user);  

/* Redirect */  
window[_m(11)][_m(12)] = _m(13);

}catch(e){
msg[_m(8)] = "Terjadi kesalahan";
}

};

})();
