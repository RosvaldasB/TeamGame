import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { newRoom, addPlayer, perform, view } from './game.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.DATA_DIR || path.join(root,'data');fs.mkdirSync(dataDir,{recursive:true});
const db=new DatabaseSync(path.join(dataDir,'games.sqlite'));db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY, state TEXT NOT NULL)');
const rooms=new Map(db.prepare('SELECT code,state FROM rooms').all().map(x=>[x.code,JSON.parse(x.state)]));
const save=db.prepare('INSERT INTO rooms(code,state) VALUES(?,?) ON CONFLICT(code) DO UPDATE SET state=excluded.state');
const streams=new Map();const limits=new Map();
function store(r){rooms.set(r.code,r);save.run(r.code,JSON.stringify(r));}
function broadcast(r){for(const c of streams.get(r.code)||[]){const p=c.playerId?r.players.find(x=>x.id===c.playerId):null;c.res.write(`data: ${JSON.stringify(view(r,p))}\n\n`);}}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
function code(){let c;do{c=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(c));return c;}
function authenticate(r,req,url){const raw=req.headers.authorization?.replace(/^Bearer /,'')||'';return r.players.find(p=>{const a=Buffer.from(raw),b=Buffer.from(p.token);return a.length===b.length&&timingSafeEqual(a,b);});}
async function body(req){let b='';for await(const chunk of req){b+=chunk;if(Buffer.byteLength(b)>12000)throw Error('Request too large.');}return JSON.parse(b||'{}');}
function rate(req){const key=req.socket.remoteAddress;const now=Date.now();let l=limits.get(key);if(!l||now-l.at>10000){l={at:now,n:0};limits.set(key,l);}if(++l.n>400)throw Error('Too many requests. Please wait a moment.');}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.webm':'video/webm'};
export const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'");
  try{
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/health'){return json(res,200,{ok:true});}
    if(url.pathname.startsWith('/api/')){
      rate(req);
      // Browser POSTs must originate from this host. No cross-origin API access.
      if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'Cross-origin request rejected.'});
      if(req.method==='POST'&&url.pathname==='/api/create'){
        if(rooms.size>=100)throw Error('Room limit reached. Ask the host to archive old games.');
        const b=await body(req);const secret=typeof b.gmCode==='string'?b.gmCode.trim():'';if(secret.length<6||secret.length>80)throw Error('Choose a private GM code of 6–80 characters.');
        const r=newRoom(code(),b.nickname,secret);if(r.players[0].name.toLowerCase()==='darius')perform(r,r.players[0],'claimGM',{secret});store(r);return json(res,200,{code:r.code,token:r.players[0].token});
      }
      if(req.method==='POST'&&url.pathname==='/api/join'){
        const b=await body(req);const r=rooms.get(String(b.code||'').toUpperCase());if(!r)throw Error('Room not found.');const next=structuredClone(r);const p=addPlayer(next,b.nickname);
        if(!next.gmId&&p.name.toLowerCase()==='darius'&&b.gmCode)perform(next,p,'claimGM',{secret:b.gmCode});store(next);broadcast(next);return json(res,200,{code:next.code,token:p.token});
      }
      const match=url.pathname.match(/^\/api\/room\/([A-Z0-9]{6})\/(state|events|command)$/);if(!match)return json(res,404,{error:'Unknown endpoint.'});
      const r=rooms.get(match[1]);if(!r)return json(res,404,{error:'Room not found.'});const p=authenticate(r,req,url);const presentation=url.searchParams.get('public')==='1';
      if(!p&&!presentation)return json(res,401,{error:'Session not found. Use your original browser or saved reconnect key.'});
      if(match[2]==='state'&&req.method==='GET')return json(res,200,view(r,presentation?null:p));
      if(match[2]==='events'&&req.method==='GET'){
        const list=streams.get(r.code)||new Set();streams.set(r.code,list);if(list.size>=150)return json(res,429,{error:'Too many connections.'});
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive'});res.write(`data: ${JSON.stringify(view(r,presentation?null:p))}\n\n`);
        const c={res,playerId:presentation?null:p.id};list.add(c);req.on('close',()=>list.delete(c));return;
      }
      if(match[2]==='command'&&req.method==='POST'){
        if(!p||presentation)return json(res,403,{error:'Public presentation is read-only.'});const b=await body(req);const next=structuredClone(rooms.get(r.code));const who=next.players.find(x=>x.id===p.id);perform(next,who,b.command,b.data);store(next);broadcast(next);return json(res,200,{ok:true});
      }
      return json(res,405,{error:'Method not allowed.'});
    }
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed.'});
    const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));const file=path.resolve(root,'public',relative);
    if(!file.startsWith(path.join(root,'public')+path.sep))return json(res,403,{error:'Forbidden.'});
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{error:'File not found.'});
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);
  }catch(e){json(res,400,{error:e.message||'Request failed.'});}
});
const heartbeat=setInterval(()=>{for(const list of streams.values())for(const c of list)c.res.write(': heartbeat\n\n');for(const [k,v]of limits)if(Date.now()-v.at>60000)limits.delete(k);},15000);heartbeat.unref();
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`Drafters vs Workload Demons: http://localhost:${server.address().port}`));
function stop(){for(const list of streams.values())for(const c of list)c.res.end();server.close(()=>{db.close();process.exit(0);});}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
