// Existing mechanic tests explicitly acknowledge unrelated turns through the GM API.
// Strict phase-blocking behavior is tested against the raw engine in participation.test.js.
import {perform as engine,completion} from '../game.js';
export function perform(r,p,cmd,data){
 if(p.id===r.gmId&&['lockDemons','resolveNight','trial','resolveTrial','nextNight'].includes(cmd)){
  for(const entry of completion(r).filter(x=>!x.done))engine(r,p,'gmDecision',{player:entry.player,kind:'skip',reason:'Unrelated turn explicitly skipped by mechanic test'});
 }
 return engine(r,p,cmd,data);
}
