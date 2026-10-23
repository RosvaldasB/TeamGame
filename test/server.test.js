import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('HTTP sessions, SSE privacy, 30-player concurrency, rollback, reconnect and SQLite restart',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'draft-test-'));let child;let base;
 async function boot(){child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'3199',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',c=>reject(Error('Server exited '+c)));});base='http://127.0.0.1:3199';}
 async function stop(){await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});}
 async function req(url,data,token){const res=await fetch(base+url,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});return {status:res.status,data:await res.json()};}
 try{
  await boot();const created=await req('/api/create',{nickname:'Darius',gmCode:'test-secret'});assert.equal(created.status,200);const {code,token}=created.data;
  const sessions=await Promise.all(Array.from({length:30},(_,i)=>req('/api/join',{code,nickname:'P'+i})));assert.ok(sessions.every(x=>x.status===200));assert.equal((await req(`/api/room/${code}/state`,null,token)).data.players.length,30);
  assert.equal((await req(`/api/room/${code}/state`)).status,401);assert.equal((await req(`/api/room/${code}/state?public=1`)).data.me,undefined);
  const ptoken=sessions[0].data.token;const before=(await req(`/api/room/${code}/state`,null,token)).data.revision;
  assert.equal((await req(`/api/room/${code}/command`,{command:'start'},ptoken)).status,400);assert.equal((await req(`/api/room/${code}/state`,null,token)).data.revision,before);
  assert.equal((await req(`/api/room/${code}/command`,{command:'start'},token)).status,200);
  const s=(await req(`/api/room/${code}/state`,null,ptoken)).data;assert.equal(s.players.every(x=>x.role===null),true);assert.equal(s.cat,undefined);assert.equal(s.actions,undefined);
  const abort=new AbortController();const events=await fetch(`${base}/api/room/${code}/events?public=1`,{signal:abort.signal});const reader=events.body.getReader();const frame=new TextDecoder().decode((await reader.read()).value);assert.ok(frame.startsWith('data: '));assert.ok(!frame.includes('holder'));abort.abort();
  const publicState=(await req(`/api/room/${code}/state?public=1`)).data;assert.equal(publicState.channels,undefined);
  await stop();await boot();const restored=(await req(`/api/room/${code}/state`,null,ptoken)).data;assert.equal(restored.me.id,s.me.id);assert.equal(restored.me.role,s.me.role);assert.equal(restored.phase,'night');assert.equal(restored.players.length,30);
 }finally{if(child?.exitCode===null)await stop();rmSync(dir,{recursive:true,force:true});}
});
