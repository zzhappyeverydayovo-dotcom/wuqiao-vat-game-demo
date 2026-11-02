export const LEVELS = [
  { name: '初登场', venue: '杂技小院', target: 15, duration: 45, wind: 1.35, rate: 1 },
  { name: '满堂彩', venue: '运河集市', target: 22, duration: 50, wind: 2.1, rate: 1.5 },
  { name: '压轴绝活', venue: '吴桥大会', target: 30, duration: 60, wind: 2.9, rate: 2 }
];
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export function createGame(level = 0, upgrades = {skill:0, fame:0}) {
  return { level, upgrades:{...upgrades}, mode:'playing', elapsed:0, angle:0.035, velocity:0,
    spin:1, stable:0, streak:0, bestStreak:0, tier:1, tips:0, rewardClock:0,
    danger:0, left:0, right:0, tapLeft:0, tapRight:0, lastFoot:0,
    lastTap:-5, grace:1.2, cheers:0, nextMilestone:3, events:[] };
}
export function impulse(s, foot) {
  if(s.mode !== 'playing') return false;
  if(s.elapsed-s.lastTap < .11) return false;
  const alternate = s.lastFoot !== foot;
  const direction = foot === -1 ? 1 : -1;
  s.velocity += direction * (alternate ? .19 : .24);
  s.spin = clamp(s.spin + (alternate ? .32 : .12), 0, 2.1);
  s.lastFoot=foot; s.lastTap=s.elapsed;
  if(foot===-1) s.tapLeft=1; else s.tapRight=1;
  s.events.push({type:'tap',foot,alternate});
  return true;
}
export function step(s, dt, input={left:false,right:false}) {
  if(s.mode!=='playing') return s;
  dt=clamp(dt,0,.04);
  const level=LEVELS[s.level];
  s.elapsed+=dt;
  s.tapLeft=Math.max(0,s.tapLeft-dt*4); s.tapRight=Math.max(0,s.tapRight-dt*4);
  s.left += ((input.left?1:0)-s.left)*Math.min(1,dt*14);
  s.right += ((input.right?1:0)-s.right)*Math.min(1,dt*14);
  const t=s.elapsed;
  const disturbance=(Math.sin(t*1.37)+.52*Math.sin(t*2.41+1.7))*level.wind*.075;
  const holding=(s.left-s.right)*.92;
  // An unstable load, gentle aerodynamic damping, and independent foot torque.
  s.velocity += (Math.sin(s.angle)*.72 + disturbance + holding - s.velocity*1.7)*dt;
  s.angle += s.velocity*dt;
  s.spin = clamp(s.spin-dt*.095 + dt*(s.left+s.right)*.035,0,2.1);
  const safeAngle=.16+s.upgrades.skill*.018;
  const isStable=Math.abs(s.angle)<safeAngle && s.spin>.3;
  if(isStable) {
    s.stable+=dt; s.streak+=dt; s.bestStreak=Math.max(s.bestStreak,s.streak);
    s.tier=s.streak>=12?5:s.streak>=7?3:s.streak>=3?2:1;
    s.rewardClock+=dt;
    if(s.rewardClock>=1.0) {
      s.rewardClock-=1;
      const value=Math.round(s.tier*level.rate*(1+s.upgrades.fame*.3));
      s.tips+=value; s.events.push({type:'tip',value,tier:s.tier});
    }
    if(s.streak>=s.nextMilestone) {
      s.events.push({type:'cheer',tier:s.tier,streak:s.streak});
      s.cheers++; s.nextMilestone=s.nextMilestone===3?7:s.nextMilestone===7?12:s.nextMilestone+6;
    }
    s.grace=1.2;
  } else {
    s.grace-=dt;
    if(s.grace<=0 && s.streak>0) {
      if(s.streak>=3) s.events.push({type:'break'});
      s.streak=0; s.tier=1; s.nextMilestone=3; s.rewardClock=0;
    }
  }
  s.danger=clamp((Math.abs(s.angle)-safeAngle)/(.58-safeAngle),0,1);
  if(Math.abs(s.angle)>.58 || s.elapsed>=level.duration) {
    s.mode='lost'; s.events.push({type:'end',won:false});
  } else if(s.stable>=level.target) {
    s.mode='won'; s.events.push({type:'end',won:true});
  }
  return s;
}
export function upgradeCost(kind, rank) { return Math.round((kind==='skill'?25:35)*Math.pow(1.85,rank)); }
export function sanitizeSave(raw) {
  const n=(v,max)=>Number.isFinite(v)?clamp(Math.floor(v),0,max):0;
  return { coins:n(raw?.coins,1e7), skill:n(raw?.skill,3), fame:n(raw?.fame,3),
    unlocked:Math.max(1,n(raw?.unlocked,3)), best:n(raw?.best,1e6), rounds:n(raw?.rounds,1e6), sound:raw?.sound!==false };
}
