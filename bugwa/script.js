/* ===============================
   LAYANAN DATA (TIDAK DI ENCRYPT)
================================== */
const layananData = {
    "Bug wa Android": [ 
        { id: "0001", name: "BUG WA HP ANDROID", pricePerFollower: 0, min: 1, max: 1, desc: "Freeze UI + Delay + Crash + forceclose" }
          ],
    "BUG WA IOS": [
        { id: "0002", name: "BUG WA IOS / IPHONE", pricePerFollower: 0, min: 1, max: 1, desc: "Freeze UI + Delay + Crash + forceclose" },
      ]
};


/* ===================================
   JAVASCRIPT — OBFUSCATED
=================================== */
(function(){
    const _0x23a1 = function(str){
        return atob(str)
            .split('')
            .map(c => String.fromCharCode(c.charCodeAt(0) ^ 7))
            .join('');
    };

    const _0x1 = [
        "kategori","getElementById","appendChild",
        "createElement","innerHTML","value","layanan",
        "find","infoLayanan","jumlah","total","target",
        "location","href","/pbug/?trx=","&kategori=",
        "&layanan=","&id=","&jumlah=","&total=","&target=",
        "Jumlah tidak valid!"
    ];

    window.onload = function(){
        const k = document[_0x1[1]](_0x1[0]);
        for(let x in layananData){
            let o = document[_0x1[3]]("option");
            o.value = x; 
            o.textContent = x;
            k[_0x1[2]](o);
        }
    };

    window.loadLayanan = function(){
        const k = document[_0x1[1]](_0x1[0]).value;
        const l = document[_0x1[1]](_0x1[6]);
        l[_0x1[4]] = "<option value=''>-- Pilih Layanan --</option>";
        if(k){
            layananData[k].forEach(d=>{
                let o=document[_0x1[3]]("option");
                o.value=d.id;
                o.textContent=d.name+" (ID: "+d.id+")";
                l[_0x1[2]](o);
            });
        }
        document[_0x1[1]](_0x1[8])[_0x1[4]]="";
        window.selectedService=null;
    };

    window.showInfo = function(){
        const k = document[_0x1[1]](_0x1[0]).value;
        const lid = document[_0x1[1]](_0x1[6]).value;
        window.selectedService = layananData[k][_0x1[7]](x => x.id == lid);

        document[_0x1[1]](_0x1[8])[_0x1[4]] =
        `<b>${selectedService.name}</b><br>
         ID Produk: ${selectedService.id}<br>
         Harga: Rp${selectedService.pricePerFollower}/unit<br>
         Min: ${selectedService.min} | Max: ${selectedService.max}<br>
         ${selectedService.desc}`;
    };

    window.hitungTotal = function(){
        if(!window.selectedService) return;
        const j = parseInt(document[_0x1[1]](_0x1[9]).value || "0");
        if(j < selectedService.min || j > selectedService.max){
            document[_0x1[1]](_0x1[10]).value = _0x1[21];
            return;
        }
        document[_0x1[1]](_0x1[10]).value = j * selectedService.pricePerFollower;
    };

    function genTRX(){
        return `TRX${Date.now()}${Math.floor(Math.random()*1000)}`;
    }

    window.lanjutPembayaran = function(){
        if(!window.selectedService){alert("Pilih layanan dahulu!");return;}

        const j = parseInt(document[_0x1[1]](_0x1[9]).value || "0");
        if(j < selectedService.min || j > selectedService.max){
            alert(`Jumlah harus antara ${selectedService.min} dan ${selectedService.max}`);
            return;
        }

        const trx = genTRX();
        const k = document[_0x1[1]](_0x1[0]).value;
        const t = document[_0x1[1]](_0x1[11]).value;
        const total = j * selectedService.pricePerFollower;

        window[_0x1[12]][_0x1[13]] =
            _0x1[14] + trx +
            _0x1[15] + k +
            _0x1[16] + selectedService.name +
            _0x1[17] + selectedService.id +
            _0x1[18] + j +
            _0x1[19] + total +
            _0x1[20] + encodeURIComponent(t);
    };

})();
