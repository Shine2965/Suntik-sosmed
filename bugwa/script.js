/* Shine Shop — Encrypted Version */
/* Semua terenkripsi kecuali layananData */

(function(){
  "use strict";

  /* ============================
       STRING TABLE ENCRYPTED
     ============================ */

  const ENC = [
    "L2J1Z3dhcy9ha3VuLmpzb24=",
    "YnVnd2FzX2xvZ2lu",
    "Y3VycmVudFVzZXI=",
    "bG9naW5fZnJvbQ==",
    "YXV0aF90b2tlbg==",
    "L2J1Z3dhcy8=",
    "cmVwbGFjZQ==",
    "cmVtb3ZlSXRlbQ==",
    "bG9jYXRpb24=",
    "aHJlZg==",
    "ZXJyb3I=",
    "YWt1bi5qc29uIGZldGNoIGVycm9y",
    "UGlsaWggbGF5YW5hbiBkYWh1bHkgZGlwaWxoYXQu",
    "UGlsaWggbGVuZ2thcCB0ZXJzZWJ1dA==",
    "VVNFUl9FUlJPUg=="
  ];

  const D = i => atob(ENC[i]);

  /* ============================
       CORE PROTECTION (obfuscated)
     ============================ */

  function S(fn){ try{ fn(); }catch(e){ console.error(e); } }

  S(function(){
    fetch(D(0))
      .then(r => r.json())
      .then(data => {
        try {
          const u = localStorage.getItem(D(2));
          const ok = localStorage.getItem(D(1)) === "true";
          const from = localStorage.getItem(D(3));
          const token = localStorage.getItem(D(4));

          if(!u || !data[u]){
            logout();
            return;
          }

          const acc = data[u];

          if(acc.duration !== "permanent"){
            const now = new Date();
            const exp = new Date(acc.expired_date);
            if(now > exp){
              logout();
              return;
            }
          }

          if(acc.token){
            if(!token || token !== acc.token){
              logout();
              return;
            }
          }

          if(!(ok && from === D(5))){
            logout();
            return;
          }

        } catch(e){
          logout();
        }
      })
      .catch(() => {
        console.error(atob("YWt1bi5qc29uIGZldGNoIGVycm9y")); // akun.json fetch error
        logout();
      });

    function logout(){
      ["bugwas_login","currentUser","login_from","auth_token"].forEach(k => {
        try{ localStorage.removeItem(k); }catch(e){}
      });
      location.replace(D(5));
    }
  });

  S(function(){
    const ok = localStorage.getItem(D(1)) === "true";
    const u = localStorage.getItem(D(2));
    const fr = localStorage.getItem(D(3));

    if(!ok || !u || fr !== D(5)){
      ["bugwas_login","currentUser","login_from","auth_token"].forEach(k => {
        try{ localStorage.removeItem(k); }catch(e){}
      });
      location.replace(D(5));
    }
  });

  /* ============================
      TAMPILAN DAN UI OBFUSCATED
     ============================ */

  const $ = id => document.getElementById(id);

  S(() => {
    const t = $("menuToggle"),
          c = $("menuClose"),
          m = $("siteMenu"),
          o = $("menuOverlay");

    function open(){
      m?.classList.add("open");
      o?.classList.add("show");
      t?.classList.add("active");
    }
    function close(){
      m?.classList.remove("open");
      o?.classList.remove("show");
      t?.classList.remove("active");
    }

    t?.addEventListener("click", ()=> m.classList.contains("open") ? close() : open());
    c?.addEventListener("click", close);
    o?.addEventListener("click", close);
  });

  /* =========================================================
      BAGIAN INI TIDAK DIENKRIP — sesuai permintaan pengguna
     ========================================================= */

  const layananData = {
    "Bug wa Android": [
      { id: "0001", name: "Bug Android", pricePerFollower: 0, min: 1, max: 1, desc: "Bug random delay / force close / blank UI." }
    ],
    "Bug wa IOS": [
      { id: "0002", name: "Bug IOS/iPhone", pricePerFollower: 0, min: 1, max: 1, desc: "Bug random delay / force close / blank UI." }
    ]
  };

  /* =========================================================
      MELANJUTKAN ENKRIPSI/OBFUSKASI
     ========================================================= */

  let selected = null;

  document.addEventListener("DOMContentLoaded", () => {
    S(() => {
      const k = $("kategori");
      if(!k) return;
      k.innerHTML = "<option value=''>-- Pilih Kategori --</option>";
      Object.keys(layananData).forEach(cat => {
        const o = document.createElement("option");
        o.value = cat;
        o.textContent = cat;
        k.appendChild(o);
      });
    });
  });

  window.loadLayanan = function(){
    S(()=>{
      const k = $("kategori")?.value || "";
      const l = $("layanan");
      if(!l) return;

      l.innerHTML = "<option value=''>-- Pilih Layanan --</option>";

      if(k && layananData[k]){
        layananData[k].forEach(v=>{
          const o = document.createElement("option");
          o.value = v.id;
          o.textContent = v.name + " (ID: " + v.id + ")";
          l.appendChild(o);
        });
      }

      $("infoLayanan").innerHTML = "";
      selected = null;
    });
  };

  window.showInfo = function(){
    S(()=>{
      const k = $("kategori")?.value || "";
      const id = $("layanan")?.value || "";
      if(!layananData[k]) return;

      selected = layananData[k].find(v => v.id === id);
      if(!selected) return;

      $("infoLayanan").innerHTML =
        `<b>${selected.name}</b><br>
        ID Produk: ${selected.id}<br>
        Harga: Rp${selected.pricePerFollower}/unit<br>
        Min: ${selected.min} | Max: ${selected.max}<br>
        ${selected.desc}`;
    });
  };

  window.hitungTotal = function(){
    S(()=>{
      if(!selected) return;
      const j = parseInt($("jumlah")?.value || "0") || 0;

      if(j < selected.min || (selected.max && j > selected.max)){
        $("total").value = "Jumlah tidak valid!";
        return;
      }

      $("total").value = j * selected.pricePerFollower;
    });
  };

  function genTrx(){
    return "TRX" + Date.now() + Math.floor(Math.random()*999);
  }

  window.lanjutPembayaran = function(){
    S(()=>{
      if(!selected){ alert("Pilih layanan terlebih dahulu!"); return; }
      const j = parseInt($("jumlah")?.value || "0") || 0;

      if(j < selected.min || (selected.max && j > selected.max)){
        alert("Jumlah harus antara " + selected.min + " dan " + selected.max);
        return;
      }

      const trx = genTrx();
      const k = encodeURIComponent($("kategori")?.value || "");
      const ln = encodeURIComponent(selected.name);
      const id = encodeURIComponent(selected.id);
      const t = encodeURIComponent($("target")?.value || "");
      const total = j * selected.pricePerFollower;

      location.href =
        "/pbug/?trx=" + trx +
        "&kategori=" + k +
        "&layanan=" + ln +
        "&id=" + id +
        "&jumlah=" + j +
        "&total=" + total +
        "&target=" + t;
    });
  };

  $("btnBanzai")?.addEventListener("click", window.lanjutPembayaran);

  document.addEventListener("click", ()=>{
    const a = $("bgm");
    if(a && a.paused) a.play().catch(()=>{});
  }, { once: true });

})();
