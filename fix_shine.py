#!/usr/bin/env python3
"""
Patch otomatis untuk halaman Shine Shop (/home/index.html).

Pemakaian:
    python3 fix_shine.py index.html
Hasil:
    index.fixed.html  (file asli tidak diubah, backup tidak diperlukan)
"""
import re
import sys

if len(sys.argv) < 2:
    print("Pemakaian: python3 fix_shine.py <file.html>")
    sys.exit(1)

src = sys.argv[1]
out = re.sub(r"\.html?$", "", src) + ".fixed.html"

with open(src, "r", encoding="utf-8") as f:
    code = f.read()

report = []


def apply(name, pattern, repl, flags=0, literal=False):
    global code
    if literal:
        n = code.count(pattern)
        code = code.replace(pattern, repl)
    else:
        code, n = re.subn(pattern, lambda m: repl, code, flags=flags)
    report.append((name, n))


# 1. async async -> async
apply("async async (SyntaxError)", r"\basync\s+async\b", "async")

# 2. else tanpa kurung kurawal di initRealtimePresence (SyntaxError)
fixed_subscribe = """.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      onlineUsersMap[currentUser.id] = true;
      presenceUsersCache[currentUser.id] = { user_id: currentUser.id, email: currentUser.email, role: currentProfile?.role || 'user', is_online: true, last_seen: new Date().toISOString() };
      updateOnlineCounter();
      await presenceChannelRealtime.track({ user_id: currentUser.id, email: currentUser.email, role: currentProfile?.role || 'user', joined_at: new Date().toISOString() });
    } else if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) {
      setTimeout(initRealtimePresence, 3000);
    }
  });"""
apply(
    "initRealtimePresence subscribe (SyntaxError)",
    r"\.subscribe\(async \(status\) => \{ if \(status === 'SUBSCRIBED'\) onlineUsersMap\[currentUser\.id\] = true;.*?setTimeout\(initRealtimePresence, 3000\); \}\);",
    fixed_subscribe,
    flags=re.DOTALL,
)

# 3. variabel `found` tidak ada (ReferenceError)
apply(
    "variabel 'found' di startDepositPolling",
    "refid: (found && (found.refid || found.ref || found.id)) || null, raw: found",
    "refid: m.refid || m.ref || m.id || null, raw: m",
    literal=True,
)

# 4. HTML rusak di renderPinnedMessages
apply(
    "HTML pinned message",
    r"<b>\$\{escapeHtml\(m\.email\)\}</div>.*?</b>: ",
    "<b>${escapeHtml(m.email)}</b>: ",
    flags=re.DOTALL,
)

# 5. Turnstile loop tanpa henti
apply(
    "guard Turnstile",
    "function renderTurnstileWidgets(force) {\n",
    "function renderTurnstileWidgets(force) {\n  if (!document.getElementById('loginTurnstile') && !document.getElementById('signupTurnstile')) return;\n",
    literal=True,
)

# 6. @import di tengah CSS
apply(
    "@import font di tengah CSS",
    r"@import url\('https://fonts\.googleapis\.com/css2\?family=Inter[^']*'\);\s*",
    "",
)

# 7. Keamanan: hapus secret yang dikirim dari browser
apply(
    "hapus RPC server_complete_deposit + p_secret",
    r"if \(error && /permission denied\|could not find\|does not exist/i\.test\(error\.message \|\| ''\)\) \{\s*\(\{ data, error \} = await supabaseClient\.rpc\('server_complete_deposit'.*?\}\)\);\s*\}",
    "",
    flags=re.DOTALL,
)

# 8. Keamanan: matikan panggilan Qiospay langsung dari browser + buang API key
apply(
    "buang API key Qiospay",
    r"const apiKey = '[0-9a-f]{32,}';",
    "const apiKey = '';",
)
apply(
    "nonaktifkan fetchQiospayMutasiDirect",
    "async function fetchQiospayMutasiDirect(expectedAmount) {\n",
    "async function fetchQiospayMutasiDirect(expectedAmount) {\n  return []; // dinonaktifkan: jangan panggil Qiospay dari browser\n",
    literal=True,
)

with open(out, "w", encoding="utf-8") as f:
    f.write(code)

print("Hasil patch:")
for name, n in report:
    print(("  OK     " if n else "  TIDAK DITEMUKAN  ") + f"{name}  ({n}x)")
print(f"\nFile tersimpan: {out}")
print("Cek syntax JS dengan: node --check <(sed -n '/<script>$/,/<\\/script>/p' file) atau buka di browser + Console (F12).")
