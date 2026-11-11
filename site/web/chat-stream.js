'use strict';

const CHAT_RECORD_FIELDS=['recordVersion','context','branch','metrics','findings','errors','engine','mode','modelInvoked','workflowInvoked','serverDurationMs','durationMs','failed','demo','dataDeclared','frameworks','selectedStrategyCount','evaluatedStrategyCount','returnedProblemCount','formulas','goalCheck','goalNarrative','legacyTimingRemoved','workflowNodes','modelEvidenceSource','explanationOrigin','modelUsage','cozeUsage','executionStages'];
function chatStreamState(context={},question=''){return {recordVersion:2,context,question,branch:'pending',stage:'正在准备请求',startedAt:Date.now(),metrics:[],findings:[],text:'',kind:'diagnosis',errors:[]};}
function chatDuration(ms){return ms<1000?(ms/1000).toFixed(2)+'秒':(ms/1000).toFixed(1)+'秒';}
function chatExecutionStages(value){
 const count=n=>Number.isSafeInteger(n)&&n>=0;
 return (Array.isArray(value)?value:[]).filter(s=>s&&['published_workflow_path','coze_trace','model_usage'].includes(s.source)&&s.status==='complete'&&typeof s.name==='string').slice(0,16).map(s=>({id:String(s.id||'').slice(0,60),name:s.name.slice(0,120),status:'complete',source:s.source,nodeNames:(s.nodeNames||[]).filter(x=>typeof x==='string').slice(0,5).map(x=>x.slice(0,100)),detail:String(s.detail||'').slice(0,300),...Object.fromEntries(['cozeTokens','deepseekTokens','callCount'].filter(k=>count(s[k])).map(k=>[k,s[k]])),...(s.parallel===true?{parallel:true}:{}),...(s.source==='coze_trace'&&count(s.durationMs)?{durationMs:s.durationMs}:{})}));
}
function chatEvidenceRecord(result,existing={}){
 const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0,r=result||{},performance=r.performance||{};
 const modes={published_rules:'规则与数值计算',goal_calculation:'目标数值核算',published_data:'指标查询',scope_validation:'输入范围校验',coze_workflow:'工作流服务返回',browser_demo:'浏览器内规则演示',fixed_reply:'固定欢迎语'};
 const mode=Object.hasOwn(modes,performance.route)?performance.route:Object.hasOwn(modes,existing.mode)?existing.mode:Object.hasOwn(modes,existing.routeHint)?existing.routeHint:'';
 const local=mode==='browser_demo',rule=['published_rules','goal_calculation','published_data','scope_validation','browser_demo','fixed_reply'].includes(mode);
 const metrics=[...new Map((result?[...(r.evidence||[]),...(r.metricAnalysis||[])]:existing.metrics||[]).map(m=>[m.metricId||m.id||m.label,{metricId:m.metricId||m.id,label:m.label||m.name||'经营指标',value:m.value,previousValue:m.previousValue,unit:m.unit||''}])).values()].slice(0,64);
 const frameworks=result?(r.coverage?.frameworks||r.execution?.frameworks||(r.execution?.frameworkName?[{name:r.execution.frameworkName,version:r.execution.frameworkVersion}]:[])):existing.frameworks||[];
 const out={recordVersion:2,context:r.context||existing.context||{},branch:r.branch||existing.branch,metrics,findings:result?(r.diagnosis||[]).filter(d=>d.triggered!==false).slice(0,3):existing.findings||[],errors:result?(r.missing||[]):existing.errors||[],engine:modes[mode]||'未记录处理方式',mode,modelInvoked:rule?false:mode==='coze_workflow'&&performance.modelInvoked===false&&performance.modelEvidenceSource==='server_model_usage'?false:mode==='coze_workflow'&&performance.modelInvoked===true&&['coze_node_response','workflow_model_output','server_model_usage'].includes(performance.modelEvidenceSource)?true:existing.recordVersion===2&&typeof existing.modelInvoked==='boolean'?existing.modelInvoked:null,workflowInvoked:mode==='coze_workflow'?true:rule?false:null,failed:existing.failed===true,demo:r.synthetic===true||r.dataMode==='demo'||local||existing.demo===true,dataDeclared:!!r.dataMode||r.synthetic===true||local||existing.dataDeclared===true,frameworks:frameworks.map(f=>({id:f.id,name:f.name,version:f.version})),formulas:result?[...new Set((r.diagnosis||[]).flatMap(d=>d.analysis?.calculations||[]).map(c=>c.formula).filter(v=>typeof v==='string'&&v))]:existing.formulas||[]};
 out.executionStages=chatExecutionStages(result?r.workflowExecution?.stages||existing.executionStages:existing.executionStages);
 const routingNames={diagnosis:'任务分流：经营诊断',data:'任务分流：智能取数',knowledge:'任务分流：知识问答',clarification:'任务分流：补充信息'};
 for(const stage of out.executionStages){
  if(stage.source!=='published_workflow_path')continue;
  if(stage.id==='routing'&&stage.name==='经营分析场景路由'&&routingNames[out.branch])stage.name=routingNames[out.branch];
  if(stage.id==='intent'&&stage.name==='意图识别与分析范围确认'&&['data','knowledge'].includes(out.branch))stage.name=out.branch==='data'?'意图识别与查询范围确认':'意图识别';
 }
 out.workflowNodes=result?(r.workflowExecution?.nodes||[]).filter(n=>n.complete&&typeof n.name==='string').map(n=>n.name):existing.workflowNodes||[];
 const usage=r.modelUsage||existing.modelUsage;
 if(usage?.provider==='DeepSeek'&&usage.accounting==='provider_usage')out.modelUsage={provider:'DeepSeek',model:String(usage.model||''),accounting:'provider_usage',complete:usage.complete!==false,...Object.fromEntries(['callCount','inputTokens','outputTokens','reasoningTokens','cachedInputTokens','totalTokens'].filter(k=>finite(usage[k])).map(k=>[k,usage[k]])),calls:(usage.calls||[]).slice(0,5).map(c=>({stage:String(c.stage||''),nodeName:String(c.nodeName||''),callIndex:c.callIndex,available:c.available!==false,...(['none','low','high'].includes(c.reasoningEffort)?{reasoningEffort:c.reasoningEffort}:{}),...Object.fromEntries(['inputTokens','outputTokens','reasoningTokens','cachedInputTokens','totalTokens','durationMs'].filter(k=>finite(c[k])).map(k=>[k,c[k]]))}))};
 const coze=r.cozeUsage||existing.cozeUsage;
 if(coze?.accounting==='coze_api_reported')out.cozeUsage={accounting:'coze_api_reported',...Object.fromEntries(['totalTokens','inputTokens','outputTokens'].filter(k=>Number.isSafeInteger(coze[k])&&coze[k]>=0).map(k=>[k,coze[k]])),...(typeof coze.reportedCost==='string'&&/^\d+(?:\.\d+)?$/.test(coze.reportedCost)?{reportedCost:coze.reportedCost.slice(0,32)}:{}),costUnit:'not_supplied',...(coze.trace==='enabled'?{trace:'enabled'}:{})};
 out.explanationOrigin=r.workflow?.explanationOrigin||existing.explanationOrigin||'';
 out.modelEvidenceSource=performance.modelEvidenceSource||existing.modelEvidenceSource||'unavailable';
 if(typeof r.goalDiagnosis?.judgment==='string')out.goalNarrative=r.goalDiagnosis.judgment;else if(typeof existing.goalNarrative==='string')out.goalNarrative=existing.goalNarrative;
 if(finite(existing.durationMs)&&!(local&&existing.recordVersion!==2))out.durationMs=existing.durationMs;
 if(local&&existing.recordVersion!==2&&finite(existing.durationMs))out.legacyTimingRemoved=true;
 if(finite(performance.serverMs))out.serverDurationMs=performance.serverMs;else if(existing.recordVersion===2&&finite(existing.serverDurationMs))out.serverDurationMs=existing.serverDurationMs;
 const selected=r.coverage?.selectedStrategyCount??(Array.isArray(r.execution?.selectedStrategyIds)?r.execution.selectedStrategyIds.length:undefined);
 const evaluated=r.coverage?.evaluatedStrategyCount;
 if(finite(selected))out.selectedStrategyCount=selected;else if(!result&&finite(existing.selectedStrategyCount))out.selectedStrategyCount=existing.selectedStrategyCount;
 if(finite(evaluated))out.evaluatedStrategyCount=evaluated;else if(!result&&finite(existing.evaluatedStrategyCount))out.evaluatedStrategyCount=existing.evaluatedStrategyCount;
 if(result&&Array.isArray(r.diagnosis))out.returnedProblemCount=r.diagnosis.filter(d=>d.triggered!==false).length;else if(finite(existing.returnedProblemCount))out.returnedProblemCount=existing.returnedProblemCount;
 if(existing.legacyTimingRemoved===true)out.legacyTimingRemoved=true;
 const goal=existing.goalCheck;
 if(goal&&['actual','target','gap','rate'].every(k=>finite(goal[k]))&&goal.target>0)out.goalCheck={actual:goal.actual,target:goal.target,gap:goal.gap,rate:goal.rate};
 return out;
}
function chatStreamComplete(view,result,{failed=false}={}){
 const durationMs=Math.max(0,Date.now()-(view.startedAt||Date.now())),record=chatEvidenceRecord(result,{...view,durationMs,failed});
 Object.assign(view,record);delete view.timeline;delete view.steps;delete view.plans;
 if(result?.branch==='diagnosis'&&typeof merchantRankIssues==='function')view.findings=merchantRankIssues(result.diagnosis||[],result,typeof aiddData!=='undefined'?aiddData.metrics:[]).slice(0,3).map(x=>x.finding);
 if(result&&typeof isGoalQuestion==='function'&&isGoalQuestion(view.question)&&typeof buildMerchantGoalBrief==='function'){
  const goal=buildMerchantGoalBrief(result,view.question);
  if(goal.valid)view.goalCheck={actual:goal.actual,target:goal.target,gap:goal.gap,rate:goal.rate};
 }
 return view;
}
function chatAnalysisSnapshot(view){const snapshot={};for(const key of CHAT_RECORD_FIELDS)if(view[key]!==undefined)snapshot[key]=view[key];return JSON.parse(JSON.stringify(snapshot));}
function chatStreamUpdate(view,event,data){
 if(event==='progress')view.stage=data.step==='workflow_response_received'||data.step==='submitted'?'已收到工作流接口响应，等待完整结果':'正在提交请求';
 if(event==='delta'){
  const goalMode=typeof isGoalQuestion==='function'&&isGoalQuestion(view.question);
  if(!(goalMode&&data.kind==='diagnosis')){view.kind=data.kind==='knowledge'?'knowledge':'diagnosis';view.text=(view.text+String(data.text||'')).slice(0,24000);}
  view.stage='正在接收回复内容';
 }
 if(event==='update'){
  if(data.kind==='execution'){view.mode='coze_workflow';view.workflowInvoked=true;view.executionStages=chatExecutionStages(data.stages);view.stage='前置节点已返回，等待后续结果';return view;}
  view.stage='已收到部分返回信息，等待完整结果';
  if(data.kind==='context'){view.context={...view.context,...data.context};view.branch=data.branch;}
  if(data.kind==='evidence'){view.metrics=(data.metrics||[]).slice(0,64);view.errors=data.errors||[];}
  if(data.kind==='plan')view.errors=data.errors||[];
  if(data.kind==='findings'){view.findings=(data.findings||[]).slice(0,3);view.errors=data.errors||[];}
 }
 return view;
}
function chatRunSummaryHTML(view,record,complete){
 const count=n=>Number.isSafeInteger(n)&&n>=0?n.toLocaleString('zh-CN'):complete?'未提供':'待回执';
 const local=['published_rules','goal_calculation','published_data','scope_validation','browser_demo','fixed_reply'].includes(record.mode);
 const coze=record.cozeUsage?.totalTokens??(local?0:undefined),deepseek=record.modelUsage?.complete===true?record.modelUsage.totalTokens:local?0:undefined;
 const total=Number.isSafeInteger(coze)&&Number.isSafeInteger(deepseek)?coze+deepseek:undefined;
 const time=complete?(Number.isFinite(record.durationMs)?chatDuration(record.durationMs):'未记录'):`<span class="stream-elapsed">${chatDuration(Math.max(0,Date.now()-(view.startedAt||Date.now())))}</span>`;
 return `<span class="workflow-run-summary" data-usage-account="totals"><span><small>${record.mode==='browser_demo'?'本地处理耗时':'总耗时'}</small><strong>${time}</strong></span><span><small>总 Token</small><strong>${count(total)}</strong></span><span><small>Coze Token</small><strong>${count(coze)}</strong></span><span><small>DeepSeek Token</small><strong>${count(deepseek)}</strong></span></span>`;
}
function chatWorkflowStagesHTML(stages=[]){
 if(!stages.length)return '';
 const count=n=>Number.isSafeInteger(n)&&n>=0?n.toLocaleString('zh-CN'):'未提供';
 const rows=stages.map((stage,i)=>`<tr><td><strong>${i+1}. ${esc(stage.name)}</strong>${stage.parallel?`<small>并行 ${count(stage.callCount)} 次调用</small>`:''}<small>${esc(stage.detail)}</small><small class="workflow-node-names">${stage.nodeNames.map(esc).join(' → ')}</small></td><td>${Number.isFinite(stage.durationMs)?chatDuration(stage.durationMs):'未提供'}</td><td>${count(stage.cozeTokens)}</td><td>${count(stage.deepseekTokens)}</td></tr>`).join('');
 return `<div class="workflow-stage-list" data-usage-account="stages"><strong>本次执行路径</strong><div class="analysis-table-wrap"><table><thead><tr><th>阶段</th><th>耗时</th><th>Coze Token</th><th>DeepSeek Token</th></tr></thead><tbody>${rows}</tbody></table></div><p class="analysis-source">路径依据已发布工作流、本次返回分支与模型回执整理；当前未取得逐节点 Trace 计时。并行调用的 Token 按实际回执汇总，阶段耗时不相加作为总耗时。</p></div>`;
}
function chatStreamStepsHTML(view,complete=false){
 const r=chatEvidenceRecord(null,view),summary=chatRunSummaryHTML(view,r,complete);
 const title=complete?(r.failed?'查看未完成请求记录':'查看本次执行过程'):esc(view.stage||'等待结果');
 const heading=`<summary><span class="analysis-heading"><span class="stream-state-dot${complete?' complete':''}"></span>${title}</span>${summary}</summary>`;
 const stages=chatWorkflowStagesHTML(r.executionStages);
 const metricNote=r.metrics.length?`<p class="analysis-source">本次返回的指标：${r.metrics.length} 项。用于本次范围与规则判断，具体指标和数值见正式回答。</p>`:'';
 if(!complete)return `<details class="chat-analysis workflow-progress" open>${heading}${stages}${view.metrics?.length?'<p class="analysis-source">已收到诊断所需的部分指标，完整诊断尚未返回；具体数值将在正式回答中展示。</p>':'<p class="analysis-source">正在等待工作流返回本轮资料和诊断结果。</p>'}</details>`;
 const model=r.modelInvoked===false?'本次未调用大模型':r.modelInvoked===true?'已收到工作流模型节点返回记录':'本次未提供可核验的模型调用记录';
 const data=r.demo?'合成演示数据，真实店铺取数尚未接入':r.dataDeclared?'本次返回未标注为演示数据；真实性仍需来源证明':'本次未提供数据来源信息';
 const template=['published_rules','goal_calculation','published_data','browser_demo'].includes(r.mode)?'<p class="analysis-source">规则、核查说明与行动文案使用预设配置或表达模板；命中与数值按本次数据计算。</p>':'';
 const billing=chatCozeUsageHTML(r.cozeUsage,r.workflowInvoked)+chatModelUsageHTML(r.modelUsage);
 const counts=[Number.isFinite(r.selectedStrategyCount)?`选用策略 ${r.selectedStrategyCount} 条`:'',Number.isFinite(r.evaluatedStrategyCount)?`规则检查 ${r.evaluatedStrategyCount} 条`:'',Number.isFinite(r.returnedProblemCount)?`返回诊断问题 ${r.returnedProblemCount} 项`:''].filter(Boolean).join('；');
 const frameworks=r.frameworks.length?`<p class="analysis-source">返回的框架：${r.frameworks.map(f=>esc(f.name||f.id||'未命名框架')+(Number.isFinite(f.version)?' v'+f.version:'')).join('；')}。</p>`:'';
 const timing=Number.isFinite(r.durationMs)?`<p class="analysis-source">${r.mode==='browser_demo'?'由浏览器记录本次数值计算与结果生成的总耗时；没有网络或模型调用，也未记录逐步执行耗时。':'总耗时由浏览器记录，包含请求准备、网络等待和结果接收；未记录逐步执行耗时。'}</p>`:'';
 const server=Number.isFinite(r.serverDurationMs)?`<p class="analysis-source">服务端报告处理用时：${r.serverDurationMs.toLocaleString('zh-CN',{maximumFractionDigits:3})}毫秒${r.serverDurationMs===0?'（受计时精度限制）':''}；不含浏览器与网络等待。</p>`:'';
 const boundary=r.mode==='coze_workflow'?(r.explanationOrigin==='evidence_gate'?'<p class="analysis-source">本次由证据校验返回判断边界；未确认具体经营原因，未推荐经营工具。</p>':r.explanationOrigin==='quality_gate'?'<p class="analysis-source">模型说明未通过完整证据核验，已拦截未核实的结论与工具建议。</p>':''):'';
 const unknown=!stages&&r.workflowNodes?.length?`<p class="analysis-source">收到返回的节点：${r.workflowNodes.map(esc).join('；')}。</p>`:'';
 return `<details class="chat-analysis workflow-progress" data-analysis-complete>${heading}${r.failed?'<p class="analysis-source">本次请求未完成，以下仅保留已收到的信息。</p>':''}${stages}<p class="analysis-source">处理方式：${esc(r.engine)}；${model}。</p>${r.mode==='coze_workflow'&&r.modelInvoked!==true?'<p class="analysis-source">已收到工作流服务返回；本轮没有可核验的模型节点返回记录。</p>':''}${boundary}${metricNote}${frameworks}${counts?`<p class="analysis-source">${counts}。</p>`:''}${r.metrics.length||r.demo?`<p class="analysis-source">经营数据来源：${data}。</p>`:''}${unknown}${template}${timing}${server}${r.legacyTimingRemoved?'<p class="analysis-source">旧版演示动画的耗时不再作为处理用时展示。</p>':''}${r.goalNarrative?`<p class="analysis-source">工作流返回的目标说明：${esc(r.goalNarrative)}</p>`:''}${r.errors.length?`<p class="analysis-source">资料说明：${r.errors.slice(0,3).map(esc).join('；')}${r.errors.length>3?'；其余缺口见正式回答':''}</p>`:''}${billing?`<details class="workflow-usage-details"><summary>查看两类账户用量与模型调用明细</summary><p class="analysis-source">总 Token 是两类已返回用量的数量合计；费用按账户分别结算，不折算成同一余额。</p>${billing}</details>`:''}</details>`;
}
function chatCozeUsageHTML(usage,workflowInvoked){
 if(!usage&&workflowInvoked!==true)return '';
 const count=value=>Number.isSafeInteger(value)&&value>=0?value.toLocaleString('zh-CN'):'未提供';
 return `<div class="analysis-evidence" data-usage-account="coze"><strong>扣子 Coze · 工作流用量</strong><p class="analysis-source">扣子接口记录 Token：${count(usage?.totalTokens)}；自有 DeepSeek API 用量单列，两类账户分别结算。</p><p class="analysis-source">本次扣子积分：接口未提供单次结算值，以扣子积分账单为准。${usage?.trace==='enabled'?'Trace 已启用，日志费用另按扣子账单结算。':''} Token 为 0 不代表扣子积分消耗为 0。</p></div>`;
}
function chatModelUsageHTML(usage){
 if(!usage)return '';
 const names={understanding:'理解复杂问法',explanation:'原因判断与行动建议',repair:'补全回答',knowledge:'经营知识问答'};
 const count=value=>Number.isSafeInteger(value)&&value>=0?value.toLocaleString('zh-CN'):'未记录';
 const calls=usage.calls||[],rows=calls.map(call=>{
  const name=call.nodeName||names[call.stage]||'模型调用';
  const label=call.stage==='explanation'?name+' · 问题'+(call.callIndex||1):name;
  const effort=call.reasoningEffort?'（'+call.reasoningEffort+'）':'';
  return `<tr><td>${esc(label+effort)}</td><td>${count(call.inputTokens)}</td><td>${count(call.outputTokens)}</td><td>${count(call.reasoningTokens)}</td><td>${count(call.totalTokens)}</td></tr>`;
 }).join('');
 const total=usage.complete===false?'部分调用的用量未完整返回。':`本次实际模型调用 ${count(usage.callCount)} 次，合计 ${count(usage.totalTokens)} Token。`;
 return `<div class="analysis-evidence" data-usage-account="deepseek"><strong>本次模型节点 Token 用量 · DeepSeek</strong><p class="analysis-source">扣费账户：自有 DeepSeek API，使用 DeepSeek 余额，不从扣子积分扣费。${total}</p>${rows?`<div class="analysis-table-wrap"><table><thead><tr><th>模型节点</th><th>输入</th><th>输出</th><th>其中推理</th><th>合计</th></tr></thead><tbody>${rows}</tbody></table></div>`:''}<p class="analysis-source">输出已包含推理 Token，合计为输入加输出。缓存命中 ${count(usage.cachedInputTokens)} Token，已计入输入。用量按 DeepSeek 回执统计。</p></div>`;
}
function chatStreamTextHTML(text){return String(text||'').split('\n').filter(Boolean).map(line=>/^#{1,3}\s/.test(line)?'<h4>'+esc(line.replace(/^#{1,3}\s*/,''))+'</h4>':'<p>'+esc(line)+'</p>').join('');}
function chatStreamHTML(view){return `<div class="stream-scope">${['diagnosis','data'].includes(view.branch)&&typeof merchantScopeHTML==='function'?merchantScopeHTML({context:view.context,branch:view.branch,dataMode:'demo'},view.question):''}</div>${chatStreamStepsHTML(view)}<div class="stream-answer"${view.text?'':' hidden'}><div class="answer-label">正在接收回复</div><div class="stream-answer-text"></div></div>`;}
function renderChatStream(id,view){
 const root=document.querySelector(`#${id} .message-content`);if(!root)return;
 const messages=document.querySelector('#chat-messages'),follow=messages&&messages.scrollHeight-messages.scrollTop-messages.clientHeight<90;
 const existing=root.querySelector('.chat-analysis'),wasOpen=existing?existing.open:true;
 if(!root.querySelector('.stream-answer'))root.innerHTML=chatStreamHTML(view);else root.querySelector('.chat-analysis').outerHTML=chatStreamStepsHTML(view);
 root.querySelector('.chat-analysis').open=wasOpen;
 if(typeof merchantScopeHTML==='function')root.querySelector('.stream-scope').innerHTML=['diagnosis','data'].includes(view.branch)?merchantScopeHTML({context:view.context,branch:view.branch,dataMode:'demo'},view.question):'';
 const answer=root.querySelector('.stream-answer');answer.hidden=!view.text;answer.querySelector('.stream-answer-text').innerHTML=chatStreamTextHTML(view.text);
 if(follow)messages.scrollTop=messages.scrollHeight;
}
