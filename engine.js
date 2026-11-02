export const LEVELS = [
  {name:'初登场',venue:'杂技小院',target:3,heights:[65,110,155],duration:70,wind:1.35,rate:1,catchHeight:54,slow:.36},
  {name:'满堂彩',venue:'运河集市',target:4,heights:[80,125,170,215],duration:85,wind:2.1,rate:1.5,catchHeight:43,slow:.27},
  {name:'压轴绝活',venue:'吴桥大会',target:5,heights:[95,140,185,230,275],duration:100,wind:2.9,rate:2,catchHeight:34,slow:.20}
];
export const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
export function createGame(level=0,upgrades={skill:0,fame:0}) {
  return {level,upgrades:{skill:0,fame:0,...upgrades},mode:'playing',phase:'balance',elapsed:0,angle:.035,velocity:0,
    spin:1,stable:0,streak:0,bestStreak:0,tier:1,tips:0,rewardClock:0,danger:0,left:0,right:0,tapLeft:0,tapRight:0,
    lastFoot:0,lastTap:-5,grace:1.2,cheers:0,nextMilestone:3,events:[],power:0,charge:0,perfect:false,
    height:0,vy:0,vatX:0,catchX:0,vx:0,peak:0,requiredHeight:0,catches:0,kicks:0,phaseTime:0,
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
  s.requiredHeight=l.heights[s.catches];
  s.vy=Math.sqrt(2*215*s.requiredHeight);s.height=0;s.peak=0;s.vatX=0;s.vx=0;
  s.kicks++;s.phase='flight';s.phaseTime=0;s.power=0;s.catchArmed=0;s.landingReady=false;
  s.events.push({type:'launch',count:s.kicks,final:s.kicks===l.target});
}
export function step(s,dt,input={left:false,right:false}) {
  if(s.mode!=='playing')return s;
  dt=clamp(dt,0,.04);const l=LEVELS[s.level],both=!!(input.left&&input.right),bothDown=both&&!s.wasBoth;
  s.wasBoth=both;s.elapsed+=dt;s.phaseTime+=dt;s.catchFlash=Math.max(0,s.catchFlash-dt*1.4);
  s.tapLeft=Math.max(0,s.tapLeft-dt*4);s.tapRight=Math.max(0,s.tapRight-dt*4);
  s.left+=((input.left?1:0)-s.left)*Math.min(1,dt*14);s.right+=((input.right?1:0)-s.right)*Math.min(1,dt*14);
  if(s.elapsed>=l.duration){end(s,false,'锣声收场了，还没有完成蹬接。下次脚力蓄满就试着起缸。');return s;}
  if(s.phase==='windup'||s.phase==='rebound') {
    s.angle*=Math.exp(-dt*8);s.velocity=0;
    if(s.phaseTime>=(s.phase==='windup'?.46:.56))launch(s,l);
    return s;
  }
  if(s.phase==='flight') {
    // Every return must be a fresh two-finger press, never a held auto-combo.
    if(!input.left&&!input.right)s.landingReady=true;
    s.catchArmed=Math.max(0,s.catchArmed-dt);
    const flightDt=dt*(s.vy<0&&s.height<=l.catchHeight?l.slow:1);
    s.vy-=215*flightDt;s.height+=s.vy*flightDt;s.peak=Math.max(s.peak,s.height);
    s.angle=Math.sin(s.phaseTime*3)*.035;
    if(bothDown&&s.landingReady){
      if(s.vy<0&&s.height<=l.catchHeight){
        s.catchArmed=.8;s.perfect=s.height<l.catchHeight*.62;
        s.events.push({type:'brace',final:s.kicks===l.target});
      }else s.events.push({type:'early'});
    }
    if(s.vy<0&&s.height<=4){
      s.height=0;
      if(s.catchArmed<=0){end(s,false,`第 ${s.kicks} 蹬没接上。每次先松开双键，等缸落回、金圈亮起，再双键一起接蹬。赏钱保留。`);}
      else {
        s.angle=0;s.velocity=0;s.spin=1.4;s.catches++;s.catchFlash=1;
        const final=s.catches>=l.target;
        reward(s,Math.round((final?50:8*s.catches)*(s.level+1)*(s.perfect?1.5:1)*(1+s.upgrades.fame*.3)),final?5:s.catches);
        s.events.push({type:'catch',perfect:s.perfect,count:s.catches,final});
        if(final){s.phase='celebrate';s.phaseTime=0;end(s,true);}
        else {s.phase='rebound';s.phaseTime=0;}
      }
    }
    return s;
  }
  if(s.power>=100&&bothDown){
    s.phase='windup';s.phaseTime=0;s.danger=0;s.events.push({type:'charge'});return s;
  }
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
