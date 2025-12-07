/* ===== Shine Shop - Unified Script - Medium Obfuscation ===== */
(function(){

    const K = [
        "fetch",
        "then","json","catch","log",
        "https://raw.githubusercontent.com/USERNAME/REPO/main/9AaYq5TS.json", // <=== GANTI URL RAW JSON
        "akun.json error:",
        "getItem","setItem","removeItem",
        "currentUser","bugwas_login","membership",
        "username","password","msg","value","textContent",
        "Akun kadaluarsa!","Username atau password salah!",
        "Masukkan username & password!","href","/bugwa/",
        "location","membership",
        "duration","expired_date","permanent","includes",
        "window","localStorage","Date",
        "parse error","redirect",
        "Shine Shop"
    ];

    const G = i => K[i];

    let DB = {};

    /* ============ LOAD JSON via GITHUB RAW ============ */
    window.loadAccounts = function(cb){
        fetch(G(5),{cache:"no-store"})
        [G(1)](r=>r[G(2)]())
        [G(1)](d=>{ DB=d; if(cb) cb(); })
        [G(3)](e=>{ console[G(4)](G(6), e); });
    };

    /* ============ PARSE DATE EXP ============ */
    function PDate(s){
        try{
            if(!s) return null;
            if((s+"")[G(28)](G(27))) return "permanent";
            let a=s.split(" ");
            let d=a[0].split("-");
            let t=(a[1]||"00:00:00").split(":");
            return new Date(d[0],d[1]-1,d[2],t[0],t[1],t[2]);
        }catch(e){
            console[G(4)](G(32), e);
            return null;
        }
    }

    /* ============ LOGIN FUNCTION ============ */
    window.doLogin = function(){
        const u = document.getElementById(G(13))[G(16)].trim();
        const p = document.getElementById(G(14))[G(16)].trim();
        const m = document.getElementById(G(15));

        if(!u || !p){
            if(m) m[G(17)] = G(20);
            return;
        }

        if(!DB[u] || DB[u].password !== p){
            if(m) m[G(17)] = G(19);
            return;
        }

        let dur = DB[u][G(24)];
        let exp = DB[u][G(25)];

        if(dur !== G(27)){
            let x = PDate(exp);
            if(!x || new Date() > x){
                if(m) m[G(17)] = G(18);
                return;
            }
        }

        let level = DB[u][G(23)] || "member";

        try{
            localStorage[G(8)](G(10), u);
            localStorage[G(8)](G(11), "true");
            localStorage[G(8)](G(12), level);
        }catch(e){}

        window[G(29)][G(21)][G(22)] = G(21);
    };

    /* ============ AUTO CHECK SESSION & EXPIRED ============ */
    window.securePage = function(){
        const user = localStorage[G(7)](G(10));
        const ok = localStorage[G(7)](G(11));

        if(!user || ok !== "true"){
            window[G(29)][G(21)][G(22)] = "/home/";
            return;
        }

        loadAccounts(()=>{
            if(!DB[user]){
                localStorage[G(9)](G(10));
                localStorage[G(9)](G(11));
                localStorage[G(9)](G(12));
                window[G(29)][G(21)][G(22)] = "/home/";
                return;
            }

            let acc = DB[user];

            if(acc.duration !== "permanent"){
                let ex = PDate(acc.expired_date);
                if(!ex || new Date() > ex){
                    localStorage[G(9)](G(10));
                    localStorage[G(9)](G(11));
                    localStorage[G(9)](G(12));
                    window[G(29)][G(21)][G(22)] = "/home/";
                }
            }
        });
    };

    /* ============ MEMBERSHIP PANEL HANDLER ============ */
    window.loadMembershipUI = function(){
        let lv = localStorage.getItem("membership");

        const memPanel = document.getElementById("panel-member");
        const resPanel = document.getElementById("panel-reseller");
        const ownPanel = document.getElementById("panel-owner");

        if(memPanel) memPanel.style.display = "none";
        if(resPanel) resPanel.style.display = "none";
        if(ownPanel) ownPanel.style.display = "none";

        if(lv === "member"){
            if(memPanel) memPanel.style.display = "block";
        }
        if(lv === "resseler"){
            if(resPanel) resPanel.style.display = "block";
        }
        if(lv === "own"){
            if(ownPanel) ownPanel.style.display = "block";
            if(resPanel) resPanel.style.display = "block";
        }
    };

})();
