import { randomInt, randomBytes } from 'node:crypto';
export const ROLES = {
  drafter: 'Drafter', auditor: 'The Auditor', beast: 'Deadline Beast', ink: 'Ink Demon', manager: 'Whispering Manager',
  burnout: 'Burned-Out Drafter', succubus: 'Succubus', analyst: 'Analyst', guard: 'Office Security Guard', doctor: 'Office Doctor', enforcer: 'Enforcer', heaven: 'Touched by Heaven', priest: 'Priest'
};
export const DEMONS = ['auditor','beast','ink','manager','converted'];
export const label = p => p.converted ? 'Workload Demon (converted)' : ROLES[p.role] || p.role;
export const isDemon = p => p.converted || DEMONS.includes(p.role);
export const isEvil = p => isDemon(p) || p.role === 'succubus';
export const alive = r => r.players.filter(p => p.alive);
const pick = list => list.length ? list[randomInt(list.length)] : null;
const fail = message => { throw new Error(message); };
const requireThat = (condition, message) => { if (!condition) fail(message); };
const clean = (value, max=1600) => String(value || '').trim().slice(0,max);
export const defaults = () => ({ priestTarget:'player', tie:'acquit', nightSeconds:180, daySeconds:300, trialSeconds:90, autoRevealSuccess:false, roles:{ auditor:1,beast:1,ink:1,manager:1,burnout:1,succubus:1,analyst:1,guard:1,doctor:1,enforcer:1,heaven:1,priest:1 } });
export function newRoom(code, nickname, gmSecret) {
  const r = {code, phase:'lobby', round:0, players:[], gmId:null, gmSecret, settings:defaults(), channels:{public:[],demons:[]}, announcements:[], pending:[], actions:{}, votes:{}, gmVotes:{}, cat:{holder:null,lives:9}, skipAttack:0, doubleAttack:0, skipTrial:0, skipTrialToday:false, demonLocked:false, selectedTargets:[], trialTarget:null, deadline:null, timerPaused:false, timerRemaining:0, winner:null, revision:0, actionDrafts:{}, roleResults:{}, achievements:[], nominations:{}, voteHistory:[], schema:2, created:Date.now(), privateLog:[], publicRoster:null, publicAnnouncements:null, publicWinner:null };
  addPlayer(r,nickname); return r;
}
export function addPlayer(r,nickname) {
  requireThat(r.phase==='lobby','The game has started. Reconnect using your saved session.');
  const name=clean(nickname,30); requireThat(name.length>=2,'Use a nickname with 2–30 characters.');
  requireThat(!r.players.some(p=>p.name.toLowerCase()===name.toLowerCase()),'That nickname is already taken.');
  requireThat(r.players.filter(p=>p.id!==r.gmId).length<30,'This room already has 30 players.');
  const p={id:randomBytes(12).toString('hex'),token:randomBytes(32).toString('hex'),name,role:null,alive:true,ghost:false,converted:false,guardLives:3,doctorSelf:1,doctorPoison:1,priestProtect:2,priestRedirect:1,enforcerUsed:false,lastSeen:Date.now()};
  r.players.push(p); return p;
}
function msg(r,channel,sender,text) { r.channels[channel] ||= []; r.channels[channel].push({id:randomBytes(6).toString('hex'),sender,text:clean(text),at:Date.now()}); if(r.channels[channel].length>500)r.channels[channel].shift(); }
function log(r,text){r.privateLog.push({text,at:Date.now()});if(r.privateLog.length>500)r.privateLog.shift();}
function announce(r,text,kind='event'){r.pending.push({id:randomBytes(8).toString('hex'),text,kind,at:Date.now(),media:null});}
function notice(r,text,kind='event'){r.announcements.push({id:randomBytes(8).toString('hex'),text,kind,at:Date.now(),media:null});if(r.announcements.length>250)r.announcements.shift();}
export function upgradeRoom(r){
  r.actionDrafts||={};r.roleResults||={};r.achievements||=[];r.nominations||={};r.voteHistory||=[];
  r.settings.autoRevealSuccess=!!r.settings.autoRevealSuccess;
  if(r.schema!==2){
    for(const a of Object.values(r.actions||{}))a.locked=true;
    for(const m of r.channels.public||[])if(m.sender==='SYSTEM'||m.sender==='OFFICE INTERCOM')notice(r,m.text,'office');
    r.channels={public:(r.channels.public||[]).filter(m=>m.sender!=='SYSTEM'&&m.sender!=='OFFICE INTERCOM'),demons:r.channels.demons||[]};r.schema=2;
  }
  return r;
}
function result(r,p,text,pending=false){r.roleResults[p.id]||=[];r.roleResults[p.id].push({id:randomBytes(8).toString('hex'),round:r.round,text,at:Date.now(),pending});if(r.roleResults[p.id].length>100)r.roleResults[p.id].shift();}
function success(r,p,key,text){
  if(r.achievements.some(a=>a.player===p.id&&a.round===r.round&&a.key===key))return;
  r.achievements.push({id:randomBytes(8).toString('hex'),player:p.id,round:r.round,key,text,released:false,releasable:false});
}
function actionWindow(r,p){
  requireThat(p.id!==r.gmId&&p.alive&&r.phase==='night'&&!isDemon(p),'Actions are only available to living special roles at night.');
  requireThat(['analyst','succubus','doctor','guard','priest'].includes(p.role),'Your role has no selectable night action.');
  requireThat(p.role==='succubus'?r.demonLocked:!r.demonLocked,p.role==='succubus'?'Succubus acts after the demon vote is locked.':'This action window has closed.');
  requireThat(!r.actions[p.id]?.locked,'Your actions are locked for this night.');
}
export function completion(r){
  const living=r.players.filter(p=>p.alive&&!p.disqualified&&p.id!==r.gmId);
  let required=[];
  if(r.phase==='night'){
    if(!r.demonLocked){
      required=living.filter(p=>!isDemon(p)&&['analyst','doctor','guard','priest'].includes(p.role)).map(p=>({player:p.id,name:p.name,kind:'role',done:!!r.actions[p.id]?.locked}));
      if(!r.skipAttack)required.push(...living.filter(isDemon).map(p=>({player:p.id,name:p.name,kind:'demon',done:Array.isArray(r.votes[p.id])})));
    }else required=living.filter(p=>p.role==='succubus'&&!isDemon(p)).map(p=>({player:p.id,name:p.name,kind:'role',done:!!r.actions[p.id]?.locked}));
  }else if(r.phase==='day'&&!r.skipTrialToday&&!r.trialDone)required=living.map(p=>({player:p.id,name:p.name,kind:'nomination',done:Object.hasOwn(r.nominations,p.id)}));
  else if(r.phase==='trial')required=living.map(p=>({player:p.id,name:p.name,kind:'trial',done:Object.hasOwn(r.votes,p.id)}));
  else if(r.phase==='review'&&r.enforcerPending){const p=r.players.find(p=>p.id===r.enforcerPending);if(p&&!p.disqualified)required=[{player:p.id,name:p.name,kind:'enforcer',done:false}];}
  return required;
}
function requireComplete(r){const missing=completion(r).filter(x=>!x.done);requireThat(!missing.length,`Waiting for decisions: ${missing.map(x=>x.name).join(', ')}. Each player must act or skip; GM can override or disqualify.`);}
function disqualify(r,p,reason){
  requireThat(p&&p.id!==r.gmId&&!p.disqualified,'Select an employee who is not already disqualified; GM cannot disqualify themselves.');
  p.disqualified=true;p.alive=false;p.ghost=false;p.enforcerUsed=true;
  delete r.actions[p.id];delete r.actionDrafts[p.id];delete r.nominations[p.id];delete r.votes[p.id];if(r.enforcerPending===p.id)r.enforcerPending=null;
  for(const [id,a]of Object.entries(r.actions))if(!a.investigate&&['protect','poison','redirect'].some(k=>a[k]===p.id)){r.actions[id]={locked:true,pass:true,cancelledByDQ:true};const actor=r.players.find(x=>x.id===id);if(actor)result(r,actor,'Your selected target was disqualified. This action has been cancelled.');}
  for(const [id,ids]of Object.entries(r.votes))if(Array.isArray(ids))r.votes[id]=ids.filter(x=>x!==p.id);
  for(const [id,t]of Object.entries(r.nominations))if(t===p.id)r.nominations[id]=null;
  r.selectedTargets=r.selectedTargets.filter(id=>id!==p.id);if(r.targetOverride)r.targetOverride=r.targetOverride.filter(id=>id!==p.id);
  if(r.cat.holder===p.id)r.cat.holder=null;
  const text=`${p.name} has been disqualified and removed from play.${p.role?' Their role was '+label(p)+'.':''}`;
  notice(r,text,'disqualification');log(r,`GM disqualified ${p.name}: ${reason}. Administrative removal; no death-trigger abilities or protection charges apply.`);
  if(r.publicRoster){const row=r.publicRoster.find(x=>x.id===p.id);if(row)Object.assign(row,{alive:false,ghost:false,disqualified:true,role:p.role?label(p):null});r.publicAnnouncements.push(r.announcements.at(-1));}
  if(r.trialTarget===p.id&&r.phase==='trial'){r.trialDone=true;r.voteHistory.push({round:r.round,target:p.id,nominations:{...r.nominations},votes:{...r.votes},cancelled:'Accused disqualified'});setPhase(r,'day',r.settings.daySeconds);notice(r,'The trial is cancelled because the accused was disqualified.','office');}
  if(r.phase!=='lobby'&&r.phase!=='review'){victory(r);if(r.winner)setPhase(r,'finished');}
}
function setPhase(r,phase,seconds=0){r.phase=phase;r.deadline=seconds>0?Date.now()+seconds*1000:null;r.timerPaused=false;}
function target(r,id){const p=r.players.find(p=>p.id===id && p.id!==r.gmId);requireThat(p&&p.alive,'Choose a living player.');return p;}
function gm(r,p){requireThat(p.id===r.gmId,'Only the Game Master can do that.');}
function frozen(r){r.publicRoster=r.players.filter(p=>p.id!==r.gmId).map(p=>({id:p.id,name:p.name,alive:p.alive,ghost:p.ghost,role:!p.alive?label(p):null,disqualified:!!p.disqualified}));r.publicAnnouncements=[...r.announcements];r.publicWinner=r.winner;}
function beginReview(r){frozen(r);setPhase(r,'review');}
function victory(r){
  const living=alive(r).filter(p=>p.id!==r.gmId); const demons=living.filter(isDemon);const good=living.filter(p=>!isEvil(p));
  if(!demons.length)r.winner='Drafters';else if(demons.length>=good.length)r.winner='Workload Demons';
}
function death(r,p,cause){
  if(!p.alive)return; p.alive=false;p.ghost=false;announce(r,`${p.name} has been eliminated. Their role was ${label(p)}.`);log(r,`${p.name} died: ${cause}.`);
  if(p.role==='succubus')r.doubleAttack=1;
  if(p.role==='heaven'){if(cause==='demons'){r.skipAttack=1;log(r,'Touched by Heaven: demons will miss their next attack.');}if(cause==='trial'){r.skipTrial=1;log(r,'Touched by Heaven: no trial vote on the next day.');}}
  if(p.role==='enforcer'&&!p.enforcerUsed)r.enforcerPending=p.id;
}
function catSave(r,p){if(r.cat.holder===p.id&&r.cat.lives>0){r.cat.lives--;announce(r,`Cat Neo appears! ${p.name} survives.`);log(r,`Cat Neo saves ${p.name}; ${r.cat.lives} charges remain.`);return true;}return false;}
function startNight(r){
  r.round++;r.actions={};r.actionDrafts={};r.nominations={};r.votes={};r.selectedTargets=[];r.demonLocked=false;r.trialTarget=null;r.enforcerPending=null;r.guardSpent=[];
  r.cat.holder=r.cat.lives>0?pick(alive(r).filter(p=>p.id!==r.gmId))?.id:null;
  log(r,`Night ${r.round}: Cat Neo assigned secretly.`);setPhase(r,'night',r.settings.nightSeconds);
}
function attack(r,p,cause,visited=new Set()){
  if(!p?.alive||visited.has(p.id))return;visited.add(p.id);
  if(catSave(r,p))return;
  if(cause==='demons'){
    const guards=alive(r).filter(g=>g.role==='guard'&&(g.guardLives>0||r.guardSpent.includes(g.id))&&(g.id===p.id||r.actions[g.id]?.protect===p.id));
    if(guards.length){for(const g of guards){success(r,g,'guard-save','Office Security Guard has successfully blocked an attack.');result(r,g,'Your protection prevented an attack.',true);if(!r.guardSpent.includes(g.id)){g.guardLives--;r.guardSpent.push(g.id);log(r,`${g.name} used one Bodyguard life (${g.guardLives} remain).`);}}return;}
    const priest=alive(r).find(g=>g.role==='priest'&&r.actions[g.id]?.protect===p.id&&g.priestProtect>0&&!r.actions[g.id]?.protectionUsed);
    if(priest){priest.priestProtect--;r.actions[priest.id].protectionUsed=true;success(r,priest,'priest-save','Priest has successfully protected an employee.');result(r,priest,'Your protection prevented an attack.',true);log(r,`${priest.name} used a protection.`);return;}
    if(p.role==='priest'&&p.priestRedirect>0){
      let redirected=r.settings.priestTarget==='random'?pick(alive(r).filter(x=>x.id!==p.id&&x.id!==r.gmId)):r.players.find(x=>x.id===r.actions[p.id]?.redirect&&x.alive);
      if(redirected){p.priestRedirect--;success(r,p,'priest-redirect','Priest has successfully redirected an attack.');result(r,p,'Your redirection was used.',true);log(r,`${p.name} redirected attack to ${redirected.name}.`);attack(r,redirected,cause,visited);return;}
    }
    const doctor=alive(r).find(g=>g.role==='doctor'&&r.actions[g.id]?.protect===p.id);
    if(doctor){success(r,doctor,'doctor-save','Office Doctor has successfully saved an employee.');result(r,doctor,'Your protection prevented an attack.',true);log(r,`${doctor.name} protected ${p.name}.`);return;}
    if(p.role==='burnout'&&!p.converted){p.converted=true;log(r,`${p.name} secretly became a demon.`);return;}
  }
  death(r,p,cause);
}
function lockDemons(r){
  requireComplete(r);
  requireThat(r.phase==='night'&&!r.demonLocked,'Demon voting is not open.');
  const count=r.skipAttack>0?0:r.doubleAttack>0?2:1;const scores=new Map();
  for(const [id,ids] of Object.entries(r.votes)){const voter=r.players.find(p=>p.id===id);if(voter?.alive&&isDemon(voter))for(const t of ids)scores.set(t,(scores.get(t)||0)+1);}
  let groups=[...scores.entries()].filter(([id])=>r.players.some(p=>p.id===id&&p.alive&&!isDemon(p))).sort((a,b)=>b[1]-a[1]);
  // Ties stay under GM control: no hidden automatic kill choice.
  if(!r.targetOverride&&count&&groups.length){const cutoff=groups[Math.min(count,groups.length)-1][1];const higher=groups.filter(x=>x[1]>cutoff),tied=groups.filter(x=>x[1]===cutoff);if(higher.length+tied.length>count){fail('Demon target vote is tied. Use GM target override before locking.');}}
  r.selectedTargets=r.targetOverride ? [...r.targetOverride] : groups.slice(0,count).map(x=>x[0]);delete r.targetOverride;
  if(count&&r.selectedTargets.length)requireThat(r.selectedTargets.length===Math.min(count,alive(r).filter(p=>p.id!==r.gmId&&!isDemon(p)).length),'Demon targets are missing. Ask for votes or use the GM target override.');
  r.demonLocked=true;setPhase(r,'night',r.settings.nightSeconds);log(r,'Demon vote locked. Succubus investigation is now available.');
}
export function perform(r,p,cmd,data={}){
  upgradeRoom(r);
  switch(cmd){
  case 'claimGM':
    requireThat(r.phase==='lobby','GM selection is only available in the lobby.');requireThat(!r.gmId,'A Game Master is already selected.');
    requireThat(p.name.toLowerCase()==='darius'&&data.secret===r.gmSecret,'Automatic Darius selection requires the private GM code.');r.gmId=p.id;notice(r,`${p.name} is the Game Master.`,'office');break;
  case 'voteGM':{
    requireThat(r.phase==='lobby'&&!r.gmId,'GM voting is closed.');requireThat(r.players.some(x=>x.id===data.target&&!x.disqualified),'Choose a candidate.');r.gmVotes[p.id]=data.target;
    const counts=Object.values(r.gmVotes).filter(x=>x===data.target).length;
    if(counts>r.players.filter(x=>!x.disqualified).length/2){r.gmId=data.target;notice(r,`${r.players.find(x=>x.id===data.target).name} was elected Game Master.`,'office');}break;}
  case 'settings':{
    gm(r,p);requireThat(r.phase==='lobby','Settings are locked once play starts.');const s=data.settings;
    requireThat(s&&['player','random'].includes(s.priestTarget)&&['acquit','gm'].includes(s.tie),'Invalid rule settings.');
    for(const k of ['nightSeconds','daySeconds','trialSeconds'])requireThat(Number.isInteger(s[k])&&s[k]>=0&&s[k]<=7200,'Timers must be 0–7200 seconds.');
    for(const [role,n] of Object.entries(s.roles||{}))requireThat(role in ROLES&&role!=='drafter'&&Number.isInteger(n)&&n>=0&&n<=(DEMONS.includes(role)?30:1),'Use 0–1 for unique special roles, and 0–30 for demon variants.');
    requireThat(Object.keys(s.roles||{}).length===Object.keys(defaults().roles).length,'Provide every special-role count.');requireThat(s.autoRevealSuccess===undefined||typeof s.autoRevealSuccess==='boolean','Success notice setting must be a checkbox.');r.settings={...structuredClone(s),autoRevealSuccess:!!s.autoRevealSuccess};break;}
  case 'start':{
    gm(r,p);requireThat(r.phase==='lobby','Game already started.');const ps=r.players.filter(x=>x.id!==r.gmId&&!x.disqualified);requireThat(ps.length>=4,'At least four players are needed.');
    const deck=Object.entries(r.settings.roles).flatMap(([role,n])=>Array(n).fill(role));requireThat(deck.length<=ps.length,'Special-role counts exceed player count. Lower counts in the rules board.');requireThat(deck.some(x=>DEMONS.includes(x)),'Include at least one Workload Demon.');
    while(deck.length<ps.length)deck.push('drafter');for(let i=deck.length-1;i>0;i--){const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
    ps.forEach((x,i)=>{x.role=deck[i];});r.announcements.push({text:'The office doors are locked. Trust no one.',at:Date.now(),media:null});startNight(r);break;}
  case 'chat':{
    const channel=clean(data.channel,50), text=clean(data.text);requireThat(text,'Enter a message.');
    requireThat(canRead(r,p,channel),'This channel is private or unavailable.');
    if(p.id!==r.gmId){requireThat(r.phase!=='review','The GM is reviewing outcomes. Chat resumes after the announcement.');requireThat(p.alive||p.ghost,'Spectators cannot write.');if(channel==='public')requireThat(r.phase!=='night','Public chat is quiet during the night.');}
    msg(r,channel,p.name,text);break;}
  case 'action':{
    actionWindow(r,p);const t=target(r,data.target);const a=r.actionDrafts[p.id]||={};
    if(data.kind==='investigate'){
      requireThat(['analyst','succubus'].includes(p.role),'Your role cannot investigate.');requireThat(t.id!==p.id,'Choose another player.');a.investigate=t.id;
    }else if(data.kind==='protect'){
      requireThat(['guard','doctor','priest'].includes(p.role),'Your role cannot protect.');
      if(p.role==='guard')requireThat(p.guardLives>0,'No Bodyguard lives remain.');
      if(p.role==='priest')requireThat(p.priestProtect>0&&p.id!==t.id,'Priest cannot protect himself and needs a protection use.');
      if(p.role==='doctor'){requireThat(!(t.id===p.id&&p.doctorSelf===0),'Self-protection was already used.');delete a.poison;}
      a.protect=t.id;
    }else if(data.kind==='poison'){
      requireThat(p.role==='doctor'&&p.doctorPoison>0,'Poison is unavailable.');a.poison=t.id;delete a.protect;
    }else if(data.kind==='redirect'){
      requireThat(p.role==='priest'&&p.priestRedirect>0&&r.settings.priestTarget==='player','Redirection selection is unavailable.');requireThat(p.id!==t.id,'Choose another player.');a.redirect=t.id;
    }else fail('Unknown action.');break;
  }
  case 'clearAction':actionWindow(r,p);delete r.actionDrafts[p.id];break;
  case 'skipAction':
  case 'lockAction':{
    actionWindow(r,p);const a=cmd==='skipAction'?{pass:true}:r.actionDrafts[p.id];requireThat(a&&Object.keys(a).length,'Select an action first, or choose Skip.');
    for(const k of ['protect','poison','redirect','investigate'])if(a[k])target(r,a[k]);
    r.actions[p.id]={...a,locked:true,lockedAt:Date.now()};delete r.actionDrafts[p.id];const locked=r.actions[p.id];
    if(locked.investigate){const t=target(r,locked.investigate);const yes=p.role==='analyst'?isEvil(t):t.role==='analyst';locked.answered=true;locked.answer=yes?'Yes':'No';result(r,p,`Inquiry about ${t.name}: ${locked.answer}.`);
      if(yes)success(r,p,'investigation',p.role==='succubus'?'Succubus has successfully identified the Analyst.':'Analyst has successfully identified a Workload Demon.');
    }
    log(r,`${p.name} locked ${locked.pass?'a skipped turn':'their role action'}.`);break;
  }
  case 'demonVote':{
    requireThat(r.phase==='night'&&!r.demonLocked&&p.alive&&isDemon(p),'Demon voting is unavailable.');const count=r.skipAttack?0:r.doubleAttack?2:1;requireThat(count>0,'Demons are sick and miss this attack.');const ids=[...new Set(data.targets||[])];requireThat(ids.length===count,'Select the required number of different targets.');ids.forEach(id=>requireThat(!isDemon(target(r,id)),'Demons cannot target a fellow demon.'));r.votes[p.id]=ids;break;}
  case 'targetOverride':gm(r,p);requireThat(r.phase==='night'&&!r.demonLocked,'Targets are locked.');{
    const count=r.skipAttack?0:r.doubleAttack?2:1;const ids=[...new Set(data.targets||[])];requireThat(ids.length===0||ids.length===count,'Choose the required number of targets, or explicitly waive the attack.');ids.forEach(id=>requireThat(!isDemon(target(r,id)),'Choose a non-demon target.'));r.targetOverride=ids;log(r,'GM set a demon target override.');break;}
  case 'lockDemons':gm(r,p);lockDemons(r);break;
  case 'answer':{
    // Compatibility for older GM clients. Answers are now delivered on lock-in.
    gm(r,p);requireThat(r.phase==='night'&&r.actions[data.player]?.locked&&r.actions[data.player]?.investigate,'No locked investigation.');break;
  }
  case 'revealAchievement':{
    gm(r,p);const a=r.achievements.find(x=>x.id===data.id);requireThat(a&&a.releasable&&!a.released&&r.phase!=='review','This success notice is not available for release.');notice(r,a.text,'success');a.released=true;break;
  }
  case 'resolveNight':{
    gm(r,p);requireThat(r.phase==='night'&&r.demonLocked,'Lock demon voting first.');requireComplete(r);requireThat(!Object.values(r.actions).some(a=>a.investigate&&!a.answered),'Answer pending investigations first.');beginReview(r);
    for(const x of r.players)if(r.actions[x.id]?.locked&&!r.actions[x.id]?.investigate)result(r,x,r.actions[x.id].pass?'You skipped this night.':'Your locked action has been processed.',true);
    // Record consumable uses before attacks; resolve poison after demon attacks.
    const poisons=[];for(const x of alive(r)){const a=r.actions[x.id]||{};if(x.role==='doctor'){if(a.protect===x.id)x.doctorSelf--;if(a.poison){x.doctorPoison--;poisons.push({target:a.poison,doctor:x.id});}}}
    const sick=r.skipAttack>0;r.skipAttack=0;r.doubleAttack=0;
    if(sick)log(r,'Demons skipped tonight’s attack.');else for(const id of r.selectedTargets)attack(r,r.players.find(x=>x.id===id),'demons');
    for(const shot of poisons){const t=r.players.find(x=>x.id===shot.target);const wasAlive=t?.alive;attack(r,t,'poison');if(wasAlive&&!t.alive){const doctor=r.players.find(x=>x.id===shot.doctor);success(r,doctor,'poison','Office Doctor has successfully used the poison.');}}
    if(!r.pending.length)announce(r,'Morning arrives. No one was eliminated.');r.reviewNext='day';break;}
  case 'publish':{
    gm(r,p);requireThat(r.phase==='review','There are no outcomes awaiting release.');requireThat(!r.enforcerPending,'Resolve or waive the Enforcer’s final action first.');
    r.announcements.push(...r.pending);r.pending=[];
    for(const a of r.achievements){if(a.round<=r.round&&!a.released){a.releasable=true;if(r.settings.autoRevealSuccess){notice(r,a.text,'success');a.released=true;}}}
    for(const results of Object.values(r.roleResults))for(const x of results)x.pending=false;if(r.announcements.length>250)r.announcements=r.announcements.slice(-250);
    r.publicRoster=null;r.publicAnnouncements=null;victory(r);r.publicWinner=null;
    if(r.winner)setPhase(r,'finished');else{if(r.reviewNext==='day'){r.skipTrialToday=!!r.skipTrial;r.skipTrial=0;r.trialDone=false;}setPhase(r,'day',r.settings.daySeconds);}
    if(r.reviewNext==='day')for(const x of r.players){if(x.converted&&!x.conversionNotified){result(r,x,'The workload consumes you. You have become a Workload Demon.');x.conversionNotified=true;}}
    r.reviewNext=null;break;}
  case 'skipDecision':{
    const entry=completion(r).find(x=>x.player===p.id);requireThat(entry,'You do not have a decision in this phase.');
    if(entry.kind==='role'){perform(r,p,'skipAction');break;}
    if(entry.kind==='demon')r.votes[p.id]=[];else if(entry.kind==='nomination')r.nominations[p.id]=null;else if(entry.kind==='trial')r.votes[p.id]='abstain';else{perform(r,p,'enforcer',{});}
    break;
  }
  case 'gmDecision':{
    gm(r,p);const entry=completion(r).find(x=>x.player===data.player&&!x.done);requireThat(entry,'Select a player with an outstanding decision.');
    const actor=r.players.find(x=>x.id===entry.player);const reason=clean(data.reason,250)||'Player unavailable';
    if(data.kind==='skip'){perform(r,actor,'skipDecision');}
    else if(entry.kind==='role'){delete r.actionDrafts[actor.id];perform(r,actor,'action',{kind:data.kind,target:data.target});perform(r,actor,'lockAction');r.actions[actor.id].gmOverride=true;}
    else if(entry.kind==='demon'){perform(r,actor,'demonVote',{targets:data.targets||[data.target]});}
    else if(entry.kind==='nomination'){perform(r,actor,'nominateVote',{target:data.target});}
    else if(entry.kind==='trial'){perform(r,actor,'trialVote',{vote:data.kind});}
    else perform(r,actor,'enforcer',{target:data.target});
    log(r,`GM override for ${actor.name}: ${data.kind}; ${reason}.`);result(r,actor,'The Game Master submitted your outstanding decision.');break;
  }
  case 'disqualify':gm(r,p);requireThat(r.phase!=='finished','The game is already finished.');disqualify(r,r.players.find(x=>x.id===data.player),clean(data.reason,250)||'Emergency departure');break;
  case 'nominateVote':requireThat(r.phase==='day'&&!r.skipTrialToday&&!r.trialDone&&p.alive&&p.id!==r.gmId,'Nomination voting is closed.');r.nominations[p.id]=target(r,data.target).id;break;
  case 'trial':gm(r,p);requireThat(r.phase==='day'&&!r.skipTrialToday&&!r.trialDone,'Trial is unavailable today.');requireComplete(r);r.trialTarget=target(r,data.target).id;r.votes={};setPhase(r,'trial',r.settings.trialSeconds);break;
  case 'trialVote':requireThat(r.phase==='trial'&&p.alive&&p.id!==r.gmId,'You cannot vote now.');requireThat(['execute','spare','abstain'].includes(data.vote),'Invalid vote.');r.votes[p.id]=data.vote;break;
  case 'resolveTrial':{
    gm(r,p);requireThat(r.phase==='trial','No trial is running.');requireComplete(r);const yes=Object.values(r.votes).filter(v=>v==='execute').length,no=Object.values(r.votes).filter(v=>v==='spare').length;
    if(yes===no&&r.settings.tie==='gm')requireThat(['execute','spare'].includes(data.decision),'Choose a tie decision.');const execute=yes>no||(yes===no&&r.settings.tie==='gm'&&data.decision==='execute');
    r.voteHistory.push({round:r.round,target:r.trialTarget,nominations:{...r.nominations},votes:{...r.votes}});r.trialDone=true;beginReview(r);if(execute)attack(r,r.players.find(x=>x.id===r.trialTarget),'trial');else announce(r,`${r.players.find(x=>x.id===r.trialTarget).name} was spared by the office.`);r.reviewNext='trial';break;}
  case 'nextNight':gm(r,p);requireThat(r.phase==='day','Start the next night from the day phase.');requireComplete(r);startNight(r);break;
  case 'enforcer':{
    requireThat(r.phase==='review'&&r.enforcerPending,'There is no pending Enforcer action.');requireThat(p.id===r.gmId||p.id===r.enforcerPending,'Only the Enforcer or GM may choose.');const e=r.players.find(x=>x.id===r.enforcerPending);e.enforcerUsed=true;r.enforcerPending=null;
    if(data.target){const t=target(r,data.target);attack(r,t,'enforcer');if(!t.alive)success(r,e,'final-action','Enforcer has successfully carried out a final action.');}else log(r,'Enforcer final action waived.');result(r,e,'Your final action has been locked and processed.',true);break;}
  case 'ghost':requireThat(r.phase!=='review'&&p.id!==r.gmId&&!p.alive&&!p.ghost&&!p.disqualified&&!isEvil(p)&&p.role!=='analyst','You are not eligible for a ghost place.');requireThat(r.players.filter(x=>x.ghost).length<5,'All five ghost places are occupied.');p.ghost=true;notice(r,`${p.name} joins the office as a ghost.`,'ghost');break;
  case 'timer':{
    gm(r,p);requireThat(['night','day','trial'].includes(r.phase),'There is no active phase timer.');
    if(data.mode==='pause'){r.timerRemaining=r.deadline?Math.max(0,r.deadline-Date.now()):0;r.deadline=null;r.timerPaused=true;}else if(data.mode==='resume'){r.deadline=r.timerRemaining?Date.now()+r.timerRemaining:null;r.timerPaused=false;}else fail('Unknown timer command.');break;}
  case 'announcement':gm(r,p);requireThat(clean(data.text),'Enter announcement text.');requireThat(r.phase!=='review','Release reviewed outcomes before posting a manual public notice.');notice(r,clean(data.text),'office');break;
  default:fail('Unknown command.');
  }
  r.revision++;return r;
}
export function canRead(r,p,channel){
  if(channel==='public')return true;
  return channel==='demons'&&(p.id===r.gmId||(p.alive&&isDemon(p)));
}
export function view(r,p=null){
  upgradeRoom(r);const master=p?.id===r.gmId;const review=r.phase==='review';
  const roster=(!master&&review?r.publicRoster:null)||r.players.filter(x=>x.id!==r.gmId).map(x=>({id:x.id,name:x.name,alive:x.alive,ghost:x.ghost,disqualified:!!x.disqualified,role:master||!x.alive?label(x):null,...(master?{roleKey:x.role,converted:x.converted,guardLives:x.guardLives,doctorSelf:x.doctorSelf,doctorPoison:x.doctorPoison,priestProtect:x.priestProtect,priestRedirect:x.priestRedirect}: {})}));
  const out={code:r.code,phase:r.phase,round:r.round,revision:r.revision,gmName:r.players.find(x=>x.id===r.gmId)?.name||null,gmId:r.gmId,players:roster,settings:r.settings,deadline:r.deadline,timerPaused:r.timerPaused,timerRemaining:r.timerRemaining,trialTarget:r.trialTarget,skipTrialToday:r.skipTrialToday,trialDone:!!r.trialDone,winner:!master&&review?r.publicWinner:r.winner,announcements:!master&&review?r.publicAnnouncements:r.announcements,gmVotes:r.phase==='lobby'?r.gmVotes:{},nominations:r.nominations,history:r.voteHistory,votes:r.phase==='trial'||(r.phase==='day'&&r.trialDone)||(r.phase==='review'&&r.reviewNext==='trial')?r.votes:{}};
  if(!p)return out;
  const pub=roster.find(x=>x.id===p.id);out.me={id:p.id,name:p.name,gm:master,alive:review&&!master?pub?.alive:p.alive,ghost:p.ghost,disqualified:!!p.disqualified,role:review&&!master?(p.converted&&!p.conversionNotified?ROLES[p.role]:label(p)):label(p),roleKey:p.role,converted:review&&!master?!!p.conversionNotified:p.converted};
  if(!review||master){out.me.guardLives=p.guardLives;out.me.doctorSelf=p.doctorSelf;out.me.doctorPoison=p.doctorPoison;out.me.priestProtect=p.priestProtect;out.me.priestRedirect=p.priestRedirect;}
  out.channels={};for(const key of ['public','demons']){
    const allowed=review&&!master?key==='public'||(key==='demons'&&pub?.alive&&isDemon(p)&&(!p.converted||p.conversionNotified)):canRead(r,p,key);
    if(allowed)out.channels[key]=r.channels[key]||[];
  }
  out.myAction=review&&!master?{}:r.actions[p.id]||{};out.myDraft=review?{}:r.actionDrafts[p.id]||{};out.roleResults=(r.roleResults[p.id]||[]).filter(x=>!x.pending);
  out.actionWindow=r.phase==='night'&&p.alive&&p.id!==r.gmId&&!isDemon(p)&&['guard','doctor','priest','analyst','succubus'].includes(p.role)&&(p.role==='succubus'?r.demonLocked:!r.demonLocked);
  out.decision=completion(r).find(x=>x.player===p.id)||null;
  out.myVote=r.votes[p.id];out.ghostAvailable=!review&&!p.alive&&!p.ghost&&!p.disqualified&&!isEvil(p)&&p.role!=='analyst'&&r.players.filter(x=>x.ghost).length<5;
  if(!review&&((p.alive&&isDemon(p))||master)){out.demonLocked=r.demonLocked;out.attackCount=r.skipAttack?0:r.doubleAttack?2:1;out.demonTeam=r.players.filter(isDemon).map(x=>x.id);out.demonVotes=r.phase==='night'?r.votes:{};}
  if(!review&&p.alive&&p.role==='succubus')out.demonLocked=r.demonLocked;
  if(r.enforcerPending===p.id)out.enforcerPending=true;
  if(master){out.completion=completion(r);out.actions=r.actions;out.cat=r.cat;out.pending=r.pending;out.privateLog=r.privateLog;out.achievements=r.achievements;out.enforcerPlayer=r.enforcerPending;out.selectedTargets=r.selectedTargets;out.targetOverride=r.targetOverride;out.effects={skipAttack:r.skipAttack,doubleAttack:r.doubleAttack,skipTrial:r.skipTrial};}
  return out;
}
