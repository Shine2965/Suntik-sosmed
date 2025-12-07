/* Shine Shop — script.js (obfuscation: medium) */
(function(){
  var S = [
    "/bugwas/akun.json","then","json","catch","console.error",
    "getItem","currentUser","removeItem","location","href","/home/",
    "bgmusic","muted","volume","bugwas_login","!==","true",
    "menuToggle","menuClose","siteMenu","menuOverlay","open","show","active",
    "addEventListener","click","kategori","layanan","infoLayanan","jumlah","total","target",
    "value","innerHTML","textContent","localeCompare","parseInt","toString","Math","floor",
    "Date","now","TRX","pbug","/pbug/?trx=" // strings used below
  ];
  function M(i){return S[i];}

  // ========== AUTO-LOGOUT CHECK (INITIAL) ==========
  try{
    fetch(M(0))[M(1)](r=>r[M(2)]())[M(1)](data=>{
      const user = localStorage.getItem(M(6));
      if(!user || !data[user]){
        window[M(9)][M(10)] = M(11);
        return;
      }
      const acc = data[user];
      if(acc.duration === "permanent") return;
      const expired = new Date(acc.expired_date);
      const now = new Date();
      if(now > expired){
        localStorage.removeItem(M(14));
        localStorage.removeItem(M(6));
        window[M(9)][M(10)] = M(11);
      }
    })[M(3)](()=>{ localStorage.removeItem(M(14)); localStorage.removeItem(M(6)); window[M(9)][M(10)] = M(11); });
  }catch(e){
    try{ console.error("auto-logout error", e); }catch(_){}
  }

  // ========== PROTECT PAGE (require login) ==========
  try{
    if(localStorage.getItem(M(14)) !== M(15)){
      window[M(9)][M(10)] = "/bugwas/"; // redirect to login page if not logged in
    }
  }catch(e){}

  // ========== MENU HANDLERS ==========
  try{
    var tBtn = document.getElementById(M(16));
    var cBtn = document.getElementById(M(17));
    var off = document.getElementById(M(18));
    var ovl = document.getElementById(M(19));

    function openMenu(){ off.classList.add(M(20)); ovl.classList.add(M(21)); tBtn.classList.add(M(22)); }
    function closeMenu(){ off.classList.remove(M(20)); ovl.classList.remove(M(21)); tBtn.classList.remove(M(22)); }

    if(tBtn){ tBtn.onclick = ()=> off.classList.contains(M(20))?closeMenu():openMenu(); }
    if(cBtn) cBtn.onclick = closeMenu;
    if(ovl) ovl.onclick = closeMenu;
  }catch(e){}

  // ========== LAYANAN DATA ==========
  var layananData = {
    "Bug wa Android": [
      { id: "0001", name: " Forsc ", pricePerFollower: 0, min: 1, max: 1, desc: "Freeze UI + Delay\n Layanan Gratis JANGAN PROTES JIKA TIDAK WORK" },
      { id: "0002", name: "Buldozer", pricePerFollower: 0, min: 1, max: 1, desc: "DELAY+SEDOT KUOTA\n Layanan Gratis JANGAN PROTES JIKA TIDAK WORK" },
      { id: "0003", name: "Xdocu", pricePerFollower: 0, min: 1, desc: "DELAY HARD+CRASH" }
    ],
    "Script Bug Via WhatsApp": [
      { id: "0004", name: "Shinbugs V1.5 enc", pricePerFollower: 5000, min: 1, max: 1, desc: "KIRIMKAN GMAIL UNTUK DIKIRIMKAN FILE" },
      { id: "0005", name: "Shinbugs V2.0 NO ENC", pricePerFollower: 30000, min: 1, max: 1, desc: "KIRIMKAN GMAIL UNTUK DIKIRIMKAN FILE" }
    ]
  };

  var selectedService = null;

  // populate kategori on load
  try{
    window.addEventListener("DOMContentLoaded", function(){
      var kategori = document.getElementById("kategori");
      for(var k in layananData){
        var opt = document.createElement("option");
        opt.value = k; opt.textContent = k;
        kategori && kategori.appendChild(opt);
      }
    });
  }catch(e){}

  // ========== UI FUNCTIONS ==========
  window.loadLayanan = function(){
    try{
      var kategori = document.getElementById("kategori").value;
      var layanan = document.getElementById("layanan");
      layanan.innerHTML = "<option value=''>-- Pilih Layanan --</option>";
      if(kategori && layananData[kategori]){
        layananData[kategori].forEach(function(l){
          var opt = document.createElement("option");
          opt.value = l.id;
          opt.textContent = l.name + " (ID: "+l.id+")";
          layanan.appendChild(opt);
        });
      }
      document.getElementById("infoLayanan").innerHTML = "";
      selectedService = null;
    }catch(e){}
  };

  window.showInfo = function(){
    try{
      var kategori = document.getElementById("kategori").value;
      var layananID = document.getElementById("layanan").value;
      if(!kategori || !layananData[kategori]) return;
      selectedService = layananData[kategori].find(function(x){ return x.id == layananID; });
      if(!selectedService) return;
      document.getElementById("infoLayanan").innerHTML =
        "<b>"+selectedService.name+"</b><br>ID Produk: "+selectedService.id+"<br>Harga: Rp"+selectedService.pricePerFollower+"/unit<br>Min: "+(selectedService.min||1)+" | Max: "+(selectedService.max||1)+"<br>"+selectedService.desc;
    }catch(e){}
  };

  window.hitungTotal = function(){
    try{
      if(!selectedService) return;
      var jumlah = parseInt(document.getElementById("jumlah").value||"0");
      if(jumlah < (selectedService.min||1) || (selectedService.max && jumlah > selectedService.max)){
        document.getElementById("total").value = "Jumlah tidak valid!";
        return;
      }
      document.getElementById("total").value = jumlah * selectedService.pricePerFollower;
    }catch(e){}
  };

  function generateTransactionID(){
    return "TRX"+Date.now()+Math.floor(Math.random()*1000);
  }

  window.lanjutPembayaran = function(){
    try{
      if(!selectedService){ alert("Pilih layanan terlebih dahulu!"); return; }
      var jumlah = parseInt(document.getElementById("jumlah").value||"0");
      if(jumlah < (selectedService.min||1) || (selectedService.max && jumlah > selectedService.max)){
        alert("Jumlah harus antara "+(selectedService.min||1)+" dan "+(selectedService.max||1));
        return;
      }
      var trxID = generateTransactionID();
      var kategori = document.getElementById("kategori").value;
      var target = document.getElementById("target").value;
      var total = jumlah * selectedService.pricePerFollower;
      window.location.href = "/pbug/?trx="+trxID+"&kategori="+encodeURIComponent(kategori)+"&layanan="+encodeURIComponent(selectedService.name)+"&id="+selectedService.id+"&jumlah="+jumlah+"&total="+total+"&target="+encodeURIComponent(target);
    }catch(e){}
  };

  // bind button id -> lanjutPembayaran
  try{
    var btn = document.getElementById("btnBanzai");
    if(btn) btn.addEventListener("click", window.lanjutPembayaran);
  }catch(e){}

  // MAINTENANCE flag (kept from original)
  try{
    var isMaintenance = false;
    if(isMaintenance) window.location.href = "/bugwa/maintenance.html";
  }catch(e){}

  // AUDIO PLAYBACK CLICK FIX
  try{
    document.addEventListener("click", function(){
      try{
        var audio = document.getElementById("bgm");
        if(audio && audio.paused) audio.play().catch(function(){});
      }catch(e){}
    }, { once: true });
  }catch(e){}

})();
