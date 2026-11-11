'use strict';
// The dashboard reads saved results. Only the explicit backend refresh invokes
// the Workflow; opening the dashboard, tabs or the assistant never does.
const DASHBOARD_SNAPSHOTS={key:'',status:'idle',snapshots:{},generation:null};
function dashboardSnapshotConfigurations(){return Object.fromEntries(Object.keys(MERCHANT_FIELDS).flatMap(field=>['week','day'].map(period=>[field+':'+period,aiddRuntimeConfig(field,period,{question:merchantQuestion(field,period)})])));}
function dashboardSnapshotManagerVisible(){return !!document.querySelector?.('[data-dashboard-snapshot-modal]');}
function dashboardSnapshotSchedule(fromManager=false){
 if((state.view!=='merchant'&&!fromManager)||!curatedActive()||!cozeIsActive())return;
 const runtimeConfigurations=dashboardSnapshotConfigurations(),key=JSON.stringify(runtimeConfigurations);
 if(DASHBOARD_SNAPSHOTS.key===key&&DASHBOARD_SNAPSHOTS.status!=='idle')return;
 DASHBOARD_SNAPSHOTS.key=key;DASHBOARD_SNAPSHOTS.status='reading';DASHBOARD_SNAPSHOTS.snapshots={};
 fetch('/api/dashboard/snapshot',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation:'read',runtimeConfigurations})}).then(r=>r.json()).then(data=>{if(DASHBOARD_SNAPSHOTS.key!==key)return;DASHBOARD_SNAPSHOTS.snapshots=Object.fromEntries(Object.entries(data.snapshots||{}).map(([scope,snapshot])=>[scope,{...snapshot,configKey:JSON.stringify(runtimeConfigurations[scope])}]));DASHBOARD_SNAPSHOTS.status=data.error?'unavailable':'ready';if(state.view==='merchant')render();else if(dashboardSnapshotManagerVisible())dashboardSnapshotManager();}).catch(()=>{DASHBOARD_SNAPSHOTS.status='unavailable';});
}
function dashboardRuleBundle(field=state.fieldKey,period=state.period){
 const config=aiddRuntimeConfig(field,period,{question:merchantQuestion(field,period)}),base=curatedGoalResult(curatedDemoResult(merchantQuestion(field,period),{fieldKey:field,period},null));
 const saved=DASHBOARD_SNAPSHOTS.snapshots[field+':'+period];
 const compatible=saved&&saved.configKey===JSON.stringify(config)&&(saved.result.metricAnalysis||[]).every(m=>{const now=curatedMetricData(m.metricId||m.id,period);return now.value===m.value&&now.previousValue===m.previousValue;});
 const result=compatible?saved.result:base;
 const rows=curatedDiagnosticRows(field,period,config),findings=rows.filter(r=>r.warning).map(row=>{
  const original=base.diagnosis.find(f=>f.strategyId===row.id),model=result.diagnosis?.find(f=>f.strategyId===row.id);
  return {...original,...model,row};
 });
 const ranked=merchantRankIssues(findings,{...result,goal:curatedGoalData(field,period)},config?.metrics||[]).map(x=>x.finding);
 return {config,result,rows,findings:ranked,field,period,snapshot:compatible?saved:null};
}
function dashboardPlain(text){return String(text||'').replaceAll('本次成交回落主要体现为订单量收缩','成交下降主要因为订单变少').replaceAll('订单量收缩','订单变少').replaceAll('观看规模收缩','观看人数减少').replaceAll('人均成交产出','每位观众带来的成交金额').replaceAll('人均产出','每位观众带来的成交金额').replaceAll('形成部分抵消','弥补了部分降幅').replaceAll('抵消了部分降幅','弥补了部分降幅').replaceAll('抵消','弥补').replaceAll('负向因素','下降因素').replaceAll('正向因素','增长因素');}
function dashboardMetric(id,bundle){const def=bundle.config?.metrics.find(m=>m.id===id)||curatedMetric(id)||{},data=curatedMetricData(id,bundle.period);return {...def,...data,metricId:id,label:def.originalName||def.name||'指标'};}
function dashboardNumber(value,unit=''){
 if(!Number.isFinite(value))return '待补充';
 const n=value.toLocaleString('zh-CN',{maximumFractionDigits:2});
 return Math.abs(value)>=10000?(value/10000).toLocaleString('zh-CN',{maximumFractionDigits:2})+'万'+unit:n+unit;
}
function dashboardMetricEvidence(m){
 const value=dashboardNumber(m.value,m.unit==='待核验'?'':m.unit),old=m.previousValue;
 if(!Number.isFinite(m.value))return m.label+'数据待补充';
 if(!Number.isFinite(old))return `${m.label}${value}，前期值待补充`;
 const delta=m.value-old;
 if(Math.abs(delta)<1e-9)return `${m.label}${value}，与前期持平`;
 const word=delta>0?'上升':'下降',change=m.unit==='%'?dashboardNumber(Math.abs(delta))+'个百分点':old>0?Math.abs(100*delta/old).toFixed(1)+'%':`由${dashboardNumber(old,m.unit)}变为${value}`;
 return `${m.label}${value}，${old===0&&m.unit!=='%'?change:word+change}`;
}
// Buttons and recommendation copy use the same matched, published strategy.
// Asset names never select a tool; IDs and their order come from publication.
function dashboardIssueActions(finding,bundle){
 if(!bundle.config?.active)return [];
 const id=finding.strategyId||finding.row?.id||finding.id,strategy=bundle.config.strategies?.find(s=>s.id===id);
 if(!strategy||strategy.enabled===false||strategy.status!=='生效中')return [];
 return [...new Set(strategy.actionIds||[])].map(id=>{
  const asset=bundle.config.actions?.find(a=>a.id===id);if(!asset)return null;
  return {...asset,toolName:asset.name,fieldKey:bundle.field,recommendation:strategy.actionSubtitles?.[id]?.trim()||asset.description||''};
 }).filter(Boolean);
}
function dashboardIssueCopy(finding,bundle){
 const analysis=merchantEvidenceAnalysis(finding,bundle.result,bundle.config?.metrics||[]),names=(finding.evidence||[]).map(m=>m.label).join(' '),c=analysis.calculations?.[0];
 let reason=dashboardPlain(finding.reasonItems?.find(x=>x.label==='判断')?.text||analysis.conclusion);
 if(c?.kind==='live_revenue')reason=c.volumeEffect<0&&c.outputEffect>=0?'观看人数减少是成交下降的主要影响；每位观众带来的成交金额提高，弥补了部分降幅。':c.volumeEffect<0?'观看人数和每位观众带来的成交金额同时下降，需要同时核查流量和成交承接。':'观看人数未减少，但每位观众带来的成交金额降低，需核查商品和成交承接。';
 else if(c)reason=c.total<0&&c.orderEffect<0&&c.valueEffect>=0?'成交下降主要因为订单变少；每笔订单金额提高，弥补了部分降幅。':c.total<0&&c.orderEffect<0?'订单变少，每笔订单金额也降低，两项共同影响成交。':c.total>=0&&c.orderEffect<0?'每笔订单金额提高，弥补了订单减少的影响。':'成交变化与订单数量、每笔订单金额有关，具体商品或来源仍需核查。';
 else if(/退款率|退单率|纠纷介入率|退款金额/.test(names))reason='退款或纠纷指标变化需结合订单基数、归因批次和原因核查，暂不能据此认定具体原因。';
 else if(/佣金/.test(names))reason='成交和结算佣金可能对应不同批次，暂不能直接判断佣金成本是否变高。';
 else if(/动销|在架商品/.test(names))reason='需区分商品下架、缺货和在架未成交，不能只凭动销率判断具体原因。';
 else if(/成交率|转化率|转换率/.test(names))reason='成交承接比例发生变化，需分清人群变化与商品承接的影响。';
 else if(/曝光|观看|触达|商品点击/.test(names))reason='变化集中在触达或点击环节；具体来源、内容或商品仍需明细核实。';
 else if(/回复率|发货及时率|体验分/.test(names))reason='服务表现发生变化，具体咨询、订单和批次仍需核实。';
 else if(/首购|复购|粉丝|成交用户|成交人数/.test(names))reason=/占比/.test(names)?'用户结构发生变化，占比下降不等同于人数减少。':'成交人群规模发生变化，需分别核对首购、复购与来源。';
 const actions=dashboardIssueActions(finding,bundle),action=actions.map(a=>a.recommendation).filter(Boolean).join('；').replace(/。；/g,'；')||'当前已发布策略尚未配置行动建议。';
 const ids=finding.displayMetricIds?.length?finding.displayMetricIds:(finding.evidence||[]).map(m=>m.metricId||m.id);
 return {conclusion:finding.name||finding.title,evidence:ids.slice(0,2).map(id=>dashboardMetricEvidence(dashboardMetric(id,bundle))).join('；')||'关联指标待补充',reason,action,actions};
}
function dashboardRuleCopyHTML(copy,keys=['conclusion','evidence','reason','action']){const labels={conclusion:'结论',evidence:'证据',reason:'原因',action:'建议'};return keys.map(key=>`<span class="dashboard-rule-line"><strong>${labels[key]}：</strong>${esc(copy[key])}</span>`).join('');}
function dashboardEmptyCopy(bundle){const missing=bundle.rows[0];return {conclusion:missing?.title||'暂无可用诊断结果',evidence:missing?.evidence||'当前场域指标待补充',reason:'缺少生效配置或可比数据时，暂不能判断经营原因。',action:'先核对本场域配置、当前指标和前周期值，再更新诊断结果。'};}
function dashboardSummaryFinding(bundle){return bundle.findings.find(f=>/成交规模|直播成交|成交金额/.test(f.name))||bundle.findings[0];}
function dashboardSummaryCopy(bundle){
 const metrics=curatedCoreMetricIds(bundle.field,bundle.period).map(id=>dashboardMetric(id,bundle)),gmv=metrics[0],goal=curatedGoalData(bundle.field,bundle.period);
 if(!gmv||!Number.isFinite(gmv.value))return dashboardEmptyCopy(bundle);
 const direction=m=>!Number.isFinite(m.previousValue)?'暂无可比前期':m.value===m.previousValue?'持平':m.value<m.previousValue?'回落':'提升';
 const label=m=>/退款/.test(m.label)?'退款率':/转化|成交率|转换率/.test(m.label)?'转化':/曝光|观看/.test(m.label)?'流量':/订单/.test(m.label)?'订单量':/点击/.test(m.label)?'商品点击':m.label;
 const secondary=metrics.slice(1).filter(m=>Number.isFinite(m.value)&&Number.isFinite(m.previousValue)).map(m=>label(m)+(m.value===m.previousValue?'持平':m.value<m.previousValue?(m.unit==='%'?'回落':'减少'):(m.unit==='%'?'上升':'增加'))).join('、');
 const issue=dashboardSummaryFinding(bundle),detail=issue?dashboardIssueCopy(issue,bundle):null;
 return {conclusion:(goal?(goal.gap?'目标尚未达成，':'目标已达成，'):'')+`成交${direction(gmv)}${secondary?'，'+secondary:''}。`,evidence:metrics.map(dashboardMetricEvidence).join('；')+'。',reason:detail?.reason||(bundle.config?.active?'当前关联条件未出现需优先处理的变化；汇总指标仍不能排除局部问题。':'对应诊断配置未生效，暂不能判断具体经营原因。'),action:detail?.action||(bundle.config?.active?'继续按商品和来源复看成交，保留有效做法；出现变化后再核查对应经营环节。':'先核对并发布本场域配置，再更新诊断结果。'),actions:detail?.actions||[]};
}
function dashboardRuleSummary(){
 const bundle=dashboardRuleBundle(),copy=dashboardSummaryCopy(bundle);
 return `<section class="card merchant-summary" aria-labelledby="business-summary-title"><div class="merchant-summary-copy"><h3 id="business-summary-title">${icon('spark')}${periodName()}经营小结</h3><p class="dashboard-rule-copy">${dashboardRuleCopyHTML(copy)}</p></div><div class="merchant-summary-actions">${copy.actions?.length?merchantActionLinks({actions:copy.actions},'btn'):''}<button class="btn ai-entry" data-action="open-assistant">${icon('spark')} 问问智能助手 ${icon('arrow')}</button></div></section>`;
}
function dashboardRuleMetricIssue(id,field=state.fieldKey,period=state.period){
 const bundle=dashboardRuleBundle(field,period),finding=bundle.findings.find(f=>(f.evidence||[]).some(m=>(m.metricId||m.id)===id));
 if(finding){const copy=dashboardIssueCopy(finding,bundle);return {...finding.row,actions:copy.actions,hasAction:copy.actions.length>0,copy};}
 const m=dashboardMetric(id,bundle),available=Number.isFinite(m.value)&&Number.isFinite(m.previousValue),neutral=/占比|佣金|客单价/.test(m.label);
 const copy={conclusion:!Number.isFinite(m.value)?'当前指标待补充':!available?'前期数据待补充':m.value===m.previousValue?'指标与前期持平':m.label+(m.value<m.previousValue?'回落':'上升'),evidence:dashboardMetricEvidence(m),reason:available?'仅有汇总变化，具体经营原因仍需明细验证。':'当前值或可比前期缺失，暂不能判断变化原因。',action:available?(neutral?'结合人数、金额及商品结构核对变化，再决定是否调整。':'按商品和来源核查变化最大的对象，确认问题后再调整。'):'补齐当前值和同口径前期值后重新核查。'};
 return {metric:id,metricIds:[id],fieldKey:field,warning:!!finding,title:copy.conclusion,actions:[],copy};
}
function dashboardRuleGoal(bundle){
 const goal=curatedGoalData(bundle.field,bundle.period),conclusion=goal?(goal.gap?`目标尚未达成，还差${dashboardNumber(goal.gap,'元')}。`:`目标已达成，超出${dashboardNumber(goal.actual-goal.target,'元')}。`):'目标或成交数据待补充。';
 return `<section class="goal-panel" aria-labelledby="goal-title"><div class="compact-goal-heading"><h3 id="goal-title">目标诊断</h3><button class="btn ai-entry goal-ask" data-ask-goal="${bundle.field}">分析目标差距 ${icon('arrow')}</button></div><div class="compact-goal-main"><div class="goal-rate">${goal?goal.rate.toFixed(1):'—'}<span>%</span></div><span>目标完成</span></div><div class="goal-progress" role="progressbar" aria-label="${esc(fieldData(bundle.field).name)}成交金额目标完成率" aria-valuemin="0" aria-valuemax="100" ${goal?`aria-valuenow="${Math.min(100,goal.rate)}" aria-valuetext="完成${goal.rate.toFixed(1)}%"`:'aria-valuetext="数据待补充"'}><span style="width:${goal?Math.min(100,goal.rate):0}%"></span></div><p class="compact-goal-gap">${esc(conclusion)}</p>${merchantGoalFields(bundle.period)}</section>`;
}
function dashboardRuleDiagnosis(){
 const b=dashboardRuleBundle(),rows=b.findings.slice(0,2);
 return `<section class="card merchant-diagnosis compact-diagnosis" aria-labelledby="diagnosis-title"><div class="overview-head"><div class="section-title">${icon('spark')}<h2 id="diagnosis-title">经营诊断</h2></div>${pill(rows.length?'待改善':'待观察',rows.length?'purple':'outline')}</div><div class="diagnosis-body">${dashboardRuleGoal(b)}<div class="diagnosis-findings"><h3 class="findings-title">问题诊断</h3><div class="diagnosis-grid ${rows.length<2?'single-issue':''}">${rows.length?rows.map(f=>{const copy=dashboardIssueCopy(f,b);return `<article class="diagnosis-card"><div class="diagnosis-topline"><span class="diagnosis-scope">${esc(fieldData(b.field).name)}</span></div><h3>${esc(f.name)}</h3><p class="diagnosis-evidence dashboard-rule-copy">${dashboardRuleCopyHTML(copy,['evidence','reason','action'])}</p><div class="diagnosis-actions">${copy.actions.length?merchantActionLinks({...f.row,actions:copy.actions,hasAction:true},'btn'):''}<button class="text-btn ai-entry" data-diagnosis-question="${esc(merchantQuestion(b.field,b.period,f.name+'，以及下一步应该怎么做'))}" data-context-field="${b.field}">问问智能助手 ${icon('arrow')}</button></div></article>`;}).join(''):`<div class="diagnosis-clear"><p class="dashboard-rule-copy">${dashboardRuleCopyHTML(dashboardEmptyCopy(b),['evidence','reason','action'])}</p></div>`}</div></div></div></section>`;
}
function dashboardSnapshotManager(){
 dashboardSnapshotSchedule(true);
 const job=DASHBOARD_SNAPSHOTS.generation,entries=Object.keys(MERCHANT_FIELDS).flatMap(field=>['week','day'].map(period=>({field,period,key:field+':'+period})));
 const list=entries.map(({field,period,key})=>{const saved=DASHBOARD_SNAPSHOTS.snapshots[key],status=job?.states[key]||(saved?'已保存':'待生成');return `<li>${esc(fieldData(field).name)} · ${periodName(period)}：${esc(status)}${saved?' · '+esc(new Date(saved.generatedAt).toLocaleString('zh-CN')):''}</li>`;}).join('');
 modal('看板预生成结果','离线生成 · 在线读取',`<div data-dashboard-snapshot-modal><p>固定点位读取已保存的 Workflow 结果，并按结论、证据、原因、建议组织展示。打开看板不会运行 Workflow；配置或数据变化后需重新生成。</p><ul class="snapshot-status-list">${list}</ul>${job?.running?'<p>正在批量生成，请保持当前页面打开。</p>':''}<p class="form-help">未生成或快照不匹配时，按当前已发布规则呈现；不会冒充已完成的 Workflow 结果。智能助手中的新提问实时执行 Workflow。</p></div>`,`<button class="btn" data-action="close-modal">关闭</button><button class="btn" data-dashboard-snapshot-generate="missing" ${job?.running?'disabled':''}>补齐未生成结果</button><button class="btn primary" data-dashboard-snapshot-generate="all" ${job?.running?'disabled':''}>${job?.running?'生成中':'更新全部预生成结果'}</button>`);
}
async function dashboardGenerateSnapshots(onlyMissing=false){
 if(DASHBOARD_SNAPSHOTS.generation?.running)return;
 const configurations=dashboardSnapshotConfigurations(),queue=Object.keys(configurations).filter(key=>!onlyMissing||!DASHBOARD_SNAPSHOTS.snapshots[key]),job=DASHBOARD_SNAPSHOTS.generation={running:true,states:{}};
 const worker=async()=>{while(queue.length){const key=queue.shift(),[fieldKey,period]=key.split(':');job.states[key]='生成中';if(dashboardSnapshotManagerVisible())dashboardSnapshotManager();try{
  const result=await cozeRequest({operation:'generate',dashboardSnapshot:true,runtimeConfigurations:configurations,pageContext:{fieldKey,period,metricKey:''},sellerId:'DEMO_10001'});
  job.states[key]='已保存';DASHBOARD_SNAPSHOTS.snapshots[key]={origin:'workflow_snapshot',configKey:JSON.stringify(configurations[key]),generatedAt:Date.now(),result};
 }catch(error){job.states[key]='未保存：'+error.message;}if(dashboardSnapshotManagerVisible())dashboardSnapshotManager();}};
 await Promise.all([worker(),worker()]);job.running=false;DASHBOARD_SNAPSHOTS.status='ready';DASHBOARD_SNAPSHOTS.key=JSON.stringify(configurations);if(dashboardSnapshotManagerVisible())dashboardSnapshotManager();if(state.view==='merchant')render();
}
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-dashboard-snapshots'))dashboardSnapshotManager();if(button.hasAttribute('data-dashboard-snapshot-generate'))dashboardGenerateSnapshots(button.dataset.dashboardSnapshotGenerate==='missing');});
