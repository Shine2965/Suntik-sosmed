/* ===============================
   LAYANAN DATA (TIDAK DI ENCRYPT)
================================== */
const layananData = {
    "Bug wa Android": [ 
        { id: "0001", name: "BUG WA HP ANDROID", pricePerFollower: 0, min: 1, max: 1, desc: "Freeze UI + Delay + Crash + forceclose" }
    ],
    "BUG WA IOS": [
        { id: "0002", name: "BUG WA IOS / IPHONE", pricePerFollower: 0, min: 1, max: 1, desc: "Freeze UI + Delay + Crash + forceclose" }
    ]
};


/* ===================================
   JAVASCRIPT — OBFUSCATED (MEDIUM)
   (dilengkapi & hardening)
=================================== */
(function(){

    const _k = [
        "kategori",        // 0
        "getElementById",  // 1
        "appendChild",     // 2
        "createElement",   // 3
        "innerHTML",       // 4
        "value",           // 5
        "layanan",         // 6
        "find",            // 7
        "infoLayanan",     // 8
        "jumlah",          // 9
        "total",           // 10
        "target",          // 11
        "location",        // 12
        "href",            // 13
        "/pbug/?trx=",     // 14
        "&kategori=",      // 15
        "&layanan=",       // 16
        "&id=",            // 17
        "&jumlah=",        // 18
        "&total=",         // 19
        "&target=",        // 20
        "Jumlah tidak valid!" // 21
    ];

    /* ========== MUAT KATEGORI ========== */
    window.addEventListener("load", function(){
        const kElem = document[_k[1]](_k[0]);
        if(!kElem) return;
        for(let x in layananData){
            let o = document[_k[3]]("option");
            o.value = x;
            o.textContent = x;
            kElem[_k[2]](o);
        }
    });

    /* ========== MUAT LAYANAN ========== */
    window.loadLayanan = function(){
        const kElem = document[_k[1]](_k[0]);
        const lElem = document[_k[1]](_k[6]);

        if(!lElem) return;

        const k = kElem ? kElem[_k[5]] : "";

        lElem[_k[4]] = "<option value=''>-- Pilih Layanan --</option>";

        if(k && layananData[k]){
            layananData[k].forEach(d=>{
                let o = document[_k[3]]("option");
                o.value = d.id;
                o.textContent = d.name + " (ID: " + d.id + ")";
                lElem[_k[2]](o);
            });
        }

        const infoElem = document[_k[1]](_k[8]);
        if(infoElem) infoElem[_k[4]] = "";
        window.selectedService = null;
    };

    /* ========== TAMPILKAN INFO LAYANAN ========== */
    window.showInfo = function(){
        const kElem = document[_k[1]](_k[0]);
        const lElem = document[_k[1]](_k[6]);

        const k = kElem ? kElem[_k[5]] : "";
        const lid = lElem ? lElem[_k[5]] : "";

        const infoElem = document[_k[1]](_k[8]);
        if(!infoElem) return;

        // Proteksi: jika tidak ada kategori / layanan terpilih
        if(!k || !lid || !layananData[k]){
            infoElem[_k[4]] = "";
            window.selectedService = null;
            return;
        }

        window.selectedService = layananData[k][_k[7]](x => x.id == lid) || null;

        if(!window.selectedService){
            infoElem[_k[4]] = "";
            return;
        }

        infoElem[_k[4]] = 
        `<b>${selectedService.name}</b><br>
         ID Produk: ${selectedService.id}<br>
         Harga: Rp${selectedService.pricePerFollower}/unit<br>
         Min: ${selectedService.min} | Max: ${selectedService.max}<br>
         ${selectedService.desc}`;
    };

    /* ========== HITUNG TOTAL ========== */
    window.hitungTotal = function(){
        const totalElem = document[_k[1]](_k[10]);
        const jumlahElem = document[_k[1]](_k[9]);

        if(!totalElem){
            return;
        }

        if(!window.selectedService){
            totalElem.value = "";
            return;
        }

        const j = parseInt(jumlahElem ? (jumlahElem[_k[5]] || "0") : "0", 10);
        if(isNaN(j)){
            totalElem.value = "";
            return;
        }

        if(j < selectedService.min || j > selectedService.max){
            totalElem.value = _k[21];
            return;
        }

        totalElem.value = (j * selectedService.pricePerFollower).toString();
    };

    /* ========== GENERATE TRX ========== */
    function genTRX(){
        return `TRX${Date.now()}${Math.floor(Math.random()*1000)}`;
    }

    /* ========== LANJUT PEMBAYARAN ========== */
    window.lanjutPembayaran = function(){
        if(!window.selectedService){
            alert("Pilih layanan dulu!");
            return;
        }

        const jumlahElem = document[_k[1]](_k[9]);
        const j = parseInt(jumlahElem ? (jumlahElem[_k[5]] || "0") : "0", 10);
        if(isNaN(j)){
            alert("Jumlah tidak valid!");
            return;
        }

        if(j < selectedService.min || j > selectedService.max){
            alert(`Jumlah harus antara ${selectedService.min} dan ${selectedService.max}`);
            return;
        }

        const trx = genTRX();
        const kElem = document[_k[1]](_k[0]);
        const tElem = document[_k[1]](_k[11]);

        const k = kElem ? kElem[_k[5]] : "";
        const t = tElem ? tElem[_k[5]] : "";
        const total = j * selectedService.pricePerFollower;

        // Redirect ke halaman pembayaran dengan parameter
        window[_k[12]][_k[13]] =
            _k[14] + trx +
            _k[15] + encodeURIComponent(k) +
            _k[16] + encodeURIComponent(selectedService.name) +
            _k[17] + encodeURIComponent(selectedService.id) +
            _k[18] + encodeURIComponent(j) +
            _k[19] + encodeURIComponent(total) +
            _k[20] + encodeURIComponent(t);
    };

    /* ========== PASANG EVENT UNTUK BANZAI & INPUT JUMLAH ========== */
    document.addEventListener("DOMContentLoaded", ()=>{
        const btn = document.getElementById("btnBanzai");
        if(btn){
            btn.addEventListener("click", window.lanjutPembayaran);
        }

        const jumlahInput = document.getElementById("jumlah");
        if(jumlahInput){
            jumlahInput.addEventListener("input", window.hitungTotal);
        }

        // optional: jika user mengganti layanan via keyboard/select program, juga update info
        const layananSelect = document.getElementById("layanan");
        if(layananSelect){
            layananSelect.addEventListener("change", window.showInfo);
        }

        const kategoriSelect = document.getElementById("kategori");
        if(kategoriSelect){
            kategoriSelect.addEventListener("change", window.loadLayanan);
        }
    });

})();
