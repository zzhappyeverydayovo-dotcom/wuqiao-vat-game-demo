import {createGame} from './engine.js';
export const THEMES=[
  {prop:'大缸',short:'缸',background:'background',actor:'acrobat',object:'vat',costume:'素衣练功',bounds:[14,60,1239,1195],width:290},
  {prop:'花鼓',short:'鼓',background:'market',actor:'acrobat-market',object:'drum',costume:'青绿演出服',bounds:[28,80,1347,1082],width:280},
  {prop:'方桌',short:'桌',background:'festival',actor:'acrobat-festival',object:'table',costume:'红金压轴服',bounds:[21,36,1491,942],width:322}
];
export const LESSON_LENGTH=12;
export function lessonFrame(level,time){
  const t=Math.min(time,LESSON_LENGTH),s=createGame(level),keys={left:false,right:false};
  s.kicks=1;s.firstFoot=1;s.landingReady=true;s.phase='flight';s.vy=-60;s.height=Math.max(0,100*(1-t/3));s.angle=.21;
  let index=0,title='先看低侧，等脚圈亮',copy=`${level===1?'鼓':'桌'}向右倾，先准备右脚 D；此时不要双按。`;
  if(t>=3){s.height=0;s.phase=level===1?'support':'splitcatch';s.phaseTime=0;index=1;keys.right=true;title='① 右脚先接低侧';copy='右侧金圈亮起，只按右键 D。';}
  if(t>=4.5&&level===1){index=2;s.angle=.21*Math.max(0,1-(t-4.5)/2);title='② 按住右脚，把鼓扶平';copy='继续按住 D，观察上方指针移进绿色区域。';}
  if(t>=4.5&&level===2){index=2;keys.right=false;s.phaseTime=Math.min(.3,(t-4.5)*.2);title=t<5.4?'② 等另一脚圈亮':'② 左脚接上，分拍卸力';copy=t<5.4?'先松开 D，左键 A 暂时不要按。':'左侧金圈亮起，再单独按 A。';if(t>=5.4)keys.left=true;}
  if(t>=7){index=3;s.phase='support';s.angle=0;keys.left=keys.right=false;title='③ 松开双键，准备合力';copy='两脚已经接稳，先把两个按钮都松开。';}
  if(t>=8.5){index=4;keys.left=keys.right=t<9.1;s.phase='rebound';s.phaseTime=Math.min(.56,(t-8.5)*.5);s.angle=0;title='④ 双键一起按，再蹬高';copy='同时按 A + D，收腿、蹬起，完成一次接蹬。';}
  if(t>=9.6){s.phase='flight';s.phaseTime=t-9.6;s.vy=90;s.height=Math.min(180,(t-9.6)*90);title='接得稳，才能蹬得更高';copy='下一蹬会换成左侧先接；根据倾斜和脚圈判断。';}
  return {state:s,keys,index,title,copy,done:t>=LESSON_LENGTH};
}
export function createPracticeState(level,upgrades){
  const s=createGame(level,upgrades);
  Object.assign(s,{phase:'flight',kicks:1,firstFoot:1,height:70,vy:-45,angle:.21,landingReady:true});
  return s;
}
