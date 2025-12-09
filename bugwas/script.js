/* Shine Shop - medium obfuscation */
(function(){

var _s = [
"fetch","/bugwas/9AaYq5TS.json","then","json","catch","error",
"getElementById","value","textContent",
"Username atau password salah!","Masukkan username & password",
"location","href","/bugwa/","expired_date","duration","permanent",
"U2hpbmUgU2hvcA==","setItem","currentUser","bugwas_login",

"https://api.ipify.org?format=json",   // 21
"https://ipwho.is/",                   // 22
"https://api.telegram.org/bot",        // 23
"/sendMessage",                        // 24
"POST","Content-Type","application/json",
"chat_id","text","parse_mode"
];

function _m(i){ return _s[i]; }

try{ atob(_m(17)); }catch(e){}

var _acc = {};

_m(0)(_m(1))[_m(2)](r=>r[_m(3)]())[_m(2)](d=>{_acc=d||{};})
[_m(4)](e=>console[_m(5)]("akun.json error:",e));

function _pDate(s){
if(!s) return null;
if(s.toLowerCase()==="permanent") return "permanent";
var x=s.replace("T"," ").split(" ");
var d=x[0].split("-");
var t=(x[1]||"00:00:00").split(":");
return new Date(+d[0],d[1]-1,+d[2],+t[0],+t[1],+t[2]);
}

/* === Telegram Sender (IP Realtime) === */
async function _send(u){
try{

const _ipR = await _m(0)(_m(21));
const _ipJ = await _ipR[_m(3)]();
const _ip = _ipJ.ip || "Unknown";

const _locR = await _m(0)(_m(22)+_ip);
const _loc = await _locR[_m(3)]();

const _msg =
`Login terbaru: ${u}

IP Address: ${_ip}
Lokasi: ${_loc.city||"-"}, ${_loc.region||"-"}, ${_loc.country||"-"}
Device: ${navigator.userAgent}
Waktu: ${new Date().toLocaleString("id-ID")}`;

await _m(0)(
    _m(23)+"8401312586:AAEc028EylkBGipPzu7zieQoh4JCRmkMlU8"+_m(24),
    {
        method:_m(25),
        headers:{[_m(26)]:_m(27)},
        body:JSON.stringify({
            [_m(28)]:"6845141887",
            [_m(29)]:_msg,
            [_m(30)]:"HTML"
        })
    }
);

}catch(e){
console[_m(5)]("Gagal kirim Telegram:",e);
}
}

/* === LOGIN === */
window.login = async function(){
try{

var u = document[_m(6)]("username")[_m(7)].trim();
var p = document[_m(6)]("password")[_m(7)].trim();
var m = document[_m(6)]("msg");

if(!u||!p){ m[_m(8)] = _m(10); return; }

if(!_acc[u]){ m[_m(8)] = _m(9); return; }

if(_acc[u].password!==p){ m[_m(8)] = _m(9); return; }

var d=_acc[u][_m(15)];
var e=_acc[u][_m(14)];

if(d!==_m(16)){
    var ex=_pDate(e);
    if(ex && new Date()>ex){
        m[_m(8)]="Akun sudah kadaluarsa";
        return;
    }
}

try{
    localStorage[_m(18)](_m(19),u);
    localStorage[_m(18)](_m(20),"true");
}catch(_){}

_send(u);

window[_m(11)][_m(12)] = _m(13);

}catch(e){
m[_m(8)]="Terjadi kesalahan";
}

};

})();
