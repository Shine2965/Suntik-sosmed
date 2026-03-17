const BOT="8785872128:AAGJApScDjRIjg1VorXB35OvrvtUDCtVr0M"
const OWNER="6367582755"

export default async function handler(req,res){

const ip =
req.headers["x-forwarded-for"]?.split(",")[0] ||
req.socket.remoteAddress

const geo = await fetch(`http://ip-api.com/json/${ip}`).then(r=>r.json())

const msg = `
🌐 WEBSITE VISITOR

IP : ${ip}

Country : ${geo.country}
City : ${geo.city}
ISP : ${geo.isp}
`

await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`,{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
chat_id:OWNER,
text:msg,
reply_markup:{
inline_keyboard:[
[
{ text:"🚫 BLOCK IP", callback_data:`block_${ip}`},
{ text:"✅ UNBLOCK IP", callback_data:`unblock_${ip}`}
]
]
}
})
})

res.json({ok:true})

                        }
