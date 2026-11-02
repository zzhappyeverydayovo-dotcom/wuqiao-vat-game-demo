// Two-bone leg rig. Hip/body/stool remain fixed; knees solve toward the feet.
const rigLimit=(x,a,b)=>Math.max(a,Math.min(b,x));
const rigMix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const restLegs=[
  {hip:{x:400,y:740},knee:{x:460,y:400},ankle:{x:340,y:230}},
  {hip:{x:500,y:690},knee:{x:650,y:390},ankle:{x:630,y:220}}
];
export function solveKnee(hip,ankle,thigh,shin){
  const dx=ankle.x-hip.x,dy=ankle.y-hip.y;
  const distance=rigLimit(Math.hypot(dx,dy),Math.abs(thigh-shin)+.01,thigh+shin-.01);
  const direction=Math.atan2(dy,dx),along=(thigh*thigh-shin*shin+distance*distance)/(2*distance);
  const across=Math.sqrt(Math.max(0,thigh*thigh-along*along));
  return {x:hip.x+Math.cos(direction)*along-Math.sin(direction)*across,y:hip.y+Math.sin(direction)*along+Math.cos(direction)*across};
}
function boneDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=rigLimit(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
function boneTransform(p,a,b,na,nb){const angle=Math.atan2(nb.y-na.y,nb.x-na.x)-Math.atan2(b.y-a.y,b.x-a.x),c=Math.cos(angle),s=Math.sin(angle);return {x:na.x+(p.x-a.x)*c-(p.y-a.y)*s,y:na.y+(p.x-a.x)*s+(p.y-a.y)*c};}
const mesh=[];
for(let row=0;row<=15;row++)for(let col=0;col<=12;col++){
  const p={x:210+col*50,y:60+row*(740/15)};
  const weights=[];for(const leg of restLegs){weights.push(1/Math.pow(boneDistance(p,leg.hip,leg.knee)+25,3));weights.push(1/Math.pow(boneDistance(p,leg.knee,leg.ankle)+25,3));}
  const sum=weights.reduce((a,b)=>a+b,0);mesh.push({...p,weights:weights.map(w=>w/sum)});
}
function triangle(ctx,img,p,q){
  const dx1=p[1].x-p[0].x,dy1=p[1].y-p[0].y,dx2=p[2].x-p[0].x,dy2=p[2].y-p[0].y,det=dx1*dy2-dx2*dy1;
  const a=((q[1].x-q[0].x)*dy2-(q[2].x-q[0].x)*dy1)/det,c=((q[2].x-q[0].x)*dx1-(q[1].x-q[0].x)*dx2)/det;
  const b=((q[1].y-q[0].y)*dy2-(q[2].y-q[0].y)*dy1)/det,d=((q[2].y-q[0].y)*dx1-(q[1].y-q[0].y)*dx2)/det;
  ctx.save();ctx.beginPath();const center={x:(q[0].x+q[1].x+q[2].x)/3,y:(q[0].y+q[1].y+q[2].y)/3};
  q.forEach((v,i)=>{const length=Math.hypot(v.x-center.x,v.y-center.y)||1;const x=v.x+(v.x-center.x)/length*1.6,y=v.y+(v.y-center.y)/length*1.6;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.clip();
  ctx.transform(a,b,c,d,q[0].x-a*p[0].x-c*p[0].y,q[0].y-b*p[0].x-d*p[0].y);ctx.drawImage(img,0,0);ctx.restore();
}
export function drawLegRig(ctx,img,x,y,width,bend=0,tilt=0){
  if(Math.abs(bend)<.05&&Math.abs(tilt)<.001){ctx.drawImage(img,x,y,width,width);return;}
  const poses=restLegs.map((leg,i)=>{
    const ankle={x:leg.ankle.x,y:leg.ankle.y+bend+(i===0?-1:1)*tilt*55};
    const thigh=Math.hypot(leg.knee.x-leg.hip.x,leg.knee.y-leg.hip.y),shin=Math.hypot(leg.ankle.x-leg.knee.x,leg.ankle.y-leg.knee.y);
    return {hip:leg.hip,ankle,knee:solveKnee(leg.hip,ankle,thigh,shin)};
  });
  const deformed=mesh.map(p=>{
    let out={x:0,y:0};restLegs.forEach((leg,i)=>{
      const pose=poses[i],t=boneTransform(p,leg.hip,leg.knee,pose.hip,pose.knee),s=boneTransform(p,leg.knee,leg.ankle,pose.knee,pose.ankle);
      out.x+=t.x*p.weights[i*2]+s.x*p.weights[i*2+1];out.y+=t.y*p.weights[i*2]+s.y*p.weights[i*2+1];
    });
    const footIndex=p.x<500?0:1,footBlend=rigLimit((285-p.y)/100,0,1),ankle=poses[footIndex].ankle,rest=restLegs[footIndex].ankle;
    out=rigMix(out,{x:p.x+ankle.x-rest.x,y:p.y+ankle.y-rest.y},footBlend);
    // The waist, face, hands and bench never follow the legs.
    const influence=rigLimit((790-p.y)/110,0,1)*rigLimit((810-p.x)/95,0,1)*rigLimit((p.x-210)/40,0,1)*rigLimit((p.y-60)/30,0,1);
    return rigMix(p,out,influence);
  });
  ctx.save();ctx.translate(x,y);ctx.scale(width/img.width,width/img.height);
  ctx.save();ctx.beginPath();ctx.rect(0,0,img.width,img.height);ctx.rect(210,60,600,740);ctx.clip('evenodd');ctx.drawImage(img,0,0);ctx.restore();
  for(let row=0;row<15;row++)for(let col=0;col<12;col++){
    const a=row*13+col,b=a+1,c=a+13,d=c+1;
    triangle(ctx,img,[mesh[a],mesh[b],mesh[d]],[deformed[a],deformed[b],deformed[d]]);
    triangle(ctx,img,[mesh[a],mesh[d],mesh[c]],[deformed[a],deformed[d],deformed[c]]);
  }
  ctx.restore();
}
