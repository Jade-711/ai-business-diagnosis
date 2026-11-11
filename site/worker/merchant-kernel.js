// The same scope, framework, strategy, rule, evidence and action code as Main_agent.
// Kept in isolated closures so the published execution semantics remain unchanged.
// Existing Main_agent node 110001, SHA256 550b8460033854d553c673830b61ad0efd499eb4f07ed95e1252443c6df4a85d.
export const confirmMerchantRequest=(()=>{
// Executable reconstruction. Business rules below are demonstration definitions,
// not a claim about the original production system's unpublished internals.
const FRONTEND = {
  merchant: 'https://ai-business-diagnosis-workflow.songge-huster.chatgpt.site/#merchant',
  aidd: 'https://ai-business-diagnosis-workflow.songge-huster.chatgpt.site/#aidd'
};
const FIELDS = {overview:'全店',live:'直播',video:'短视频',shelf:'货架',creator:'达人合作'};

function confirmRequest(p) {
  const request = T.requestContext(p);
  return T.routeIntent({...p, ...request});
}
function routeIntent(p){
 const q=p.question||'',page=p.pageContext||{},validField=v=>Object.hasOwn(FIELDS,v),validPeriod=v=>['week','day'].includes(v),validMetric=v=>['gmv','orders','buyers','newBuyerRate','creators','videos','plays','activeRate','payRate','clickRate','exposure'].includes(v);
 const branchInput=['diagnosis','data','knowledge'].includes(p.intent)?p.intent:'clarification';
 const base={sellerId:p.sellerId||'DEMO_10001',fieldKey:'',period:'',metricKey:'',requestId:p.requestId||'demo',chatId:p.chatId||'',demo:true,tags:['跃迁期']};
 const scopeResolution={fieldSource:'none',periodSource:'none',metricSource:'none'},scopeErrors=[];
 if(branchInput==='knowledge')return {question:q,analysisContext:base,branch:'knowledge',routeReason:String(p.reason||''),scopeResolution,scopeErrors,needClarification:false,clarification:'',streamEvent:'AIDD_STREAM_V1\n'+JSON.stringify({kind:'context',branch:'knowledge',context:{}})};
 const pageReference=/这里|这儿|当前页面|当前看板|这张看板|这个指标|这项指标|该指标|当前指标/.test(q);
 const fieldMatches=[[/直播|live/i,'live'],[/短视频|video/i,'video'],[/货架|shelf/i,'shelf'],[/达人|creator/i,'creator']].filter(([re])=>re.test(q)).map(([,key])=>key);
 // A verified catalog scene may contain another field's name, for example
 // 直播-曝光-短视频预热. Its scene field owns the diagnostic scope.
 const catalogField=validField(p.catalogSceneFieldKey)?p.catalogSceneFieldKey:'';
 let explicitField=catalogField||(/全店|各场域|跨场域|整体店铺/.test(q)?'overview':fieldMatches.length===1?fieldMatches[0]:fieldMatches.length===0&&/店铺|全店/.test(q)?'overview':'');
 if(fieldMatches.length>1&&!explicitField){if(/对比|比较|各|分别/.test(q))explicitField='overview';else scopeErrors.push('请明确本次要分析的一个场域，或说明需要跨场域对比。');}
 const explicitDay=/昨日|昨天/.test(q),explicitWeek=/近\s*[7七]\s*天|最近\s*[7七]\s*天|过去\s*[7七]\s*天|近一周|最近一周/.test(q);
 const unsupportedPeriod=/今天|今日|前天|本周|上周|本月|上月|今年|去年|季度|自定义|\d{4}[-/年]|\d{1,2}月\d{1,2}[日号]|(近|最近|过去)\s*(?![7七]\s*天)[\d一二三四五六八九十两]+\s*天/.test(q)||(explicitDay&&explicitWeek);
 if(unsupportedPeriod)scopeErrors.push('目前接入的是近7天和昨日数据，不能用它们代替你指定的其他时间范围。请选一个已接入周期。');
 const records=Array.isArray(p.history)?p.history:[];
 let previous={};
 for(let i=records.length-1;i>=0;i--){const h=records[i];if(h.role==='assistant'&&validField(h.context?.fieldKey)&&validPeriod(h.context?.period)){previous=h.context;break;}}
 const pick=(name,valid,explicit,sourceName)=>{
  if(explicit){scopeResolution[sourceName]='question';return explicit;}
  if(p[sourceName]==='question'&&valid(p[name])){scopeResolution[sourceName]='question';return p[name];}
  if(p[sourceName]==='question'&&p[name]&&!valid(p[name])){scopeErrors.push(name==='period'?'你指定的周期尚未接入，请选择近7天或昨日。':'你指定的分析场域尚未接入，请明确支持的经营场域。');return '';}
  if(pageReference&&valid(page[name])){scopeResolution[sourceName]='page';return page[name];}
  if(valid(previous[name])){scopeResolution[sourceName]='history';return previous[name];}
  if(p[sourceName]==='history'&&records.length&&valid(p[name])){scopeResolution[sourceName]='history';return p[name];}
  if(valid(page[name])){scopeResolution[sourceName]='page';return page[name];}
  return '';
 };
 base.fieldKey=pick('fieldKey',validField,explicitField,'fieldSource');
 base.period=unsupportedPeriod?'':pick('period',validPeriod,explicitDay&&!explicitWeek?'day':explicitWeek&&!explicitDay?'week':'','periodSource');
 if(unsupportedPeriod)scopeResolution.periodSource='question';
 const patterns=[[/支付人数|支付用户|买家人数/,'buyers'],[/新客/,'newBuyerRate'],[/有成交达人|达人数/,'creators'],[/订单/,'orders'],[/发布.*视频|视频.*数量|视频数/,'videos'],[/播放/,'plays'],[/合作达人成交率/,'activeRate'],[/支付转化|支付率|转化率/,'payRate'],[/点击率/,'clickRate'],[/曝光/,'exposure'],[/金额|GMV|成交额/i,'gmv']];
 const targets=[...new Set(patterns.filter(([re])=>re.test(q)).map(([,key])=>key))];
 const broad=/表现|怎么样|全店诊断|目标差距|整体|总体|有哪些问题|经营数据/.test(q);
 if(targets.length===1){base.metricKey=targets[0];scopeResolution.metricSource='question';}
 else if(!targets.length&&!broad){
  if(p.metricSource==='question'&&validMetric(p.metricKey)){base.metricKey=p.metricKey;scopeResolution.metricSource='question';}
  else if(pageReference&&base.fieldKey===page.fieldKey&&validMetric(page.metricKey)){base.metricKey=page.metricKey;scopeResolution.metricSource='page';}
  else if(!pageReference&&base.fieldKey===previous.fieldKey&&validMetric(previous.metricKey)){base.metricKey=previous.metricKey;scopeResolution.metricSource='history';}
 }
 if(!base.fieldKey)scopeErrors.push('请明确要看全店、直播、短视频、货架还是达人合作。');
 if(!base.period&&!unsupportedPeriod)scopeErrors.push('请明确要看近7天还是昨日。');
 if(branchInput==='clarification')scopeErrors.push('请说明需要分析经营问题、查询经营数据，还是了解经营知识。');
 base.tags=['跃迁期',...(base.fieldKey==='live'?['直播型']:[])];
 const needClarification=scopeErrors.length>0,branch=needClarification?'clarification':branchInput,clarification=[...new Set(scopeErrors)].join(' ');
 return {question:q,analysisContext:base,branch,routeReason:String(p.reason||''),scopeResolution,scopeErrors:[...new Set(scopeErrors)],needClarification,clarification,streamEvent:'AIDD_STREAM_V1\n'+JSON.stringify({kind:'context',branch,context:needClarification?{}:{fieldKey:base.fieldKey,period:base.period}})};
}
function requestContext(p){
 const clean=v=>typeof v==='string'?v.trim():'';
 const page=p.pageContext&&typeof p.pageContext==='object'?p.pageContext:{};
 const pageContext={fieldKey:clean(page.fieldKey),period:clean(page.period),metricKey:clean(page.metricKey)};
 const history=(Array.isArray(p.history)?p.history:[]).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-12).map(m=>({role:m.role,content:m.content.slice(0,6000),...(m.context&&typeof m.context==='object'?{context:{fieldKey:clean(m.context.fieldKey),period:clean(m.context.period),metricKey:clean(m.context.metricKey)}}:{})}));
 return {question:clean(p.question).slice(0,2000),sellerId:clean(p.sellerId)||'DEMO_10001',pageContext,history,chatId:clean(p.chatId)||'coze_'+Date.now().toString(36),requestId:clean(p.requestId)||'demo'};
}
const stages={};
const T={requestContext,routeIntent};

return confirmRequest;
})();

