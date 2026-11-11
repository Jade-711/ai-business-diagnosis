'use strict';
function curatedActive(){return !!aiddData?.catalog&&!!aiddData.catalogRevision;}
function curatedMetrics(fieldKey=state.fieldKey,period=state.period){return aiddRuntimeConfig(fieldKey,period)?.metrics||[];}
function curatedDashboardMetrics(field=state.fieldKey,period=state.period){return aiddRuntimeConfig(field,period,{allScenes:true})?.metrics||[];}
function curatedCoreMetricIds(field=state.fieldKey,period=state.period){
 const wanted={overview:[['trade','成交金额'],['home','商品曝光次数'],['trade','点击成交转化率(订单)']],live:[['live','成交金额'],['live','观看人数'],['live','观看-成交率(人数)']],video:[['video','成交金额'],['video','曝光人数'],['video','商品点击人数']],shelf:[['shelf','商品卡成交金额'],['shelf','商品卡曝光次数'],['shelf','点击成交率']],creator:[['creator','成交金额'],['creator','成交订单数'],['creator','成交退款率(金额)']]}[field]||[];
 const metrics=curatedMetrics(field,period);return wanted.map(([key,name])=>metrics.find(m=>m.sourceKey===key&&m.originalName===name)?.id).filter(Boolean);
}
function curatedMetric(id){return aiddData.metrics.find(m=>m.id===id);}
function curatedMetricData(id,period=state.period){return aiddData.demoData?.metrics?.[id]?.[period]||{value:null,previousValue:null,current:[],previous:[]};}
// Adapt the current published assets to the original merchant presentation.
// This only shapes UI inputs; it does not edit assets or published snapshots.
function curatedPresentationMetrics(){
 return Object.fromEntries(curatedDashboardMetrics().map(m=>[m.id,{id:m.id,label:m.originalName||m.name,unit:m.unit==='待核验'?'':m.unit,type:m.unit==='元'?'money':m.unit==='%'?'rate':m.unit==='待核验'?'number':'count',week:curatedMetricData(m.id,'week'),day:curatedMetricData(m.id,'day')}]));
}
function curatedGoalMetricId(fieldKey,period,key){
 if(key==='gmv')return curatedCoreMetricIds(fieldKey,period)[0];
 const names={overview:{orders:'成交订单数',buyers:'成交人数'},live:{clickRate:'观看-成交率(人数)',payRate:'观看-成交率(人数)',exposure:'观看人数'},video:{clickRate:'商品点击人数',plays:'曝光人数'},shelf:{payRate:'点击成交率',exposure:'商品卡曝光次数'},creator:{creators:'成交订单数',orders:'成交订单数'}};
 return curatedMetrics(fieldKey,period).find(m=>m.originalName===names[fieldKey]?.[key])?.id;
}
function curatedGoalData(fieldKey,period,actual){
 const target=MERCHANT_FIELDS[fieldKey]?.goal?.[period];
 if(actual===undefined)actual=curatedMetricData(curatedGoalMetricId(fieldKey,period,'gmv'),period).value;
 if(!Number.isFinite(actual)||actual<0||!Number.isFinite(target)||target<=0)return null;
 return {actual,target,gap:Math.max(0,target-actual),rate:100*actual/target,source:'previous_demo'};
}
function curatedGoalResult(result){
 if(result.dataMode!=='demo'||!['success','partial'].includes(result.status)||Number.isFinite(result.goal?.target)&&result.goal.target>0)return result;
 const fieldKey=result.context?.fieldKey,period=result.context?.period,id=curatedGoalMetricId(fieldKey,period,'gmv');
 const value=[...(result.metricAnalysis||[]),...(result.evidence||[])].find(m=>(m.metricId||m.id)===id&&Number.isFinite(m.value));
 if(!value)return result;
 const goal=curatedGoalData(fieldKey,period,value.value);
 return goal?{...result,goal}:result;
}
function curatedGoalDiagnosis(){
 if(typeof dashboardRuleGoal==='function')return dashboardRuleGoal(dashboardRuleBundle());
 const goal=curatedGoalData(state.fieldKey,state.period),rate=goal?.rate;
 return `<section class="goal-panel" aria-labelledby="goal-title"><div class="compact-goal-heading"><h3 id="goal-title">目标诊断</h3><button class="btn ai-entry goal-ask" data-ask-goal="${state.fieldKey}">分析目标差距 ${icon('arrow')}</button></div><div class="compact-goal-main"><div class="goal-rate">${goal?rate.toFixed(1):'—'}<span>%</span></div><span>目标完成</span></div><div class="goal-progress" role="progressbar" aria-label="${esc(fieldData().name)}成交金额目标完成率" aria-valuemin="0" aria-valuemax="100" ${goal?`aria-valuenow="${Math.min(100,+rate.toFixed(1))}" aria-valuetext="完成${rate.toFixed(1)}%"`:'aria-valuetext="数据待补充"'}><span style="width:${goal?Math.min(100,rate):0}%"></span></div><p class="compact-goal-gap">${goal?goal.gap?`距目标还差 <strong>¥${money(goal.gap)}</strong>`:'本周期目标已达成':'目标或成交数据待补充'}</p>${merchantGoalFields()}</section>`;
}
function curatedNumber(value){return Number.isFinite(value)?value.toLocaleString('zh-CN',{maximumFractionDigits:2}):'—';}
function curatedValue(metric,value){return Number.isFinite(value)?curatedNumber(value)+(metric.unit==='待核验'?'':metric.unit):'待补充';}
function curatedChange(data){return Number.isFinite(data.value)&&Number.isFinite(data.previousValue)&&data.previousValue!==0?100*(data.value/data.previousValue-1):null;}
function curatedComparison(data){const change=curatedChange(data);return change===null?'暂无可比前周期':Math.abs(change)<.005?'与前周期持平':`较前周期${change>0?'上升':'下降'} ${Math.abs(change).toFixed(1)}%`;}
function curatedInputErrors(config,context){
 const frames=config?.frameworkCandidates||[config?.frameworkDefinition].filter(Boolean);
 return [...(config?.scopeClarification||[]),...frames.flatMap(f=>typeof sceneEvidenceErrors==='function'?sceneEvidenceErrors(f,{period:context.period,sellerId:'DEMO_10001'}):[]),...(config?.metrics||[]).filter(m=>m.unit==='待核验').map(m=>(m.originalName||m.name)+'的单位尚未核验，暂不能参与判断')];
}
function curatedRuleMetricIds(strategy){
 const ids=new Set();
 const collect=rule=>{if(!rule)return;if(rule.children){rule.children.forEach(collect);return;}if(rule.metricId)ids.add(rule.metricId);if(rule.rightType==='metric'&&rule.rightMetricId)ids.add(rule.rightMetricId);};
 collect(strategy.rule);for(const id of strategy.diagnosticMetricIds||[])ids.add(id);return ids.size?[...ids]:strategy.metricIds||[];
}
function curatedDiagnosticRows(fieldKey,period,config){
 if(!config?.active)return [{metric:'',metricIds:[],fieldKey,warning:false,title:'当前场景诊断未生效',evidence:config?.inactiveReason||'请先发布对应场景的框架和策略。',hasAction:false}];
 const inputs=curatedInputErrors(config,{fieldKey,period});if(inputs.length)return [{metric:'',metricIds:[],fieldKey,warning:false,title:'本场景资料待补充，暂无法判断',evidence:inputs.join('；'),hasAction:false}];
 const rows=[];let missing=false;
 const ordered=(config.strategies||[]).slice().sort((a,b)=>(aiddData.groups.find(g=>g.id===a.groupId)?.priority||0)-(aiddData.groups.find(g=>g.id===b.groupId)?.priority||0)||a.priority-b.priority);
 for(const s of ordered){
  if(s.status!=='生效中'||s.enabled===false)continue;
  if(s.execution==='模型理解'||s.decisionLevel==='evidence_required'){missing=true;continue;}
  if(s.businessFrameworkVersion===2&&curatedRuleMetricIds(s).filter(id=>s.metricIds.includes(id)).some(id=>{const d=curatedMetricData(id,period);return !Number.isFinite(d.previousValue)||d.previousValue<=0||curatedMetric(id)?.unit==='待核验';})){missing=true;continue;}
  const hit=aiddEvaluateRule(s.rule,config.metrics,period);if(hit===null){missing=true;continue;}if(!hit)continue;
  const assets=curatedRuleMetricIds(s).map(id=>config.metrics.find(m=>m.id===id)).filter(Boolean);
  const evidence=assets.slice(0,2).map(m=>{const d=curatedMetricData(m.id,period);return `${m.originalName||m.name} ${curatedValue(m,d.value)}，前期 ${curatedValue(m,d.previousValue)}`;}).join('；');
  const actions=s.actionIds.map(id=>config.actions.find(a=>a.id===id)).filter(Boolean).map(a=>({...clone(a),toolName:a.name,recommendation:s.actionSubtitles?.[a.id]||a.description}));
  rows.push({id:s.id,sceneId:s.sceneId,frameworkId:s.frameworkId,diagnosticKind:s.diagnosticKind,displayMetricIds:s.displayMetricIds,metric:assets[0]?.id||'',metricIds:assets.map(m=>m.id),fieldKey,warning:true,title:s.name.replace(/（近7天）|（昨日）/g,''),evidence,advice:s.businessMeaning,actions,hasAction:actions.length>0});
 }
 if(!rows.length)rows.push({metric:'',metricIds:[],fieldKey,warning:false,title:missing?'部分指标待补充，暂无法判断':'未命中当前已发布的变化条件',evidence:missing?'所需指标或前周期值缺失，不以旧演示值补齐。':'仅表示当前已发布条件未命中，不能据此保证经营没有其他问题。',hasAction:false});
 const suppressed=new Set(rows.flatMap(r=>config.strategies.find(s=>s.id===r.id)?.suppressesStrategyIds||[]));return rows.filter(r=>!suppressed.has(r.id));
}
function curatedLocalSnapshot(context,runtime=aiddRuntimeConfig(context.fieldKey,context.period)){
 const metrics=(runtime?.metrics||[]).map(m=>{const d=curatedMetricData(m.id,context.period),verified=m.unit!=='待核验';return {id:m.id,label:m.originalName||m.name,metricKey:m.id,derived:'value',value:verified?d.value:null,previousValue:verified?d.previousValue:null,currentValues:verified?d.current:[],unit:m.unit,sourceLabel:m.name};});
 return {data:{mode:'demo',synthetic:true,label:'本批指标的合成演示数据，非快手店铺实绩',fieldKey:context.fieldKey,period:context.period,metrics,goal:null,fieldBreakdown:[],missing:['真实取数未接入；数值仅用于验证新框架、策略和页面联动。','达人合作可能与直播、短视频及商品卡重叠，不将四个场域金额直接相加。']},config:runtime||{active:false,metrics:[],actions:[],strategies:[]}};
}
function curatedMetricIssue(id,field=state.fieldKey,period=state.period){
 const config=aiddRuntimeConfig(field,period),rows=curatedDiagnosticRows(field,period,config),hit=rows.find(r=>r.warning&&r.metricIds.includes(id));
 if(hit)return hit;
 const metric=curatedMetric(id),data=curatedMetricData(id,period);
 return {metric:id,metricIds:[id],fieldKey:field,warning:false,title:config?.active?'未命中已发布的关联条件':'关联诊断未生效',evidence:`${metric?.originalName||'指标'} ${curatedValue(metric||{},data.value)}；${curatedComparison(data)}`,advice:'指标变化不直接代表原因，需要结合对应经营环节和明细验证。',actions:[],hasAction:false};
}
function curatedTrend(){return merchantTrend();}
function curatedMetricCards(dashboard=false){return merchantMetricCards(dashboard);}
function curatedSummary(){
 if(typeof dashboardRuleSummary==='function')return dashboardRuleSummary();
 const runtime=aiddRuntimeConfig(state.fieldKey,state.period),rows=curatedDiagnosticRows(state.fieldKey,state.period,runtime),hit=rows.find(r=>r.warning),m=curatedMetric(curatedCoreMetricIds()[0]),d=curatedMetricData(m?.id);
 return `<section class="card merchant-summary" aria-labelledby="business-summary-title"><div class="merchant-summary-copy"><h3 id="business-summary-title">${icon('spark')}${periodName()}经营小结</h3><p>${esc(m?.originalName||'成交')} <strong>${esc(curatedValue(m||{},d.value))}</strong>，${esc(curatedComparison(d))}。${esc(hit?`优先核查${hit.title}。`:rows[0]?.title||'诊断资料待补充。')}</p></div><div class="merchant-summary-actions">${hit?merchantActionLinks({...hit,actions:hit.actions.slice(0,1)},'btn'):''}<button class="btn ai-entry" data-action="open-assistant">${icon('spark')} 问问智能助手 ${icon('arrow')}</button></div></section>`;
}
function curatedDiagnosis(){return merchantDiagnosis();}
function curatedMerchantView(){return merchantView();}
function curatedSelectMetric(id){return selectMetric(id);}
function curatedOpenTool(name){
 const a=typeof aiddPublishedToolAsset==='function'?aiddPublishedToolAsset(name):aiddData.actions.find(a=>a.name===name);if(!a)return;
 modal(esc(a.name),'经营工具',`<p>${esc(a.description)}</p><dl class="frame-filled"><div><dt>适用条件</dt><dd>${esc(a.conditions)}</dd></div><div><dt>工作台位置</dt><dd>${esc(a.category)}</dd></div></dl><p class="form-help">仅提供工具说明，未绑定跳转链接，也不会自动执行操作。</p>`,`<button class="btn primary" data-action="close-modal">知道了</button>`);
}
function curatedShowMetricInsight(id){
 const m=curatedMetric(id);if(!m)return;
 openChat('指标诊断',merchantQuestion(state.fieldKey,state.period,m.originalName+'变化的原因和改善建议'),{fieldKey:state.fieldKey,period:state.period,metricKey:id});
}
function curatedResolveContext(question,context){
 const next={...context};if(/全店|整店/.test(question))next.fieldKey='overview';else for(const key of FIELD_KEYS)if(question.includes(fieldData(key).name)){next.fieldKey=key;break;}
 if(/昨天|昨日/.test(question))next.period='day';else if(/近7天|近七天/.test(question))next.period='week';
 const m=curatedMetrics(next.fieldKey,next.period).filter(m=>question.includes(m.originalName)).sort((a,b)=>b.originalName.length-a.originalName.length)[0];
 if(m)next.metricKey=m.id;else if(next.fieldKey!==context.fieldKey)delete next.metricKey;
 return next;
}
function curatedDemoResult(question,context,config){
 const selected=aiddRuntimeConfig(context.fieldKey,context.period,{question}),provided=config?.fieldConfigs?.[context.fieldKey],ids=selected?.frameworkCandidates?.map(f=>f.sceneId)||[];
 const runtime=provided&&ids.length&&ids.every(id=>provided.frameworkCandidates?.some(f=>f.sceneId===id))?provided:selected||provided;
 const snap=curatedLocalSnapshot(context,runtime),rows=curatedDiagnosticRows(context.fieldKey,context.period,runtime),metrics=snap.data.metrics.map(m=>({...m,metricId:m.id})),errors=curatedInputErrors(runtime,context);
 return {schemaVersion:1,catalogRevision:aiddData.catalogRevision,branch:'diagnosis',status:runtime?.active&&!errors.length?'success':'missing_data',context,dataMode:'demo',synthetic:true,metricAnalysis:metrics,evidence:metrics,goal:null,fieldBreakdown:[],diagnosis:rows.filter(r=>r.warning).map(r=>({strategyId:r.id,name:r.title,diagnosticKind:r.diagnosticKind,displayMetricIds:r.displayMetricIds,triggered:true,explanation:r.advice,evidence:metrics.filter(m=>r.metricIds.includes(m.id)),actionIds:(r.actions||[]).map(a=>a.id)})),actions:runtime?.actions||[],missing:[...snap.data.missing,...errors],answer:rows[0]?.title||'当前无可用的生效诊断配置'};
}
function curatedScopeInfo(result,question=''){
 const c=result.context||{},field=fieldData(c.fieldKey||state.fieldKey).name,period=c.period||state.period,ranges=aiddData.demoData?.ranges||{},comparisons=aiddData.demoData?.comparisons||{};
 return {text:`本次${result.branch==='data'?'查询':'分析'}：${field} · ${period==='day'?'昨日':'近7天'}（${ranges[period]||''}）；对比${comparisons[period]||'同口径前期'}。`,inherited:/全店|直播|短视频|货架|达人|昨天|昨日|近7天/.test(question)?'':'沿用当前页面或会话的场域与周期。',scene:field,period:period==='day'?'昨日':'近7天'};
}
function curatedPublicText(value){
 const assets=[...aiddData.metrics,...aiddData.actions,...aiddData.scenes,...aiddData.frameworks,...aiddData.strategies],names=new Map(assets.map(a=>[a.id,a.originalName||a.name]));
 return String(value||'').replace(/research-(?:metric|action|scene|framework|strategy)-[\w-]+/g,id=>names.get(id)||'待核验资产').replace(/演示阈值/g,'已发布比较条件');
}
function curatedResultHTML(result,question=''){return merchantBriefHTML(result,question,true);}
function curatedResultVerdict(result,findings,goal,hasEvidence,focus){
 if(goal)return '当前未录入同周期经营目标金额，暂不能计算达成率或差额。';
 if(['missing_data','not_applicable','invalid_input','error','failed'].includes(result.status)||!hasEvidence)return '缺少本次场景可用的配置或指标，暂无法判断。';
 if(!findings.length&&focus){
  const row=[...(result.metricAnalysis||[]),...(result.evidence||[])].find(e=>(e.metricId||e.id)===focus.id&&Number.isFinite(e.value));
  if(row)return `${focus.originalName||focus.name} ${curatedValue(focus,row.value)}${Number.isFinite(row.previousValue)?`，前期 ${curatedValue(focus,row.previousValue)}，${curatedComparison(row)}`:''}；未命中该指标当前已发布的关联条件，具体原因仍需经营明细核实。`;
 }
 return findings.length?`当前已发布条件命中 ${findings.length} 项变化线索，需进一步核查。`:'未命中当前已发布的关联条件；不代表经营不存在其他问题。';
}
function curatedBuildBrief(result,question='',options={}){
 const scope=curatedScopeInfo(result,question),context=curatedResolveContext(question,result.context||{fieldKey:state.fieldKey,period:state.period}),focus=curatedMetric(context.metricKey),findings=(result.diagnosis||[]).filter(r=>r.triggered!==false&&(!focus||(r.evidence||[]).some(e=>(e.metricId||e.id)===focus.id))),goal=/目标|差距|补差/.test(question);
 const allIssues=findings.map(r=>{
  const strategy=aiddData.strategies.find(s=>s.id===r.strategyId||s.name===r.name);
  const returned=[...(result.evidence||[]),...(result.metricAnalysis||[])],support=(strategy?.diagnosticMetricIds||[]).map(id=>returned.find(m=>(m.metricId||m.id)===id)).filter(Boolean);
  r={...r,diagnosticKind:r.diagnosticKind||strategy?.diagnosticKind,displayMetricIds:r.displayMetricIds||strategy?.displayMetricIds,evidence:[...new Map([...(r.evidence||[]),...support].map(m=>[m.metricId||m.id,m])).values()]};
  const analysis=merchantEvidenceAnalysis(r,result,aiddData.metrics);
  const modelNote=!['published_strategy','evidence_analysis'].includes(result.explanationSource)&&r.explanation&&r.explanation!==strategy?.businessMeaning?`补充解释（待明细核实）：${curatedPublicText(r.explanation)}`:'';
  return {id:merchantIssueId(r),title:r.name||r.title,reason:analysis.reason+modelNote,modelNote,uncertainty:(result.dataMode==='demo'?'以上为合成演示数据中的数值分析。':'')+analysis.limitation,analysis,actionSummary:analysis.checks,metrics:(r.evidence||[]).filter(e=>!r.displayMetricIds?.length||r.displayMetricIds.includes(e.metricId||e.id)).map(e=>{
   const id=e.metricId||e.id,m=curatedMetric(id)||e,display={label:m.originalName||e.label,unit:m.unit,type:m.unit==='元'?'money':m.unit==='%'?'rate':'count'},returned=(result.metricAnalysis||[]).find(v=>(v.metricId||v.id)===id),previous=Number.isFinite(e.previousValue)?e.previousValue:returned?.previousValue,change=Number.isFinite(e.value)&&Number.isFinite(previous)&&previous!==0?100*(e.value/previous-1):null;
   const points=m.unit==='%'&&Number.isFinite(previous)&&Number.isFinite(e.value)?` · ${e.value>=previous?'上升':'下降'}${Math.abs(e.value-previous).toLocaleString('zh-CN',{maximumFractionDigits:2})}个百分点`:'';
   const badUp=/退款率|退单率|介入率/.test(display.label),tone=change===null?'':(badUp?change>0:change<0)?'down':'up';
   return {label:display.label,value:Number.isFinite(e.value)?formattedMetric(display,e.value):'未提供',change,tone,comparison:Number.isFinite(previous)?`前期 ${formattedMetric(display,previous)}${points}${change===null?'':` · ${Math.abs(change)<.05?'环比持平':`相对${change<0?'下降':'上升'} ${Math.abs(change).toFixed(1)}%`}`}`:''};
  }),actions:(r.actionIds||[]).map(id=>result.actions?.find(a=>a.id===id)).filter(Boolean).map(a=>({kind:'tool',label:a.name,title:a.name,detail:[a.description,strategy?.diagnosticKind==='live_revenue'?strategy.actionSubtitles?.[a.id]:'',analysis.checks,'调整后复看上述同口径指标；投放工具先核验渠道和预算，不因汇总量下降直接加大推广。'].filter(Boolean).join('\n')}))};
 });
 const ranked=merchantRankIssues(findings,result,aiddData.metrics),queue=merchantIssueQueue(ranked,options.progress),byId=new Map(allIssues.map(i=>[i.id,i]));
 const issues=queue.active.map((entry,index)=>{const issue=byId.get(entry.id),writing=merchantIssueWriting(issue.analysis,issue.metrics);return {...issue,...writing,priorityReason:entry.reason,rank:queue.batchIndex*3+index+1,handled:entry.handled};});
 const fallback=curatedResultVerdict(result,findings,goal,[...(result.metricAnalysis||[]),...(result.evidence||[])].some(e=>curatedMetric(e.metricId||e.id)),focus);
 const verdict=issues.length?queue.complete?'本次问题均已标记处理，经营效果待同口径数据复核。':`本次先处理优先级最高的 ${issues.length} 项问题。`:fallback;
 const coverage=result.coverage,goalText=coverage?.frameworks?.length?`已检查 ${coverage.frameworks.length} 个已发布诊断方向、${coverage.evaluatedStrategyCount} 条策略。`:'';
 const progressText=issues.length?`本批已处理 ${issues.filter(i=>i.handled).length}/${issues.length} 项${queue.remaining?`；后续 ${queue.remaining} 项待本批处理后展示`:'，处理后需用数据复核'}。`:'';
 const handledText=queue.handledIds.length?'商家已标记处理（待数据复核）：'+queue.handledIds.map(id=>byId.get(id)?.title).filter(Boolean).join('、'):'';
 return {scope,issues,ranked,queue,verdict,demo:result.dataMode==='demo',tone:findings.length?'attention':'watch',goalText,text:[scope.text,verdict,progressText,handledText,...issues.map((i,index)=>`问题${index+1}：${i.title}${i.handled?'（商家已标记处理，待数据复核）':''}\n优先依据：${i.priorityReason}\n关联指标：${i.metrics.map(m=>m.label+' '+m.value).join('；')}\n原因判断：\n${i.reasonItems.map((x,n)=>(n+1)+'. '+x.label+'：'+x.text).join('\n')}\n行动建议：\n${i.actionItems.map((x,n)=>String.fromCharCode(97+n)+'. '+x.label+'：'+x.text).join('\n')}\n关联工具：${i.actions.map(a=>a.label).join('、')}`)].filter(Boolean).join('\n\n')};
}
function curatedMerchantAnswer(branch,q,context){
 if(branch==='fixed')return '<h3>你好，我是智能助手。</h3><p>我可以依据当前已发布场景、指标和工具，帮助你查看经营变化。当前数值为合成演示数据，真实取数尚未接入。</p>';
 const resolved=curatedResolveContext(q,context),result=curatedDemoResult(q,resolved,aiddRequestConfig(resolved));
 if(branch==='data'){
  const target=curatedResolveContext(q,resolved).metricKey,items=result.metricAnalysis.filter(m=>!target||m.id===target);
  return `<h3>${esc(fieldData(resolved.fieldKey).name)} · ${periodName(resolved.period)}指标</h3><p>合成演示数据，非真实店铺实绩。</p><div class="result-metrics">${items.map(m=>`<div class="result-metric"><span>${esc(m.label)}</span><b>${esc(curatedValue(m,m.value))}</b><small>前期 ${esc(curatedValue(m,m.previousValue))}</small></div>`).join('')}</div>`;
 }
 if(branch==='knowledge'){const action=aiddData.actions.find(a=>q.includes(a.name));return action?`<h3>${esc(action.name)}</h3><p>${esc(action.description)}</p><p>${esc(action.conditions)}</p>`:'<h3>需要进一步经营依据</h3><p>已整理场景、指标和经营工具；具体政策、同行基准、商品内容及真实经营原因还需要相应资料。</p>';}
 return curatedResultHTML(result,q);
}
document.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b||!curatedActive())return;
 if(b.dataset.curatedInsight)curatedShowMetricInsight(b.dataset.curatedInsight);
 if(b.dataset.curatedFollow){const id=b.dataset.curatedFollow,m=curatedMetric(id);closeModal();openChat('指标诊断',`帮我分析${periodName()}${fieldData().name}的${m.originalName}变化及关联行动点`,{fieldKey:state.fieldKey,period:state.period,metricKey:id});}
});
