'use strict';

function isGoalQuestion(question){return /目标|达标|达成|补差|缺口/.test(question)&&!/什么是|是什么意思|如何设置|怎么设置|如何制定|怎么制定/.test(question);}
function buildMerchantGoalBrief(result,question=''){
 if(typeof workflowResult==='function'&&workflowResult(result))return workflowGoalBrief(result,question);
 const curated=typeof curatedActive==='function'&&curatedActive();
 if(curated)result=curatedGoalResult(result);
 const context=result.context||{},names={overview:'全店',live:'直播',video:'短视频',shelf:'货架',creator:'达人合作'},field=context.fieldKey||'overview',scene=names[field]||'当前场景';
 const finite=n=>typeof n==='number'&&Number.isFinite(n),fmt=n=>n.toLocaleString('zh-CN',{maximumFractionDigits:2}),pct=n=>n.toFixed(1)+'%';
 const metrics=new Map();
 for(const m of [...(result.evidence||[]),...(result.metricAnalysis||[])]){
  const id=m.metricId||m.id||'',match=id.match(new RegExp('^'+field+'-(\\w+)-value$'));
  if(match&&finite(m.value))metrics.set(match[1],{...m,label:m.label||m.name});
 }
 if(curated)for(const key of ['gmv','orders','buyers','clickRate','payRate','exposure','plays','creators']){
  const id=curatedGoalMetricId(field,context.period,key),value=[...(result.metricAnalysis||[]),...(result.evidence||[])].find(m=>(m.metricId||m.id)===id&&finite(m.value));
  if(value)metrics.set(key,{...value,label:curatedMetric(id)?.originalName||value.label});
 }
 const goal=result.goal||{},actual=finite(goal.actual)?goal.actual:metrics.get('gmv')?.value,target=goal.target;
 const valid=finite(actual)&&actual>=0&&finite(target)&&target>0&&['success','partial'].includes(result.status);
 const brief={type:'goal',scene,period:context.period==='day'?'昨日':'近7天',demo:result.dataMode==='demo',valid,plans:[],fields:[],metrics:[],scope:merchantScopeInfo(result,question)};
 const link=(f,metric,label)=>({kind:'data',label,href:`#merchant/dashboard/${f}/${context.period==='day'?'day':'week'}/${curated?curatedGoalMetricId(f,context.period,metric)||curatedGoalMetricId(f,context.period,'gmv'):metric}`});
 const advice=(label,detail)=>({kind:'advice',label,title:label,detail});
 if(!valid){
  brief.verdict='目标资料不足，暂不能判断达成差距';brief.note='需要同场景、同周期的目标金额与已完成金额。';brief.text=brief.scope.text+'\n'+brief.verdict+'。'+brief.note;return brief;
 }
 const gap=Math.max(0,target-actual),rate=100*actual/target,uplift=actual>0?100*gap/actual:null;
 Object.assign(brief,{actual,target,gap,rate,uplift,achieved:gap===0,verdict:gap?`${scene}目标完成${pct(rate)}，还差${fmt(gap)}元`:`${scene}目标已达成，完成${pct(rate)}`});
 brief.metrics=[{label:goal.source==='previous_demo'?'演示目标金额':'目标金额',value:fmt(target)+'元'},{label:'已完成金额',value:fmt(actual)+'元'},{label:gap?'距目标差额':'超出目标',value:fmt(gap||actual-target)+'元'}];
 if(!gap){
  brief.note='当前没有需要补齐的目标缺口，继续观察后续同口径表现。';
  brief.plans=[{title:'复盘有效做法，保持下一周期表现',detail:'按商品或场次复盘成交贡献，保留经过验证的有效做法。',metrics:[],actions:[link(field,'gmv','查看成交趋势'),advice('复盘本期有效做法','对比本期与上一周期的商品、内容或合作对象，复盘成交贡献；不因单次达标就承诺后续表现。')]}];
 }else{
  brief.note=uplift===null?'当前成交为零，先恢复有效成交，再评估各环节的补差空间。':`还差目标的${pct(100*gap/target)}；若以同样目标作为下一次同等周期的参考，成交需在当前基础上提升${pct(uplift)}。`;
  const fields=(result.fieldBreakdown||[]).filter(f=>finite(f.actual)&&finite(f.target)&&f.target>0).map(f=>({...f,name:names[f.fieldKey]||f.name,gap:Math.max(0,f.target-f.actual),rate:100*f.actual/f.target})).sort((a,b)=>b.gap-a.gap);
  if(field==='overview'&&fields.length){
   const gross=fields.reduce((s,f)=>s+f.gap,0),netMatches=Math.abs(gross-gap)<1;
   brief.fields=fields.map(f=>({...f,share:gross?100*f.gap/gross:0}));brief.shareLabel=netMatches?'全店缺口占比':'未达标场域缺口占比';
   for(const f of brief.fields.filter(x=>x.gap>0).slice(0,2)){
    brief.plans.push({title:`优先补${f.name}：还差${fmt(f.gap)}元`,detail:`${f.name}完成${pct(f.rate)}，占${brief.shareLabel.replace('占比','')}${pct(f.share)}。${f.actual>0?`若继续采用原目标，本场域成交需较当前提升${pct(100*f.gap/f.actual)}。`:'先恢复有效成交，再评估补差路径。'}`,metrics:[],actions:[{kind:'diagnose',label:`分析${f.name}目标差距`,question:`帮我分析${brief.period}${f.name}的目标差距，给出补差方案`},link(f.fieldKey,'gmv',`查看${f.name}成交数据`)]});
   }
   brief.planTitle='先确定补差优先级';brief.assumption='差额和占比来自本次返回的目标与成交数据；各场域的具体经营原因仍需明细复盘。';
  }else if(actual>0){
   const factor=target/actual,effKey={live:'clickRate',video:'clickRate',shelf:'payRate',creator:'creators'}[field]||'orders',flowKey={live:'exposure',video:'plays',shelf:'exposure',creator:'creators'}[field]||'buyers';
   const labels={clickRate:'商品点击率',payRate:'点击支付转化率',creators:'有成交达人数',exposure:'商品曝光人数',plays:'视频播放量',orders:'支付订单数',buyers:'支付人数'},eff=metrics.get(effKey),flow=metrics.get(flowKey),isRate=key=>curated?metrics.get(key)?.unit==='%':['clickRate','payRate','activeRate'].includes(key);
   if(curated)for(const [key,value] of metrics)labels[key]=value.label;
   brief.planTitle='两条可选补差路径';brief.assumption='以下是演示补差方案，按当前产出做等比例情景测算；用于确定验证方向，不代表已确认原因或效果承诺。两条路径择一验证，不能相加。';
   if(eff&&eff.value>0&&(!isRate(effKey)||eff.value*factor<=100)){
    const raw=eff.value*factor,reference=isRate(effKey)?raw:Math.ceil(raw-1e-9),unit=eff.unit||'';
    brief.plans.push({title:`路径1：集中改善${labels[effKey]||eff.label}`,badge:'情景测算',detail:`假设其他条件、商品结构与单位成交产出保持不变，${labels[effKey]||eff.label}从${fmt(eff.value)}${unit}提高到约${fmt(reference)}${unit}，按等比例测算可覆盖${fmt(gap)}元差额。`,metrics:[{label:'当前'+(labels[effKey]||eff.label),value:fmt(eff.value)+unit},{label:'情景参考值',value:fmt(reference)+unit}],actions:[advice({live:'检查商品展示与讲解',video:'复盘视频点击承接',shelf:'检查库存与到手价',creator:'复盘有效达人合作'}[field]||'检查重点商品','先定位变化集中的商品、内容或合作对象；选取小范围调整，比较同口径的成交与相关指标，再决定是否扩大。'),link(field,effKey,'查看对应指标趋势')]});
   }
   if(flow&&flow.value>0&&eff&&eff.value>0&&effKey!==flowKey){
    const flowFactor=Math.min(1.1,Math.sqrt(factor)),effFactor=factor/flowFactor,reference=eff.value*effFactor;
    if(!isRate(effKey)||reference<=100){
     brief.plans.push({title:'路径2：同时改善触达与承接',badge:'组合测算',detail:`假设其余环节不变，${labels[flowKey]}提升${pct((flowFactor-1)*100)}、${labels[effKey]}提升${pct((effFactor-1)*100)}，组合成交约为当前的${factor.toFixed(2)}倍，可达到${fmt(target)}元参考目标。`,metrics:[{label:labels[flowKey]+'参考值',value:fmt(Math.ceil(flow.value*flowFactor-1e-9))+(flow.unit||'')},{label:labels[effKey]+'参考值',value:fmt(reference)+(eff.unit||'')}],actions:[advice('安排下一周期补差试验',`下一次同等周期分别记录${labels[flowKey]}、${labels[effKey]}与支付金额。先做小范围经营调整，验证两项指标能否同时改善，再复看目标缺口。`),link(field,'gmv','查看成交趋势')]});
    }
   }
   if(brief.plans.length<2)brief.plans.push({title:'按商品或合作对象拆解差额',badge:'演示方案',detail:'先找出成交贡献最大的对象，逐一核对排期、可售状态和成交承接，再为下一次同等周期分配补差任务。',metrics:[],actions:[advice('分配补差任务','按商品、内容、场次或合作对象列出已有成交及可验证的增量机会；责任人确认可执行性后，再确定分配量。'),link(field,'gmv','查看成交数据')]});
  }else{
   brief.planTitle='先恢复基础成交';brief.assumption='当前成交为零，不能用除法估算需要提升多少倍。';brief.plans=[{title:'核对开播、供给与可售状态',badge:'演示方案',detail:'先确认经营活动正常开展、商品可售且成交记录完整，再拆解目标差距。',metrics:[],actions:[advice('检查基础经营状态','核对排期、商品可售状态、支付链路与数据统计；先恢复有效成交，再分配补差任务。'),link(field,'gmv','查看成交数据')]}];
  }
 }
 if(brief.planTitle==='两条可选补差路径'&&brief.plans.length!==2){brief.planTitle='补差路径与验证';brief.assumption=brief.assumption.replace('两条路径择一验证，不能相加。','先验证可执行性，再决定补差目标。');}
 brief.verification=gap?`复盘与验证：${brief.period==='昨日'?'昨日已结束，以上方案用于下一次同等周期。':''}以支付金额是否达到${fmt(target)}元作为结果指标，同时观察调整环节与支付承接；效果需实际数据验证。`:'复盘时继续同时查看成交金额、效率与经营投入。';
 brief.text=[brief.scope.text,brief.verdict,brief.metrics.map(m=>m.label+'：'+m.value).join('；'),brief.note,...brief.fields.map(f=>`${f.name}：目标${fmt(f.target)}元，已完成${fmt(f.actual)}元，缺口${fmt(f.gap)}元`),brief.assumption,...brief.plans.map(p=>p.title+'：'+p.detail+'\n行动：'+p.actions.map(a=>a.label).join('、')),brief.verification].filter(Boolean).join('\n\n');return brief;
}
function merchantGoalHTML(result,question='',isCoze=true){
 const b=buildMerchantGoalBrief(result,question),money=n=>n.toLocaleString('zh-CN',{maximumFractionDigits:2})+'元';
 const tiles=items=>`<div class="merchant-brief-metrics" data-count="${items.length}">${items.map(m=>`<div><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong></div>`).join('')}</div>`;
 const fields=b.fields.length?`<section class="goal-section"><h4>差距集中在哪里</h4><div class="goal-breakdown" role="table" aria-label="各场域目标差距"><div class="goal-breakdown-row heading" role="row"><span>场域</span><span>已完成 / 目标</span><span>缺口</span><span>${esc(b.shareLabel)}</span></div>${b.fields.map(f=>`<div class="goal-breakdown-row" role="row"><strong>${esc(f.name)}</strong><span>${money(f.actual)} / ${money(f.target)}</span><strong>${money(f.gap)}</strong><span>${f.share.toFixed(1)}%</span></div>`).join('')}</div></section>`:'';
 const plans=b.plans.map((p,i)=>`<section class="merchant-issue goal-plan"><header class="merchant-issue-heading"><span>${b.achieved?'复盘':'方案 '+(i+1)}</span><h4>${esc(p.title)}</h4>${p.badge?`<small class="goal-scenario-badge">${esc(p.badge)}</small>`:''}</header>${p.metrics.length?tiles(p.metrics):''}<p>${esc(p.detail)}</p><div class="merchant-issue-actions">${p.actions.map(merchantBriefActionHTML).join('')}</div></section>`).join('');
 return `<article class="merchant-brief merchant-goal"><div class="answer-label">${icon('spark')}目标诊断${b.demo?' · 演示数据':''}</div>${merchantScopeHTML(result,question)}<div class="merchant-brief-summary"><p class="merchant-brief-verdict ${b.achieved?'watch':'attention'}">${esc(b.verdict)}</p>${b.metrics.length?tiles(b.metrics):''}<p class="goal-gap-note">${esc(b.note||'')}</p></div>${fields}${plans?`<section class="goal-section"><h4>${esc(b.planTitle||'下一步行动')}</h4>${b.assumption?`<p class="goal-assumption">${esc(b.assumption)}</p>`:''}${plans}</section>`:''}${b.verification?`<p class="goal-verification">${esc(b.verification)}</p>`:''}</article>`;
}
