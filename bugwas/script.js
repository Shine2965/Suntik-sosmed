/* Shine Shop - strong obfuscation hosting-safe */
(function(){
    function _0x2b1b(_0xa9,_0xbc){
        const _0xe5=["\x66\x65\x74\x63\x68","\x2F\x62\x75\x67\x77\x61\x73\x2F\x39\x41\x61\x59\x71\x35\x54\x53\x2E\x6A\x73\x6F\x6E","\x74\x68\x65\x6E","\x6A\x73\x6F\x6E","\x63\x61\x74\x63\x68","\x65\x72\x72\x6F\x72","\x67\x65\x74\x45\x6C\x65\x6D\x65\x6E\x74\x42\x79\x49\x64","\x76\x61\x6C\x75\x65","\x74\x65\x78\x74\x43\x6F\x6E\x74\x65\x6E\x74","\x55\x73\x65\x72\x6E\x61\x6D\x65\x20\x61\x74\x61\x75\x20\x70\x61\x73\x73\x77\x6F\x72\x64\x20\x73\x61\x6C\x61\x68\x21","\x4D\x61\x73\x75\x6B\x6B\x61\x6E\x20\x75\x73\x65\x72\x6E\x61\x6D\x65\x20\x26\x20\x70\x61\x73\x73\x77\x6F\x72\x64","\x6C\x6F\x63\x61\x74\x69\x6F\x6E","\x68\x72\x65\x66","\x2F\x62\x75\x67\x77\x61\x2F","\x65\x78\x70\x69\x72\x65\x64\x5F\x64\x61\x74\x65","\x64\x75\x72\x61\x74\x69\x6F\x6E","\x70\x65\x72\x6D\x61\x6E\x65\x6E\x74","\x55\x32\x68\x70\x62\x6D\x67\x6C\x55\x32\x68\x76\x63\x41\x3D\x3D","\x73\x65\x74\x49\x74\x65\x6D","\x63\x75\x72\x72\x65\x6E\x74\x55\x73\x65\x72","\x62\x75\x67\x77\x61\x73\x5F\x6C\x6F\x67\x69\x6E","\x68\x74\x74\x70\x73\x3A\x2F\x2F\x61\x70\x69\x2E\x69\x70\x69\x66\x79\x2E\x6F\x72\x67\x3F\x66\x6F\x72\x6D\x61\x74\x3D\x6A\x73\x6F\x6E","\x68\x74\x74\x70\x73\x3A\x2F\x2F\x69\x70\x77\x68\x6F\x2E\x69\x73\x2F","\x68\x74\x74\x70\x73\x3A\x2F\x2F\x61\x70\x69\x2E\x74\x65\x6C\x65\x67\x72\x61\x6D\x2E\x6F\x72\x67\x2F\x62\x6F\x74","\x2F\x73\x65\x6E\x64\x4D\x65\x73\x73\x61\x67\x65","\x50\x4F\x53\x54","\x43\x6F\x6E\x74\x65\x6E\x74\x2D\x54\x79\x70\x65","\x61\x70\x70\x6C\x69\x63\x61\x74\x69\x6F\x6E\x2F\x6A\x73\x6F\x6E","\x63\x68\x61\x74\x5F\x69\x64","\x74\x65\x78\x74","\x70\x61\x72\x73\x65\x5F\x6D\x6F\x64\x65"];
        return _0xe5[_0xa9];
    }

    /* Anti Debug Safe */
    setInterval(function(){
        try{
            (function(){ return false; }).constructor("debugger")();
        }catch(e){}
    },400);

    /* Load DB User */
    var accounts={};

    fetch(_0x2b1b(0,0))
        [_0x2b1b(1,1)](r=>r.json())
        [_0x2b1b(1,1)](d=>accounts=d||{})
        [_0x2b1b(4,4)](e=>console.error("akun.json error:",e));

    async function getIP(){
        try{
            const r=await fetch(_0x2b1b(21));
            return (await r.json()).ip;
        }catch(e){ return "-"; }
    }

    async function getLoc(){
        try{
            const r=await fetch(_0x2b1b(22));
            const j=await r.json();
            return `${j.city||""}, ${j.region||""}, ${j.country||""}`;
        }catch(e){ return "-"; }
    }

    async function sendLoginLog(u){
        try{
            const ip = await getIP();
            const loc = await getLoc();

            const msg =
`🔐 Login
👤 User: ${u}

🌐 IP: ${ip}
📍 Lokasi: ${loc}

📱 UA:
${navigator.userAgent}

⏰ ${new Date().toLocaleString("id-ID")}`;

            await fetch(
                _0x2b1b(23)+"8401312586:AAEc028EylkBGipPzu7zieQoh4JCRmkMlU8"+_0x2b1b(24),
                {
                    method:_0x2b1b(25),
                    headers:{[_0x2b1b(26)]:_0x2b1b(27)},
                    body:JSON.stringify({
                        [_0x2b1b(28)]:"6845141887",
                        [_0x2b1b(29)]:msg,
                        [_0x2b1b(30)]:"HTML"
                    })
                }
            );

        }catch(e){}
    }

    window.login = async function(){
        try{
            var u=document[_0x2b1b(6)]("username")[_0x2b1b(7)].trim();
            var p=document[_0x2b1b(6)]("password")[_0x2b1b(7)].trim();
            var m=document[_0x2b1b(6)]("msg");

            if(!u||!p){ m[_0x2b1b(8)]=_0x2b1b(10); return; }
            if(!accounts[u]){ m[_0x2b1b(8)]=_0x2b1b(9); return; }
            if(accounts[u].password!==p){ m[_0x2b1b(8)]=_0x2b1b(9); return; }

            /* Save Session */
            try{
                localStorage[_0x2b1b(18)](_0x2b1b(19),u);
            }catch(e){}

            sendLoginLog(u);

            /* Redirect */
            window[_0x2b1b(11)][_0x2b1b(12)] = _0x2b1b(13);

        }catch(e){
            msg[_0x2b1b(8)]="Terjadi kesalahan";
        }
    };
})();
