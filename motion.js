// One contact trajectory drives both the feet and the supported object.
export const PUSH_DURATION=.82;
export const SOURCE_SCALE=330/1254;
const motionClamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=motionClamp(t);return t*t*(3-2*t);};
export function contactBend(age){
  if(age<.30)return 154*Math.sin(motionClamp(age/.30)*Math.PI/2);
  return 126+28*Math.exp(-(age-.30)*9)*Math.cos((age-.30)*13);
}
export function performancePose(s){
  const t=s.phaseTime||0;let bend=0,angle=s.angle,freeLeft=0,freeRight=0,label='',attached=true,offsetY=0;
  if(s.phase==='windup'||s.phase==='rebound'){
    const start=s.pushBend||0;
    if(t<.30){bend=start+(174-start)*ease(t/.30);label='屈腿卸力';}
    else if(t<.46){bend=174;label='压稳 · 蓄力';}
    else {bend=174-208*ease((t-.46)/.36);label='伸腿 · 蹬出去';}
    angle=(s.pushAngle||0)*(1-ease(t/.32));
  }else if(s.phase==='support'||s.phase==='splitcatch'){
    bend=contactBend(s.contactAge||0);if(s.secondFoot)angle=(s.secondFromAngle??s.angle)+(s.angle-(s.secondFromAngle??s.angle))*ease((s.secondContactAge||0)/.18);label=(s.contactAge||0)<.3?'接住 · 屈腿卸力':'托稳重心';
    // Only the first foot supports the underside until the second contact.
    const free=s.level===2?(s.phase==='splitcatch'?1:1-ease((s.secondContactAge||0)/.18)):0;
    if(s.firstFoot===1)freeLeft=48*free;else freeRight=48*free;
  }else if(s.phase==='flight'){
    attached=false;bend=-34*(1-ease(t/.34));
    offsetY=-s.height*.44-34*SOURCE_SCALE*Math.exp(-t*10);
    angle=s.angle*ease(t/.22);label=s.vy>0?'离脚 · 腾起':'落回 · 准备接住';
  }else if(s.phase==='celebrate'){
    const age=s.finishAge||0,start=s.pushBend||0;
    bend=age<.3?start+(150-start)*ease(age/.3):150*(1-ease((age-.3)/.85));
    angle=(s.pushAngle||0)*(1-ease(age/.3));label='屈腿收稳 · 满堂彩';
  }else {bend=-Math.max(s.tapLeft||0,s.tapRight||0)*5;}
  if(attached)offsetY=bend*SOURCE_SCALE;
  return {bend,angle,freeLeft,freeRight,offsetY,attached,label};
}
