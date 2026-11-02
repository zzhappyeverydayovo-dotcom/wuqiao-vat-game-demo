export const LEVELS = [
  { name:'初登场', venue:'杂技小院', target:1, height:110, duration:70, wind:1.35, rate:1, chargeWidth:.25, catchHeight:48, tolerance:32, drift:9 },
  { name:'满堂彩', venue:'运河集市', target:1, height:165, duration:85, wind:2.1, rate:1.5, chargeWidth:.19, catchHeight:37, tolerance:25, drift:25 },
  { name:'压轴绝活', venue:'吴桥大会', target:2, height:195, duration:100, wind:2.9, rate:2, chargeWidth:.15, catchHeight:30, tolerance:21, drift:31 }
];
export const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
export function createGame(level=0,upgrades={skill:0,fame:0}) {
  return {level,upgrades:{skill:0,fame:0,...upgrades},mode:'playing',phase:'balance',elapsed:0,angle:.035,velocity:0,
    spin:1,stable:0,streak:0,bestStreak:0,tier:1,tips:0,rewardClock:0,danger:0,left:0,right:0,tapLeft:0,tapRight:0,
    lastFoot:0,lastTap:-5,grace:1.2,cheers:0,nextMilestone:3,events:[],power:0,charge:0,perfect:false,
    height:0,vy:0,vatX:0,catchX:0,vx:0,peak:0,requiredHeight:0,catches:0,phaseTime:0,
    wasBoth:false,catchArmed:0,landingReady:false,catchFlash:0,reason:''};
}
export function impulse(s,foot) {
  if(s.mode!=='playing'||s.phase!=='balance'||s.elapsed-s.lastTap<.11)return false;
  const alternate=s.lastFoot!==foot;
  s.velocity+=(foot===-1?1:-1)*(alternate?.19:.24);
  s.spin=clamp(s.spin+(alternate?.32:.12),0,2.1);
  s.lastFoot=foot;s.lastTap=s.elapsed;
  if(foot===-1)s.tapLeft=1;else s.tapRight=1;
  s.events.push({type:'tap',foot,alternate});return true;
}
function end(s,won,reason='') {s.mode=won?'won':'lost';s.reason=reason;s.events.push({type:'end',won});}
function reward(s,value,tier=5) {s.tips+=value;s.events.push({type:'tip',value,tier});}
function launch(s,l) {
  s.requiredHeight=l.height+s.catches*35;
  const low=.74-l.chargeWidth/2,high=.74+l.chargeWidth/2;
  s.perfect=s.charge>=low&&s.charge<=high;
  const altitude=s.requiredHeight*(s.perfect?1.16:.48+s.charge*.85);
  s.vy=Math.sqrt(2*185*altitude);s.height=0;s.peak=0;
  s.vatX=s.catchX;s.vx=(s.catches%2===0?1:-1)*l.drift;
  s.phase='flight';s.phaseTime=0;s.power=0;s.catchArmed=0;s.landingReady=false;
  s.events.push({type:'launch',perfect:s.perfect});
}
export function step(s,dt,input={left:false,right:false}) {
  if(s.mode!=='playing')return s;
  dt=clamp(dt,0,.04);const l=LEVELS[s.level],both=!!(input.left&&input.right),bothDown=both&&!s.wasBoth;
  s.wasBoth=both;s.elapsed+=dt;s.phaseTime+=dt;s.catchFlash=Math.max(0,s.catchFlash-dt*1.4);
  s.tapLeft=Math.max(0,s.tapLeft-dt*4);s.tapRight=Math.max(0,s.tapRight-dt*4);
  s.left+=((input.left?1:0)-s.left)*Math.min(1,dt*14);s.right+=((input.right?1:0)-s.right)*Math.min(1,dt*14);
  if(s.elapsed>=l.duration){end(s,false,'锣声收场了，还没有完成蹬接。下次脚力蓄满就试着起缸。');return s;}
  if(s.phase==='charge') {
    if(!both){launch(s,l);return s;}
    s.charge+=dt*.58;s.angle*=Math.exp(-dt*5);s.velocity=0;
    if(s.charge>1.08){s.phase='balance';s.charge=0;s.power=75;s.events.push({type:'overcharge'});}
    return s;
  }
  if(s.phase==='flight') {
    if(!both)s.landingReady=true;
    s.catchArmed=Math.max(0,s.catchArmed-dt);
    const move=(input.right?1:0)-(input.left?1:0);
    s.catchX=clamp(s.catchX+move*100*dt,-92,92);
    const flightDt=dt*(s.vy<0&&s.height<=l.catchHeight?[.35,.24,.17][s.level]:1);
    s.vatX+=s.vx*flightDt;s.vy-=185*flightDt;s.height+=s.vy*flightDt;s.peak=Math.max(s.peak,s.height);
    s.angle+=((s.vx*.0012)-s.angle*.8)*dt;
    if(bothDown&&s.landingReady){
      if(s.vy<0&&s.height<=l.catchHeight){s.catchArmed=.75;s.events.push({type:'brace'});}
      else s.events.push({type:'early'});
    }
    if(s.vy<0&&s.height<=12){
      if(s.catchArmed<=0){s.height=0;end(s,false,'接缸慢了一拍：下落进入金色接缸区时，双键同时短按。');}
      else if(Math.abs(s.vatX-s.catchX)>l.tolerance){s.height=0;end(s,false,'落点没有对齐：腾空时按左或右移动双脚，再双键接缸。');}
      else if(s.peak<s.requiredHeight){s.height=0;end(s,false,'接住了，但蹬得不够高。下次蓄力到金色区再松手。');}
      else {
        s.height=0;s.vatX=s.catchX;s.angle=0;s.velocity=0;s.spin=1.4;s.catches++;s.catchFlash=1;
        reward(s,Math.round((s.perfect?50:30)*(s.level+1)*(1+s.upgrades.fame*.3)));
        s.events.push({type:'catch',perfect:s.perfect,count:s.catches});
        if(s.catches>=l.target){s.phase='celebrate';end(s,true);}
        else {s.phase='recover';s.phaseTime=0;}
      }
    }
    return s;
  }
  if(s.phase==='recover') {
    s.catchX*=Math.exp(-dt*2);s.vatX=s.catchX;
    if(s.phaseTime>1.3){s.phase='balance';s.phaseTime=0;s.power=65;s.charge=0;s.grace=1.2;s.events.push({type:'nextkick'});}
    return s;
  }
  if(s.power>=100&&bothDown){s.phase='charge';s.phaseTime=0;s.charge=0;s.events.push({type:'charge'});return s;}
  const t=s.elapsed,disturbance=(Math.sin(t*1.37)+.52*Math.sin(t*2.41+1.7))*l.wind*.075;
  s.velocity+=(Math.sin(s.angle)*.72+disturbance+(s.left-s.right)*.92-s.velocity*1.7)*dt;
  s.angle+=s.velocity*dt;s.spin=clamp(s.spin-dt*.095+dt*(s.left+s.right)*.035,0,2.1);
  const safe=.16+s.upgrades.skill*.018,isStable=Math.abs(s.angle)<safe&&s.spin>.3;
  if(isStable) {
    s.stable+=dt;s.streak+=dt;s.bestStreak=Math.max(s.bestStreak,s.streak);
    const before=s.power;s.power=Math.min(100,s.power+dt*(19+s.upgrades.skill));
    if(before<100&&s.power>=100)s.events.push({type:'ready'});
    s.tier=s.streak>=12?5:s.streak>=7?3:s.streak>=3?2:1;s.rewardClock+=dt;
    if(s.rewardClock>=1){s.rewardClock-=1;reward(s,Math.round(s.tier*l.rate*(1+s.upgrades.fame*.3)),s.tier);}
    if(s.streak>=s.nextMilestone){s.events.push({type:'cheer',tier:s.tier,streak:s.streak});s.cheers++;s.nextMilestone=s.nextMilestone===3?7:s.nextMilestone===7?12:s.nextMilestone+6;}
    s.grace=1.2;
  }else{
    s.grace-=dt;
    if(s.grace<=0&&s.streak>0){if(s.streak>=3)s.events.push({type:'break'});s.streak=0;s.tier=1;s.nextMilestone=3;s.rewardClock=0;}
  }
  s.danger=clamp((Math.abs(s.angle)-safe)/(.58-safe),0,1);
  if(Math.abs(s.angle)>.58)end(s,false,'缸倾得太多了。缸向哪边倒，就按哪边扶稳。已赚的赏钱会保留。');
  return s;
}
export function upgradeCost(kind,rank){return Math.round((kind==='skill'?25:35)*Math.pow(1.85,rank));}
export function sanitizeSave(raw){const n=(v,max)=>Number.isFinite(v)?clamp(Math.floor(v),0,max):0;return {coins:n(raw?.coins,1e7),skill:n(raw?.skill,3),fame:n(raw?.fame,3),unlocked:Math.max(1,n(raw?.unlocked,3)),best:n(raw?.best,1e6),rounds:n(raw?.rounds,1e6),sound:raw?.sound!==false};}
