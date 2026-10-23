import { MEDIA_EVENTS } from './media.js';
const app=document.querySelector('#app'),connection=document.querySelector('#connection');
const params=new URLSearchParams(location.search);let code=(params.get('room')||'').toUpperCase();let publicMode=params.get('view')==='public';const chatOnly=params.get('view')==='chat';
let token=code?localStorage.getItem(`draft-token-${code}`):null;let state=null,channel='public',revision=-1,streamAbort=null,roleHidden=true;
let chatOpen=chatOnly,renderIdentity=null;
const roleNames={drafter:'Drafter',auditor:'The Auditor',beast:'Deadline Beast',ink:'Ink Demon',manager:'Whispering Manager',burnout:'Burned-Out Drafter',succubus:'Succubus',analyst:'Analyst',guard:'Office Security Guard',doctor:'Office Doctor',enforcer:'Enforcer',heaven:'Touched by Heaven',priest:'Priest'};
const roleHelp={drafter:'Discuss, bluff, and vote. Eliminate every Workload Demon.',auditor:'Coordinate with your fellow demons and vote for nightly targets.',beast:'Coordinate with your fellow demons and vote for nightly targets.',ink:'Coordinate with your fellow demons and vote for nightly targets.',manager:'Coordinate with your fellow demons and vote for nightly targets.',burnout:'You appear innocent. An unblocked demon attack secretly converts you into a demon.',succubus:'Once per night, after demon voting, ask whether one player is the Analyst. You cannot attack with demons.',analyst:'Once each night, ask whether a player is a demon (including Succubus). The answer is only Yes or No.',guard:'Protect one player. You also protect yourself automatically. At most one life is lost per night; you have three lives.',doctor:'Protect one player, or use your one poison. Self-protection can be used once. You cannot protect and poison together.',enforcer:'When you die, you may choose one player to kill. Cat Neo can block this action.',heaven:'Killed by demons: their next attack is skipped. Executed at trial: the next day’s trial vote is skipped.',priest:'Protect another player twice per game. Redirect an attack against yourself once, using the lobby rule.'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const player=id=>state.players.find(p=>p.id===id);const name=id=>player(id)?.name||(id?'Unknown employee':'None');
const options=(excludeSelf=false)=>state.players.filter(p=>p.alive&&(!excludeSelf||p.id!==state.me?.id)).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
const panel=(title,body,cls='')=>`<section class="panel ${cls}"><h2>${title}</h2><div class="content">${body}</div></section>`;
const button=(text,cmd,cls='')=>`<button data-command="${cmd}" class="${cls}">${text}</button>`;
function toast(text){const t=document.querySelector('#toast');t.textContent=text;t.style.display='block';clearTimeout(t.hide);t.hide=setTimeout(()=>t.style.display='none',6000);}
async function api(url,data){if(window.OFFLINE_APP)return window.OFFLINE_APP.api(url,data);const res=await fetch(url,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:data?JSON.stringify(data):undefined});const result=await res.json();if(!res.ok)throw Error(result.error||'Request failed.');return result;}
async function command(cmd,data={}){try{await api(`/api/room/${code}/command`,{command:cmd,data});}catch(e){toast(e.message);}}
function home(){
 document.body.classList.add("at-entrance");
 app.innerHTML=`<div class="home"><div class="entrance-art" role="img" aria-label="Draftersville office at night"><div class="entry-caption"><b>WELCOME TO THE NIGHT SHIFT.</b>Clock in. Trust no one. Survive the deadline.</div></div>${window.OFFLINE_APP?window.OFFLINE_APP.entry():''}<div class="two entry-forms">${panel('OPEN A NEW OFFICE',`<form id="create"><label>Your nickname<input name="nickname" minlength="2" maxlength="30" required placeholder="Darius"></label><label>Private GM code<input name="gmCode" type="password" minlength="6" maxlength="80" required autocomplete="new-password"></label><p class="small">Darius becomes GM automatically when creating the room. Otherwise, elect a GM in the lobby. Keep this code private.</p><button>Create room</button></form>`)}${panel('JOIN YOUR COLLEAGUES',`<form id="join"><label>Room code<input id="joinCode" name="code" minlength="6" maxlength="6" required value="${esc(code)}"></label><label>Your nickname<input name="nickname" minlength="2" maxlength="30" required></label><label>GM code (Darius only, optional)<input name="gmCode" type="password" autocomplete="off"></label><button>Join office</button></form><details><summary>Reconnect with a saved key</summary><form id="reconnect"><label>Room code<input name="code" minlength="6" maxlength="6" required></label><label>Private reconnect key<input name="token" required type="password"></label><button>Reconnect</button></form></details>`)}</div><p class="intro">Private rooms · Secret roles · Human narration · No accounts</p></div>`;
 for(const id of ['create','join','reconnect'])document.querySelector('#'+id).onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));try{let result;if(id==='reconnect'){code=b.code.toUpperCase();token=b.token;await api(`/api/room/${code}/state`);result={code,token};}else result=await api('/api/'+id,b);code=result.code;token=result.token;localStorage.setItem(`draft-token-${code}`,token);if(!window.OFFLINE_APP)history.replaceState(null,'',`?room=${code}`);connect();}catch(err){toast(err.message);}};
}
async function connect(){
 if(window.OFFLINE_APP){window.OFFLINE_APP.refresh();return;}
 if(streamAbort)streamAbort.abort();streamAbort=new AbortController();revision=-1;connection.textContent='CONNECTING';
 try{
  const res=await fetch(`/api/room/${code}/events${publicMode?'?public=1':''}`,{headers:!publicMode&&token?{Authorization:`Bearer ${token}`}:{},signal:streamAbort.signal});
  if(!res.ok){const b=await res.json();throw Error(b.error);}
  connection.textContent=publicMode?'PUBLIC VIEW':'CONNECTED';const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';
  while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let idx;while((idx=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,idx);buffer=buffer.slice(idx+2);if(frame.startsWith('data: ')){const next=JSON.parse(frame.slice(6));if(next.revision!==revision){revision=next.revision;state=next;render();}}}}
  connection.textContent='RECONNECTING';setTimeout(connect,1500);
 }catch(e){if(e.name==='AbortError')return;connection.textContent='DISCONNECTED';if(!state){home();toast(e.message);}else setTimeout(connect,2000);}
}
const readReceipts=new Map();
function readKey(key){return `draft-chat-read:${code}:${state?.me?.id||'public'}:${key}`;}
function lastRead(key){try{return localStorage.getItem(readKey(key))||readReceipts.get(readKey(key));}catch{return readReceipts.get(readKey(key))||null;}}
function unread(key){
 const items=state?.channels?.[key]||[],last=lastRead(key);if(!items.length)return 0;const index=items.findIndex(m=>m.id===last);
 return items.slice(index<0?0:index+1).filter(m=>m.sender!==state?.me?.name).length;
}
function markRead(key){const items=state?.channels?.[key]||[];if(items.length){readReceipts.set(readKey(key),items.at(-1).id);try{localStorage.setItem(readKey(key),items.at(-1).id);}catch{}}}
function chatButtons(){return ['public','demons'].filter(k=>state.channels?.[k]).map(k=>{
 const n=unread(k);return `<button data-channel="${k}" class="chat-access ${n?'unread':''} ${chatOpen&&channel===k?'active':''}" aria-label="${k==='public'?'General':'Demons'} chat${n?`, ${n} unread messages`:''}">${k==='public'?'General':'Demons'}${n?` <span class="unread-count">${n}</span>`:''}</button>`;
 }).join('');}
