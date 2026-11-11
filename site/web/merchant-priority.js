// Presentation ranking, not new diagnosis thresholds or a claim of causal loss.
// The complete diagnosis snapshot remains intact behind a three-item queue.
function merchantIssueId(finding){
 if(typeof finding.strategyId==='string'&&finding.strategyId)return finding.strategyId;
 const text=String(finding.name||finding.title||'')+'|'+(finding.evidence||[]).map(m=>m.metricId||m.id||m.label).sort().join('|');
 let hash=2166136261;for(const char of text)hash=Math.imul(hash^char.charCodeAt(0),16777619);
 return 'issue-'+(hash>>>0).toString(36);
}
function merchantRankIssues(findings,result={},definitions=[]){
 const finite=n=>typeof n==='number'&&Number.isFinite(n),rows=new Map([...(result.evidence||[]),...(result.metricAnalysis||[])].map(m=>[m.metricId||m.id,m]));
 const goals=[result.goal,...(result.goals||[])].filter(Boolean),goalIds=new Set(goals.flatMap(g=>[g.metricId,...(g.metricIds||[])].filter(Boolean))),goalKeys=new Set(goals.map(g=>g.metricKey).filter(Boolean));
 const explicit=goalIds.size||goalKeys.size,goalName=goals.find(g=>g.name)?.name||'成交目标';
 return [...new Map(findings.filter(f=>f.triggered!==false).map(f=>{
  const metrics=(f.evidence||[]).map(e=>{const id=e.metricId||e.id,d=definitions.find(m=>m.id===id)||{},m=rows.get(id)||{};return {...m,...e,id,label:d.originalName||e.label||m.label||d.name||'',metricKey:d.metricKey||m.metricKey,previousValue:finite(e.previousValue)?e.previousValue:m.previousValue};});
  const names=metrics.map(m=>m.label).join(' '),direct=metrics.some(m=>goalIds.has(m.id)||goalKeys.has(m.metricKey)||goalKeys.has('gmv')&&/^(成交金额|商品卡成交金额)$/.test(m.label)),ambiguous=/粉丝占比|佣金/.test(names);
  let relation=direct?1:explicit?.35:/^(成交金额|商品卡成交金额)$/.test(metrics[0]?.label||'')?1:/退款率|成交订单|成交人数/.test(names)?.9:/成交率|转化率|转换率|下单订单/.test(names)?.85:/首购|复购|成交用户|客单价/.test(names)?.75:/曝光|观看人数|触达/.test(names)?.7:/品质|动销|在架/.test(names)?.65:.55;
  if(ambiguous&&!direct)relation=.3;
  let severity=0,largest=null;
  for(const m of metrics){
   if(!finite(m.value)||!finite(m.previousValue)||m.previousValue<0)continue;
   const badUp=/退款率|退单率|介入率|退款金额|佣金支出/.test(m.label),delta=(badUp?1:-1)*(m.value-m.previousValue);
   if(delta<=0||(/占比/.test(m.label)&&!direct))continue;
   const relative=m.previousValue>0?Math.min(delta/m.previousValue,1):1;
   // Rates combine relative movement and percentage-point movement, preventing
   // a tiny denominator alone from dominating the display order.
   const movement=m.unit==='%'?.5*relative+.5*Math.min(delta/10,1):relative;
   if(movement>severity){severity=movement;largest={label:m.label,relative:m.previousValue>0?100*delta/m.previousValue:null,points:m.unit==='%'?delta:null,badUp};}
  }
  const complete=metrics.length?metrics.filter(m=>finite(m.value)&&finite(m.previousValue)).length/metrics.length:0;
  const score=50*relation+40*severity+10*complete*(ambiguous?.5:1),id=merchantIssueId(f);
  const movement=largest?`${largest.label}${largest.badUp?'上升':'下降'}${largest.points!==null?largest.points.toLocaleString('zh-CN',{maximumFractionDigits:2})+'个百分点':finite(largest.relative)?largest.relative.toFixed(1)+'%':'（前期为0）'}`:'变化幅度需结合明细确认';
  return [id,{id,finding:f,score,goalRelevance:relation,severity,evidenceCompleteness:complete,goalBasis:explicit?'configured':'default_gmv',reason:`${direct||!explicit&&relation>=.9?'直接关联':relation>=.65?'关联':'间接关联'}${goalName}；${movement}`}];
 })).values()].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
function merchantIssueQueue(ranked,progress={}){
 const byId=new Map(ranked.map(r=>[r.id,r])),stored=Array.isArray(progress.order)?progress.order.filter(id=>byId.has(id)):[];
 const order=[...new Set([...stored,...ranked.map(r=>r.id)])],handled=new Set((Array.isArray(progress.handledIds)?progress.handledIds:[]).filter(id=>byId.has(id)));
 const max=Math.max(0,Math.ceil(order.length/3)-1);let batch=Number.isInteger(progress.batchIndex)?Math.min(Math.max(progress.batchIndex,0),max):0;
 // Stored state cannot skip unresolved earlier batches.
 for(let i=0;i<batch;i++)if(order.slice(i*3,i*3+3).some(id=>!handled.has(id))){batch=i;break;}
 const activeIds=order.slice(batch*3,batch*3+3),ready=activeIds.length>0&&activeIds.every(id=>handled.has(id));
 return {version:1,order,batchIndex:batch,handledIds:[...handled],active:activeIds.map(id=>({...byId.get(id),handled:handled.has(id)})),total:order.length,remaining:Math.max(0,order.length-(batch+1)*3),ready,canNext:ready&&batch<max,complete:order.length>0&&order.every(id=>handled.has(id))};
}
function merchantAdvanceIssueQueue(ranked,progress,operation,issueId){
 const queue=merchantIssueQueue(ranked,progress),next={version:1,order:queue.order,handledIds:queue.handledIds,batchIndex:queue.batchIndex};
 if(operation==='toggle'&&queue.active.some(r=>r.id===issueId))next.handledIds=next.handledIds.includes(issueId)?next.handledIds.filter(id=>id!==issueId):[...next.handledIds,issueId];
 else if(operation==='next'&&queue.canNext)next.batchIndex++;
 return next;
}
function merchantIssueWriting(analysis,metrics=[]){
 if(analysis.kind==='live_revenue')return {reasonItems:analysis.reasonItems,actionItems:analysis.actionItems};
 const n=value=>value.toLocaleString('zh-CN',{maximumFractionDigits:2}),c=analysis.calculations?.[0];
 let basis=analysis.facts?.[0]||'当前证据不足，需补齐数据。',pending='核对商品、来源及经营记录，具体经营根因尚未确认。',judgment=analysis.conclusion;
 if(c){const sign=v=>(v>=0?'+':'−')+n(Math.abs(v));basis=`订单量变化对应${sign(c.orderEffect)}元，每单金额变化对应${sign(c.valueEffect)}元，合计${sign(c.total)}元。`;pending='此分解是算术关系；流量、价格、库存或内容等原因仍需明细核实。';}
 else if(/分子、分母/.test(analysis.limitation)){judgment='比率发生异常变化，需优先核对金额或订单结构。';pending=/退款/.test(metrics[0]?.label||'')?'需核对同口径退款金额、成交基数及原因；比率上升不等于退款金额增加。':'需核对同口径分子、分母及原因明细，不能由比率变化直接认定经营根因。';}
 else if(/佣金率|ROI/.test(analysis.limitation))pending='先对齐结算批次与成交订单，当前不能据此计算佣金率或ROI。';
 else if(/净成交/.test(analysis.limitation))pending='先对齐退款与成交归因，当前不能直接计算净成交。';
 const steps=String(analysis.checks||'核对本次指标与对应经营明细。').split(/[；。]|[，,](?=再|定位|优先)|(?=核实后|对齐前)/).map(s=>s.trim()).filter(Boolean);
 const first=steps[0],rest=steps.slice(1).join('；');
 const compact=text=>{const sentences=String(text).split(/[，,]/).filter(Boolean);return sentences.length>2?sentences.slice(0,2).join('，')+'。':text;};
 const focus=metrics.slice(0,2).map(m=>m.label).filter(Boolean).join('、')||'本次关联指标';
 return {reasonItems:[{label:'判断',text:judgment},{label:'依据',text:basis},{label:'待验证',text:pending}],actionItems:[{label:'定位',text:compact(first)},{label:'核查与调整',text:compact(rest||'核对重点对象的经营记录，确认原因后再做小范围调整。')},{label:'验证',text:`调整后按同口径复看${focus}；数据未验证前保留“待复核”状态。`}]};
}
