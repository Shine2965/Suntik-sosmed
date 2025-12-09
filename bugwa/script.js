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
    window.onload = function(){
        const k = document[_k[1]](_k[0]);
        for(let x in layananData){
            let o = document[_k[3]]("option");
            o.value = x;
            o.textContent = x;
            k[_k[2]](o);
        }
    };

    /* ========== MUAT LAYANAN ========== */
    window.loadLayanan = function(){
        const k = document[_k[1]](_k[0]).value;
        const l = document[_k[1]](_k[6]);

        l[_k[4]] = "<option value=''>-- Pilih Layanan --</option>";

        if(k){
            layananData[k].forEach(d=>{
                let o = document[_k[3]]("option");
                o.value = d.id;
                o.textContent = d.name + " (ID: " + d.id + ")";
                l[_k[2]](o);
            });
        }

        document[_k[1]](_k[8])[_k[4]] = "";
        window.selectedService = null;
    };

    /* ========== TAMPILKAN INFO LAYANAN ========== */
    window.showInfo = function(){
        const k = document[_k[1]](_k[0]).value;
        const lid = document[_k[1]](_k[6]).value;

        window.selectedService = layananData[k][_k[7]](x => x.id == lid);

        document[_k[1]](_k[8])[_k[4]] = 
        `<b>${selectedService.name}</b><br>
         ID Produk: ${selectedService.id}<br>
         Harga: Rp${selectedService.pricePerFollower}/unit<br>
         Min: ${selectedService.min} | Max: ${selectedService.max}<br>
         ${selectedService.desc}`;
    };

    /* ========== HITUNG TOTAL ========== */
    window.hitungTotal = function(){
        if(!window.selectedService) return;

        const j = parseInt(document[_k[1]](_k[9]).value || "0");

        if(j < selectedService.min || j > selectedService.max){
            document[_k[1]](_k[10]).value = _k[21];
            return;
        }

        document[_k[1]](_k[10]).value = j * selectedService.pricePerFollower;
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

        const j = parseInt(document[_k[1]](_k[9]).value || "0");

        if(j < selectedService.min || j > selectedService.max){
            alert(`Jumlah harus antara ${selectedService.min} dan ${selectedService.max}`);
            return;
        }

        const trx = genTRX();
        const k = document[_k[1]](_k[0]).value;
        const t = document[_k[1]](_k[11]).value;
        const total = j * selectedService.pricePerFollower;

        window[_k[12]][_k[13]] =
            _k[14] + trx +
            _k[15] + k +
            _k[16] + selectedService.name +
            _k[17] + selectedService.id +
            _k[18] + j +
            _k[19] + total +
            _k[20] + encodeURIComponent(t);
    };

})();
