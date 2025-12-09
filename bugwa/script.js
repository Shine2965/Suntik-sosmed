/* Shine Shop — script.fixed.js (obfuscation: medium, repaired) */
(function(){
  var S = [
    "/bugwas/akun.json", //0
    "then",              //1
    "json",              //2
    "catch",             //3
    "console.error",     //4
    "getItem",           //5
    "currentUser",       //6
    "removeItem",        //7
    "location",          //8
    "href",              //9
    "/home/",            //10
    "bgm",               //11  // audio element id
    "muted",             //12
    "volume",            //13
    "bugwas_login",      //14
    "true",              //15
    "menuToggle",        //16
    "menuClose",         //17
    "siteMenu",          //18
    "menuOverlay",       //19
    "open",              //20
    "show",              //21
    "active",            //22
    "addEventListener",  //23
    "click",             //24
    "kategori",          //25
    "layanan",           //26
    "infoLayanan",       //27
    "jumlah",            //28
    "total",             //29
    "target",            //30
    "value",             //31
    "innerHTML",         //32
    "textContent",       //33
    "localeCompare",     //34
    "parseInt",          //35
    "toString",          //36
    "Math",              //37
    "floor",             //38
    "Date",              //39
    "now",               //40
    "TRX",               //41
    "pbug",              //42
    "/pbug/?trx="        //43
  ];
  function M(i){return S[i];}

  // ========== AUTO-LOGOUT CHECK (INITIAL) ==========
  try{
    fetch(M(0))[M(1)](function(r){ return r[M(2)](); })
    [M(1)](function(data){
      try{
        var user = localStorage.getItem(M(6));
        if(!user || !data || !data[user]){
          window[M(8)][M(9)] = M(10);
          return;
        }
        var acc = data[user];
        if(acc && acc.duration === "permanent") return;
        var expired = new Date(acc.expired_date);
        var now = new Date();
        if(now > expired){
          localStorage.removeItem(M(14));
          localStorage.removeItem(M(6));
          window[M(8)][M(9)] = M(10);
        }
      }catch(e){ try{ console.error('auto-logout inner error', e); }catch(_){} }
    })[M(3)](function(e){ try{ localStorage.removeItem(M(14)); localStorage.removeItem(M(6)); window[M(8)][M(9)] = M(10); }catch(_){}});
  }catch(e){ try{ console.error('auto-logout error', e); }catch(_){}}

  // ========== PROTECT PAGE (require login) ==========
  try{
    if(localStorage.getItem(M(14)) !== M(15)){
      window[M(8)][M(9)] = "/bugwas/"; // redirect to login page if not logged in
    }
  }catch(e){}

  // ========== MENU HANDLERS ==========
  try{
    var tBtn = document.getElementById(M(16));
    var cBtn = document.getElementById(M(17));
    var off = document.getElementById(M(18));
    var ovl = document.getElementById(M(19));

    function openMenu(){ if(off) off.classList.add(M(20)); if(ovl) ovl.classList.add(M(21)); if(tBtn) tBtn.classList.add(M(22)); }
    function closeMenu(){ if(off) off.classList.remove(M(20)); if(ovl) ovl.classList.remove(M(21)); if(tBtn) tBtn.classList.remove(M(22)); }

    if(tBtn) tBtn.onclick = function(){ return off && off.classList.contains(M(20))? closeMenu() : openMenu(); };
    if(cBtn) cBtn.onclick = closeMenu;
    if(ovl) ovl.onclick = closeMenu;
  }catch(e){}

  // ========== LAYANAN DATA ==========
  var layananData = {
    "Bug wa Android": [
      { id: "0001", name: "Bug Android", pricePerFollower: 0, min: 1, max: 1, desc: "bug yang dikirim random bisa delay, forclose, crash/blank ui" }
    ],
    "Bug wa IOS": [
      { id: "0002", name: "Bug IOS/IPHONE", pricePerFollower: 0, min: 1, max: 1, desc: "bug yang dikirim random bisa delay, forclose, crash/blank ui" }
    ]
  };

  var selectedService = null;

  // populate kategori on load
  try{
    window.addEventListener("DOMContentLoaded", function(){
      try{
        var kategoriEl = document.getElementById(M(25));
        if(!kategoriEl){ console.error('Element with id "kategori" not found. Make sure <select id="kategori"> exists.'); return; }
        // clear existing
        kategoriEl.innerHTML = "<option value=''>-- Pilih Kategori --</option>";
        for(var k in layananData){
          if(!layananData.hasOwnProperty(k)) continue;
          var opt = document.createElement('option');
          opt.value = k; opt.textContent = k;
          kategoriEl.appendChild(opt);
        }

        // ensure layanan select exists and has default
        var layananEl = document.getElementById(M(26));
        if(layananEl) layananEl.innerHTML = "<option value=''>-- Pilih Layanan --</option>";

        // attach onchange to kategori if not present in HTML
        if(kategoriEl){
          kategoriEl.addEventListener('change', function(){ try{ window.loadLayanan(); }catch(e){console.error('loadLayanan error',e);} });
        }

      }catch(e){ console.error('Error saat render kategori:', e); }
    });
  }catch(e){}

  // ========== UI FUNCTIONS ==========
  window.loadLayanan = function(){
    try{
      var kategori = document.getElementById(M(25));
      if(!kategori) return;
      var kategoriVal = kategori.value;
      var layanan = document.getElementById(M(26));
      if(!layanan) return;
      layanan.innerHTML = "<option value=''>-- Pilih Layanan --</option>";
      if(kategoriVal && layananData[kategoriVal]){
        layananData[kategoriVal].forEach(function(l){
          var opt = document.createElement('option');
          opt.value = l.id;
          opt.textContent = l.name + " (ID: "+l.id+")";
          layanan.appendChild(opt);
        });
      }
      var info = document.getElementById(M(27)); if(info) info.innerHTML = "";
      selectedService = null;
    }catch(e){ console.error('loadLayanan error', e); }
  };

  window.showInfo = function(){
    try{
      var kategori = document.getElementById(M(25)).value;
      var layananID = document.getElementById(M(26)).value;
      if(!kategori || !layananData[kategori]) return;
      selectedService = layananData[kategori].find(function(x){ return x.id == layananID; });
      if(!selectedService) return;
      var infoEl = document.getElementById(M(27));
      if(!infoEl) return;
      infoEl.innerHTML = "<b>"+selectedService.name+"</b><br>ID Produk: "+selectedService.id+"<br>Harga: Rp"+selectedService.pricePerFollower+"/unit<br>Min: "+(selectedService.min||1)+" | Max: "+(selectedService.max||1)+"<br>"+selectedService.desc;
    }catch(e){ console.error('showInfo error', e); }
  };

  window.hitungTotal = function(){
    try{
      if(!selectedService) return;
      var jumlah = parseInt(document.getElementById(M(28)).value||"0", 10);
      if(jumlah < (selectedService.min||1) || (selectedService.max && jumlah > selectedService.max)){
        var t = document.getElementById(M(29)); if(t) t.value = "Jumlah tidak valid!";
        return;
      }
      var totalEl = document.getElementById(M(29)); if(totalEl) totalEl.value = jumlah * selectedService.pricePerFollower;
    }catch(e){ console.error('hitungTotal error', e); }
  };

  function generateTransactionID(){
    return M(41) + Date.now().toString() + Math.floor(Math.random()*1000).toString();
  }

  window.lanjutPembayaran = function(){
    try{
      if(!selectedService){ alert("Pilih layanan terlebih dahulu!"); return; }
      var jumlah = parseInt(document.getElementById(M(28)).value||"0", 10);
      if(jumlah < (selectedService.min||1) || (selectedService.max && jumlah > selectedService.max)){
        alert("Jumlah harus antara "+(selectedService.min||1)+" dan "+(selectedService.max||1));
        return;
      }
      var trxID = generateTransactionID();
      var kategori = document.getElementById(M(25)).value;
      var target = document.getElementById(M(30)).value || '';
      var total = jumlah * selectedService.pricePerFollower;
      window.location.href = M(43)+trxID+"&kategori="+encodeURIComponent(kategori)+"&layanan="+encodeURIComponent(selectedService.name)+"&id="+selectedService.id+"&jumlah="+jumlah+"&total="+total+"&target="+encodeURIComponent(target);
    }catch(e){ console.error('lanjutPembayaran error', e); }
  };

  // bind button id -> lanjutPembayaran
  try{
    var btn = document.getElementById('btnBanzai');
    if(btn) btn.addEventListener('click', window.lanjutPembayaran);
  }catch(e){}

  // MAINTENANCE flag (kept from original)
  try{
    var isMaintenance = false;
    if(isMaintenance) window.location.href = "/bugwa/maintenance.html";
  }catch(e){}

  // AUDIO PLAYBACK CLICK FIX
  try{
    document.addEventListener('click', function(){
      try{
        var audio = document.getElementById(M(11));
        if(audio && audio.paused) audio.play().catch(function(){});
      }catch(e){}
    }, { once: true });
  }catch(e){}

})();
