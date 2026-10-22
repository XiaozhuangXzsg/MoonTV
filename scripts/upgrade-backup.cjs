const {Redis}=require('@upstash/redis');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
(async()=>{
 if(!process.env.UPSTASH_URL||!process.env.UPSTASH_TOKEN||!process.env.PASSWORD)throw new Error('Backup configuration missing');
 const r=new Redis({url:process.env.UPSTASH_URL,token:process.env.UPSTASH_TOKEN,automaticDeserialization:false});
 const prefix='upgrade-backup:moon-tv:20261022-v226.1.0';
 const complete=await r.get(prefix+':complete');
 if(complete){console.log('UPGRADE_BACKUP_ALREADY_VERIFIED');return;}
 const keys=new Set(['admin:config']);
 let cursor=0;
 do{const result=await r.scan(cursor,{match:'u:*',count:100});cursor=Number(result[0]);for(const key of result[1])keys.add(key);}while(cursor!==0);
 const salt=crypto.randomBytes(16);
 const encKey=crypto.scryptSync(process.env.PASSWORD,salt,32);
 const entries=[];
 for(const key of keys){
  const type=await r.type(key);
  if(type==='none')continue;
  let value;
  if(type==='string')value=await r.get(key);
  else if(type==='list')value=await r.lrange(key,0,-1);
  else if(type==='hash')value=await r.hgetall(key);
  else if(type==='set')value=await r.smembers(key);
  else throw new Error('Unsupported backup data type');
  const pttl=await r.pttl(key);
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',encKey,iv);
  const compressed=zlib.gzipSync(Buffer.from(JSON.stringify({key,type,value,pttl,capturedAt:Date.now()})));
  const payload=Buffer.concat([cipher.update(compressed),cipher.final()]);
  const envelope=JSON.stringify({v:1,salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),payload:payload.toString('base64')});
  const id=crypto.createHash('sha256').update(key).digest('hex');
  await r.set(prefix+':'+id,envelope);
  if(await r.get(prefix+':'+id)!==envelope)throw new Error('Backup verification failed');
  entries.push(id);
 }
 await r.set(prefix+':complete',JSON.stringify({v:1,createdAt:new Date().toISOString(),entries,sourceCommit:'5f9e1fb1a8d002d88da8e02bc90a9a5b5ccc9b1b'}));
 console.log('UPGRADE_BACKUP_VERIFIED keys='+entries.length);
})().catch(()=>{console.error('UPGRADE_BACKUP_FAILED');process.exit(1)});
