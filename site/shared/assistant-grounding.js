import {assistantMetricObservations} from './assistant-answer-contract.js';

// This runs with verified server data, before model generation. It does not use
// evaluation IDs, expected answers, model output, or frontend demonstration data.
export function buildAssistantGrounding(result,configuration,data){
 const obs=assistantMetricObservations(result),byId=new Map(obs.map(m=>[m.metricId,m]));
 const norm=s=>String(s||'').replace(/[（）]/g,c=>c==='（'?'(':')').replace(/\s/g,'');
 const find=name=>obs.find(m=>norm(m.label)===norm(name));
 const n=v=>Number(v.toFixed(2)).toLocaleString('zh-CN',{maximumFractionDigits:2}),sign=v=>(v<0?'−':'+')+n(Math.abs(v));
 const provided=obs.filter(m=>Number.isFinite(m.previousValue)).map(m=>m.label);
 const missingOnly=items=>(items||[]).flatMap(t=>String(t).split('、')).filter(t=>!provided.some(label=>norm(t)===norm(label)||norm(t)===norm(label)+'数据'));
 const rates=[
  ['曝光-观看率(人数)','观看人数','曝光人数'],
  ['观看-商品点击率(人数)','商品点击人数','观看人数'],
  ['商品曝光-点击转化率(人数)','商品点击人数','商品曝光人数'],
  ['商品点击-成交转化率(人数)','成交人数','商品点击人数'],
  ['商品点击-成交率(人数)','成交人数','商品点击人数'],
  ['点击成交转化率(订单)','成交订单数','商品点击次数'],
  ['曝光点击率','商品卡点击次数','商品卡曝光次数'],
  ['商品动销率','动销商品数','在架商品数'],
  ['加购成交转化率','同加购批次成交人数','商品加购人数']
 ];
 const issues=(result.diagnosis||[]).map(f=>{
  const s=(configuration.strategies||[]).find(s=>s.id===f.strategyId)||{};
  const ids=new Set((f.evidence||[]).map(m=>m.metricId||m.id)),facts=[],formulaNotes=[];
  const add=m=>{if(m)ids.add(m.metricId);};
  if(/退款|售后/.test(f.name)){for(const m of obs)if(/退款/.test(m.label))add(m);formulaNotes.push('同归因批次和观察窗口前提下，金额退款率=退款金额÷对应成交金额，订单退款率=退款订单数÷对应成交订单数；比率升高不证明退款绝对量增加。');}
  if(/加购/.test(f.name))for(const m of obs)if(/加购|商品点击人数/.test(m.label))add(m);
  if(/动销|在架/.test(f.name))for(const m of obs)if(/动销|在架/.test(m.label))add(m);
  if(/成交|订单/.test(f.name))for(const m of obs)if(/^(成交金额|商品卡成交金额|成交订单数|商品卡成交订单数|每单成交金额)$/.test(m.label))add(m);
  if(f.diagnosticKind==='live_revenue')for(const m of obs)if(/观看|成交金额|直播场次/.test(m.label))add(m);
  for(const [label,numerator,denominator]of rates){
   const rate=find(label);if(!rate)continue;
   const relevant=ids.has(rate.metricId)||/曝光.*观看/.test(f.name)&&label==='曝光-观看率(人数)'||/点击|转化|成交承接/.test(f.name)&&/点击/.test(label)||/动销|在架/.test(f.name)&&label==='商品动销率'||/加购/.test(f.name)&&label==='加购成交转化率';
   if(!relevant)continue;
   const a=find(numerator),b=find(denominator);add(rate);add(a);add(b);
   let t=label+'='+numerator+'÷'+denominator+'×100%，须同对象、同周期与同归因';
   if(label==='加购成交转化率')t+='，并对齐同加购人群和固定成交观察窗口';
   if(label==='商品动销率')t+='，分子须属于同统计时点的在架商品集合';
   if(a&&b&&b.value>0&&b.previousValue>0&&a.previousValue!==null&&Math.abs(100*a.value/b.value-rate.value)<.02&&Math.abs(100*a.previousValue/b.previousValue-rate.previousValue)<.02)t+=`；本期${n(a.value)}÷${n(b.value)}≈${n(rate.value)}%，前期${n(a.previousValue)}÷${n(b.previousValue)}≈${n(rate.previousValue)}%`;
   formulaNotes.push(t+'。');
  }
  for(const id of ids){const m=byId.get(id);if(m)facts.push(m.fact+'。');}
  let relation='';
  const calculations=[...(f.analysis?.calculations||[])];
  // A conversion diagnosis can also have verified amount and order data.
  // Retain that numerical cross-check even when the triggering rule only used
  // a conversion rate and buyer count. Never combine distinct metric sources.
  if(f.diagnosticKind!=='live_revenue'&&/成交|订单/.test(f.name)&&!/退款|佣金/.test(f.name)&&!calculations.some(k=>k.formula==='成交金额 = 成交订单数 × 每单成交金额')){
   const amount=find('成交金额')||find('商品卡成交金额'),orders=find('成交订单数')||find('商品卡成交订单数');
   if(amount&&orders&&amount.metricId.replace(/-\d+$/,'')===orders.metricId.replace(/-\d+$/,'')&&[amount.value,amount.previousValue,orders.value,orders.previousValue].every(Number.isFinite)&&orders.value>0&&orders.previousValue>0){
    const current=amount.value/orders.value,previous=amount.previousValue/orders.previousValue;
    calculations.push({formula:'成交金额 = 成交订单数 × 每单成交金额',current,previous,orderEffect:(orders.value-orders.previousValue)*(current+previous)/2,valueEffect:(current-previous)*(orders.value+orders.previousValue)/2,total:amount.value-amount.previousValue});
   }
  }
  for(const k of calculations){
   if(k.kind==='live_revenue'){
    facts.push(`每位观看者成交产出=成交金额÷观看人数，前期${n(k.previous)}元，本期${n(k.current)}元；观看人数变化对应${sign(k.volumeEffect)}元，人均产出变化对应${sign(k.outputEffect)}元，合计${sign(k.total)}元。这是算术分解，不是经营因果证明。`);
    relation=k.volumeEffect<0&&k.outputEffect>0?'观看规模减少、人均产出提升，后者弥补部分金额降幅。':k.volumeEffect<0&&k.outputEffect<0?'观看规模与人均产出共同回落。':k.volumeEffect<0?'观看规模减少，人均产出持平。':'观看规模与人均产出须分别核查。';
   }else if(k.kind==='exposure_frequency')facts.push(`人均曝光次数=曝光次数÷去重曝光人数，前期${n(k.previous)}次/人，本期${n(k.current)}次/人；须同范围口径，不能据此确认流量或内容根因。`);
   else if(k.formula==='成交金额 = 成交订单数 × 每单成交金额'){
    const movement=Math.abs(k.current-k.previous)<1e-9?'持平':k.current>k.previous?'上升':'下降';
    facts.push(`每单成交金额=成交金额÷成交订单数，前期${n(k.previous)}元，本期${n(k.current)}元，${movement}；这是订单口径，不能代替去重买家人数口径。订单数变化对应${sign(k.orderEffect)}元，每单金额变化对应${sign(k.valueEffect)}元，合计${sign(k.total)}元。`);
    relation=k.orderEffect<0&&k.valueEffect>0?'订单减少拉低成交，每单金额提高弥补部分下降。':k.orderEffect<0&&k.valueEffect<0?'订单减少、每单金额下降，共同拉低成交。':k.orderEffect<0?'订单减少、每单金额持平。':k.valueEffect<0?'订单规模未减，每单金额下降。':'';
   }
  }
  const exposure=find('商品曝光次数'),click=find('商品点击次数');
  if(/曝光与点击同步|曝光.*点击/.test(f.name)&&exposure&&click&&exposure.value>0&&exposure.previousValue>0&&click.previousValue!==null&&data.sameAttribution===true)facts.push(`同对象同周期同归因前提下，事件点击效率=商品点击次数÷商品曝光次数，前期${n(100*click.previousValue/exposure.previousValue)}%，本期${n(100*click.value/exposure.value)}%；不作为去重人数点击率。`);
  const requirements=missingOnly(s.missingMetricOrEvidence);
  const actions=(f.actionIds||[]).map(id=>{
   const a=(result.actions||[]).find(a=>a.id===id),mapping=(s.actionMappings||[]).find(m=>m.id===id);if(!a)return null;
   return {id,name:a.name,capability:a.description||'',instruction:mapping?.instruction||s.actionSubtitles?.[id]||'先核实具体经营对象的问题，再在工具声明能力内操作。',verification:mapping?.verification||'沿用相同统计周期与来源，复看相关指标、成交、退款与成本。'};
  }).filter(Boolean);
  return {strategyId:f.strategyId,judgment:f.name+'。'+relation,basis:[...facts,...formulaNotes].join(''),relation,requirements,actions};
 });
 const amount=find('成交金额')||find('商品卡成交金额'),traffic=obs.find(m=>/曝光|观看人数/.test(m.label)&&m.unit!=='%'),conversion=obs.find(m=>m.unit==='%'&&/转化率|成交率/.test(m.label));
 const short=m=>!m?'':m.label+(m.previousValue===null?'本期'+n(m.value)+m.unit:m.value===m.previousValue?'持平':(m.value>m.previousValue?'上升':'下降')+(m.unit==='%'?n(Math.abs(m.value-m.previousValue))+'个百分点':m.previousValue>0?n(Math.abs(100*(m.value/m.previousValue-1)))+'%':n(m.value)+m.unit));
 const goal=result.goal,goalValid=Number.isFinite(goal?.actual)&&Number.isFinite(goal?.target)&&goal.target>0;
 const summary={conclusion:[goalValid?(goal.actual>=goal.target?'本周期目标已达成':'本周期目标尚未达成'):'',short(amount),short(traffic),short(conversion)].filter(Boolean).join('；')+'。',basis:[amount,traffic,conversion].filter(Boolean).map(m=>m.label+(m.previousValue===null?'本期'+n(m.value):n(m.previousValue)+'→'+n(m.value))+m.unit).join('；')+'。',reason:[...new Set(issues.map(i=>i.relation).filter(Boolean))].slice(0,2).join('')||'这些指标定位了变化环节，具体原因仍需按商品、来源及经营记录核查。'};
 return {version:1,providedMetrics:provided,observations:obs,issues,summary,goalJudgment:goalValid?`本周期实际${n(goal.actual)}元，目标${n(goal.target)}元，完成率${n(100*goal.actual/goal.target)}%，差额${n(Math.max(0,goal.target-goal.actual))}元，${goal.actual>goal.target?'超额完成':goal.actual===goal.target?'刚好达成':'尚未达成'}。`:'',goalBasis:goalValid?`实际${n(goal.actual)}元，目标${n(goal.target)}元，完成率${n(100*goal.actual/goal.target)}%，差额${n(Math.max(0,goal.target-goal.actual))}元。`+issues.map(i=>i.basis).join(''):'',instruction:'问题判断和数字依据由发布规则与工具计算固定；模型负责待验证原因及行动。所有已提供聚合指标不得再次声称缺失；businessEvidence中已给的同批次与固定窗口摘要也不能说未提供，但未给原始明细仍可请求核对；对象级原始明细未给时可要求人工核对。行动必须满足当前绑定instruction的具体前提，不能把汇总变化本身当作根因。商品列表仅查看和管理商品信息，不提供退款统计或渠道报表。'};
}