function publicVoteText(id,v,target){return v==='execute'?`Execute → ${name(target)}`:v==='spare'?`Spare → ${name(target)}`:v==='abstain'?'Abstain':v?name(v):'—';}
function roster(){
 const history=state.history||[];const table=state.players.map((p,i)=>{
  let vote='—';if(state.phase==='night')vote=state.demonVotes?.[p.id]?.map(name).join(', ')||'Sealed';
  else if(state.phase==='trial'||state.trialDone)vote=publicVoteText(p.id,state.votes?.[p.id],state.trialTarget);
  else vote=state.nominations?.[p.id]?name(state.nominations[p.id]):'—';
  return `<tr class="${!p.alive?p.ghost?'row-ghost':'row-dead':''}"><td class="row-number">${i+1}</td><th scope="row">${esc(p.name)}</th><td><span class="status-dot ${p.alive?'alive':p.ghost?'ghost':'dead'}"></span>${p.alive?'On shift':p.ghost?'Office ghost':'Moved on'}</td><td>${esc(vote)}</td>${history.map(h=>`<td>${esc(h.nominations?.[p.id]?name(h.nominations[p.id]):'—')}<small>${esc(publicVoteText(p.id,h.votes?.[p.id],h.target))}</small></td>`).join('')}<td class="role-column">${esc(p.role||'Unrevealed')}</td></tr>`;
 }).join('');
 const resources=state.me?.gm?`<div class="resource-strip confidential"><span>GM ONLY</span><span>Cat Neo charges: ${state.cat?.lives??9}</span>${state.players.filter(p=>p.roleKey==='guard').map(p=>`<span>Guard lives: ${p.guardLives}/3</span>`).join('')}${state.players.filter(p=>p.roleKey==='doctor').map(p=>`<span>Doctor poison: ${p.doctorPoison} · Self-protection: ${p.doctorSelf}</span>`).join('')}${state.players.filter(p=>p.roleKey==='priest').map(p=>`<span>Priest protections: ${p.priestProtect} · Redirect: ${p.priestRedirect}</span>`).join('')}</div>`:'';
 return `<section class="party-ledger"><div class="ledger-title"><span>DRAFTERSVILLE SOLUTIONS INC.</span><h2>PARTY NIGHT LOG</h2><span>${state.players.length} EMPLOYEES · SHIFT ${state.round||'—'}</span></div><p class="ledger-caption">Different roles. One mission. Trust no one. <span>${state.phase==='night'?'Night targets remain confidential.':'Public nominations and trial votes appear here.'}</span></p><div class="sheet-scroll"><table class="status-sheet"><thead><tr><th>#</th><th>Party members</th><th>Player status</th><th>${state.phase==='night'?'Night vote · restricted':'Current public vote'}</th>${history.map(h=>`<th>Shift ${h.round}<small>Nomination / verdict</small></th>`).join('')}<th>${state.me?.gm?'Role · GM only':'Revealed role'}</th></tr></thead><tbody>${table||'<tr><td colspan="5">Waiting for employees…</td></tr>'}</tbody></table></div><div class="ledger-footer"><span>ON SHIFT ${state.players.filter(p=>p.alive).length}</span><span>GHOSTS ${state.players.filter(p=>p.ghost).length}/5</span><span>MOVED ON ${state.players.filter(p=>!p.alive&&!p.ghost).length}</span></div>${resources}</section>`;
}
function announcements(){return panel('OFFICE NOTICE BOARD',`${state.winner?`<article class="board-note victory"><span class="stamp">FINAL SHIFT REPORT</span><h3>${esc(state.winner)} win</h3><p>The office doors open again.</p></article>`:''}${announcementItems()}`,'notice-board');}
function announcementItems(){return [...state.announcements].reverse().slice(0,40).map(a=>`<article class="board-note ${a.kind==='success'?'success-notice':''}"><span class="notice-pin"></span><time>${new Date(a.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · ${a.kind==='success'?'RESTRICTED SUCCESS REPORT RELEASED':'OFFICE INTERCOM'}</time><p>${esc(a.text)}</p></article>`).join('')||'<article class="board-note"><p>No notices posted. Await the Game Master’s first announcement.</p></article>';}
function chat(){
 const keys=['public','demons'].filter(k=>state.channels?.[k]);if(!keys.includes(channel))channel='public';
 const canWrite=state.me.gm||(state.me.alive||state.me.ghost)&&state.phase!=='review'&&!(channel==='public'&&state.phase==='night');
 return panel('COMMUNICATION TERMINAL',`<div class="tabs">${chatButtons()}<button id="closeChat" class="secondary">Close chat</button></div>${channel==='demons'?'<p class="small">CONFIDENTIAL — demons and Game Master only.</p>':''}<div class="chat" id="messages">${(state.channels?.[channel]||[]).map(m=>`<div class="message"><b>${esc(m.sender)}<time>${new Date(m.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time></b>${esc(m.text)}</div>`).join('')||'<div class="empty">No messages yet.</div>'}</div><form id="chatForm"><div class="row"><input id="chatText" autocomplete="off" maxlength="1600" placeholder="${canWrite?'Type a message…':'Read-only during this phase'}" ${canWrite?'':'disabled'}><button ${canWrite?'':'disabled'}>Send</button></div></form><p class="small">Game announcements are posted on the notice board.</p>`,channel==='public'?'':'private');
}
function rules(){return panel('RULES & PROCEDURES',`<p><b>Night → Morning → Discussion → Trial</b></p><p>Protection priority: Cat Neo → Security Guard → Priest → Doctor.</p><p>Drafters win when every attacking demon is eliminated. Demons win when they equal or outnumber living Drafters. A living Succubus alone cannot prevent a Drafter victory.</p><p>Cat Neo moves randomly each night and stays through the day. Nine charges; ownership stays secret until it saves someone.</p><p>Ghosts cannot vote or reveal secret information. Five places maximum. Analyst and demons are ineligible.</p><p>Deaths reveal exact roles. Bluffing, accusations, and bargaining are allowed.</p><details><summary>Role guide</summary>${Object.entries(roleHelp).map(([k,v])=>`<p><b>${esc(roleNames[k])}:</b> ${esc(v)}</p>`).join('')}</details><p class="small">Priest redirection: ${state.settings.priestTarget==='random'?'random target':'player chooses'}. Trial ties: ${state.settings.tie==='gm'?'GM decides':'acquit'}. Timers require GM phase advancement.</p>`);}
function lobby(){
 const me=state.me;let body=`<p>Share the room code <b class="mono">${code}</b> or copy its link.</p><p>${state.gmName?`Game Master: <b>${esc(state.gmName)}</b>`:'Elect a Game Master. More than half the lobby must vote for the same person.'}</p>`;
 if(!state.gmId)body+=`<form id="gmVote"><select name="target">${state.players.map(p=>`<option value="${p.id}">${esc(p.name)} · ${Object.values(state.gmVotes).filter(v=>v===p.id).length} votes</option>`).join('')}</select><button>Vote for GM</button></form>${me.name.toLowerCase()==='darius'?'<form id="claim"><label>Private GM code<input name="secret" type="password" required></label><button>Claim GM dashboard</button></form>':''}`;
 if(me.gm)body+='<p class="notice">Configure role counts before starting. Unassigned players become ordinary Drafters.</p>'+button('Assign secret roles & start night','start');
 return panel('THE LOBBY',body);
}
function settings(){const s=state.settings;return panel('GM RULES BOARD',`<form id="settings"><div class="settingsgrid"><label>Priest redirect target<select name="priestTarget"><option value="player" ${s.priestTarget==='player'?'selected':''}>Priest chooses</option><option value="random" ${s.priestTarget==='random'?'selected':''}>Random living player</option></select></label><label>Trial tie<select name="tie"><option value="acquit" ${s.tie==='acquit'?'selected':''}>Acquit</option><option value="gm" ${s.tie==='gm'?'selected':''}>GM decides</option></select></label>${['nightSeconds','daySeconds','trialSeconds'].map(k=>`<label>${{nightSeconds:'Night',daySeconds:'Discussion',trialSeconds:'Trial'}[k]} timer (seconds, 0 = unlimited)<input name="${k}" type="number" min="0" max="7200" value="${s[k]}" required></label>`).join('')}</div><label class="checkbox-row"><input name="autoRevealSuccess" type="checkbox" ${s.autoRevealSuccess?'checked':''}> Automatically publish special-role success notices after GM releases outcomes</label><p class="small">Off: successes stay private until GM chooses to reveal them. Public notices never identify the acting or investigated player.</p><h3>Special roles · ${Object.values(s.roles).reduce((a,b)=>a+b,0)} / ${state.players.length}</h3><div class="rolecounts">${Object.entries(s.roles).map(([k,n])=>`<label for="role-${k}">${esc(roleNames[k])}</label><input id="role-${k}" name="role-${k}" type="number" min="0" max="${['auditor','beast','ink','manager'].includes(k)?30:1}" value="${n}" required>`).join('')}</div><br><button>Save rules</button></form>`,'private');}
function playerControls(){
 const m=state.me,a=state.myAction||{},draft=state.myDraft||{};
 let b=`<div class="rolecard"><span class="stamp">PERSONNEL FILE · CONFIDENTIAL</span><strong>${roleHidden?'ROLE HIDDEN':esc(m.converted?'Workload Demon':m.role)}</strong><button id="revealRole" class="secondary link">${roleHidden?'Reveal my role':'Hide my role'}</button>${!roleHidden?`<p>${esc(m.converted?'Coordinate with demons and vote for targets.':roleHelp[m.roleKey]||'')}</p>`:''}</div>`;
 if(state.phase==='review')b+='<p class="notice">The GM is reviewing outcomes. Await the notice board update.</p>';
 if(state.enforcerPending)b+=`<h3>Your final Enforcer action</h3><form id="enforcer"><select name="target"><option value="">Decline final kill</option>${options(true)}</select><button class="danger">Lock final action</button></form>`;
 if(state.ghostAvailable)b+=button('Become an Office Ghost','ghost','secondary');
 if(!m.alive)b+=`<p class="notice">${m.ghost?'You are a ghost. Chat is available; voting is disabled. Keep hidden information secret.':'You are a spectator. Public chat is read-only.'}</p>`;
 if(m.alive&&state.phase==='night'){
  if(m.converted||['auditor','beast','ink','manager'].includes(m.roleKey)){
   b+=`<h3>Demon target vote</h3>${state.attackCount===0?'<p>Demons are sick. No attack tonight.</p>':`<form id="demonVote">${Array.from({length:state.attackCount||1},(_,i)=>`<label>Target ${i+1}<select name="target${i}">${state.players.filter(p=>p.alive&&!state.demonTeam?.includes(p.id)).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>`).join('')}<button ${state.demonLocked?'disabled':''}>Submit target vote</button></form>`}<p class="small">${state.demonLocked?'Voting locked.':`Your vote: ${(state.myVote||[]).map(name).map(esc).join(', ')||'not submitted'}`}</p>`;
  }else if(['guard','doctor','priest','analyst','succubus'].includes(m.roleKey)){
   b+='<h3>Private role action dashboard</h3>';
   if(a.locked)b+='<p class="action-locked">✓ ACTION LOCKED · Delivered to Game Master</p>';
   else if(state.actionWindow){
    const kinds=['analyst','succubus'].includes(m.roleKey)?['investigate']:m.roleKey==='doctor'?['protect','poison']:m.roleKey==='priest'&&state.settings.priestTarget==='player'?['protect','redirect']:['protect'];
    b+=`<form id="action"><label>Action<select name="kind">${kinds.map(k=>`<option value="${k}">${{investigate:'Investigate a player',protect:'Protect',poison:'Poison (once)',redirect:'Redirect if attacked (once)'}[k]}</option>`).join('')}</select></label><label>Player<select name="target">${options(['priest','analyst','succubus'].includes(m.roleKey))}</select></label><button class="secondary">Save private selection</button></form><p class="small">Selections stay private until you lock them. Locking is final for this night.</p><div class="draft-summary">${Object.entries(draft).map(([k,id])=>`<p>${esc(k)} → <b>${esc(name(id))}</b></p>`).join('')||'No selection saved.'}</div><div class="row">${button('Lock in actions','lockAction','danger')}${button('Clear selection','clearAction','secondary')}${button('Skip this window','skipAction','secondary')}</div>`;
   }else b+=`<p class="notice">${m.roleKey==='succubus'&&!state.demonLocked?'Your action window opens after the GM locks the demon vote.':'Your action window is closed. Unlocked selections are not submitted.'}</p>`;
   if(a.answer)b+=`<div class="private-answer"><span>PRIVATE INQUIRY RESULT</span><strong>${esc(a.answer)}</strong></div>`;
   if(m.roleKey==='guard')b+=`<p>Lives: ${m.guardLives??'—'}/3</p>`;
   if(m.roleKey==='doctor')b+=`<p>Self-protection: ${m.doctorSelf??'—'} · Poison: ${m.doctorPoison??'—'}</p>`;
   if(m.roleKey==='priest')b+=`<p>Protections: ${m.priestProtect??'—'} · Redirect: ${m.priestRedirect??'—'}</p>`;
  }
 }
 if(m.alive&&state.phase==='day'&&!state.skipTrialToday&&!state.trialDone)b+=`<h3>Public nomination</h3><form id="nominate"><select name="target">${options()}</select><button>Vote to nominate</button></form><p class="small">Your nomination is public. The GM opens the final trial.</p>`;
 if(m.alive&&state.phase==='trial')b+=`<h3>Trial: ${esc(name(state.trialTarget))}</h3><div class="row">${['execute','spare','abstain'].map(v=>`<button data-trial-vote="${v}" class="${v==='execute'?'danger':'secondary'}">${v.toUpperCase()}</button>`).join('')}</div><p>Your vote: ${esc(state.myVote||'not submitted')}</p>`;
 if(state.roleResults?.length)b+=`<details open class="role-results"><summary>Your private results</summary>${[...state.roleResults].reverse().slice(0,12).map(x=>`<p><span class="small">SHIFT ${x.round}</span><br>${esc(x.text)}</p>`).join('')}</details>`;
 return panel('YOUR DESK',b,'private');
}
function gmControls(){
 let b='<p class="small">Secret information appears only on this dashboard. Share the public window when presenting.</p>';
 if(['night','day','trial'].includes(state.phase))b+=button(state.timerPaused?'Resume timer':'Pause timer',state.timerPaused?'resumeTimer':'pauseTimer','secondary')+'<br><br>';
 if(state.phase==='night'){
  b+=`<p>Attack slots: ${state.attackCount} · ${state.demonLocked?'VOTE LOCKED':'VOTING OPEN'}</p>`;
  if(!state.demonLocked){b+=`<form id="override"><label>GM target override (for missing votes or ties)</label>${Array.from({length:state.attackCount},(_,i)=>`<select name="target${i}">${state.players.filter(p=>p.alive&&!state.demonTeam?.includes(p.id)).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>`).join('')}<button class="secondary">Set target override</button></form><br>`+button('Lock demon vote','lockDemons');}
  else b+=`<p>Targets: ${state.selectedTargets.map(name).map(esc).join(', ')||'No attack'}</p>`+button('Resolve night privately','resolveNight');
  b+='<h3>Role action submissions</h3>'+state.players.filter(p=>p.alive&&['analyst','succubus','doctor','guard','priest'].includes(p.roleKey)&&!p.converted).map(p=>{
    const a=state.actions?.[p.id];return `<div class="notice"><b>${esc(p.name)} · ${esc(p.role)}</b><br>${a?.locked?'✓ LOCKED':p.roleKey==='succubus'&&!state.demonLocked?'WAITING FOR WINDOW':'NOT LOCKED / SKIPPING IF CLOSED'}${a?.locked?`<p>${a.pass?'Skipped':Object.entries(a).filter(([k])=>['protect','poison','redirect','investigate'].includes(k)).map(([k,t])=>`${esc(k)} → ${esc(name(t))}`).join('<br>')}${a.answer?`<br>Private answer delivered: ${esc(a.answer)}`:''}</p>`:''}</div>`;
  }).join('');
  b+='<h3>Demon votes</h3>'+Object.entries(state.demonVotes||{}).map(([id,ids])=>`<p>${esc(name(id))}: ${Array.isArray(ids)?ids.map(name).map(esc).join(', '):''}</p>`).join('');
 }else if(state.phase==='day'){
  b+=state.skipTrialToday||state.trialDone?'<p class="notice">No further trial voting today.</p>':`<form id="trial"><label>Nominate a player<select name="target">${options()}</select></label><button>Open trial vote</button></form><br>`;b+=button('Begin next night','nextNight');
 }else if(state.phase==='trial'){
  b+=`<p>Accused: <b>${esc(name(state.trialTarget))}</b></p><p>Execute: ${Object.values(state.votes).filter(v=>v==='execute').length} · Spare: ${Object.values(state.votes).filter(v=>v==='spare').length} · Abstain: ${Object.values(state.votes).filter(v=>v==='abstain').length}</p><form id="resolveTrial"><label>Tie decision (if configured)<select name="decision"><option value="spare">Spare</option><option value="execute">Execute</option></select></label><button>Resolve trial privately</button></form>`;
 }else if(state.phase==='review'){
  b+='<h3>Outcomes awaiting release</h3>'+state.pending.map(a=>`<p class="notice">${esc(a.text)}</p>`).join('');
  if(state.enforcerPlayer)b+=`<p>Pending Enforcer action: ${esc(name(state.enforcerPlayer))}</p><form id="enforcer"><select name="target"><option value="">Waive final action</option>${options()}</select><button class="danger">Resolve final action</button></form><br>`;
  b+=button('Release outcomes to notice board','publish');
 }
 b+=`<h3>Special-role success reports</h3><p class="small">${state.settings.autoRevealSuccess?'Auto-publication enabled after outcome release.':'Private by default. You choose which notices to release.'}</p>${(state.achievements||[]).map(a=>`<div class="achievement-private"><p>${esc(a.text)}</p><span class="small">${esc(name(a.player))} · SHIFT ${a.round} · ${a.released?'RELEASED':a.releasable?'HELD PRIVATE':'AWAITING OUTCOME RELEASE'}</span>${a.releasable&&!a.released?`<br><button data-reveal-success="${a.id}">Reveal on notice board</button>`:''}</div>`).join('')||'<p class="small">No successful tasks recorded yet.</p>'}`;
 b+=`<h3>Cat Neo · CONFIDENTIAL</h3><p>Holder: <b>${esc(name(state.cat.holder))}</b><br>Protection charges: ${state.cat.lives}/9</p><p>Pending effects: skip attack ${state.effects.skipAttack}; extra-target night ${state.effects.doubleAttack}; skip trial ${state.effects.skipTrial}.</p><details><summary>Manual public announcement</summary><form id="announce"><textarea name="text" required maxlength="1600" placeholder="Everyone will see this message."></textarea><button>Publish announcement</button></form></details>`;
 return panel('GAME MASTER CONTROL DESK',b,'private');
}
function render(){
 document.body.classList.remove('at-entrance');
 const oldMessages=document.querySelector('#messages');const atBottom=!oldMessages||oldMessages.scrollHeight-oldMessages.scrollTop-oldMessages.clientHeight<45;
 const focused=document.visibilityState!=='hidden'&&(!document.hasFocus||document.hasFocus());
 if(!publicMode&&chatOpen&&focused&&atBottom)markRead(channel);
 const oldScroll=oldMessages?.scrollTop||0;
 const identity=publicMode?'public':state.me?.id;const sameIdentity=renderIdentity===identity;
 const fieldKey=el=>`${el.closest('form')?.id||'screen'}:${el.id||el.name}`;
 const drafts={};if(sameIdentity)document.querySelectorAll('input,textarea,select').forEach(el=>{if((el.id||el.name)&&el.type!=='file')drafts[fieldKey(el)]=el.type==='checkbox'?el.checked:el.value;});const active=sameIdentity?document.activeElement?.id:null;const position=document.activeElement?.selectionStart;renderIdentity=identity;
 document.body.classList.toggle('presentation',publicMode);
 let toolbar=publicMode?'<span class="badge">PUBLIC PRESENTATION · NO SECRET DATA</span>':`${chatButtons()}<button id="copyLink" class="secondary">Copy room link</button><button id="popup" class="secondary">Detach chat</button>${state.me?.gm?'<button id="publicWindow">Open public presentation</button><button id="privacy" class="danger">Hide all secrets</button>':''}<button id="reconnectKey" class="secondary">Save reconnect key</button><button id="leave" class="secondary">Leave screen</button>`;
 if(publicMode&&params.get('view')!=='public')toolbar+='<button id="privacyReturn">Return to private dashboard</button>';
 const phase=`<div class="phase"><div><span class="small">ROOM ${code} · ${state.gmName?'GM '+esc(state.gmName):'NO GM YET'}</span><br><strong>${state.phase.toUpperCase()} ${state.round?'· '+state.round:''}</strong></div><span id="timer" class="counter"></span></div>`;
 let content;
 if(publicMode)content=roster()+`<div class="ledger-layout">${announcements()}<div>${rules()}</div></div>`;
 else if(chatOnly)content=chat();
 else if(state.phase==='lobby')content=roster()+`<div class="ledger-layout"><div>${lobby()}${chatOpen?chat():''}${announcements()}</div><div>${state.me.gm?settings():rules()}</div></div>`;
 else content=roster()+`<div class="ledger-layout"><div>${announcements()}${chatOpen?chat():''}</div><div>${state.me.gm?gmControls():playerControls()}${state.me.gm?panel('PRIVATE EVENT LOG',`<div class="log">${[...state.privateLog].reverse().slice(0,60).map(x=>`<p>${esc(x.text)}</p>`).join('')}</div>`,'private'):`<details><summary>Rules & role reference</summary>${rules()}</details>`}</div></div>`;
 app.innerHTML=`${window.OFFLINE_APP?window.OFFLINE_APP.toolbar():''}<div class="toolbar">${toolbar}</div>${phase}${content}`;
 document.querySelectorAll('input,textarea,select').forEach(el=>{const key=fieldKey(el);if(key in drafts&&el.type!=='file'){if(el.type==='checkbox')el.checked=drafts[key];else el.value=drafts[key];}});
 if(active){const el=document.getElementById(active);el?.focus();if(position!=null&&el?.setSelectionRange&&el.type!=='number')try{el.setSelectionRange(position,position);}catch{}}
 const messages=document.querySelector('#messages');if(messages){messages.scrollTop=atBottom?messages.scrollHeight:oldScroll;messages.onscroll=()=>{if(messages.scrollHeight-messages.scrollTop-messages.clientHeight<45&&focused){markRead(channel);document.querySelectorAll(`[data-channel="${channel}"]`).forEach(b=>{b.classList.remove('unread');b.querySelector('.unread-count')?.remove();});}};}
 bind();tick();if(window.OFFLINE_APP)window.OFFLINE_APP.bind();
}
function bind(){
 const on=(id,fn)=>{const el=document.getElementById(id);if(el)el.onclick=fn;};
 const form=(id,fn)=>{const el=document.getElementById(id);if(el)el.onsubmit=e=>{e.preventDefault();fn(Object.fromEntries(new FormData(el)));};};
 document.querySelectorAll('[data-command]').forEach(el=>el.onclick=()=>{const c=el.dataset.command;command(c==='pauseTimer'||c==='resumeTimer'?'timer':c,c==='pauseTimer'?{mode:'pause'}:c==='resumeTimer'?{mode:'resume'}:{});});
 document.querySelectorAll('[data-channel]').forEach(el=>el.onclick=()=>{channel=el.dataset.channel;chatOpen=true;markRead(channel);render();});
 document.querySelectorAll('[data-answer]').forEach(el=>el.onclick=()=>command('answer',{player:el.dataset.answer}));
 document.querySelectorAll('[data-trial-vote]').forEach(el=>el.onclick=()=>command('trialVote',{vote:el.dataset.trialVote}));
 on('closeChat',()=>{chatOpen=false;render();});
 document.querySelectorAll('[data-reveal-success]').forEach(el=>el.onclick=()=>command('revealAchievement',{id:el.dataset.revealSuccess}));
 form('nominate',b=>command('nominateVote',b));
 form('gmVote',b=>command('voteGM',b));form('claim',b=>command('claimGM',b));form('action',b=>command('action',b));form('trial',b=>command('trial',b));form('enforcer',b=>command('enforcer',b));form('resolveTrial',b=>command('resolveTrial',b));form('announce',b=>command('announcement',b));
 form('demonVote',b=>command('demonVote',{targets:Object.values(b)}));form('override',b=>command('targetOverride',{targets:Object.values(b)}));
 form('settings',b=>{const roles={};for(const [k,v]of Object.entries(b))if(k.startsWith('role-'))roles[k.slice(5)]=Number(v);command('settings',{settings:{priestTarget:b.priestTarget,tie:b.tie,nightSeconds:Number(b.nightSeconds),daySeconds:Number(b.daySeconds),trialSeconds:Number(b.trialSeconds),autoRevealSuccess:!!document.querySelector('#settings input[name=autoRevealSuccess]')?.checked,roles}});});
 form('chatForm',()=>{const input=document.querySelector('#chatText');const text=input.value;if(text.trim()){input.value='';command('chat',{channel,text});}});
 on('revealRole',()=>{roleHidden=!roleHidden;render();});
 on('copyLink',async()=>{if(window.OFFLINE_APP){toast('Offline simulation: no multiplayer link. Use the hosted version for colleagues.');return;}try{await navigator.clipboard.writeText(`${location.origin}/?room=${code}`);toast('Room link copied.');}catch{toast(`Room link: ${location.origin}/?room=${code}`);}});
 on('popup',()=>{if(window.OFFLINE_APP){window.OFFLINE_APP.popup('chat');return;}window.open(`/?room=${code}&view=chat`,'draft-chat-'+code,'popup,width=680,height=700');});
 on('publicWindow',()=>{if(window.OFFLINE_APP){window.OFFLINE_APP.popup('public');return;}window.open(`/?room=${code}&view=public`,'draft-public-'+code);});
 on('privacy',()=>{publicMode=true;state=null;app.innerHTML='<div class="terminal">Switching to public presentation…</div>';connect();});
 on('privacyReturn',()=>{publicMode=false;state=null;app.innerHTML='<div class="terminal">Opening private dashboard…</div>';connect();});
 on('leave',()=>{streamAbort?.abort();state=null;token=null;code='';if(!window.OFFLINE_APP)history.replaceState(null,'','/');home();if(window.OFFLINE_APP)window.OFFLINE_APP.bindHome();});
 on('reconnectKey',()=>{if(window.OFFLINE_APP){window.OFFLINE_APP.exportSave();return;}const blob=new Blob([`PRIVATE — do not share\nRoom: ${code}\nReconnect key: ${token}\nOpen ${location.origin} and use Reconnect with a saved key.\n`],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`private-reconnect-${code}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
}
function tick(){const el=document.getElementById('timer');if(!el||!state)return;el.textContent=state.timerPaused?'PAUSED':state.deadline?(()=>{const seconds=Math.max(0,Math.ceil((state.deadline-Date.now())/1000));return seconds?`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'TIME UP · GM TO ADVANCE';})():'NO TIMER';}
setInterval(()=>{tick();if(state?.actionWindow&&state.deadline&&Date.now()>state.deadline){state.actionWindow=false;render();}},1000);
if(document.addEventListener){document.addEventListener('visibilitychange',()=>{if(state&&!publicMode&&chatOpen&&document.visibilityState==='visible')render();});window.addEventListener?.('focus',()=>{if(state&&!publicMode&&chatOpen)render();});}
if(code&&(token||publicMode))connect();else home();if(window.OFFLINE_APP)window.OFFLINE_APP.bindHome();
