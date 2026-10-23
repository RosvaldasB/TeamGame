import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
import {newRoom,addPlayer,perform,view,defaults} from '../game.js';
test('browser templates render lobby, every role, review and public projection without errors',()=>{
 const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace("import { MEDIA_EVENTS } from './media.js';",'');
 const app={innerHTML:''},connection={},dummy={};const context=vm.createContext({window:{},URLSearchParams,location:{search:'',origin:'http://localhost',href:'http://localhost/'},localStorage:{getItem:()=>null},document:{querySelector:s=>s==='#app'?app:s==='#connection'?connection:['#create','#join','#reconnect'].includes(s)?dummy:null,querySelectorAll:()=>[],getElementById:()=>null,body:{classList:{toggle:()=>{},add:()=>{},remove:()=>{}}},activeElement:null},setInterval:()=>{},setTimeout:()=>{},clearTimeout:()=>{},console,Date,URL,AbortController});
 vm.runInContext(source,context);assert.match(app.innerHTML,/WELCOME/);
 const r=newRoom('ABC123','Darius','secret-code');const gm=r.players[0];perform(r,gm,'claimGM',{secret:'secret-code'});for(let i=0;i<15;i++)addPlayer(r,'P'+i);
 function render(v,pub=false){context.input=v;context.pub=pub;vm.runInContext('state=input; publicMode=pub; code="ABC123"; roleHidden=false; render();',context);return app.innerHTML;}
 assert.match(render(view(r,gm)),/GM RULES BOARD/);perform(r,gm,'start');assert.match(render(view(r,gm)),/Holder:/);
 for(const p of r.players.slice(1)){const html=render(view(r,p));assert.match(html,/YOUR DESK/);assert.ok(!html.includes('Holder:'));}
 const pub=render(view(r),true);assert.ok(!pub.includes('Holder:'));assert.ok(!pub.includes('GAME MASTER CONTROL DESK'));assert.ok(!pub.includes('YOUR DESK'));
});
function client(){
 const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace("import { MEDIA_EVENTS } from './media.js';",'');const app={innerHTML:''},dummy={},storage=new Map();
 const c=vm.createContext({window:{},URLSearchParams,location:{search:'',origin:'http://localhost'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{querySelector:s=>s==='#app'?app:s==='#connection'?{}:['#create','#join','#reconnect'].includes(s)?dummy:null,querySelectorAll:()=>[],getElementById:()=>null,body:{classList:{toggle:()=>{},add:()=>{},remove:()=>{}}},activeElement:null},setInterval:()=>{},setTimeout:()=>{},clearTimeout:()=>{},console,Date,URL,AbortController});vm.runInContext(source,c);return {c,app,run:s=>vm.runInContext(s,c)};
}
test('unread chat access turns orange until read; receipts are scoped to room and player',()=>{
 const {c,run}=client();c.v={me:{id:'one',name:'Me',gm:true,alive:true},channels:{public:[{id:'a',sender:'Other',text:'hello'}],demons:[{id:'b',sender:'Other demon',text:'secret'}]}};run('state=v;code="OFFICE";');assert.equal(run('unread("public")'),1);assert.match(run('chatButtons()'),/chat-access unread/);run('markRead("public")');assert.equal(run('unread("public")'),0);assert.equal(run('unread("demons")'),1);run('state.channels.public.push({id:"c",sender:"Me",text:"own message"});');assert.equal(run('unread("public")'),0);run('state.channels.public.push({id:"d",sender:"Other",text:"new message"});');assert.equal(run('unread("public")'),1);run('markRead("public");state.me.id="two"');assert.equal(run('unread("public")'),2);run('state.me.id="one"');assert.equal(run('unread("public")'),0);
});
test('chat labels only show General and Demons even if old UUID channels are present',()=>{
 const {c,run}=client();c.v={me:{id:'one',name:'Me',gm:true,alive:true},phase:'day',channels:{public:[],demons:[],E40EBB5BFBE84F401BDC6A7D:[]}};run('state=v');const html=run('chat()');assert.ok(!html.includes('E40EBB5BFBE84F401BDC6A7D'));assert.match(html,/General/);assert.match(html,/Demons/);assert.ok(!html.includes('Private · GM'));
});
test('ledger precedes notices and controls; dead ghosts show revealed role on the right',()=>{
 const {c,app,run}=client();const r=newRoom('OFFICE','Darius','secret-code'),gm=r.players[0];perform(r,gm,'claimGM',{secret:'secret-code'});for(let i=0;i<15;i++)addPlayer(r,'P'+i);perform(r,gm,'start');const dead=r.players[1];dead.alive=false;dead.ghost=true;r.phase='day';c.v=view(r);run('state=v;publicMode=true;code="OFFICE";render()');assert.ok(app.innerHTML.indexOf('PARTY NIGHT LOG')<app.innerHTML.indexOf('OFFICE NOTICE BOARD'));assert.match(app.innerHTML,/row-ghost/);assert.match(app.innerHTML,/Revealed role/);assert.ok(app.innerHTML.includes(view(r).players[0].role));assert.ok(!app.innerHTML.includes('GM ONLY'));assert.ok(!app.innerHTML.includes('office-scene'));
});
