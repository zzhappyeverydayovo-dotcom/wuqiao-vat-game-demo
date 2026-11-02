import {drawLegRig} from './rig.js';
import {loadImageCandidates} from './loader.js';
import {LEVELS,createGame,step,impulse,clamp,upgradeCost,sanitizeSave} from './engine.js';
const $=id=>document.getElementById(id);
const canvas=$('scene'),ctx=canvas.getContext('2d',{alpha:false});
let save;try{save=sanitizeSave(JSON.parse(localStorage.getItem('wuqiao-vat-v1')||'{}'));}catch{save=sanitizeSave({});}
let state=createGame(0,save),selectedLevel=0,screen='intro',lastTime=0,worldTime=0,toastUntil=0,stampUntil=0,cheerEnergy=0,settled=false;
let assets={},loaded=false,particles=[],bubbles=[],lastUi=0,spinPhase=0,audioCtx,master,seed=34,lastCatchAt=-10;
const learnedStages=new Set();
const inputs={left:false,right:false},pressed={left:new Set(),right:new Set()};
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const persist=()=>{try{localStorage.setItem('wuqiao-vat-v1',JSON.stringify(save));}catch{}};
function syncSave(){ $('coins').textContent=save.coins.toLocaleString('zh-CN');$('sound').textContent=save.sound?'♪':'♩';$('sound').setAttribute('aria-label',save.sound?'关闭音效':'打开音效'); }
function initAudio(){if(!audioCtx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audioCtx=new AC();master=audioCtx.createGain();master.gain.value=.25;master.connect(audioCtx.destination);}if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});}
function tone(freq,duration=.15,type='sine',volume=.2,delay=0){if(!save.sound||!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(60,freq*.6),t+duration);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(master);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
function clap(count=3){if(!save.sound||!audioCtx)return;for(let i=0;i<count;i++){const duration=.075;const b=audioCtx.createBuffer(1,audioCtx.sampleRate*duration,audioCtx.sampleRate),d=b.getChannelData(0);for(let j=0;j<d.length;j++)d[j]=(random()*2-1)*Math.exp(-j/d.length*8);const source=audioCtx.createBufferSource(),g=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();filter.type='highpass';filter.frequency.value=1000;g.gain.value=.15;source.buffer=b;source.connect(filter);filter.connect(g);g.connect(master);source.start(audioCtx.currentTime+i*.13);source.onended=()=>{source.disconnect();filter.disconnect();g.disconnect();};}}
function showToast(text,duration=2){$('toast').textContent=text;$('toast').classList.add('show');toastUntil=worldTime+duration;}
function releaseAll(){for(const side of ['left','right']){pressed[side].clear();inputs[side]=false;$(side).classList.remove('pressed');}}
function startRound(level=selectedLevel){
  selectedLevel=clamp(level,0,save.unlocked-1);state=createGame(selectedLevel,save);settled=false;particles=[];bubbles=[];cheerEnergy=0;releaseAll();
  $('combo-stamp').classList.remove('show');$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','暂停游戏');
  const begin=()=>{learnedStages.add(selectedLevel);screen='playing';$('overlay').classList.add('hidden');initAudio();tone(180,.5,'sine',.45);showToast('锣声一响，好戏开场',1.3);updateUI();};
  if(learnedStages.has(selectedLevel)){begin();return;}
  screen='brief';const l=LEVELS[selectedLevel];
  const lessons=[
    ['双脚一起接，练准节奏','脚力满后，双键起缸。','松开双键，等金色脚圈亮起，再同时按下。','完成三连蹬；抢拍两次会断连。'],
    ['先扶平，才蹬得高','缸底会向左或右倾：低侧脚圈提前指示。','落回时先按低侧单脚，继续按住把缸扶正。','平衡指针进绿区，再双键合力蹬；左右交替变化。'],
    ['错开两脚，分两拍卸力','落回时先用低侧脚接住，不能同时按。','等另一只脚圈亮起，再补另一脚；太早或太晚都会断连。','两脚接稳后松开，再双键蹬起；连续完成五次。']
  ][selectedLevel];
  $('panel').innerHTML=`<span class="eyebrow">第 ${selectedLevel+1} 场 · 新功夫</span><h2>${l.name}</h2><p class="intro-copy">${lessons[0]}</p><div class="how-to stage-steps">${lessons.slice(1).map((text,i)=>`<span><b>${i+1}</b>${text}</span>`).join('')}</div><p class="result-reason">${selectedLevel?'这一关只同时按 A、D 无法过关。':'先练准，再练难。'}</p><button class="primary" id="begin-stage">开始 · ${l.lesson}<span>↗</span></button>`;
  $('overlay').classList.remove('hidden');$('begin-stage').onclick=begin;updateUI();
}
function pauseGame(){if(screen!=='playing')return;state.wasBoth=false;state.wasLeft=false;state.wasRight=false;screen='paused';releaseAll();$('pause').textContent='▷';$('pause').setAttribute('aria-label','继续游戏');$('panel').innerHTML=`<span class="eyebrow">歇口气，好戏还在</span><h2>稍歇片刻</h2><p class="result-reason">赏钱与当前进度都替你留着。</p><button class="primary" id="resume">继续表演 <span>↗</span></button><button class="secondary" id="restart">重新开场</button>`;$('overlay').classList.remove('hidden');$('resume').onclick=resumeGame;$('restart').onclick=()=>startRound();}
function resumeGame(){if(screen!=='paused')return;screen='playing';$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','暂停游戏');$('overlay').classList.add('hidden');releaseAll();}
function buyUpgrade(kind){const cost=upgradeCost(kind,save[kind]);if(save[kind]>=3||save.coins<cost)return;save.coins-=cost;save[kind]++;persist();syncSave();tone(780,.2);tone(1040,.3,'sine',.15,.1);renderResults();}
function shopRow(kind,title,copy){const rank=save[kind],cost=upgradeCost(kind,rank);return `<div class="shop-row"><div><b>${title} <span style="opacity:.45">${rank}/3</span></b><small>${copy}</small></div><button class="buy" data-upgrade="${kind}" ${rank>=3||save.coins<cost?'disabled':''}>${rank>=3?'已练满':`${cost} 文 · 提升`}</button></div>`;}
function finish(won){if(settled)return;settled=true;releaseAll();screen='result';selectedLevel=won?Math.min(2,state.level+1):state.level;save.rounds++;save.best=Math.max(save.best,Math.floor(state.bestStreak));if(won){save.unlocked=Math.max(save.unlocked,Math.min(3,state.level+2));const bonus=20*(state.level+1);save.coins+=bonus;state.bonus=bonus;clap(7);[440,554,659,880].forEach((f,i)=>tone(f,.4,'sine',.22,i*.13));}else{state.bonus=0;tone(180,.4,'triangle',.2);}persist();syncSave();setTimeout(()=>{if(screen==='result')renderResults();},1600);}
function renderResults(){const won=state.mode==='won';$('panel').innerHTML=`<span class="eyebrow">${won?'好功夫，值得这个赏！':'台上一分钟，台下十年功'}</span><h2>${won?(state.level===2?'压轴，满堂彩！':'这一场，漂亮！'):'再练一场'}</h2><p class="result-reason">${won?`连续完成 ${state.catches} 蹬，最后一记接稳，街坊们为你喝彩！`:state.reason}</p><div class="result-score"><div><strong>${state.catches}<small> / ${LEVELS[state.level].target}</small></strong>连续接蹬完成</div><div><strong>+${state.tips+(state.bonus||0)}</strong>本场赏钱${won?`（含${state.bonus}文彩头）`:''}</div></div><div class="shop"><div class="progress-caption"><span>赏钱练功 · 下场更出彩</span><b>钱袋 ${save.coins} 文</b></div>${shopRow('skill','基本功','扩大稳定区，加快脚力积累')}${shopRow('fame','人气','每级增加 30% 喝彩赏钱')}</div><div class="level-chooser">${LEVELS.map((l,i)=>`<button data-level="${i}" class="${selectedLevel===i?'selected':''}" ${i>=save.unlocked?'disabled':''}>${i>=save.unlocked?'未解锁':`${i+1} · ${l.name}`}</button>`).join('')}</div><button class="primary" id="next">${selectedLevel>state.level?'下一场，接着来':'再上场，露一手'} <span>↗</span></button><p class="panel-foot">赏钱已存好 · 最长连稳纪录 ${save.best} 秒</p>`;$('overlay').classList.remove('hidden');document.querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=()=>buyUpgrade(b.dataset.upgrade));document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{selectedLevel=Number(b.dataset.level);renderResults();$('next').textContent=`上场 · ${LEVELS[selectedLevel].name} ↗`;});$('next').onclick=()=>startRound(selectedLevel);}
function showAbout(){const previous=screen;if(screen==='playing')pauseGame();screen='about';releaseAll();$('panel').innerHTML=`<span class="eyebrow">绝活小记</span><h2>双脚之上<br>力与巧的功夫</h2><div class="about-copy"><p>蹬大缸是吴桥杂技演出中可见的蹬技：艺人仰卧，用脚托举、蹬转大缸，展现力量、节奏与平衡。</p><p>这个游戏以蹬缸为灵感，将双脚发力转化为双按钮操作。小院、服饰与青花纹样是美术演绎，关卡、赏钱与“连环蹬缸”大招是游戏化改编，并非真实节目的动作复原。</p><p>资料：<a href="https://web.cmc.hebtv.com/cms/rmt0336/19/19js/zx/tt/12056931.shtml" target="_blank" rel="noopener">《非遗里的中国》河北·吴桥杂技篇 ↗</a></p></div><button class="primary" id="close-about">回到小院 <span>↗</span></button>`;$('overlay').classList.remove('hidden');$('close-about').onclick=()=>{if(previous==='playing'||previous==='paused'){screen='paused';resumeGame();}else if(previous==='result'){screen='result';renderResults();}else{location.reload();}};}
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
  else if(event.type==='break')showToast('连赏中断，扶稳再来',1.4);
  else if(event.type==='tap')tone(event.foot===-1?145:175,.085,'triangle',.18);
  else if(event.type==='ready'){showToast('脚力已满 · 双键一起按，起缸！',2);tone(680,.25);}
  else if(event.type==='charge'){showToast('收腿蓄势 · 连环蹬缸',.5);tone(100,.35,'triangle',.2);}
  else if(event.type==='launch'){
    $('toast').classList.remove('show');tone(160+event.count*40,.22,'triangle',.34);
    tone(420+event.count*100,.3,'sine',.18,.08);
    bubbles.push({text:event.final?'看这最后一蹬！':event.count>1?'再高一点！':'起！',x:event.count%2?77:458,y:430,life:0,duration:1.3,type:'cheer'});
  }
  else if(event.type==='mistake'){showToast(event.message,1.2);tone(100,.15,'triangle',.18);}
  else if(event.type==='firstfoot'){state.tapLeft=event.foot===-1?1:0;state.tapRight=event.foot===1?1:0;tone(180,.12,'triangle',.2);}
  else if(event.type==='secondfoot'){state.tapLeft=state.tapRight=1;tone(250,.12,'triangle',.2);}
  else if(event.type==='brace'){tone(170,.12,'triangle',.2);}
  else if(event.type==='catch'){
    lastCatchAt=worldTime;cheer(event.final?5:Math.min(3,event.count+1));
    $('combo-stamp').innerHTML=`<span>${event.final?'连环绝活':event.perfect?'接得准':'接上了'}</span><b>${event.count} 连蹬</b>`;
    stampUntil=worldTime+(event.final?2.6:.9);
    if(event.final){clap(9);tone(110,.7,'triangle',.45);showToast('最后一记接稳 · 满堂彩！',2.4);}
  }
  else if(event.type==='end')finish(event.won);
}state.events.length=0;}
function updateUI(){
  const l=LEVELS[state.level],flight=state.phase==='flight',chain=state.phase!=='balance',ready=state.power>=100;
  const landing=flight&&state.vy<0&&state.height<=l.catchHeight,final=state.kicks===l.target;
  const remaining=Math.ceil(Math.max(0,l.duration-state.elapsed));
  $('level-name').textContent=`第 ${String(state.level+1).padStart(2,'0')} 场 · ${l.name}`;
  $('timer').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  $('stable-seconds').textContent=state.catches;$('target-seconds').textContent=` / ${l.target} 蹬`;
  $('objective').textContent=chain?'连环蹬缸 · 最后一记接稳过关':`稳缸蓄势 · 本场连续 ${l.target} 蹬`;
  $('progress').style.width=`${chain?state.catches/l.target*100:state.power}%`;
  $('progress').parentElement.classList.toggle('charged',ready||chain);
  $('streak-label').textContent=`脚力 ${Math.floor(state.power)}%`;
  $('multiplier').textContent=`赏钱 ×${state.tier}`;
  $('crowd-text').textContent=state.tier>=5?'全场喝彩，赏钱不断':state.tier>=2?'有人拍手叫好了':'稳住积脚力，连稳得赏钱';
  const zone=document.querySelector('.safe-zone'),width=(state.phase==='support'?.055:.16+state.upgrades.skill*.018)/.58*94;
  zone.style.width=`${width}%`;zone.style.left=`${50-width/2}%`;$('needle').style.left=`${50+clamp(state.angle/.58,-1,1)*47}%`;
  let hint=state.spin<.35?'轻点左右脚，让大缸继续转动':Math.abs(state.angle)>.2?(state.angle>0?'大缸向右倾 → 右脚发力':'左脚发力 ← 大缸向左倾'):'缸向哪边倒，就按哪边扶稳';
  let act=`稳住大缸 · 准备连蹬 ${l.target} 次`,label='稳住重心',buttonLeft='左脚发力',buttonRight='右脚发力';
  if(ready){label='连环蹬缸就绪';hint='双键同时按一下 · 开始连续蹬缸';act='脚力已满 · 双脚起缸';}
  if(state.phase==='windup'){hint='松开双键 · 看脚下发力';act='收腿蓄势 → 第一蹬';buttonLeft=buttonRight='松开双键';}
  if(state.phase==='rebound'){hint='接住顺势收腿 · 马上再蹬高一层';act=`${state.catches} 连蹬！下一蹬更高`;buttonLeft=buttonRight='松开双键';}
  if(flight){
    hint=landing?(final?'双键一起短按 · 接稳这一记过关！':'双键一起短按 · 接住，顺势再蹬！'):'松开双键 · 等大缸落回、金圈亮起';
    act=landing?(final?'收！最后一记，双脚接稳':'接 · 蹬！双键一起按'):`第 ${state.kicks} 蹬 / ${l.target} 蹬${final?' · 压轴一记':state.kicks>1?' · 更高了！':' · 起！'}`;
    buttonLeft=buttonRight=landing?(final?'接稳收势':'接住再蹬'):'等待落缸';
  }
  if(flight&&state.level>0){
    const foot=state.firstFoot===1?'右':'左';
    act=landing?`先用${foot}脚 · 接低侧`:`第 ${state.kicks} 蹬 · 缸向${foot}倾`;
    hint=landing?`${foot}脚单独按下接缸 · 这一拍不要双脚同按`:`预判：先${foot}脚${state.level===2?'，再等另一脚接上':'接住，再单脚扶平'}`;
    buttonLeft=state.firstFoot===-1?'左脚先接':'等右脚先接';buttonRight=state.firstFoot===1?'右脚先接':'等左脚先接';
  }
  if(state.phase==='support'){
    const flat=Math.abs(state.angle)<=.055,foot=state.angle>0?'右':'左';
    label=flat?'缸已扶平 · 双脚蹬':'单脚扶正 · 指针对准绿区';
    $('streak-label').textContent=`托缸 ${Math.max(0,state.supportLimit-state.phaseTime).toFixed(1)}秒`;
    act=flat?(final?'双脚合力 · 接稳收势':'扶平了 · 双脚合力蹬！'):`按住${foot}脚 · 把缸扶平`;
    hint=flat?'松开后双键一起按 · 合力蹬起':`按住${foot}键微调 · 绿区内补另一脚蹬起`;
    buttonLeft=flat?'合力蹬起':state.angle<0?'左脚扶正':'等缸扶平';buttonRight=flat?'合力蹬起':state.angle>0?'右脚扶正':'等缸扶平';
    $('crowd-text').textContent='缸底扶平才能继续';$('multiplier').textContent='低侧脚发力';
  }
  if(state.phase==='splitcatch'){
    const other=state.firstFoot===1?'左':'右',now=state.phaseTime>=.18;
    label=now?`现在补${other}脚`:`先等一拍 · 准备${other}脚`;
    $('streak-label').textContent='分脚卸力';zone.style.left='25.7%';zone.style.width='54.3%';$('needle').style.left=`${Math.min(100,state.phaseTime/.7*100)}%`;
    act=now?`${other}脚接上！`:`第一脚已接 · 等${other}脚圈亮`;
    hint=now?`单独补按${other}键 · 两脚接稳后再合力蹬`:'另一脚先别按 · 等脚圈亮起';
    buttonLeft=other==='左'?(now?'左脚接上':'左脚等一拍'):'已接住';buttonRight=other==='右'?(now?'右脚接上':'右脚等一拍'):'已接住';
    $('crowd-text').textContent='第一脚卸力 → 第二脚接稳';$('multiplier').textContent='不能同时硬接';
  }
  if(state.mode==='won'){act=`${l.target} 连蹬 · 最后一记接稳！`;hint='这一场，满堂彩';}
  $('balance-label').textContent=label;$('balance-label').style.color=ready?'#a1432b':'';
  $('hint').textContent=hint;$('act-label').textContent=act;
  $('game').dataset.phase=state.mode==='playing'?state.phase:state.mode;
  $('game').classList.toggle('chain-active',chain);$('game').classList.toggle('catch-now',(landing||state.phase==='splitcatch'&&state.phaseTime>=.18||state.phase==='support'&&Math.abs(state.angle)<=.055)&&state.mode==='playing');
  $('game').dataset.lesson=String(state.level);
  $('game').dataset.foot=state.phase==='splitcatch'?(state.firstFoot===1?'left':'right'):state.firstFoot===1?'right':'left';
  $('left-text').textContent=buttonLeft;$('right-text').textContent=buttonRight;
  $('left').setAttribute('aria-label',chain?`左脚：${buttonLeft}`:'左脚发力，向右扶正');
  $('right').setAttribute('aria-label',chain?`右脚：${buttonRight}`:'右脚发力，向左扶正');
  $('left-cue').style.opacity=chain?0:state.tapLeft*.8;$('right-cue').style.opacity=chain?0:state.tapRight*.8;
}
function drawImageCover(img,x,y,w,h){const scale=Math.max(w/img.width,h/img.height),sw=w/scale,sh=h/scale;ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h);}
function legBend(){
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  if(state.phase==='windup'){const t=state.phaseTime/.46;return t<.72?150*smooth(t/.72):150-165*smooth((t-.72)/.28);}
  if(state.phase==='rebound'){const t=state.phaseTime/.56;return t<.42?145*smooth(t/.42):t<.65?145:145-160*smooth((t-.65)/.35);}
  if(state.phase==='support'||state.phase==='splitcatch')return 28;
  if(state.phase==='flight')return -15*Math.max(0,1-state.phaseTime/.18);
  if(state.phase==='celebrate')return 100*Math.sin(Math.min(1,(worldTime-lastCatchAt)/.7)*Math.PI);
  return -Math.max(state.tapLeft,state.tapRight)*8;
}
function drawActor(angle){drawLegRig(ctx,assets.acrobat,137,464,330,legBend(),state.phase==='support'||state.phase==='splitcatch'?state.angle*2.4:0);}
function drawVat(angle){
  const airborne=state.phase==='flight',bend=airborne?0:legBend()*330/1254;
  const x=271,y=489-state.height*.44+bend;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  const sway=1+Math.sin(spinPhase)*.008;ctx.scale(sway,1);
  ctx.shadowColor='#14202b38';ctx.shadowBlur=12;ctx.shadowOffsetY=6;
  ctx.drawImage(assets.vat,14,60,1225,1135,-145,-263,290,269);ctx.shadowColor='transparent';
  if(airborne&&state.vy>0){
    ctx.strokeStyle='#fff1c6aa';ctx.lineWidth=2.5;
    for(const dx of [-158,158]){ctx.beginPath();ctx.moveTo(dx,-120);ctx.lineTo(dx,10+state.kicks*9);ctx.stroke();}
  }
  if(!airborne&&state.spin>.3){ctx.lineWidth=1.8;for(let i=0;i<2;i++){const a=spinPhase+i*Math.PI;ctx.strokeStyle=`rgba(255,232,182,${.18+state.spin*.1})`;ctx.beginPath();ctx.ellipse(0,-130,164,25,-.15,a,a+1.5);ctx.stroke();}}
  ctx.restore();
}
function drawFlightGuide(){
  if(!['flight','support','splitcatch'].includes(state.phase))return;
  const l=LEVELS[state.level],landing=state.phase==='flight'&&state.vy<0&&state.height<=l.catchHeight;
  const support=state.phase==='support',split=state.phase==='splitcatch',flat=Math.abs(state.angle)<=.055;
  ctx.save();
  for(const [foot,x] of [[-1,239],[1,313]]){
    let active=landing&&(state.level===0||foot===state.firstFoot);
    if(support)active=flat||foot===(state.angle>0?1:-1);
    if(split)active=foot!==state.firstFoot&&state.phaseTime>=.18;
    const expected=state.level>0&&(split?foot!==state.firstFoot:foot===state.firstFoot);
    ctx.strokeStyle=active?'#ffe29a':expected?'#fff0c4aa':'#fff0c433';ctx.fillStyle=active?'#ffd56b55':'#fff0c40b';ctx.lineWidth=active?4:1.5;
    ctx.beginPath();ctx.ellipse(x,501,29,12,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    if(active){ctx.font='bold 21px serif';ctx.fillStyle='#fff0b4';ctx.strokeStyle='#624020';ctx.lineWidth=3;ctx.textAlign='center';ctx.strokeText(foot===-1?'左 A':'右 D',x,535);ctx.fillText(foot===-1?'左 A':'右 D',x,535);}
  }
  ctx.restore();
}
function drawBubbles(dt){for(let i=bubbles.length-1;i>=0;i--){const b=bubbles[i];b.life+=dt;if(b.life>b.duration){bubbles.splice(i,1);continue;}const p=b.life/b.duration;ctx.save();ctx.globalAlpha=Math.min(1,p*8,(1-p)*5);ctx.translate(b.x,b.y-p*32);if(b.type==='money'){ctx.fillStyle='#ffdf8b';ctx.strokeStyle='#674020';ctx.lineWidth=3;ctx.font='bold 22px Georgia,serif';ctx.textAlign='center';ctx.strokeText(b.text,0,0);ctx.fillText(b.text,0,0);}else{ctx.font='bold 19px "Noto Serif SC",serif';const width=ctx.measureText(b.text).width+25;ctx.fillStyle='#fff0ccee';ctx.strokeStyle='#805c36';ctx.lineWidth=1.2;ctx.beginPath();roundBox(ctx,-width/2,-20,width,35,8);ctx.fill();ctx.stroke();ctx.fillStyle='#65452d';ctx.textAlign='center';ctx.fillText(b.text,0,4);}ctx.restore();}}
function drawParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life+=dt;if(p.life<p.delay)continue;const t=(p.life-p.delay)/p.duration;if(t>1){particles.splice(i,1);continue;}const ease=t*t;const x=p.startX+(460-p.startX)*ease;const y=p.startY+(137-p.startY)*ease-Math.sin(t*Math.PI)*100;ctx.save();ctx.translate(x,y);ctx.rotate(t*8+p.rotate);ctx.scale(.6+Math.abs(Math.cos(t*9))*.4,1);ctx.fillStyle='#e3ae45';ctx.strokeStyle='#ffe19b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#826032';ctx.fillRect(-2,-2,4,4);ctx.restore();}}
function render(dt){
  ctx.clearRect(0,0,540,960);if(!loaded)return;
  ctx.save();
  // Fixed stage framing: the performer and courtyard keep their size throughout the chain.
  drawImageCover(assets.background,0,0,540,960);
  cheerEnergy=Math.max(0,cheerEnergy-dt*.4);
  if(cheerEnergy>.05){const img=assets.background;for(const [sx,sw,dx,dw,phase] of [[0,.22,0,119,0],[.78,.22,421,119,2]]){
    const jump=Math.sin(worldTime*15+phase)*cheerEnergy*3;ctx.save();ctx.beginPath();ctx.rect(dx,370,dw,310);ctx.clip();ctx.drawImage(img,sx*img.width,.38*img.height,sw*img.width,.38*img.height,dx,365+jump,dw,365);ctx.restore();}}
  ctx.fillStyle='#30271c2e';ctx.beginPath();ctx.ellipse(294,778,130,18,0,0,Math.PI*2);ctx.fill();
  const angle=screen==='intro'?Math.sin(worldTime*.7)*.035:clamp(state.angle,-.63,.63);
  drawActor(angle);drawFlightGuide();drawVat(angle);
  const flash=clamp(1-(worldTime-lastCatchAt)*2.2,0,1);
  if(flash>0){ctx.strokeStyle=`rgba(255,219,132,${flash})`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(271,505,50+(1-flash)*160,18+(1-flash)*35,0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
  drawBubbles(dt);drawParticles(dt);
  if(screen==='playing'&&state.phase==='balance'&&state.danger>.5){ctx.fillStyle=`rgba(155,55,30,${Math.sin(worldTime*8)*.025+state.danger*.035})`;ctx.fillRect(0,0,540,960);}
}
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
window.WuqiaoBoot.status('正在启动游戏 · 三阶功夫版 v5');
syncLayout();syncSave();updateUI();requestAnimationFrame(frame);
loadAssets().catch(error=>{window.WuqiaoBoot.fail();console.error('Asset loading failed',error);});
