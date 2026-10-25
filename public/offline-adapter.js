// Bundled into OFFLINE_DEMO.html. Uses exactly the same perform()/view() engine as the server.
// This is a local sandbox: switching identities is intentional, never multiplayer security.
let demoRoom=null,demoPerson=null;
const demoNames=['Alex','Morgan','Jamie','Taylor','Casey','Sam','Riley','Jordan','Blake','Charlie','Robin','Avery','Quinn','Drew','Reese','Cameron'];
function rememberDemo(){try{localStorage.setItem('draft-offline-save-v1',JSON.stringify(demoRoom));}catch{}}
function savedDemo(){try{return JSON.parse(localStorage.getItem('draft-offline-save-v1')||'null');}catch{return null;}}
window.OFFLINE_APP={
 entry(){return `<div class="offline-entry"><button id="demo-lobby">Test the lobby</button><button id="demo-night" class="danger">Explore the night shift</button><button id="demo-resume" class="secondary">Resume saved demo</button></div><p class="home-note">OFFLINE SANDBOX · No installation, account, or internet required.<br>Switch between 16 simulated employees and the GM. This file does not connect real players.</p>`;},
 toolbar(){return `<section class="offline-tools"><div class="row"><span class="stamp">OFFLINE SANDBOX</span><select id="demo-person" aria-label="View as simulated participant"><option value="public" ${publicMode?'selected':''}>Public presentation · no secrets</option>${demoRoom.players.map(p=>`<option value="${p.id}" ${!publicMode&&p.id===demoPerson?'selected':''}>${esc(p.name)}${p.id===demoRoom.gmId?' · GAME MASTER':''}</option>`).join('')}</select><button id="demo-chat" class="secondary">Simulate unread messages</button><button id="demo-complete" class="secondary">Fill missing decisions (skip)</button><button id="demo-fill" class="secondary">Submit sample actions</button><button id="demo-round" class="danger">Simulate night outcome</button><button id="demo-save" class="secondary">Export demo save</button><button id="demo-import" class="secondary">Import demo save</button><input id="demo-save-file" type="file" accept=".json,application/json" hidden><button id="demo-reset" class="secondary">New demo lobby</button></div><p>Local simulated players · choose a player to test their role, chat, and votes; choose Darius to narrate and release results. Sample actions are sandbox helpers.</p></section>`;},
 reset(phase='lobby',nickname='Darius',secret='offline-gm'){
  demoRoom=newRoom('OFFICE',nickname,secret);demoPerson=demoRoom.players[0].id;
  for(const n of demoNames)addPlayer(demoRoom,n);
  if(nickname.toLowerCase()==='darius')perform(demoRoom,demoRoom.players[0],'claimGM',{secret});
  if(phase==='night'){demoRoom.gmId=demoPerson;perform(demoRoom,demoRoom.players[0],'start');}
  const note={id:'demo-intro',sender:'OFFICE INTERCOM',text:'The night shift has begun. Someone left a drawing open. Someone else left a door unlocked.',at:Date.now()};demoRoom.announcements.push({...note,kind:'office',media:null});
  code='OFFICE';token=demoRoom.players[0].token;publicMode=false;roleHidden=true;channel='public';rememberDemo();this.refresh();
 },
 refresh(){if(!demoRoom){home();this.bindHome();return;}code=demoRoom.code;const p=demoRoom.players.find(x=>x.id===demoPerson)||demoRoom.players[0];demoPerson=p.id;token=p.token;upgradeRoom(demoRoom);state=view(demoRoom,publicMode?null:p);revision=state.revision;connection.textContent='OFFLINE SANDBOX';render();},
 async api(url,data){
  if(url==='/api/create'){this.reset('lobby',data.nickname,data.gmCode);return {code:demoRoom.code,token};}
  if(url==='/api/join'){if(!demoRoom)throw Error('Open the demo lobby first.');const next=structuredClone(demoRoom);const p=addPlayer(next,data.nickname);demoRoom=next;demoPerson=p.id;rememberDemo();return{code:demoRoom.code,token:p.token};}
  if(url.includes('/command')){const next=structuredClone(demoRoom);const p=next.players.find(x=>x.id===demoPerson);if(!p||publicMode)throw Error('Select a simulated player or GM first.');perform(next,p,data.command,data.data);demoRoom=next;rememberDemo();this.refresh();return{ok:true};}
  if(url.includes('/state'))return view(demoRoom,demoRoom.players.find(p=>p.token===token));
  throw Error('This action requires online hosting.');
 },
 bindHome(){const on=(id,fn)=>{const e=document.getElementById(id);if(e)e.onclick=fn;};on('demo-lobby',()=>this.reset('lobby'));on('demo-night',()=>this.reset('night'));on('demo-resume',()=>{const saved=savedDemo();if(!saved?.players?.length){toast('No saved offline demo yet.');return;}demoRoom=saved;demoPerson=saved.gmId||saved.players[0].id;publicMode=false;this.refresh();});},
 bind(){
  const select=document.getElementById('demo-person');if(select){select.value=publicMode?'public':demoPerson;select.onchange=()=>{publicMode=select.value==='public';if(!publicMode)demoPerson=select.value;roleHidden=true;channel='public';chatOpen=true;this.refresh();};}
  const on=(id,fn)=>{const e=document.getElementById(id);if(e)e.onclick=fn;};
  on('demo-reset',()=>{if(confirm('Replace this local demo with a fresh lobby?'))this.reset('lobby');});on('demo-save',()=>this.exportSave());
  on('demo-import',()=>document.getElementById('demo-save-file').click());const file=document.getElementById('demo-save-file');if(file)file.onchange=async()=>{try{const saved=JSON.parse(await file.files[0].text());if(!saved||!Array.isArray(saved.players)||!saved.players.length||saved.players.length>31||!saved.channels||!saved.settings||!saved.cat||!['lobby','night','review','day','trial','finished'].includes(saved.phase))throw Error('Invalid demo save.');demoRoom=saved;demoPerson=saved.gmId||saved.players[0].id;publicMode=false;rememberDemo();this.refresh();toast('Demo save restored.');}catch(e){toast(e.message);}};
  on('demo-chat',()=>{const next=structuredClone(demoRoom);msg(next,'public','Alex','Someone left a redline on my desk. Who was here last?');msg(next,'demons','THE DEADLINE','The next deadline will not survive the night.');next.revision++;demoRoom=next;rememberDemo();this.refresh();});
  on('demo-complete',()=>{try{const next=structuredClone(demoRoom),gm=next.players.find(p=>p.id===next.gmId);for(const e of completion(next).filter(x=>!x.done))perform(next,gm,'gmDecision',{player:e.player,kind:'skip',reason:'Offline simulation helper'});demoRoom=next;rememberDemo();this.refresh();}catch(e){toast(e.message);}});
  on('demo-fill',()=>{try{this.sample(false);toast('Sample selections submitted. Switch to players to inspect or change them.');}catch(e){toast(e.message);}});
  on('demo-round',()=>{try{this.sample(true);toast('Night resolved privately. Select Darius to review and release announcements.');}catch(e){toast(e.message);}});
 },
 sample(resolve){
  if(demoRoom.phase!=='night')throw Error('Begin a night first using the GM controls.');
  const r=structuredClone(demoRoom),gm=r.players.find(p=>p.id===r.gmId),living=alive(r).filter(p=>p.id!==r.gmId);
  if(!r.demonLocked){
   const candidates=living.filter(p=>!isDemon(p));const targets=candidates.filter(p=>p.role==='drafter').concat(candidates.filter(p=>p.role!=='drafter')).slice(0,r.skipAttack?0:r.doubleAttack?2:1);
   for(const p of living){
    if(!r.actions[p.id]?.locked&&['doctor','guard','priest'].includes(p.role)){
      const other=living.find(x=>x.id!==p.id&&!targets.some(t=>t.id===x.id));if(other)try{perform(r,p,'action',{kind:'protect',target:other.id});perform(r,p,'lockAction');}catch{}
    }
    if(isDemon(p)&&targets.length)perform(r,p,'demonVote',{targets:targets.map(t=>t.id)});
    if(p.role==='analyst'&&!r.actions[p.id]?.investigate){const evil=living.find(isEvil);if(evil){perform(r,p,'action',{kind:'investigate',target:evil.id});perform(r,p,'lockAction');}}
   }
   if(resolve){for(const e of completion(r).filter(x=>!x.done))perform(r,gm,'gmDecision',{player:e.player,kind:'skip',reason:'Offline sample action helper'});perform(r,gm,'lockDemons');}
  }
  if(resolve){
   for(const p of living){if(p.role==='succubus'&&!r.actions[p.id]?.investigate){const a=living.find(x=>x.role==='analyst');if(a){perform(r,p,'action',{kind:'investigate',target:a.id});perform(r,p,'lockAction');}}}
   for(const [id,a]of Object.entries(r.actions))if(a.investigate&&!a.answered)perform(r,gm,'answer',{player:id});
   for(const e of completion(r).filter(x=>!x.done))perform(r,gm,'gmDecision',{player:e.player,kind:'skip',reason:'Offline sample action helper'});
   perform(r,gm,'resolveNight');
  }
  demoRoom=r;rememberDemo();this.refresh();
 },
 exportSave(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(demoRoom,null,2)],{type:'application/json'}));a.download='offline-game-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Demo save exported. This sandbox file includes all simulated secrets.');},
 popup(kind){
  const child=window.open('','draft-demo-'+kind,'popup,width=850,height=800');if(!child){toast('Allow browser popups, then try again.');return;}
  const styles=document.querySelector('style')?.textContent||'';child.document.write('<!doctype html><html><head><title>Offline '+kind+'</title><style>'+styles+'</style></head><body><main id="detached"></main></body></html>');child.document.close();
  const selected=demoPerson;
  const draw=()=>{if(child.closed)return;const previous=state,previousChannel=channel;const p=demoRoom.players.find(x=>x.id===selected);state=view(demoRoom,kind==='public'?null:p);const html=kind==='public'?`<div class="badge">OFFLINE PUBLIC PRESENTATION</div>${announcements()}${roster()}`:`<div class="badge">DETACHED OFFLINE CHAT · ${esc(p.name)}</div>${chat()}`;child.document.getElementById('detached').innerHTML=html;
    if(kind==='chat'){child.document.querySelectorAll('[data-channel]').forEach(el=>el.onclick=()=>{channel=el.dataset.channel;markRead(channel);draw();});const f=child.document.getElementById('chatForm');if(f)f.onsubmit=e=>{e.preventDefault();const text=child.document.getElementById('chatText').value;try{const next=structuredClone(demoRoom);perform(next,next.players.find(x=>x.id===selected),'chat',{channel,text});demoRoom=next;rememberDemo();window.OFFLINE_APP.refresh();draw();}catch(err){child.alert(err.message);}};}
    state=previous;};draw();const timer=setInterval(()=>{if(child.closed)clearInterval(timer);else draw();},3000);
 }
};
