import {loadImageCandidates} from './loader.js';
import {LEVELS,createGame,step,impulse,clamp,upgradeCost,sanitizeSave} from './engine.js';
const $=id=>document.getElementById(id);
const canvas=$('scene'),ctx=canvas.getContext('2d',{alpha:false});
let save;try{save=sanitizeSave(JSON.parse(localStorage.getItem('wuqiao-vat-v1')||'{}'));}catch{save=sanitizeSave({});}
let state=createGame(0,save),selectedLevel=0,screen='intro',lastTime=0,worldTime=0,toastUntil=0,stampUntil=0,cheerEnergy=0,settled=false;
let assets={},loaded=false,particles=[],bubbles=[],lastUi=0,spinPhase=0,audioCtx,master,seed=34;
const inputs={left:false,right:false},pressed={left:new Set(),right:new Set()};
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const persist=()=>{try{localStorage.setItem('wuqiao-vat-v1',JSON.stringify(save));}catch{}};
function syncSave(){ $('coins').textContent=save.coins.toLocaleString('zh-CN');$('sound').textContent=save.sound?'♪':'♩';$('sound').setAttribute('aria-label',save.sound?'关闭音效':'打开音效'); }
function initAudio(){if(!audioCtx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audioCtx=new AC();master=audioCtx.createGain();master.gain.value=.25;master.connect(audioCtx.destination);}if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});}
function tone(freq,duration=.15,type='sine',volume=.2,delay=0){if(!save.sound||!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(60,freq*.6),t+duration);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(master);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
function clap(count=3){if(!save.sound||!audioCtx)return;for(let i=0;i<count;i++){const duration=.075;const b=audioCtx.createBuffer(1,audioCtx.sampleRate*duration,audioCtx.sampleRate),d=b.getChannelData(0);for(let j=0;j<d.length;j++)d[j]=(random()*2-1)*Math.exp(-j/d.length*8);const source=audioCtx.createBufferSource(),g=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();filter.type='highpass';filter.frequency.value=1000;g.gain.value=.15;source.buffer=b;source.connect(filter);filter.connect(g);g.connect(master);source.start(audioCtx.currentTime+i*.13);source.onended=()=>{source.disconnect();filter.disconnect();g.disconnect();};}}
function showToast(text,duration=2){$('toast').textContent=text;$('toast').classList.add('show');toastUntil=worldTime+duration;}
function releaseAll(){for(const side of ['left','right']){pressed[side].clear();inputs[side]=false;$(side).classList.remove('pressed');}}
function startRound(level=selectedLevel){selectedLevel=clamp(level,0,save.unlocked-1);state=createGame(selectedLevel,save);screen='playing';settled=false;particles=[];bubbles=[];cheerEnergy=0;releaseAll();$('overlay').classList.add('hidden');$('combo-stamp').classList.remove('show');$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','暂停游戏');initAudio();tone(180,.5,'sine',.45);showToast('锣声一响，好戏开场',2);updateUI();}
function pauseGame(){if(screen!=='playing')return;if(state.phase==='charge'){state.phase='balance';state.charge=0;}state.wasBoth=false;screen='paused';releaseAll();$('pause').textContent='▷';$('pause').setAttribute('aria-label','继续游戏');$('panel').innerHTML=`<span class="eyebrow">歇口气，好戏还在</span><h2>稍歇片刻</h2><p class="result-reason">赏钱与当前进度都替你留着。</p><button class="primary" id="resume">继续表演 <span>↗</span></button><button class="secondary" id="restart">重新开场</button>`;$('overlay').classList.remove('hidden');$('resume').onclick=resumeGame;$('restart').onclick=()=>startRound();}
function resumeGame(){if(screen!=='paused')return;screen='playing';$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','暂停游戏');$('overlay').classList.add('hidden');releaseAll();}
function buyUpgrade(kind){const cost=upgradeCost(kind,save[kind]);if(save[kind]>=3||save.coins<cost)return;save.coins-=cost;save[kind]++;persist();syncSave();tone(780,.2);tone(1040,.3,'sine',.15,.1);renderResults();}
function shopRow(kind,title,copy){const rank=save[kind],cost=upgradeCost(kind,rank);return `<div class="shop-row"><div><b>${title} <span style="opacity:.45">${rank}/3</span></b><small>${copy}</small></div><button class="buy" data-upgrade="${kind}" ${rank>=3||save.coins<cost?'disabled':''}>${rank>=3?'已练满':`${cost} 文 · 提升`}</button></div>`;}
function finish(won){if(settled)return;settled=true;releaseAll();screen='result';selectedLevel=won?Math.min(2,state.level+1):state.level;save.rounds++;save.best=Math.max(save.best,Math.floor(state.bestStreak));if(won){save.unlocked=Math.max(save.unlocked,Math.min(3,state.level+2));const bonus=20*(state.level+1);save.coins+=bonus;state.bonus=bonus;clap(7);[440,554,659,880].forEach((f,i)=>tone(f,.4,'sine',.22,i*.13));}else{state.bonus=0;tone(180,.4,'triangle',.2);}persist();syncSave();setTimeout(()=>{if(screen==='result')renderResults();},1600);}
function renderResults(){const won=state.mode==='won';$('panel').innerHTML=`<span class="eyebrow">${won?'好功夫，值得这个赏！':'台上一分钟，台下十年功'}</span><h2>${won?(state.level===2?'压轴，满堂彩！':'这一场，漂亮！'):'再练一场'}</h2><p class="result-reason">${won?`完成 ${state.catches} 次凌空接缸，街坊们为你喝彩！`:state.reason}</p><div class="result-score"><div><strong>${state.catches}<small> / ${LEVELS[state.level].target}</small></strong>成功蹬起并接稳</div><div><strong>+${state.tips+(state.bonus||0)}</strong>本场赏钱${won?`（含${state.bonus}文彩头）`:''}</div></div><div class="shop"><div class="progress-caption"><span>赏钱练功 · 下场更出彩</span><b>钱袋 ${save.coins} 文</b></div>${shopRow('skill','基本功','扩大稳定区，加快脚力积累')}${shopRow('fame','人气','每级增加 30% 喝彩赏钱')}</div><div class="level-chooser">${LEVELS.map((l,i)=>`<button data-level="${i}" class="${selectedLevel===i?'selected':''}" ${i>=save.unlocked?'disabled':''}>${i>=save.unlocked?'未解锁':`${i+1} · ${l.name}`}</button>`).join('')}</div><button class="primary" id="next">${selectedLevel>state.level?'下一场，接着来':'再上场，露一手'} <span>↗</span></button><p class="panel-foot">赏钱已存好 · 最长连稳纪录 ${save.best} 秒</p>`;$('overlay').classList.remove('hidden');document.querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=()=>buyUpgrade(b.dataset.upgrade));document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{selectedLevel=Number(b.dataset.level);renderResults();$('next').textContent=`上场 · ${LEVELS[selectedLevel].name} ↗`;});$('next').onclick=()=>startRound(selectedLevel);}
function showAbout(){const previous=screen;if(screen==='playing')pauseGame();screen='about';releaseAll();$('panel').innerHTML=`<span class="eyebrow">绝活小记</span><h2>双脚之上<br>力与巧的功夫</h2><div class="about-copy"><p>蹬大缸是吴桥杂技演出中可见的蹬技：艺人仰卧，用脚托举、蹬转大缸，展现力量、节奏与平衡。</p><p>这个游戏以蹬缸为灵感，将双脚发力转化为双按钮操作。小院、服饰与青花纹样是美术演绎，关卡、赏钱与“凌空接缸”大招是游戏化改编，并非真实节目的动作复原。</p><p>资料：<a href="https://web.cmc.hebtv.com/cms/rmt0336/19/19js/zx/tt/12056931.shtml" target="_blank" rel="noopener">《非遗里的中国》河北·吴桥杂技篇 ↗</a></p></div><button class="primary" id="close-about">回到小院 <span>↗</span></button>`;$('overlay').classList.remove('hidden');$('close-about').onclick=()=>{if(previous==='playing'||previous==='paused'){screen='paused';resumeGame();}else if(previous==='result'){screen='result';renderResults();}else{location.reload();}};}
function bindPad(side,foot){const b=$(side);const down=(key)=>{if(screen!=='playing')return;initAudio();if(pressed[side].has(key))return;pressed[side].add(key);inputs[side]=true;b.classList.add('pressed');if(!inputs[side==='left'?'right':'left'])impulse(state,foot);};const up=key=>{pressed[side].delete(key);inputs[side]=pressed[side].size>0;b.classList.toggle('pressed',inputs[side]);};b.addEventListener('pointerdown',e=>{e.preventDefault();if(screen!=='playing')return;b.setPointerCapture(e.pointerId);down(e.pointerId);});for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,e=>up(e.pointerId));b.addEventListener('contextmenu',e=>e.preventDefault());return {down,up};}
const left=bindPad('left',-1),right=bindPad('right',1);
document.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['a','d','arrowleft','arrowright',' '].includes(k)&&screen==='playing')e.preventDefault();if(k==='a'||k==='arrowleft')left.down(k);if(k==='d'||k==='arrowright')right.down(k);if(k==='escape'||k==='p'){if(screen==='playing')pauseGame();else if(screen==='paused')resumeGame();}});
document.addEventListener('keyup',e=>{const k=e.key.toLowerCase();left.up(k);right.up(k);});
window.addEventListener('blur',()=>{releaseAll();if(screen==='playing')pauseGame();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='playing')pauseGame();});
$('start').onclick=()=>startRound();$('pause').onclick=()=>screen==='playing'?pauseGame():screen==='paused'?resumeGame():null;$('sound').onclick=()=>{save.sound=!save.sound;persist();syncSave();initAudio();if(save.sound)tone(720,.12);};$('about').onclick=showAbout;
function tipParticles(value,tier){const n=Math.min(12,2+tier*2);for(let i=0;i<n;i++){const side=i%2;particles.push({type:'coin',x:side?485:60,y:520+random()*100,startX:side?485:60,startY:520+random()*100,life:0,duration:.8+random()*.35,delay:i*.045,amount:value,rotate:random()*6});}bubbles.push({text:`+${value} 文`,x:455,y:130,life:0,duration:1.15,type:'money'});tone(1100+tier*80,.13,'sine',.11);}
function cheer(tier){cheerEnergy=Math.min(1,cheerEnergy+.7);const texts=tier>=5?['绝了！','好功夫！','再来一手！']:tier>=3?['好！','稳当！','有真功夫！']:['好！','漂亮！'];bubbles.push({text:texts[Math.floor(random()*texts.length)],x:70+random()*40,y:405+random()*80,life:0,duration:2.3,type:'cheer'});bubbles.push({text:texts[Math.floor(random()*texts.length)],x:440+random()*25,y:435+random()*80,life:0,duration:2.1,type:'cheer'});clap(tier+1);$('combo-stamp').innerHTML=`<span>${tier>=5?'满堂彩':tier>=3?'好功夫':'有人赏'}</span><b>×${tier}</b>`;$('combo-stamp').classList.add('show');stampUntil=worldTime+2.6;if(navigator.vibrate&&save.sound)navigator.vibrate(25);}
function processEvents(){for(const event of state.events){
  if(event.type==='tip'){save.coins+=event.value;persist();tipParticles(event.value,event.tier);syncSave();}
  else if(event.type==='cheer')cheer(event.tier);
  else if(event.type==='break')showToast('连赏中断，扶稳再来',1.5);
  else if(event.type==='tap')tone(event.foot===-1?145:175,.085,'triangle',.18);
  else if(event.type==='ready'){showToast('脚力已满 · 双键按住蓄力',2.5);tone(680,.25);}
  else if(event.type==='charge'){showToast('等指针进入金色区 · 松开！',1.5);tone(100,.5,'triangle',.2);}
  else if(event.type==='overcharge')showToast('蓄力过头了 · 松手，重新稳缸',2);
  else if(event.type==='launch'){
    showToast(event.perfect?'漂亮起缸！左右调整接缸落点':'起缸！左右调整落点',1.8);
    tone(240,.5,'sine',.3);tone(620,.35,'sine',.2,.13);
    bubbles.push({text:'嚯！',x:80,y:440,life:0,duration:1.8,type:'cheer'});
    $('combo-stamp').classList.remove('show');
  }
  else if(event.type==='early')showToast('还早！先松手，等大缸落入金色区',1.2);
  else if(event.type==='brace'){tone(170,.15,'triangle',.2);state.tapLeft=state.tapRight=1;}
  else if(event.type==='catch'){
    cheer(5);clap(9);tone(110,.7,'triangle',.45);
    $('combo-stamp').innerHTML=`<span>${event.perfect?'凌空绝活':'接得漂亮'}</span><b>第${event.count}接</b>`;
    showToast(event.perfect?'金区起缸 · 稳稳接住 · 绝活赏！':'落缸接稳！赏！',2.4);
  }
  else if(event.type==='nextkick')showToast('再蹬一回！第二接需要更高',2.3);
  else if(event.type==='end')finish(event.won);
}state.events.length=0;}
function updateUI(){
  const l=LEVELS[state.level],flight=state.phase==='flight',charge=state.phase==='charge',ready=state.power>=100;
  const remaining=Math.ceil(Math.max(0,l.duration-state.elapsed));
  $('level-name').textContent=`第 ${String(state.level+1).padStart(2,'0')} 场 · ${l.name}`;
  $('timer').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  $('stable-seconds').textContent=state.catches;$('target-seconds').textContent=` / ${l.target} 接`;
  $('objective').textContent=state.level===2?'压轴目标 · 连续两次蹬接':'过关目标 · 蹬起并接稳';
  $('progress').style.width=`${charge?Math.min(100,state.charge*100):flight?100:state.power}%`;
  $('progress').parentElement.classList.toggle('charged',ready||charge||flight);
  $('streak-label').textContent=flight?`${state.vy>0?'上升':'下落'} · ${Math.min(100,Math.round(state.peak/state.requiredHeight*100))}%高度`:charge?'金区松手':`脚力 ${Math.floor(state.power)}%`;
  $('multiplier').textContent=flight?'接稳有大赏':`赏钱 ×${state.tier}`;
  $('crowd-text').textContent=charge?'街坊们屏住了呼吸':flight?'一院子的目光，都在这口缸上':state.tier>=5?'全场喝彩，赏钱不断':state.tier>=2?'有人拍手叫好了':'稳住积脚力，连稳得赏钱';
  const zone=document.querySelector('.safe-zone');
  let zoneWidth=(.16+state.upgrades.skill*.018)/.58*94,zoneLeft=50-zoneWidth/2,needle=50+clamp(state.angle/.58,-1,1)*47;
  let label='稳住重心',hint=state.spin<.35?'轻点左右脚，让大缸继续转动':Math.abs(state.angle)>.2?(state.angle>0?'大缸向右倾 → 右脚发力':'左脚发力 ← 大缸向左倾'):'轻点交替续转 · 缸向哪边倒，就按哪边';
  let act=`稳缸蓄脚力 · 本场需完成 ${l.target} 次蹬接`;
  if(ready){label='大招就绪';hint='同时按住双键蓄力 · 金色区松手蹬起';act='凌空接缸 · 双指按住，准备起缸';}
  if(charge){label='蓄力 · 金区松手';zoneLeft=(.74-l.chargeWidth/2)*100;zoneWidth=l.chargeWidth*100;needle=clamp(state.charge*100,0,100);hint='指针进入金色区 → 松开双键！';act='屈膝蓄力 → 蹬！';}
  if(flight){
    const offset=state.vatX-state.catchX,aligned=Math.abs(offset)<=l.tolerance,landing=state.vy<0&&state.height<=l.catchHeight;
    label=landing&&aligned?'现在！双键接缸':aligned?'落点已对齐':'左右移动，追准落点';
    zoneWidth=l.tolerance/100*94;zoneLeft=50-zoneWidth/2;needle=50+clamp(offset/100,-1,1)*47;
    hint=landing&&aligned?'双键同时短按 · 屈膝接稳！':aligned?'保持落点 · 等金色接缸圈亮起':offset>0?'按右键 → 双脚向右追落点':'← 按左键，双脚向左追落点';
    act=landing?(aligned?'接！双键同时短按':'落点还没对齐 · 快左右调整'):state.peak<state.requiredHeight?'凌空接缸 · 越过高度标线':state.vy>0?'已过高度线 · 继续追准落点':'大缸下落 · 准备双键接缸';
  }
  if(state.phase==='recover'){label='第一接，稳！';hint='第二接更高 · 准备再次蓄力';act='连环蹬接 · 好戏还没完';}
  if(state.mode==='won'){label='凌空接稳 · 满堂彩';act='这一场，凭真功夫过关！';hint='接稳有赏 · 下一场，挑战更高的绝活';}
  $('balance-label').textContent=label;$('balance-label').style.color=charge||ready?'#a1432b':'';
  $('needle').style.left=`${needle}%`;zone.style.width=`${zoneWidth}%`;zone.style.left=`${zoneLeft}%`;
  document.querySelector('.balance-track').classList.toggle('skill-track',charge||flight);
  $('hint').textContent=hint;$('act-label').textContent=act;
  $('game').dataset.phase=state.mode==='playing'?state.phase:state.mode;
  $('left').setAttribute('aria-label',flight?'向左移动接缸落点':charge?'左脚蓄力，松开蹬缸':'左脚发力，向右扶正');
  $('right').setAttribute('aria-label',flight?'向右移动接缸落点':charge?'右脚蓄力，松开蹬缸':'右脚发力，向左扶正');
  $('left-text').textContent=flight?'向左接缸':charge?'蓄力中':'左脚发力';
  $('right-text').textContent=flight?'向右接缸':charge?'金区松手':'右脚发力';
  $('left-cue').style.opacity=flight?0:state.tapLeft*.8;$('right-cue').style.opacity=flight?0:state.tapRight*.8;
}
function drawImageCover(img,x,y,w,h){const scale=Math.max(w/img.width,h/img.height),sw=w/scale,sh=h/scale;ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h);}
function drawActor(angle){
  const image=assets.acrobat,x=137,y=464,w=330,h=330,slices=48;
  const bend=state.phase==='charge'?Math.sin(Math.min(1,state.charge)*Math.PI/2)*30:state.phase==='flight'?-12:state.catchFlash*24;
  for(let i=0;i<slices;i++){
    const v=i/slices,v2=(i+1)/slices,weight=Math.pow(Math.max(0,1-v/.65),2);
    const shear=angle*.62*weight,bob=-Math.max(state.tapLeft,state.tapRight)*2.7*weight;
    ctx.save();ctx.translate(x+state.catchX*weight,y+v*h+bob+bend*weight);
    ctx.transform(1,shear,0,1,-angle*9*weight,-w*.41*shear);
    ctx.drawImage(image,0,v*image.height,image.width,(v2-v)*image.height,0,0,w,(v2-v)*h+.7);ctx.restore();
  }
}
function drawVat(angle){
  const bend=state.phase==='charge'?Math.sin(Math.min(1,state.charge)*Math.PI/2)*30:state.catchFlash*24;
  const x=271+(state.phase==='flight'?state.vatX:state.catchX),y=489-state.height+bend-Math.max(state.tapLeft,state.tapRight)*2.7;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);const sway=1+Math.sin(spinPhase)*.014;ctx.scale(sway,1);
  ctx.shadowColor='#14202b38';ctx.shadowBlur=12;ctx.shadowOffsetY=6;
  ctx.drawImage(assets.vat,14,60,1225,1135,-145,-263,290,269);ctx.shadowColor='transparent';
  if(state.phase==='flight'){
    ctx.strokeStyle='#fff0bd99';ctx.lineWidth=3;
    for(const dx of [-160,160]){ctx.beginPath();ctx.moveTo(dx,-145);ctx.lineTo(dx,-60);ctx.stroke();}
  }
  if(state.spin>.3){ctx.lineWidth=1.8;for(let i=0;i<2;i++){const a=spinPhase+i*Math.PI;ctx.strokeStyle=`rgba(255,232,182,${.18+state.spin*.1})`;ctx.beginPath();ctx.ellipse(0,-130,164,25,-.15,a,a+1.5);ctx.stroke();}}
  ctx.restore();
}
function drawFlightGuide(){
  if(state.phase!=='flight')return;
  const l=LEVELS[state.level],landing=state.vy<0&&state.height<=l.catchHeight;
  ctx.save();ctx.setLineDash([6,6]);ctx.strokeStyle='#f7e4adcc';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(35,489-state.requiredHeight);ctx.lineTo(505,489-state.requiredHeight);ctx.stroke();
  ctx.setLineDash([]);ctx.font='bold 16px serif';ctx.fillStyle='#fff1ca';ctx.strokeStyle='#443827';ctx.lineWidth=3;
  const label=state.peak>=state.requiredHeight?'✓ 越过高度线':'蹬缸高度线';ctx.strokeText(label,32,477-state.requiredHeight);ctx.fillText(label,32,477-state.requiredHeight);
  ctx.setLineDash([4,7]);ctx.strokeStyle='#fff0c088';ctx.beginPath();ctx.moveTo(271+state.vatX,489-state.height);ctx.lineTo(271+state.vatX,520);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle=landing?'#ffda72':'#fff2c7aa';ctx.fillStyle=landing?'#fbc75c55':'#fff4c41a';ctx.lineWidth=landing?5:2;
  ctx.beginPath();ctx.ellipse(271+state.catchX,505,l.tolerance+16,12,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#a44a2f';ctx.beginPath();ctx.moveTo(271+state.vatX,513);ctx.lineTo(265+state.vatX,527);ctx.lineTo(277+state.vatX,527);ctx.fill();
  if(landing){ctx.font='bold 28px serif';ctx.fillStyle='#fff0b4';ctx.strokeStyle='#624020';ctx.lineWidth=4;ctx.textAlign='center';ctx.strokeText('双键 · 接！',271+state.catchX,558);ctx.fillText('双键 · 接！',271+state.catchX,558);}
  ctx.restore();
}
function drawBubbles(dt){for(let i=bubbles.length-1;i>=0;i--){const b=bubbles[i];b.life+=dt;if(b.life>b.duration){bubbles.splice(i,1);continue;}const p=b.life/b.duration;ctx.save();ctx.globalAlpha=Math.min(1,p*8,(1-p)*5);ctx.translate(b.x,b.y-p*32);if(b.type==='money'){ctx.fillStyle='#ffdf8b';ctx.strokeStyle='#674020';ctx.lineWidth=3;ctx.font='bold 22px Georgia,serif';ctx.textAlign='center';ctx.strokeText(b.text,0,0);ctx.fillText(b.text,0,0);}else{ctx.font='bold 19px "Noto Serif SC",serif';const width=ctx.measureText(b.text).width+25;ctx.fillStyle='#fff0ccee';ctx.strokeStyle='#805c36';ctx.lineWidth=1.2;ctx.beginPath();roundBox(ctx,-width/2,-20,width,35,8);ctx.fill();ctx.stroke();ctx.fillStyle='#65452d';ctx.textAlign='center';ctx.fillText(b.text,0,4);}ctx.restore();}}
function drawParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life+=dt;if(p.life<p.delay)continue;const t=(p.life-p.delay)/p.duration;if(t>1){particles.splice(i,1);continue;}const ease=t*t;const x=p.startX+(460-p.startX)*ease;const y=p.startY+(137-p.startY)*ease-Math.sin(t*Math.PI)*100;ctx.save();ctx.translate(x,y);ctx.rotate(t*8+p.rotate);ctx.scale(.6+Math.abs(Math.cos(t*9))*.4,1);ctx.fillStyle='#e3ae45';ctx.strokeStyle='#ffe19b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#826032';ctx.fillRect(-2,-2,4,4);ctx.restore();}}
function render(dt){ctx.clearRect(0,0,540,960);if(!loaded)return;drawImageCover(assets.background,0,0,540,960);cheerEnergy=Math.max(0,cheerEnergy-dt*.4);if(cheerEnergy>.05){const img=assets.background;for(const [sx,sw,dx,dw,phase] of [[0,.22,0,119,0],[.78,.22,421,119,2]]){const jump=Math.sin(worldTime*15+phase)*cheerEnergy*3;ctx.save();ctx.beginPath();ctx.rect(dx,370,dw,310);ctx.clip();ctx.drawImage(img,sx*img.width,.38*img.height,sw*img.width,.38*img.height,dx,365+jump,dw,365);ctx.restore();}}ctx.save();ctx.fillStyle='#30271c2e';ctx.beginPath();ctx.ellipse(294,778,130,18,0,0,Math.PI*2);ctx.fill();ctx.restore();const angle=screen==='intro'?Math.sin(worldTime*.7)*.035:clamp(state.angle,-.63,.63);ctx.save();const zoom=1-.32*clamp(state.height/90,0,1)-.08*clamp((state.height-180)/75,0,1);ctx.translate(270,750);ctx.scale(zoom,zoom);ctx.translate(-270,-750);drawFlightGuide();drawActor(angle);drawVat(angle);ctx.restore();if(state.catchFlash>0){ctx.strokeStyle=`rgba(255,219,132,${state.catchFlash})`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(271+state.catchX,505,50+(1-state.catchFlash)*170,18+(1-state.catchFlash)*35,0,0,Math.PI*2);ctx.stroke();}for(let i=0;i<9;i++){const x=(i*131+worldTime*(2+i*.4))%540,y=(i*89+worldTime*7)%800;ctx.fillStyle='#ffeac044';ctx.beginPath();ctx.arc(x,y,1.3,0,6.28);ctx.fill();}drawBubbles(dt);drawParticles(dt);if(screen==='playing'&&state.danger>.5){ctx.fillStyle=`rgba(155,55,30,${Math.sin(worldTime*8)*.025+state.danger*.035})`;ctx.fillRect(0,0,540,960);}}
function frame(now){const dt=Math.min((now-lastTime)/1000||.016,.12);lastTime=now;const animate=screen!=='paused'&&screen!=='about';if(animate){worldTime+=dt;spinPhase+=dt*(screen==='playing'?state.spin:0.7)*3;}if(screen==='playing'){let remaining=dt;while(remaining>0&&screen==='playing'){const tick=Math.min(remaining,1/60);step(state,tick,inputs);processEvents();remaining-=tick;}}if(animate||screen==='intro')render(animate?dt:0);if(worldTime-lastUi>.065){updateUI();lastUi=worldTime;}if(worldTime>toastUntil)$('toast').classList.remove('show');if(worldTime>stampUntil)$('combo-stamp').classList.remove('show');requestAnimationFrame(frame);}
function roundBox(context,x,y,w,h,r){
  if(typeof context.roundRect==='function'){context.roundRect(x,y,w,h,r);return;}
  context.moveTo(x+r,y);context.lineTo(x+w-r,y);context.quadraticCurveTo(x+w,y,x+w,y+r);
  context.lineTo(x+w,y+h-r);context.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  context.lineTo(x+r,y+h);context.quadraticCurveTo(x,y+h,x,y+h-r);
  context.lineTo(x,y+r);context.quadraticCurveTo(x,y,x+r,y);context.closePath();
}
function syncLayout(){document.getElementById('game').style.setProperty('--u',document.getElementById('game').getBoundingClientRect().width/100+'px');}
window.addEventListener('resize',syncLayout);
async function loadAssets(){
  const files={background:'courtyard',acrobat:'acrobat',vat:'vat'};
  const embedded=typeof EMBEDDED_ASSETS!=='undefined'?EMBEDDED_ASSETS:{};
  let count=0;
  window.WuqiaoBoot.status('正在准备画面 0 / 3');
  await Promise.all(Object.entries(files).map(async([key,file])=>{
    const image=await loadImageCandidates([embedded[key],embedded[key]?null:`assets/mobile/${file}.webp`,`assets/${file}.png`]);
    assets[key]=image;count++;window.WuqiaoBoot.status(`场子已备 ${count} / 3`);
  }));
  loaded=true;
  render(0);
  window.WuqiaoBoot.ready();
}
window.WuqiaoBoot.status('正在启动游戏 · 凌空接缸版 v3');
syncLayout();syncSave();updateUI();requestAnimationFrame(frame);
loadAssets().catch(error=>{window.WuqiaoBoot.fail();console.error('Asset loading failed',error);});
