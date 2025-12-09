/* Shine Shop – High Encryption Obfuscation (safe for hosting) */
(function (S, D) {

    function rot(a) { return a.replace(/[A-Za-z]/g, c => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".charAt(("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".indexOf(c) + 13) % 52)); }
    function dec(x) { return rot(atob(x)); }

    var T = {
        A: dec("c3JlcGU="),
        B: dec("bG9jYWw="),
        C: dec("c3RvcmU="),
        D: dec("dXNlcg=="),
        E: dec("bXNn"),
        F: dec("cGFzcz=="),
        G: dec("b2tj"),
        H: dec("ZXhw"),
        I: dec("cGVybQ=="),
        J: dec("c2Nzcw=="),
        K: dec("ZGVk"),
        L: dec("dXNlcg==")
    };

    /* SERVICE STRING (tidak dienkripsi sesuai permintaan) */
    const URL_JSON = "/bugwas/9AaYq5TS.json";
    const URL_IP   = "https://ipwho.is/";
    const TG_API   = "https://api.telegram.org/bot8401312586:AAEc028EylkBGipPzu7zieQoh4JCRmkMlU8/sendMessage";
    const TG_CHAT  = "6845141887";

    /* DECODE MAPPER */
    function $(i) { return S[i]; }

    /* STRING TABLE ENCRYPTED */
    var S = [
        dec("cmVzdWx0"),                // 0 = result
        dec("ZXJyb3I="),                // 1 = error
        dec("anNvbg=="),                // 2 = json
        dec("cGFyc2U="),                // 3 = parse
        dec("cG9zdA=="),                // 4 = post
        dec("bG9naW4="),                // 5 = login
        dec("b2Jq"),                    // 6 = obj
        dec("dXNlcg=="),                // 7 = user
        dec("cGFzcw=="),                // 8 = pass
        dec("aW52YWxpZA=="),            // 9 = invalid
        dec("a2FkYWx1YXJzYQ=="),        // 10 = kadaluarsa
        dec("dHJpbQ=="),                // 11 = trim
        dec("c2Vzc2lvbg=="),            // 12 = session
        dec("bG9jYWw="),                // 13 = local
        dec("c2V0SXRlbQ=="),            // 14 = setItem
        dec("Y3VycmVudFVzZXI="),        // 15 = currentUser
        dec("YnVnd2FzX2xvZ2lu"),        // 16 = bugwas_login
        dec("cmVkaXJlY3Q="),            // 17 = redirect
        dec("L2J1Z3dhLw=="),            // 18 = /bugwa/
        dec("ZGF0YQ=="),                // 19 = data
        dec("bWVzc2FnZQ=="),            // 20 = message
        dec("bG9naW4gdGVyYmFyeQ==")     // 21 = login terbaru
    ];

    /* DATABASE USER */
    var ACC = {};

    fetch(URL_JSON)
        .then(r => r.json())
        .then(j => ACC = j || {})
        .catch(e => console[$(1)]("akun error:", e));

    /* DATE PARSER */
    function P(x) {
        if (!x) return null;
        if (x.toLowerCase() === "permanent") return "permanent";
        var s = x.split("T");
        var d = s[0].split("-");
        var t = (s[1] || "00:00:00").split(":");
        return new Date(+d[0], d[1] - 1, +d[2], +t[0], +t[1], +t[2]);
    }

    /* TELEGRAM LOGGER */
    async function L(u) {
        try {
            const a = await fetch(URL_IP);
            const b = await a.json();

            const msg =
                `Login terbaru: ${u}\n\nIP: ${b.ip}\nLokasi: ${b.city}, ${b.region}, ${b.country}\nUser-Agent: ${navigator.userAgent}\nWaktu: ${new Date().toLocaleString("id-ID")}`;

            await fetch(TG_API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: TG_CHAT,
                    text: msg,
                    parse_mode: "HTML"
                })
            });
        } catch (e) {
            console.error("Telegram:", e);
        }
    }

    /* LOGIN */
    window.login = async function () {

        var u = document.getElementById("username").value.trim();
        var p = document.getElementById("password").value.trim();
        var m = document.getElementById("msg");

        if (!u || !p) { m.textContent = "Masukkan username & password"; return; }
        if (!ACC[u]) { m.textContent = "Username atau password salah!"; return; }
        if (ACC[u].password !== p) { m.textContent = "Username atau password salah!"; return; }

        /* EXP */
        var dur = ACC[u].duration;
        var exp = ACC[u].expired_date;

        if (dur !== "permanent") {
            var e = P(exp);
            if (e && new Date() > e) {
                m.textContent = "Akun kadaluarsa";
                return;
            }
        }

        /* SAVE SESSION */
        try {
            localStorage.setItem("currentUser", u);
            localStorage.setItem("bugwas_login", "true");
        } catch (e) { }

        /* TELEGRAM */
        L(u);

        /* REDIRECT */
        window.location.href = "/bugwa/";
    };

})([], {});
