export const LEVELS = [
  {name:'同接起缸',lesson:'双脚同接',venue:'杂技小院',target:3,heights:[65,110,155],duration:70,wind:1.35,rate:1,catchHeight:54,slow:.36},
  {name:'偏鼓扶正',lesson:'单脚扶正',venue:'运河集市',target:4,heights:[80,125,170,215],duration:85,wind:2.1,rate:1.5,catchHeight:43,slow:.27},
  {name:'错步卸力',lesson:'分脚接桌',venue:'灯会夜场',target:5,heights:[95,140,185,230,275],duration:100,wind:2.9,rate:2,catchHeight:34,slow:.20}
];
export const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
export function createGame(level=0,upgrades={skill:0,fame:0}) {
  return {level,upgrades:{skill:0,fame:0,...upgrades},mode:'playing',phase:'balance',elapsed:0,angle:.035,velocity:0,
    spin:1,stable:0,streak:0,bestStreak:0,tier:1,tips:0,rewardClock:0,danger:0,left:0,right:0,tapLeft:0,tapRight:0,
    lastFoot:0,lastTap:-5,grace:1.2,cheers:0,nextMilestone:3,events:[],power:0,charge:0,perfect:false,
    height:0,vy:0,vatX:0,catchX:0,vx:0,peak:0,requiredHeight:0,catches:0,kicks:0,phaseTime:0,
    wasLeft:false,wasRight:false,firstFoot:0,secondFoot:false,mistakes:0,supportLimit:1.6,wasBoth:false,catchArmed:0,landingReady:false,catchFlash:0,reason:''};
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
  s.kicks++;s.firstFoot=s.kicks%2?1:-1;s.secondFoot=false;s.mistakes=0;s.angle=s.level===0?0:s.firstFoot*(.21+s.catches*.025);s.phase='flight';s.phaseTime=0;s.power=0;s.catchArmed=0;s.landingReady=false;
  s.events.push({type:'launch',count:s.kicks,final:s.kicks===l.target});
}
function completeCatch(s,l){
  s.angle=0;s.velocity=0;s.spin=1.4;s.catches++;s.catchFlash=1;
  const final=s.catches>=l.target;
  reward(s,Math.round((final?50:8*s.catches)*(s.level+1)*(s.perfect?1.5:1)*(1+s.upgrades.fame*.3)),final?5:s.catches);
  s.events.push({type:'catch',perfect:s.perfect,count:s.catches,final});
  s.phase=final?'celebrate':'rebound';s.phaseTime=0;
  if(final)end(s,true);
}
function missedInput(s,message){
  s.mistakes++;s.events.push({type:'mistake',message,remaining:2-s.mistakes});
  if(s.mistakes>=2)end(s,false,`${message}连续抢拍或按错会断连，先看清脚下提示再发力。`);
}
export function step(s,dt,input={left:false,right:false}) {
  if(s.mode!=='playing')return s;
  dt=clamp(dt,0,.04);const l=LEVELS[s.level],both=!!(input.left&&input.right),bothDown=both&&!s.wasBoth;
  const leftDown=!!input.left&&!s.wasLeft,rightDown=!!input.right&&!s.wasRight;
  s.wasLeft=!!input.left;s.wasRight=!!input.right;s.wasBoth=both;s.elapsed+=dt;s.phaseTime+=dt;s.catchFlash=Math.max(0,s.catchFlash-dt*1.4);
  s.tapLeft=Math.max(0,s.tapLeft-dt*4);s.tapRight=Math.max(0,s.tapRight-dt*4);
  s.left+=((input.left?1:0)-s.left)*Math.min(1,dt*14);s.right+=((input.right?1:0)-s.right)*Math.min(1,dt*14);
  if(s.elapsed>=l.duration){end(s,false,'锣声收场了，还没有完成蹬接。下次脚力蓄满就试着起缸。');return s;}
  if(s.phase==='windup'||s.phase==='rebound') {
    s.angle*=Math.exp(-dt*8);s.velocity=0;
    if(s.phaseTime>=(s.phase==='windup'?.46:.56))launch(s,l);
    return s;
  }
  if(s.phase==='support') {
    // The vat is on the feet now. One foot changes its tilt; two feet push it up.
    s.angle+=((input.left?1:0)-(input.right?1:0))*.68*dt+Math.sin(s.angle)*.12*dt;
    s.height=0;
    if(bothDown){
      if(Math.abs(s.angle)<=.055){s.perfect=Math.abs(s.angle)<.022;completeCatch(s,l);}
      else missedInput(s,'缸底还斜着，先用单脚扶正，再双脚合力蹬。');
    }
    if(s.mode==='playing'&&(s.phaseTime>s.supportLimit||Math.abs(s.angle)>.47))end(s,false,'托缸太久或倾斜过大。用缸低侧的脚扶正，指针进绿区后立即双脚蹬起。');
    return s;
  }
  if(s.phase==='splitcatch') {
    const nextDown=s.firstFoot===1?leftDown:rightDown;
    if(nextDown){
      if(s.phaseTime<.18){missedInput(s,'另一脚接得太早，等第二个脚圈亮起。');}
      else if(s.phaseTime<=.56){
        s.secondFoot=true;s.angle=s.firstFoot*.016;s.phase='support';s.phaseTime=0;s.supportLimit=1.15;
        s.events.push({type:'secondfoot'});
      }
    }
    if(s.phase==='splitcatch'&&s.phaseTime>.56)end(s,false,'另一脚没有跟上。先接低侧脚，第二个脚圈亮起时补另一脚，再松开、双脚蹬起。');
    return s;
  }
  if(s.phase==='flight') {
    if(!input.left&&!input.right)s.landingReady=true;
    s.catchArmed=Math.max(0,s.catchArmed-dt);
    const flightDt=dt*(s.vy<0&&s.height<=l.catchHeight?l.slow:1);
    s.vy-=215*flightDt;s.height+=s.vy*flightDt;s.peak=Math.max(s.peak,s.height);
    if(s.level===0)s.angle=Math.sin(s.phaseTime*3)*.035;
    const inWindow=s.vy<0&&s.height<=l.catchHeight;
    if(s.landingReady&&(bothDown||(s.level>0&&(leftDown||rightDown)))){
      if(!inWindow){missedInput(s,'抢拍了，等大缸落回、脚圈亮起。');}
      else if(s.level===0){
        if(s.catchArmed<=0){s.catchArmed=.8;s.perfect=s.height<l.catchHeight*.62;s.events.push({type:'brace',final:s.kicks===l.target});}
      }else{
        const correctSingle=s.firstFoot===1?input.right&&!input.left:input.left&&!input.right;
        if(!correctSingle){missedInput(s,`先用${s.firstFoot===1?'右':'左'}脚接住低侧，不能双脚同时硬接。`);}
        else {
          s.height=0;s.phaseTime=0;s.phase=s.level===1?'support':'splitcatch';
          s.supportLimit=Math.max(1.1,1.75-s.catches*.1);s.events.push({type:'firstfoot',foot:s.firstFoot});
          return s;
        }
      }
    }
    if(s.mode!=='playing')return s;
    if(s.vy<0&&s.height<=4){
      s.height=0;
      if(s.level===0&&s.catchArmed>0)completeCatch(s,l);
      else end(s,false,s.level===0?'这一蹬没接上。先松开双键，等金圈亮起再双脚接蹬。':`这一蹬要先用${s.firstFoot===1?'右':'左'}脚接低侧。看清缸的倾斜方向，单脚接触后再完成后续动作。`);
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
