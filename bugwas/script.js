/* Shine Shop - obfuscation level: medium (string table + mapper) */
(function(){
  // string table
  var _s = [
    "fetch","/bugwas/9AaYq5TS.json","then","json","catch","console.error",
    "getElementById","value","textContent","Username atau password salah!",
    "location","href","/bugwa/","bgmusic","muted","volume","Shine Shop",
    "U2hpbmUgU2hvcA==","setItem","currentUser","bugwas_login"
  ];
  // mapper helper
  function _m(i){ return _s[i]; }

  // embed watermark (base64 decode) - not used, just present
  try {
    var _wm = atob(_m(16)); // "Shine Shop"
    // optional small no-op to keep watermark present
    if(!_wm){} 
  } catch(e){}

  // accounts container
  var accounts = {};

  // load accounts JSON (same-origin)
  try {
    window[_m(6)] = window[_m(6)]; // ensure function present (no-op)
    fetch(_m(1))[_m(2)](function(res){ return res[_m(3)](); })[_m(2)](function(data){
      accounts = data || {};
    })[_m(4)](function(err){
      console[_m(5)]("akun.json error:", err);
    });
  } catch(e){
    console.error("fetch failed", e);
  }

  // unmute fallback (in case index.html didn't)
  setTimeout(function(){
    try{
      var a = document[_m(6)](_m(13));
      if(a){ a[_m(14)] = false; a[_m(15)] = 1.0; }
    }catch(e){}
  },900);

  // exported login function (button onclick calls login())
  window.login = function(){
    try{
      var user = (document[_m(6)]("username") && document[_m(6)]("username")[_m(7)]) || "";
      var pass = (document[_m(6)]("password") && document[_m(6)]("password")[_m(7)]) || "";
      var msg  = document[_m(6)]("msg");
      if(!user || !pass){
        if(msg) msg[_m(8)] = "Masukkan username & password";
        return;
      }
      if(!accounts[user] || accounts[user].password !== pass){
        if(msg) msg[_m(8)] = _m(9);
        return;
      }
      // optional: store current user for other pages
      try {
        localStorage[_m(17)](_m(18), user);
        localStorage[_m(17)](_m(19), "true");
      } catch(e){}
      // redirect to /bugwa/
      window[_m(10)][_m(11)] = _m(12);
    }catch(e){
      try{ if(document[_m(6)]("msg")) document[_m(6)]("msg")[_m(8)] = "Terjadi kesalahan"; }catch(_){}
    }
  };

})();