// Existing Main_agent node 310005, SHA256 9b91a3c6deaf5d608f39b1241650fbe3d11e20a56a245ae1d8f5cab4e7836fa7.
export const executeMerchantRules=(()=>{
// Executable reconstruction. Business rules below are demonstration definitions,
// not a claim about the original production system's unpublished internals.
const FRONTEND = {
  merchant: 'https://ai-business-diagnosis-workflow.songge-huster.chatgpt.site/#merchant',
  aidd: 'https://ai-business-diagnosis-workflow.songge-huster.chatgpt.site/#aidd'
};
const FIELDS = {overview:'全店',live:'直播',video:'短视频',shelf:'货架',creator:'达人合作'};

function executeDiagnosis(p) {
  const context = {...p.context, tags:p.merchantProfile?.tags || p.context?.tags || []};
  const matched = T.matchFramework({...p,context});
  const f = matched.selectedFramework;
  const diagnosisPlan = {
    frameworkId:f.id, frameworkVersion:f.version, objective:p.question,
    steps:(f.branches || []).map(b=>({branchId:b.id,branchName:b.name,objective:b.meaning,metricIds:b.metricIds,priority:b.priority})),
    requiredMetricIds:[...new Set((f.branches || []).flatMap(b=>b.metricIds))], missing:[],
  };
  const selected = T.selectExecutionStrategies({...p,...matched,context,diagnosisPlan,planErrors:matched.selectionErrors});
  const checked = T.executionCheck({...p,...matched,...selected,context,framework:f});
  const rules = T.evaluateStrategies({...p,context,...checked,strategies:selected.selectedStrategies});
  return {context,...matched,...selected,...checked,...rules,diagnosisPlan};
}
function selectExecutionStrategies(p){
 const f=p.selectedFramework||{},context=p.context||{},definitions=p.metricDefinitions||[],known=new Set(definitions.map(m=>m.id)),planIds=new Set(p.diagnosisPlan?.requiredMetricIds||[]),focus=context.metricKey;
 const selectedStrategies=(p.strategyCandidates||[]).filter(s=>s.sceneId===f.sceneId&&s.enabled!==false&&['生效中','active','published'].includes(s.status)&&(!s.period||s.period===context.period)&&(!s.frameworkId||s.frameworkId===f.id)&&(!s.frameworkVersion||Number(s.frameworkVersion)===f.version)).filter(s=>{
  const ids=uniqueText([...(s.metricIds||[]),...ruleMetricIds(s.rule)]);
  return ids.some(id=>planIds.has(id))&&(!focus||ids.some(id=>definitions.some(m=>m.id===id&&m.metricKey===focus)));
 }).sort((a,b)=>(a.priority||0)-(b.priority||0));
 const requiredMetricIds=uniqueText([...(p.diagnosisPlan?.requiredMetricIds||[]),...selectedStrategies.flatMap(s=>[...(s.metricIds||[]),...ruleMetricIds(s.rule)]),...definitions.filter(m=>m.metricKey==='gmv'||(!focus&&f.metricIds.includes(m.id))||m.metricKey===focus).map(m=>m.id)]);
 const planErrors=uniqueText([...(p.planErrors||[]),...(requiredMetricIds.some(id=>!known.has(id))?['已选策略依赖的指标未包含在已发布资产中。']:[])]);
 return {selectedStrategies,selectedStrategyIds:selectedStrategies.map(s=>s.id),requiredMetricIds,metricIdsQuery:requiredMetricIds.join(','),planErrors,streamEvent:'AIDD_STREAM_V1\n'+JSON.stringify({kind:'plan',frameworkName:f.name||'',frameworkVersion:f.version||0,steps:(p.diagnosisPlan?.steps||[]).map(x=>x.branchName),strategyCount:selectedStrategies.length,errors:planErrors})};
}
function ruleMetricIds(rule){if(!rule||typeof rule!=='object')return [];if(Array.isArray(rule.children)&&rule.children.length)return uniqueText(rule.children.flatMap(ruleMetricIds));return uniqueText([rule.metricId,rule.rightType==='metric'?rule.rightMetricId:'']);}
function uniqueText(items){return [...new Set((items||[]).filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()))];}
function matchFramework(p){
 const context=p.context||{},q=String(p.question||''),definitions=p.metricDefinitions||[],focusIds=definitions.filter(m=>m.metricKey===context.metricKey).map(m=>m.id);
 const options=(p.frameworkCandidates||[]).map(normalizePublishedFramework).filter(f=>f.active&&f.fieldKey===context.fieldKey&&f.version>0&&f.branches.length).map(f=>{
  let score=0;if(q.includes(f.name)&&f.name.length>2)score+=100;
  if(focusIds.some(id=>f.metricIds.includes(id)||f.branches.some(b=>b.metricIds.includes(id))))score+=20;
  for(const word of ['曝光','点击','支付','订单','新客','目标','播放','成交'])if(q.includes(word)&&(f.name+' '+f.goal).includes(word))score+=3;
  return {framework:f,score};
 }).sort((a,b)=>b.score-a.score||b.framework.version-a.framework.version||a.framework.id.localeCompare(b.framework.id));
 const selectionErrors=[...(p.configurationErrors||[])];
 if(!options.length)selectionErrors.push('当前分析范围没有可用且含诊断分支的已发布框架。');
 if(options.length>1&&options[0].score===options[1].score&&options[0].framework.sceneId!==options[1].framework.sceneId)selectionErrors.push('存在多个同等适用的诊断场景，请明确本次要解决的业务问题。');
 // Missing evidence blocks execution, not the identity of a published method.
 const ambiguous=options.length>1&&options[0].score===options[1].score&&options[0].framework.sceneId!==options[1].framework.sceneId;
 const selectedFramework=!options.length||ambiguous?normalizePublishedFramework():options[0].framework;
 const selectionReasons=selectedFramework.active?[`场域匹配：${context.fieldKey}`,`使用已发布框架 ${selectedFramework.name} v${selectedFramework.version}`,...(context.metricKey?[`重点指标匹配：${context.metricKey}`]:['按框架的经营分析路径展开'])]:[];
 return {selectedFramework,selectionReasons,selectionErrors:uniqueText(selectionErrors)};
}
function normalizePublishedFramework(f={}){
 const id=String(f.id||f.sceneId&&'framework-'+f.sceneId||'');
 return {id,sceneId:String(f.sceneId||''),name:String(f.name||'已发布诊断框架'),fieldKey:String(f.fieldKey||''),goal:String(f.goal||''),scope:String(f.scope||''),text:String(f.text||f.draftText||''),active:f.active===true,version:Number(f.version)||0,sourceWorkflow:String(f.sourceWorkflow||'人工配置'),metricIds:uniqueText(f.metricIds),actionIds:uniqueText(f.actionIds),branches:(Array.isArray(f.branches)?f.branches:[]).map((x,index)=>({id:String(x.id||id+'-branch-'+(index+1)),name:String(x.name||''),meaning:String(x.meaning||''),metricIds:uniqueText(x.metricIds),actionIds:uniqueText(x.actionIds),priority:Number(x.priority)||index+1}))};
}
function evaluateStrategies(p){
 if(p.validationErrors?.length)return {ruleResults:[],streamEvent:'AIDD_STREAM_V1\n'+JSON.stringify({kind:'findings',findings:[],errors:p.validationErrors})};
 const result=stages.validate({input:{context:p.context,config:{active:true,metrics:p.metricDefinitions,strategies:p.strategies,actions:[]},data:{mode:'demo',fieldKey:p.context.fieldKey,metrics:p.metricValues}}});
 return {ruleResults:result.ruleResults,streamEvent:'AIDD_STREAM_V1\n'+JSON.stringify({kind:'findings',findings:result.ruleResults.filter(r=>r.triggered).map(r=>({name:r.name,evidence:r.evidence})),errors:[]})};
}
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
    else if(s.execution==='模型理解'||s.decisionLevel==='evidence_required'){
      const requirements=uniqueText([...(s.requiredEvidence||[]),...(s.missingMetricOrEvidence||[])]);
      reason='本策略定义已发布，但经校验的证据判断尚未接入，无法判断；'+(requirements.length?'需核对并补齐：'+requirements.join('；')+'；':'')+'不推荐经营工具';
    }
    else if(s.businessFrameworkVersion===2&&businessInputGaps(s,p).length)reason=businessInputGaps(s,p).join('；')+'，无法判断变化';
    else {matched=judge(s.rule,p);reason=matched===null?'指标、比较基准、单位或运算条件不足':'按已发布的确定性规则判断';}
    return {strategyId:s.id,name:s.name,priority:s.priority||0,matched,applies,reason,triggered:applies&&matched!==null&&(s.actionTrigger==='mismatch'?!matched:matched),evidence:evidenceFor(s.rule,p),actionIds:s.actionIds||[]};
  });
  return p;
}
function businessInputGaps(strategy,p){
 return ruleMetricIds(strategy.rule).flatMap(id=>{
  const row=p.data.metrics.find(m=>m.id===id),def=p.config.metrics.find(m=>m.id===id),label=def?.originalName||def?.name||id,gaps=[];
  if(!def||def.unit==='待核验')return [label+'单位未核验'];
  if(!finite(row?.value))gaps.push(label+'本期值缺失');
  if(!finite(row?.previousValue))gaps.push(label+'前期值缺失');
  else if(row.previousValue<=0)gaps.push(label+'前期基数为零或负数');
  return gaps;
 });
}
function evidenceFor(rule,p) {
  const ids=[];const walk=r=>{if(r?.children)r.children.forEach(walk);else if(r){ids.push(r.metricId);if(r.rightType==='metric')ids.push(r.rightMetricId);}};walk(rule);
  return [...new Set(ids)].map(id=>{const m=(p.data?.metrics||[]).find(m=>m.id===id);return {metricId:id,label:m?.label||m?.name||id,value:finite(m?.value)?m.value:null,unit:m?.unit||'',missing:!finite(m?.value)};});
}
function finite(value) { return typeof value==='number' && Number.isFinite(value); }
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
function step(p, layer, node) { p.trace=[...(p.trace||[]),{layer,node}]; return p; }
function unpack(params) { return parse(params.input, {question:String(params.input||''),context:{demo:true}}); }
function parse(value, fallback={}) {
  if (value && typeof value==='object') return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}
