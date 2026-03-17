import fs from "fs"

export default function handler(req,res){

const ip =
req.headers["x-forwarded-for"]?.split(",")[0] ||
req.socket.remoteAddress ||
"unknown"

let blocked=[]

try{
blocked=JSON.parse(fs.readFileSync("blocked_ips.json"))
}catch{}

if(blocked.includes(ip)){
return res.json({blocked:true})
}

res.json({blocked:false})

}
