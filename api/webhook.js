export default async function handler(req, res){
  const TOKEN = process.env.TELEGRAM_TOKEN;
  const OWNER = process.env.OWNER_ID;

  try{
    const body = req.body;

    // handle tombol inline
    if(body.callback_query){

      const data = JSON.parse(body.callback_query.data);
      const userId = body.callback_query.from.id;

      if(data.action === "convert"){

        // kirim ke owner
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            chat_id: OWNER,
            text: `🔥 USER SUDAH KONFIRMASI

👤 User: ${userId}
⭐ Stars: ${data.stars}
💰 Rp ${data.total}`
          })
        });

        // edit pesan user
        await fetch(`https://api.telegram.org/bot${TOKEN}/editMessageText`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            chat_id: userId,
            message_id: body.callback_query.message.message_id,
            text: "✅ Convert berhasil diproses!"
          })
        });

      }
    }

    res.status(200).json({ok:true});
  }catch(e){
    res.status(200).json({ok:true});
  }
}