function executionCheck(p){
 const errors=[...(p.configurationErrors||[]),...(p.selectionErrors||[]),...(p.planErrors||[]),...(p.dataErrors||[])];
 if(!p.context?.sellerId)errors.push('商家标识缺失');
 if(!p.framework?.active)errors.push('当前场景没有已生效的诊断配置');
 if(!p.metricValues?.length)errors.push('经营指标缺失');
 if(p.framework?.fieldKey&&p.framework.fieldKey!==p.context.fieldKey)errors.push('配置与请求场域不一致');
 return {validationErrors:[...new Set(errors)],configVersion:Number(p.framework?.version||0)};
}
const stages={validate};
const T={executionCheck,evaluateStrategies,matchFramework,selectExecutionStrategies};

return executeDiagnosis;
})();

// Existing Main_agent node 310004, SHA256 51c30ba914745de13f992ed08f53bc2ac9b1c07e7571db180403b5b2033d157b.
export const deliverMerchantRules=(()=>{
// Executable reconstruction. Business rules below are demonstration definitions,
// not a claim about the original production system's unpublished internals.
const FRONTEND = {
  merchant: 'https://ai-business-diagnosis-workflow.songge-huster.chatgpt.site/#merchant',
  aidd: 'https://ai-business-diagnosis-workflow.songge-huster.chatgpt.site/#aidd'
};
const FIELDS = {overview:'全店',live:'直播',video:'短视频',shelf:'货架',creator:'达人合作'};

function deliverDiagnosis(p) {
  const assessment = T.normalizeThink(p).assessment;
  const delivered = T.recommendActions({...p,assessment}).result;
  delivered.trace = [
    {layer:1,node:'识别任务与分析范围'},
    {layer:2,node:'经营场景 → 演示API数据、目标与画像 → 模型通用知识'},
    {layer:3,node:'已发布资产 → Think框架匹配与规则判断 → 问题说明 → Action行动承接'},
  ];
  return {result:delivered};
}
function recommendActions(p){
 const a=p.assessment||{},context=p.context||{};
 let result=stages.action({input:{question:p.question,context,intent:'diagnosis',validationErrors:a.errors||[],strategyExecuteResList:a.results||[],thinkSummary:'指标变化提示核查方向，具体经营原因尚待更多证据确认。',data:{mode:'demo',metrics:p.metricValues||[]},config:{actions:p.actionAssets||[],version:p.configVersion||1}}});
 const selected=(p.metricValues||[]).filter(m=>m.derived==='value'&&(!context.metricKey||m.metricKey===context.metricKey));
 const evidence=selected.map(m=>({metricId:m.id,label:m.label||m.name,value:m.value,unit:m.unit||'',previousValue:m.previousValue,change:m.previousValue?+(100*(m.value-m.previousValue)/m.previousValue).toFixed(1):null}));
 result.evidence=[...new Map([...evidence,...result.evidence].map(m=>[m.metricId,m])).values()];
 result.problemBreakdown=a.problemBreakdown||[];
 result.metricAnalysis=evidence;
 result.goal=p.goal||{};result.fieldBreakdown=p.fieldBreakdown||[];
 if(p.selectedFramework)result.execution={frameworkId:p.selectedFramework.id,frameworkVersion:p.selectedFramework.version,frameworkName:p.selectedFramework.name,sourceWorkflow:p.selectedFramework.sourceWorkflow,selectionReasons:p.selectionReasons||[],diagnosisPlan:p.diagnosisPlan||{},selectedStrategyIds:p.selectedStrategyIds||[]};
 result.trace=[{layer:1,node:'确认任务与分析范围'},{layer:2,node:'调用AIDD_Execution'},{layer:3,node:'读取已发布资产 → 匹配框架 → 制定诊断计划 → 选择策略 → 按需取数 → 验证与解释 → 行动建议'}];
 if(['success','partial'].includes(result.status)){
  result=stages.final({input:result});
  if(context.metricKey&&evidence.length){const m=evidence[0];result.answer=`【演示样例】${m.label}：${m.value}${m.unit}；对比值${m.previousValue??'未提供'}${m.unit}${m.change===null?'':`，环比${m.change}%`}。\n`+result.answer.replace('【演示样例】','');}
  if(p.goal&&Number.isFinite(p.goal.target))result.answer+=`\n目标完成率${p.goal.rate}%，已完成${p.goal.actual}元，目标${p.goal.target}元，差额${p.goal.gap}元。`;
  if(context.fieldKey==='overview'&&p.fieldBreakdown?.length){const sorted=[...p.fieldBreakdown].sort((x,y)=>y.gap-x.gap);result.answer+=`\n各场域目标差额：${sorted.map(x=>`${x.name}${x.gap}元`).join('；')}。建议优先核查${sorted[0].name}的经营环节。`;}
  result.missing=[...new Set([...result.missing,'当前使用合成演示数据；商品、内容和流量明细未接入，具体经营根因尚未验证。'])];
 }
 return {result};
}
function final(params) {
  const p=unpack(params);step(p,1,'返回商家');
  if(p.branch==='diagnosis'&&['success','partial'].includes(p.status)&&p.diagnosis?.length){
    const label=p.dataMode==='demo'?'【演示样例】':'';
    const evidence=(p.evidence||[]).map(m=>String(m.label)+'：'+(finite(m.value)?m.value+String(m.unit||''):'无法判断')).join('；');
    const actions=(p.actions||[]).map(a=>a.name).join('、');
    p.answer=label+'当前优先关注：'+p.diagnosis.map(d=>d.name).join('、')+'。'+(evidence?'\n依据：'+evidence+'。':'')+(actions?'\n建议核查：'+actions+'。':'')+'\n这些证据定位到异常环节，尚不能确认价格、选品或讲解等具体原因。';
  }
  return p;
}
function finite(value) { return typeof value==='number' && Number.isFinite(value); }
function step(p, layer, node) { p.trace=[...(p.trace||[]),{layer,node}]; return p; }
function unpack(params) { return parse(params.input, {question:String(params.input||''),context:{demo:true}}); }
function parse(value, fallback={}) {
  if (value && typeof value==='object') return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}
function action(params) {
  const p=unpack(params);step(p,3,'Action执行');
  if(p.validationErrors?.length)return reply(p,'当前无法执行诊断：'+p.validationErrors.join('；')+'。请在AIDD后台检查生效配置和数据。',{status:'missing_data',missing:p.validationErrors});
  if(p.strategyExecuteResList?.length&&p.strategyExecuteResList.every(r=>!r.applies))return reply(p,'当前商家不在已发布策略的适用标签范围内，未执行异常判断。',{status:'not_applicable',strategyExecuteResList:p.strategyExecuteResList});
  const findings=(p.strategyExecuteResList||[]).filter(r=>r.triggered).sort((a,b)=>a.priority-b.priority);
  const unknown=(p.strategyExecuteResList||[]).filter(r=>r.applies&&r.matched===null);
  const actions=[];
  for(const f of findings)for(const id of f.actionIds){
    if(actions.some(a=>a.id===id))continue;
    const a=(p.config.actions||[]).find(a=>a.id===id);
    if(!a)continue;
    if(Array.isArray(a.requiredTags)&&!a.requiredTags.every(t=>(p.context.tags||[]).includes(t)))continue;
    if((p.context.excludedActionIds||[]).includes(id)||(p.context.completedActionIds||[]).includes(id))continue;
    actions.push({id,name:a.name,description:a.subtitle||a.description||'',pcLink:safeLink(a.pcLink),mobileLink:safeLink(a.mobileLink),execution:'user_confirmed_navigation'});
  }
  const evidence=[...new Map(findings.flatMap(f=>f.evidence).map(e=>[e.metricId,e])).values()];
  const prefix=p.data?.mode==='demo'?'基于演示样例数据，':'';
  const answer=findings.length?prefix+'优先关注：'+findings.map(f=>f.name).join('、')+'。'+(p.thinkSummary||'指标只能定位异常环节，具体原因需结合商品、内容与经营记录核查。'):prefix+'当前已发布规则未命中优先异常。'+(unknown.length?'仍有'+unknown.length+'条策略因信息不足无法判断。':'建议继续观察同口径数据。');
  return reply(p,answer,{status:!findings.length&&unknown.length?'partial':'success',diagnosis:findings,evidence,actions,missing:unknown.map(r=>r.name+'：'+r.reason),configVersion:p.config.version,strategyExecuteResList:p.strategyExecuteResList});
}
function safeLink(value) { try { const u=new URL(value);return u.protocol==='https:'?u.href:''; } catch { return ''; } }
function reply(p, answer, extra={}) {
  return {schemaVersion:1,status:'success',branch:p.intent||'diagnosis',answer,context:p.context||{},dataMode:p.data?.mode||'demo',
    evidence:[],diagnosis:[],actions:[],missing:[],trace:p.trace||[],frontend:FRONTEND,...extra};
}
function normalizeThink(p){
 const publicText=String(p.explanationText||'').slice(0,6000),notes=Array.isArray(p.explanations)?p.explanations:[];
 if(publicText)for(const r of p.ruleResults||[]){const section=publicText.split('### '+r.name+'\n')[1]?.split('### ')[0]?.trim();if(section)notes.push({strategyId:r.strategyId,explanation:section.slice(0,600)});}
 return {assessment:{summary:String(p.summary||publicText),problemBreakdown:(p.problemBreakdown||(p.ruleResults||[]).filter(r=>r.triggered).map(r=>r.name)).filter(x=>typeof x==='string').slice(0,6),results:(p.ruleResults||[]).map(r=>({...r,explanation:String(notes.find(n=>n.strategyId===r.strategyId)?.explanation||r.reason).slice(0,600)})),errors:p.validationErrors||[]}};
}
const stages={action,final};
const T={normalizeThink,recommendActions};

return deliverDiagnosis;
})();
