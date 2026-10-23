import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import {webcrypto} from 'node:crypto';
test('self-contained offline HTML runs shared engine without network: roles, actions, trial, save and public view',()=>{
 const html=fs.readFileSync(new URL('../OFFLINE_DEMO.html',import.meta.url),'utf8');const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];assert.ok(!html.includes('type="module"'));assert.ok(!html.includes('src="/app.js"'));assert.ok(html.includes('data:image/png;base64,'));
 const app={innerHTML:''},connection={},dummy={},storage=new Map();const context=vm.createContext({window:{},crypto:webcrypto,Uint32Array,Uint8Array,URLSearchParams,structuredClone,location:{search:'',origin:'null',href:'file:///demo.html'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{querySelector:s=>s==='#app'?app:s==='#connection'?connection:['#create','#join','#reconnect'].includes(s)?dummy:null,querySelectorAll:()=>[],getElementById:()=>null,body:{classList:{toggle:()=>{},add:()=>{},remove:()=>{}}},activeElement:null},setInterval:()=>{},setTimeout:()=>{},clearTimeout:()=>{},clearInterval:()=>{},confirm:()=>true,console,Date,URL,AbortController,fetch:()=>{throw Error('Offline test attempted network');}});
 const run=s=>vm.runInContext(s,context);run(source);assert.match(app.innerHTML,/Explore the night shift/);
 run('window.OFFLINE_APP.reset("night")');assert.match(app.innerHTML,/GAME MASTER CONTROL DESK/);assert.equal(run('demoRoom.players.length'),17);assert.equal(run('demoRoom.phase'),'night');
 run('demoPerson=demoRoom.players.find(p=>p.role==="analyst").id;window.OFFLINE_APP.refresh()');assert.match(app.innerHTML,/YOUR DESK/);assert.ok(!app.innerHTML.includes('Holder:'));
 run('window.OFFLINE_APP.sample(false)');assert.ok(run('Object.keys(demoRoom.actions).length')>=3);
 run('window.OFFLINE_APP.sample(true)');assert.equal(run('demoRoom.phase'),'review');assert.ok(!app.innerHTML.includes('Holder:'));
 run('demoPerson=demoRoom.gmId;window.OFFLINE_APP.refresh()');assert.match(app.innerHTML,/Outcomes awaiting release/);
 run('perform(demoRoom,demoRoom.players[0],"publish");window.OFFLINE_APP.refresh()');assert.equal(run('demoRoom.phase'),'day');
 run('perform(demoRoom,demoRoom.players[0],"trial",{target:demoRoom.players.find(p=>p.alive&&p.role==="drafter").id});');
 run('perform(demoRoom,demoRoom.players.find(p=>p.alive&&p.id!==demoRoom.gmId),"trialVote",{vote:"spare"});perform(demoRoom,demoRoom.players[0],"resolveTrial");perform(demoRoom,demoRoom.players[0],"publish");window.OFFLINE_APP.refresh();');assert.equal(run('demoRoom.phase'),'day');
 run('publicMode=true;window.OFFLINE_APP.refresh()');assert.ok(!app.innerHTML.includes('Holder:'));assert.ok(!app.innerHTML.includes('GAME MASTER CONTROL DESK'));assert.ok(run('state.me')===undefined);
 assert.ok(storage.has('draft-offline-save-v1'));
});
