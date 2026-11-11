'use strict';
function workflowResult(result){return result?.workflowContract===1;}
function workflowEvidenceDetail(finding){try{return JSON.parse(finding.evidenceDetail||'{}');}catch{return {};}}
function workflowMetricTile(m,result){
 const old=Number.isFinite(m.previousValue)?m.previousValue:(result.metricAnalysis||[]).find(x=>(x.metricId||x.id)===(m.metricId||m.id))?.previousValue;
 const metric={label:m.label||(typeof curatedMetric==='function'?curatedMetric(m.metricId||m.id)?.originalName:'')||'经营指标',unit:m.unit||'',type:m.unit==='元'?'money':m.unit==='%'?'rate':'count'};
 const change=Number.isFinite(m.value)&&Number.isFinite(old)&&old!==0?100*(m.value/old-1):null,points=m.unit==='%'&&Number.isFinite(old)?`${m.value>=old?'上升':'下降'}${Math.abs(m.value-old).toLocaleString('zh-CN',{maximumFractionDigits:2})}个百分点 · `:'';
 const badUp=/退款率|退单率|介入率/.test(metric.label);
 return {label:metric.label,value:Number.isFinite(m.value)?formattedMetric(metric,m.value):'未提供',change,tone:change===null?'':(badUp?change>0:change<0)?'down':'up',comparison:Number.isFinite(old)?`前期 ${formattedMetric(metric,old)} · ${points}${change===null?'暂无相对变化':`相对${change<0?'下降':'上升'} ${Math.abs(change).toFixed(1)}%`}`:''};
}
function workflowMerchantBrief(result,question='',options={}){
 const findings=(result.diagnosis||[]).filter(f=>f.triggered!==false).slice(0,3),ranked=findings.map((finding,index)=>({id:merchantIssueId(finding),finding,score:3-index,reason:finding.priorityReason||''}));
 const queue=merchantIssueQueue(ranked,options.progress),remaining=(result.pendingIssues||[]).length;
 queue.remaining=remaining;queue.total=findings.length+remaining;queue.canNext=queue.ready&&remaining>0;
 const issues=queue.active.map(entry=>{
  const f=entry.finding,detail=workflowEvidenceDetail(f),actions=(f.actionIds||[]).map(id=>(result.actions||[]).find(a=>a.id===id)).filter(Boolean);
  return {id:entry.id,title:f.name||f.title,handled:entry.handled,priorityReason:f.priorityReason||'',metrics:(f.evidence||[]).filter(m=>!f.displayMetricIds?.length||f.displayMetricIds.includes(m.metricId||m.id)).map(m=>workflowMetricTile(m,result)),reason:f.explanation||'本次工作流未返回完整原因判断。',reasonItems:(f.reasonItems||[]).filter(x=>x.text),actionItems:(f.actionItems||[]).flatMap(a=>[{label:a.label||'执行',text:a.text},{label:'验证',text:a.verification}]).filter(x=>x.text),analysis:{facts:detail.facts||[],calculations:detail.calculations||[]},uncertainty:f.uncertainty||detail.limitation||'',actions:actions.map(a=>({kind:'tool',label:a.name,title:a.name,detail:(f.actionItems||[]).filter(x=>x.actionId===a.id).map(x=>x.text+'\n验证：'+x.verification).join('\n')||a.description||''}))};
 });
 const verdict=result.answer||(!findings.length?'本次工作流未返回需要优先处理的问题。':'本次经营诊断结果');
 return {scope:merchantScopeInfo(result,question),issues,ranked,queue,verdict,demo:result.dataMode==='demo',tone:findings.length?'attention':'watch',text:[merchantScopeInfo(result,question).text,verdict,...issues.map((i,n)=>`问题${n+1}：${i.title}\n关联指标：${i.metrics.map(m=>m.label+' '+m.value).join('；')}\n原因判断：\n${i.reasonItems.map((r,k)=>`${k+1}. ${r.label}：${r.text}`).join('\n')}\n行动建议：\n${i.actionItems.map((a,k)=>`${String.fromCharCode(97+k)}. ${a.label}：${a.text}`).join('\n')}`)].join('\n\n')};
}
function workflowGoalBrief(result,question=''){
 const g=result.goal||{},n=result.goalDiagnosis||{},valid=Number.isFinite(g.actual)&&g.actual>=0&&Number.isFinite(g.target)&&g.target>0&&Number.isFinite(g.rate)&&Number.isFinite(g.gap);
 const context=result.context||{},scene=fieldData(context.fieldKey).name,fmt=x=>x.toLocaleString('zh-CN',{maximumFractionDigits:2});
 const brief={type:'goal',scene,period:periodName(context.period),demo:result.dataMode==='demo',valid,plans:[],fields:[],metrics:[],scope:merchantScopeInfo(result,question)};
 if(!valid)return {...brief,verdict:'本次工作流未取得完整目标资料',note:result.missing?.join('；')||'需要同口径目标与成交数据。',text:result.answer||'目标资料不足'};
 Object.assign(brief,{actual:g.actual,target:g.target,gap:g.gap,rate:g.rate,achieved:g.gap===0,verdict:`${scene}目标${g.gap===0?'已达成':'尚未达成'}，完成${g.rate.toFixed(1)}%`,note:n.basis||'',assumption:n.uncertainty||'',verification:'',planTitle:'下一步行动',metrics:[{label:'演示目标金额',value:fmt(g.target)+'元'},{label:'已完成金额',value:fmt(g.actual)+'元'},{label:g.gap?'距目标差额':'超出目标',value:fmt(g.gap||Math.max(0,g.actual-g.target))+'元'}]});
 if(result.quality?.validated===false||!n.judgment||!n.basis||(g.gap>0&&!n.plans?.length))brief.note='本次工作流的目标说明或行动尚未完整返回，请重新分析。'+(result.quality?.errors||result.missing||[]).join('；');
 brief.plans=(n.plans||[]).map(p=>({title:p.title,detail:p.detail,metrics:[],actions:(result.actions||[]).filter(a=>a.id===p.actionId).map(a=>({kind:'tool',label:a.name,title:a.name,detail:p.detail+'\n验证：'+p.verification})),verification:p.verification}));
 brief.verification=[...new Set(brief.plans.map(p=>p.verification).filter(Boolean))].join('；');brief.text=[brief.scope.text,brief.verdict,n.judgment||'',brief.metrics.map(m=>m.label+'：'+m.value).join('；'),brief.note,brief.assumption,...brief.plans.map(p=>p.title+'：'+p.detail+'\n验证：'+p.verification)].filter(Boolean).join('\n\n');return brief;
}
