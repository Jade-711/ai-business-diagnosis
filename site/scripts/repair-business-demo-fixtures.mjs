import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../web/curated-catalog.js',import.meta.url),src=await readFile(file,'utf8'),marker='const AIDD_CURATED_CATALOG = ';
const catalog=JSON.parse(src.split(marker)[1].trim().replace(/;$/,'')),demo=catalog.demoData;
if(demo.businessFixtureVersion===1){console.log('Reviewed business demo fixtures already installed');process.exit(0);}
const original=structuredClone(demo.metrics),changed=new Set(),round=n=>Math.round(n*100)/100,integer=n=>Math.max(1,Math.round(n));
const id=(source,n)=>'research-metric-'+source+'-'+String(n).padStart(2,'0');
const get=(source,n,period,key,index)=>{const row=original[id(source,n)][period];return index===undefined?row[key]:row[key][index];};
// Each observation is an explicitly synthetic, internally aligned cohort.
// Weekly UV remains its own declared observation, never calculated by summing
// daily UV. Only documented within-cohort relationships are used below.
function snapshot(period,key,index){
 const previous=period==='week'&&(key==='previousValue'||key==='previous'),p=previous?1:0,out={};
 const set=(source,n,value)=>out[id(source,n)]=round(value);
 const pair=(now,before)=>[now,before][p],count=(source,n,now,before,scale=1)=>{const value=integer(pair(now,before)*scale);set(source,n,value);return value;};
 const liveAmount=get('live',2,period,key,index),ls=liveAmount/pair(80000,100000);
 const lv=count('live',10,12000,16000,ls),le=count('live',9,60000,64000,ls),lp=count('live',11,9000,12000,ls),lc=count('live',12,2760,4160,ls),lb=count('live',4,600,960,ls);
 count('live',3,800,1000,ls);count('live',5,900,1200,ls);count('live',6,60,80,ls);
 set('live',8,liveAmount/lb);set('live',14,100*lv/le);set('live',15,100*lc/lv);set('live',16,100*lb/lc);set('live',17,100*lb/lv);set('live',18,1000*liveAmount/lv);
 const vu=get('video',7,period,key,index),vs=vu/pair(150000,210000);
 const vw=count('video',5,37500,58800,vs),vp=count('video',8,9750,17052,vs),vc=count('video',9,1800,2500,vs),vb=count('video',10,504,775,vs);
 const vo=count('video',3,600,800,vs);
 set('video',2,pair(32000,45000)*vs);set('video',11,100*vw/vu);set('video',12,100*vp/vw);set('video',13,100*vc/vp);set('video',14,100*vb/vc);
 set('video',15,vu);set('video',16,100*vw/vu);set('video',18,100*vc/vp);set('video',19,100*vb/vc);
 const shelfExposure=get('shelf',4,period,key,index),ss=shelfExposure/pair(300000,280000),sc=count('shelf',6,15000,16000,ss),so=count('shelf',8,600,720,ss);
 const sa=round(pair(78000,70000)*ss),self=round(pair(48000,45000)*ss);
 set('shelf',1,sa);set('shelf',2,self);set('shelf',3,sa-self);set('shelf',5,100*sc/shelfExposure);set('shelf',7,100*so/sc);
 const tradeAmount=get('trade',1,period,key,index),ts=tradeAmount/pair(190000,215000),to=count('trade',5,2600,3000,ts),tb=count('trade',6,2000,2400,ts),tc=count('trade',15,40000,40000,ts);
 set('trade',4,tradeAmount*pair(.062,.048));set('trade',9,pair(6.2,4.8));set('trade',12,tradeAmount/tb);set('trade',14,100*to/tc);
 const tr=count('trade',7,69,79,ts);set('trade',8,Math.min(tr,integer(pair(64,72)*ts)));
 set('home',1,tradeAmount);set('home',5,to);set('home',6,tb);set('home',3,tc);
 set('buyer',1,tb);const first=integer(tb*pair(.6,.625));set('buyer',2,first);set('buyer',3,tb-first);set('buyer',4,tradeAmount/tb);set('buyer',5,pair(1.5,1.6));
 set('buyer',6,lb);set('buyer',7,vb);set('buyer',9,integer(pair(32000,36000)*ts));set('buyer',10,integer(pair(2800,2900)*ts));set('buyer',11,tb);set('buyer',13,tb);set('buyer',14,tradeAmount/to);
 const creatorAmount=get('creator',1,period,key,index),cs=creatorAmount/20000,co=count('creator',2,400,430,cs);
 count('creator',3,285,295,cs);set('creator',5,creatorAmount*pair(.09,.06));set('creator',6,integer(co*pair(.27,.30)));set('creator',7,pair(9,6));set('creator',8,100*out[id('creator',6)]/co);
 const goodsScale=get('goods',1,period,key,index)/pair(160,170),gu=count('goods',4,20000,25000,goodsScale),gp=count('goods',5,30000,38000,goodsScale),gc=count('goods',6,3000,4500,goodsScale);
 count('goods',7,4000,6000,goodsScale);const gb=count('goods',13,480,855,goodsScale),go=count('goods',12,600,1000,goodsScale),gq=count('goods',14,660,1100,goodsScale),ga=round(gq*pair(45.5,42));
 set('goods',11,ga);set('goods',15,ga/gb);set('goods',8,100*gc/gu);set('goods',9,100*gb/gc);set('goods',10,100*gb/gu);
 const moving=count('goods',2,64,85,goodsScale);set('goods',3,100*moving/get('goods',1,period,key,index));count('goods',17,1000,1500,goodsScale);
 set('goods',19,integer(go*pair(.30,.33)));set('goods',21,ga*pair(.31,.34));set('goods',22,integer(gb*pair(.25,.30)));set('goods',23,100*out[id('goods',19)]/go);
 const channelExposure=get('liveChannel',1,period,key,index),ch=channelExposure/pair(159,169),cw=count('liveChannel',2,120,150,ch),cc=count('liveChannel',6,60,80,ch),cp=count('liveChannel',7,12,16,ch);
 count('liveChannel',5,100,130,ch);set('liveChannel',4,1000*get('liveChannel',3,period,key,index)/cw);set('liveChannel',8,100*cw/channelExposure);set('liveChannel',9,100*cp/cw);set('liveChannel',10,100*cp/cc);
 // Creator content has its own scope; no attribution to all creator sales is
 // invented. A declared synthetic content cohort supports the two rates.
 const ce=get('creatorVideo',1,period,key,index),cv=count('creatorVideo',3,30000,40000,ce/pair(100000,130000));
 set('creatorVideo',4,pair(.3,.25));set('creatorVideo',5,pair(150,120));
 set('after',3,Math.min(get('after',2,period,key,index),integer(get('after',3,period,key,index)*.9)));
 return out;
}
for(const period of ['week','day'])for(const key of ['value','previousValue','current','previous']){
 for(const index of ['current','previous'].includes(key)?[0,1,2,3,4,5,6]:[undefined]){
  for(const [metric,value] of Object.entries(snapshot(period,key,index))){
   changed.add(metric);if(index===undefined)demo.metrics[metric][period][key]=value;else demo.metrics[metric][period][key][index]=value;
  }
 }
}
demo.businessFixtureVersion=1;demo.businessFixtureMetricIds=[...changed];
demo.businessFixtureNote='合成案例仅验证执行链路；各来源独立声明同对象观察值，跨来源归因、真实经营效果及未声明分母仍待验证。';
await writeFile(file,src.slice(0,src.indexOf(marker))+marker+JSON.stringify(catalog)+';\n');
console.log(JSON.stringify({reviewedSyntheticMetrics:changed.size,weeklyUV:'独立声明，未按日UV求和'}));
