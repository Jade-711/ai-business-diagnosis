// Business handling copied from the existing production nodes without changes.
// Original node 410019, code SHA256 eb5ad787fe8a2ad96ad1339bdc3e141e2a9fda9ceb8449ee998708d4b51ae98f
const configuredProductionDraftRuntime=(()=>{
// Executable reconstruction. Business rules below are demonstration definitions,
// not a claim about the original production system's unpublished internals.
const FRONTEND = {
  merchant: 'https://ai-business-diagnosis-workflow.songge-huster.chatgpt.site/#merchant',
  aidd: 'https://ai-business-diagnosis-workflow.songge-huster.chatgpt.site/#aidd'
};
const FIELDS = {overview:'全店',live:'直播',video:'短视频',shelf:'货架',creator:'达人合作'};

function configuredProductionDraft(p){
 const frame=p.sourceFramework||{};
 const candidates=(p.strategyMode==='manual'?p.manualStrategies:p.candidateStrategies)||[];
 const linked=candidates.map(s=>({...s,frameworkId:s.frameworkId||frame.id,frameworkVersion:s.frameworkVersion||frame.version,metricIds:s.metricIds?.length?s.metricIds:p.strategyMode==='content'?(p.metrics||[]).filter(m=>(s.contentObjects||[]).includes(m.name)).map(m=>m.id):ruleMetricIds(s.rule),branchIds:s.branchIds?.length?s.branchIds:(frame.branches||[]).filter(b=>(b.metricIds||[]).some(id=>(s.metricIds||ruleMetricIds(s.rule)).includes(id))).map(b=>b.id),status:'待生效',enabled:false,sourceWorkflow:'AIDD_Production'}));
 return createProductionDraft({...p,manualStrategies:linked,candidateStrategies:linked});
}
function createProductionDraft(p) {
  const framework = p.candidateFramework || {};
  const strategies = p.strategyMode === 'manual' ? p.manualStrategies || [] : p.candidateStrategies || [];
  const draftText = p.operation === 'generate_framework' ? framework.draftText || '' : strategies.map(s=>
    '策略名称：'+s.name+'\n业务含义：'+(s.businessMeaning||'')+'\n逻辑表达式：'+JSON.stringify(s.rule||{})+'\n内容标准：'+(s.contentPrompt||'')+'\n关联行动：'+(s.actionIds||[]).join('、')
  ).join('\n\n');
  return {productionDraft:{operation:p.operation,strategyMode:p.strategyMode,draftText,candidateFramework:framework,candidateStrategies:strategies,missing:p.missing||[],pipelineErrors:p.inputErrors||[]}};
}
function ruleMetricIds(rule){if(!rule||typeof rule!=='object')return [];if(Array.isArray(rule.children)&&rule.children.length)return uniqueText(rule.children.flatMap(ruleMetricIds));return uniqueText([rule.metricId,rule.rightType==='metric'?rule.rightMetricId:'']);}
function uniqueText(items){return [...new Set((items||[]).filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()))];}
const stages={};
const T={};
return configuredProductionDraft;
})();
export function configuredProductionDraft(params){return configuredProductionDraftRuntime(params);}
// Original node 410026, code SHA256 9b5691b6106d83e63facd7317edfe8c1649f1f61c370cd878b16cb6f3143fb89
const productionStageResultRuntime=(()=>{
// Executable reconstruction. Business rules below are demonstration definitions,
// not a claim about the original production system's unpublished internals.
const FRONTEND = {
  merchant: 'https://ai-business-diagnosis-workflow.songge-huster.chatgpt.site/#merchant',
  aidd: 'https://ai-business-diagnosis-workflow.songge-huster.chatgpt.site/#aidd'
};
const FIELDS = {overview:'全店',live:'直播',video:'短视频',shelf:'货架',creator:'达人合作'};

function productionStageResult(p){
 const draft=p.productionDraft||{},errors=uniqueText([...(p.inputErrors||[]),...(draft.pipelineErrors||[])]);
 const emptyTrial={executed:false,status:'not_run',caseCount:0,cases:[],limitations:['案例试跑按需发起，生成和确认阶段不会自动运行。']};
 const frame=p.operation==='generate_framework'?draft.candidateFramework:p.sourceFramework;
 const result={status:errors.length?'invalid_input':'needs_review',answer:'草稿已生成，请在AIDD后台审核；确认后解析和系统校验。',operation:p.operation,phase:p.phase||'generate',draftText:draft.draftText||p.review?.reviewedText||'',candidateFramework:draft.candidateFramework||{},candidateStrategies:draft.candidateStrategies||[],missing:uniqueText([...(draft.missing||[]),...errors]),trialReport:emptyTrial,handoff:{producerWorkflow:'AIDD_Production',consumerWorkflow:'AIDD_Execution',consumerWorkflowId:'7700525555132727359',publicationStatus:'待人工审核',requiresHumanReview:true,executionEligible:false,frameworkId:frame?.id||'',frameworkVersion:frame?.version||0,sceneIds:(p.scenes||[]).map(s=>s.id),strategyIds:(draft.candidateStrategies||[]).map(s=>s.id)},releasePlan:{status:'not_ready',consumerWorkflow:'AIDD_Execution',frameworkId:frame?.id||'',frameworkVersion:frame?.version||0,strategyIds:(draft.candidateStrategies||[]).map(s=>s.id),sellerAllowlist:[],requiresBackendPublish:true,checks:[]}};
 if(errors.length){result.answer='本阶段资料未通过检查：'+errors.join('；');return {productionResult:result};}
 if(!p.phase||p.phase==='generate')return {productionResult:result};
 if(p.phase==='confirm'&&(!p.review?.confirmed||!String(p.review?.reviewer||'').trim())){result.status='needs_review';result.answer='请由产运确认审核结果。';return {productionResult:result};}
 const checked=validateReviewedProduction({...p,productionDraft:draft});
 result.candidateFramework=checked.candidateFramework;result.candidateStrategies=checked.candidateStrategies;result.missing=checked.missing;
 if(checked.status!=='needs_review'){result.status='needs_fix';result.answer=checked.answer;return {productionResult:result};}
 if(p.phase==='test'){
  result.handoff.publicationStatus='案例试跑，待人工验收';
  if(checked.candidateStrategies.some(s=>s.execution==='模型理解')){
   result.trialReport={...emptyTrial,status:'unsupported',limitations:['内容标准已生成；尚未接入真实商品资料与内容判断执行器，无法进行内容合格测试。']};result.answer=result.trialReport.limitations[0];return {productionResult:result};
  }
  result.trialReport=T.simulateProductionCandidates({...p,...checked}).trialReport;
  result.trialReport.cases=result.trialReport.cases.map((c,i)=>{
   const sample=p.trialCases[i],values=sample.metricValues||[],available=new Set(values.filter(m=>Number.isFinite(m.value)).map(m=>m.id));
   return {...c,evidence:values.filter(m=>Number.isFinite(m.value)).map(m=>({metricId:m.id,label:m.label||m.id,value:m.value,...(Number.isFinite(m.previousValue)?{previousValue:m.previousValue}:{}),unit:m.unit||''})),frameworkBranches:p.operation==='generate_framework'?(checked.candidateFramework.branches||[]).map(b=>({branchId:b.id,branchName:b.name,covered:(b.metricIds||[]).every(id=>available.has(id)),missing:(b.metricIds||[]).filter(id=>!available.has(id))})):[]};
  });
  result.answer=result.trialReport.status==='completed'?'已完成本次所选案例试跑，请人工核验同一份报告；尚未确认入库或发布。':'本次案例试跑资料不完整，请查看报告并修正。';
  return {productionResult:result};
 }
 result.status='ready_for_gray';result.answer='人工确认稿已完成协议处理与系统校验，保留待生效状态；案例试跑可按需进行，后台发布后才供AIDD_Execution使用。';
 result.handoff.publicationStatus='待后台确认发布';
 result.releasePlan={...result.releasePlan,status:'awaiting_backend_publish',sellerAllowlist:['DEMO_10001'],checks:['人工确认',p.strategyMode==='manual'||p.parsed?'结构化配置':'协议解析','系统校验']};
 return {productionResult:result};
}
function validateReviewedProduction(p) {
  const productionDraft = p.productionDraft || {};
  const normalizeRule = rule => {
    if(!rule||typeof rule!=='object')return rule;
    const next={...rule};
    if(Array.isArray(next.children)) {
      if(next.children.length)next.children=next.children.map(normalizeRule);
      else if(String(next.metricId||'').trim())delete next.children;
      else productionDraft.pipelineErrors=[...(productionDraft.pipelineErrors||[]),'规则组缺少可执行条件。'];
    }
    return next;
  };
  if(productionDraft.candidateFramework?.branches) productionDraft.candidateFramework.branches=productionDraft.candidateFramework.branches.map(b=>({...b,metricIds:b.metricIds||[],actionIds:b.actionIds||[]}));
  productionDraft.candidateStrategies=(productionDraft.candidateStrategies||[]).map(s=>({...s,enabled:false,status:'待生效',rule:s.execution==='模型理解'?null:normalizeRule(s.rule)}));
  productionDraft.candidateStrategies.forEach(s=>{delete s.period;});
  const validated = T.validateProductionDraft({...p,productionDraft});
  return {...validated,productionDraft};
}
function validateProductionDraft(p){
 const d=p.productionDraft||{},result=stages.production({input:{operation:d.operation,context:{demo:true},productionInput:{scenes:p.scenes,goal:p.goal,scope:p.scope,metrics:p.metrics,actions:p.actions}},model:{framework:d.candidateFramework,candidates:d.candidateStrategies,missing:d.missing||[]}});
 const errors=uniqueText(d.pipelineErrors);
 return {status:errors.length?'invalid_candidate':result.status,answer:errors.length?'候选未通过前置校验：'+errors.join('；'):result.answer,candidateFramework:!errors.length&&d.operation==='generate_framework'&&result.status==='needs_review'?result.candidate:{},candidateStrategies:!errors.length&&d.operation==='generate_strategies'&&result.status==='needs_review'?result.candidate:[],missing:uniqueText([...errors,...(result.missing||[])]),operation:d.operation||p.operation};
}
function uniqueText(items){return [...new Set((items||[]).filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()))];}
function production(params) {
  const p=unpack(params),model=cleanJSON(params.model),assets=p.productionInput||{};
  p.intent='production';
  step(p,'production','AIDD建设侧生成与协议校验');
  const metricIds=new Set((assets.metrics||[]).map(m=>m.id)),actionIds=new Set((assets.actions||[]).map(a=>a.id));
  const scenes=new Set((assets.scenes||[]).map(s=>s.id)),errors=[];
  if(!['generate_framework','generate_strategies'].includes(p.operation))errors.push('不支持的建设侧生产操作');
  if(!metricIds.size||!scenes.size||!assets.goal||!assets.scope)errors.push('场景、目标、适用范围与指标均需提供');
  const check=(item,requireAction=false)=>{
    if(!scenes.has(item.sceneId))errors.push('候选引用了未选择的场景');
    if(!item.metricIds?.length||item.metricIds.some(id=>!metricIds.has(id)))errors.push('候选引用了未选择的指标');
    if((requireAction&&!item.actionIds?.length)||(item.actionIds||[]).some(id=>!actionIds.has(id)))errors.push('候选引用了未选择的行动点');
    const scene=(assets.scenes||[]).find(s=>s.id===item.sceneId);
    if(scene&&((item.metricIds||[]).some(id=>!scene.metricIds?.includes(id))||(item.actionIds||[]).some(id=>!scene.actionIds?.includes(id))))errors.push('候选资产未关联当前场景');
    const walk=r=>{if(!r)return;if(r.children){r.children.forEach(walk);return;}if(!metricIds.has(r.metricId)||(r.rightType==='metric'&&!metricIds.has(r.rightMetricId)))errors.push('规则引用了未选择的指标');if(r.rightType!=='metric'&&!finite(r.value))errors.push('规则阈值不是有效数值');if(!['<','<=','>','>=','==','!='].includes(r.op))errors.push('规则比较符不受支持');};walk(item.rule);
  };
  let candidate;
  if(p.operation==='generate_framework') {
    candidate=model.framework;
    if(!candidate||!candidate.draftText||!Array.isArray(candidate.branches)||!candidate.branches.length)errors.push('框架结构不完整');
    else candidate.branches.forEach(b=>check({...b,sceneId:candidate.sceneId},false));
  } else {
    candidate=Array.isArray(model.candidates)?model.candidates:[];
    if(!candidate.length)errors.push('未生成可审核的候选策略');
    candidate.forEach(item=>check(item));
  }
  return reply(p,errors.length?'候选未通过协议校验：'+[...new Set(errors)].join('；'):'已生成待审核候选，请检查依据、试跑并人工确认后发布。',{status:errors.length?'invalid_candidate':'needs_review',branch:'production',candidate:errors.length?null:candidate,missing:[...new Set(errors),...(Array.isArray(model.missing)?model.missing:[])],operation:p.operation});
}
function finite(value) { return typeof value==='number' && Number.isFinite(value); }
function reply(p, answer, extra={}) {
  return {schemaVersion:1,status:'success',branch:p.intent||'diagnosis',answer,context:p.context||{},dataMode:p.data?.mode||'demo',
    evidence:[],diagnosis:[],actions:[],missing:[],trace:p.trace||[],frontend:FRONTEND,...extra};
}
function cleanJSON(value) { if(value&&typeof value==='object')return value;return parse(String(value||'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')); }
function parse(value, fallback={}) {
  if (value && typeof value==='object') return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}
function step(p, layer, node) { p.trace=[...(p.trace||[]),{layer,node}]; return p; }
function unpack(params) { return parse(params.input, {question:String(params.input||''),context:{demo:true}}); }
function simulateProductionCandidates(p){
 const limitations=['案例为演示数据，试跑不等于真实经营效果验证。','最终需要人工审核业务依据与阈值后发布。'];
 if(p.status!=='needs_review')return {trialReport:{executed:false,status:'not_run',caseCount:0,cases:[],limitations:[...limitations,'候选校验未通过，没有执行案例试跑。']}};
 const trials=[];
 for(const c of (p.trialCases||[]).slice(0,8)){
  const metrics=c.metricValues||[],available=new Set(metrics.filter(m=>Number.isFinite(m.value)).map(m=>m.id)),needed=p.operation==='generate_framework'?(p.candidateFramework.branches||[]).flatMap(b=>b.metricIds):(p.candidateStrategies||[]).flatMap(s=>[...(s.metricIds||[]),...ruleMetricIds(s.rule)]),missing=uniqueText(needed).filter(id=>!available.has(id)).map(id=>'案例缺少指标：'+id);
  let matchedStrategyNames=[],ruleResults=[];
  if(p.operation==='generate_strategies'&&!missing.length){
   const strategies=p.candidateStrategies.map(s=>({...s,enabled:true,status:'生效中'}));
   const r=stages.validate({input:{context:{fieldKey:c.fieldKey,sellerId:'DEMO_10001',period:c.period,tags:['跃迁期','直播型']},config:{active:true,metrics:p.metrics,strategies,actions:p.actions},data:{mode:'demo',metrics}}});
   ruleResults=r.ruleResults||[];matchedStrategyNames=ruleResults.filter(r=>r.triggered).map(r=>r.name);
   const expectedNames=c.expectedStrategies||c.expectedStrategyNames;
   if(expectedNames?.length){const expected=[...expectedNames].sort().join('|'),actual=[...matchedStrategyNames].sort().join('|');if(expected!==actual)missing.push('策略命中结果与案例预期不一致。');}
  }
  trials.push({id:String(c.id||'case-'+(trials.length+1)),label:String(c.label||'演示案例'),status:missing.length?'incomplete':'completed',availableMetrics:available.size,matchedStrategyNames,ruleResults,missing});
 }
 return {trialReport:{...(p.operation==='generate_strategies'?{schemaVersion:1,analysisMode:'strategy_rule_trial'}:{}),executed:trials.length>0,status:trials.length?(trials.some(c=>c.missing.length)?'incomplete':'completed'):'not_run',caseCount:trials.length,cases:trials,limitations:[...limitations,...(!trials.length?['尚未提供试跑案例。']:[])]}};
}
function ruleMetricIds(rule){if(!rule||typeof rule!=='object')return [];if(Array.isArray(rule.children)&&rule.children.length)return uniqueText(rule.children.flatMap(ruleMetricIds));return uniqueText([rule.metricId,rule.rightType==='metric'?rule.rightMetricId:'']);}
function validate(params) {
  const p=unpack(params);step(p,3,'参数校验与构建');
  p.validationErrors=[];
  if(!p.context?.sellerId)p.validationErrors.push('sellerId缺失');
  if(!p.config?.active)p.validationErrors.push(p.config?.inactiveReason||'当前场景没有已生效的诊断配置');
  if(!Array.isArray(p.config?.metrics)||!Array.isArray(p.config?.strategies)||!Array.isArray(p.config?.actions))p.validationErrors.push('诊断资产不完整');
  if(!Array.isArray(p.data?.metrics)||!p.data.metrics.length)p.validationErrors.push('经营指标缺失');
  if(p.config?.fieldKey&&p.config.fieldKey!==p.context.fieldKey)p.validationErrors.push('配置与请求场域不一致');
  if(p.data?.fieldKey&&p.data.fieldKey!==p.context.fieldKey)p.validationErrors.push('数据与请求场域不一致');
  const tags=Array.isArray(p.context?.tags)?p.context.tags:[];
  p.ruleResults=p.validationErrors.length?[]:(p.config.strategies||[]).filter(s=>s.status==='生效中'&&s.enabled!==false).map(s=>{
    let matched=null,reason='';
    const scopeText=String(s.merchantScope||'').trim();
    const scope=scopeText.split(/[,，]/).map(t=>t.trim().replace(/商家$/,'')).filter(Boolean);
    const unresolvedScope=!!scopeText&&/[：:。；;\n]|时间范围|适用人群|近\d+天|此前|最近/.test(scopeText);
    const applies=unresolvedScope||!scope.length||scope.every(t=>tags.includes(t));
    if(unresolvedScope)reason='适用范围含自然语言条件，尚未转换为可验证标签，无法判断';
    else if(!applies)reason='商家适用标签不满足，跳过';
    else if(s.execution==='模型理解')reason='本次未接入内容识别执行器，无法判断';
    else {matched=judge(s.rule,p);reason=matched===null?'指标、比较基准、单位或运算条件不足':'按已发布的确定性规则判断';}
    return {strategyId:s.id,name:s.name,priority:s.priority||0,matched,applies,reason,triggered:applies&&matched!==null&&(s.actionTrigger==='mismatch'?!matched:matched),evidence:evidenceFor(s.rule,p),actionIds:s.actionIds||[]};
  });
  return p;
}
function evidenceFor(rule,p) {
  const ids=[];const walk=r=>{if(r?.children)r.children.forEach(walk);else if(r){ids.push(r.metricId);if(r.rightType==='metric')ids.push(r.rightMetricId);}};walk(rule);
  return [...new Set(ids)].map(id=>{const m=(p.data?.metrics||[]).find(m=>m.id===id);return {metricId:id,label:m?.label||m?.name||id,value:finite(m?.value)?m.value:null,unit:m?.unit||'',missing:!finite(m?.value)};});
}
function judge(rule,p,depth=0) {
  if (!rule||depth>3) return null;
  if (Array.isArray(rule.children)) {
    if (!rule.children.length) return null;
    const values=rule.children.map(r=>judge(r,p,depth+1));
    if (rule.join==='OR'&&values.includes(true)) return true;
    if (rule.join!=='OR'&&values.includes(false)) return false;
    if (values.includes(null)) return null;
    return rule.join==='OR'?values.some(Boolean):values.every(Boolean);
  }
  const allowed=new Set((p.config?.metrics||[]).map(m=>m.id));
  if (!allowed.has(rule.metricId)||(rule.rightType==='metric'&&!allowed.has(rule.rightMetricId))) return null;
  const left=operand(rule,'left',p);
  const right=rule.rightType==='metric'?operand(rule,'right',p):rule.value===null||rule.value===''?null:Number(rule.value);
  if (!finite(left)||!finite(right)) return null;
  if (rule.rightType==='metric') {
    const a=p.config.metrics.find(m=>m.id===rule.metricId),b=p.config.metrics.find(m=>m.id===rule.rightMetricId);
    if (a?.unit!==b?.unit) return null;
  }
  return compare(left,rule.op,right);
}
function compare(a,op,b) { return op==='>'?a>b:op==='>='?a>=b:op==='<'?a<b:op==='<='?a<=b:op==='=='?a===b:op==='!='?a!==b:null; }
function operand(rule, side, p) {
  const id=rule[side==='left'?'metricId':'rightMetricId'];
  const metric=(p.data?.metrics||[]).find(m=>m.id===id);
  if (!metric) return null;
  const transform=rule[side+'Transform']||'value';
  let value=metric.value;
  const values=(metric.currentValues||[]).filter(finite);
  if (transform==='previous') value=metric.previousValue;
  else if (transform==='mean') value=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  else if (transform==='median') { const s=[...values].sort((a,b)=>a-b); const n=s.length; value=n?(n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2):null; }
  else if (transform!=='value') value=metric[transform];
  if (!finite(value)) return null;
  const calc=rule[side+'Calc']||(side==='right'?'*':'none');
  const n=Number(rule[side==='left'?'leftNumber':'rightNumber']??rule.factor??1);
  if (calc==='none') return value;
  if (!finite(n)||(calc==='/'&&n===0)) return null;
  return calc==='*'?value*n:calc==='/'?value/n:calc==='+'?value+n:calc==='-'?value-n:null;
}
const stages={validate,production};
const T={validateProductionDraft,simulateProductionCandidates};
return productionStageResult;
})();
export function productionStageResult(params){return productionStageResultRuntime(params);}
