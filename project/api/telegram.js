import fs from "fs"

export default async function handler(req,res){

const data=req.body

if(data.callback_query){

const action=data.callback_query.data
const ip=action.split("_")[1]

let blocked=[]

try{
blocked=JSON.parse(fs.readFileSync("blocked_ips.json"))
}catch{}

if(action.startsWith("block_")){

if(!blocked.includes(ip)){
blocked.push(ip)
}

}

if(action.startsWith("unblock_")){

blocked=blocked.filter(x=>x!==ip)

}

fs.writeFileSync("blocked_ips.json",JSON.stringify(blocked))

}

res.json({ok:true})

}
