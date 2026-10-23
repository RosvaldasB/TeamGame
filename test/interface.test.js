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
