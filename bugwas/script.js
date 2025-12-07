/* Shine Shop - medium obfuscation (string table + mapper) */
(function(){
  var _s = [
    "fetch",
    "9AaYq5TS.json",
    "then",
    "json",
    "catch",
    "console.error",
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
    "U2hpbmUgU2hvcA==", // base64 watermark
    "setItem",
    "currentUser",
    "bugwas_login"
  ];

  function _m(idx){ return _s[idx]; }

  // watermark decode (keberadaan dipantau pada versi advanced)
  try { var _wm = atob(_m(16)); /* "Shine Shop" */ if(!_wm){} } catch(e){}

  // accounts store
  var accounts = {};

  // load accounts JSON (relative file located in same folder)
  try {
    window[_m(6)]; // noop to prevent some bundlers from pruning
    fetch(_m(1))[_m(2)](function(res){ return res[_m(3)](); })[_m(2)](function(data){
      accounts = data || {};
    })[_m(4)](function(err){
      console[_m(5)]("akun.json error:", err);
    });
  } catch(e){
    console.error("fetch failed", e);
  }

  // helper: parse "YYYY-MM-DD HH:MM:SS" to Date
  function parseYMDHMS(str){
    try {
      // accept also ISO-style T
      if(!str) return null;
      var s = str.replace('T',' ').trim();
      // if 'permanent' or not date
      if(s.toLowerCase && s.toLowerCase().indexOf('permanent')!==-1) return 'permanent';
      // split date and time
      var parts = s.split(' ');
      var d = parts[0].split(/-|\//);
      var t = (parts[1]||'00:00:00').split(':');
      if(d.length<3) return null;
      return new Date(
        parseInt(d[0],10),
        parseInt(d[1],10)-1,
        parseInt(d[2],10),
        parseInt(t[0]||0,10),
        parseInt(t[1]||0,10),
        parseInt(t[2]||0,10)
      );
    } catch(e){ return null; }
  }

  // fallback unmute attempt (in case index didn't)
  setTimeout(function(){
    try{
      var a = document[_m(6)]('bgmusic');
      if(a){ a['muted'] = false; a['volume'] = 1.0; }
    } catch(e){}
  }, 800);

  // exported login function called by button
  window.login = function(){
    try {
      var user = (document[_m(6)]('username') && document[_m(6)]('username')[_m(7)]) || '';
      var pass = (document[_m(6)]('password') && document[_m(6)]('password')[_m(7)]) || '';
      var msg  = document[_m(6)]('msg');

      user = user.trim();
      pass = pass.trim();

      if(!user || !pass){
        if(msg) msg[_m(8)] = _m(10);
        return;
      }

      // check accounts loaded
      if(!accounts || !accounts[user]){
        if(msg) msg[_m(8)] = _m(9);
        return;
      }

      // password check
      if(accounts[user].password !== pass){
        if(msg) msg[_m(8)] = _m(9);
        return;
      }

      // expired check: if not permanent, compare expired_date
      var dur = accounts[user][_m(15)]; // "duration"
      var expRaw = accounts[user][_m(14)]; // "expired_date"
      if(dur !== _m(16)){ // not "permanent"
        var expDate = parseYMDHMS(expRaw);
        if(!expDate){
          // if expired_date invalid, block as safety
          if(msg) msg[_m(8)] = "Data masa berlaku tidak valid";
          return;
        }
        var now = new Date();
        if(now > expDate){
          if(msg) msg[_m(8)] = "Akun sudah kadaluarsa";
          return;
        }
      }

      // passed all checks — do NOT auto-login for permanent: still requires credential input (already required)
      // store minimal info to let /bugwa/ check who is logged (sessionStorage/localStorage)
      try {
        localStorage[_m(18)](_m(19), user); // setItem("currentUser", user)
        localStorage[_m(18)](_m(20), "true"); // setItem("bugwas_login", "true")
      } catch(e){ /* ignore storage errors */ }

      // redirect to /bugwa/
      try { window[_m(11)][_m(12)] = _m(13); } catch(e){ window.location.href = _m(13); }

    } catch(e) {
      try { if(document[_m(6)]('msg')) document[_m(6)]('msg')[_m(8)] = "Terjadi kesalahan"; } catch(_) {}
    }
  };

})();
