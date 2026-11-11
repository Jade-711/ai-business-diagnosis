import {merchantPublishedResult} from '../worker/merchant-fast-path.js';
import {merchantRankIssues} from './merchant-priority.js';
import {buildAssistantGrounding} from './assistant-grounding.js';
import {validateBusinessSummary} from './business-summary.js';

// Preparation runs only in the Workflow's calculation tool; finalization runs in Coze.
export function prepareWorkflowDiagnosis({question,context,configuration,data,excludeStrategyIds=[]}){
 const key=context.fieldKey+':'+context.period;
 const execution=merchantPublishedResult({question,sellerId:context.sellerId,pageContext:context,businessEvidence:data.businessEvidence},{[key]:{config:configuration,data}},{intent:/目标|达标|达成|补差|缺口/.test(question)?'goal':'diagnosis',resolvedContext:context,allowContent:true});
 if(!execution)throw new Error('本次工作流未取得可执行的同口径配置与数据');
 const result=execution.result,definitions=configuration.metrics||[],excluded=new Set(excludeStrategyIds);
 // The diagnosis plan may need only a subset of metrics. The dashboard summary
 // also needs the current period's other published numeric facts, without another
 // request or another model call. Keep these separate from diagnostic evidence.
 if(data.fieldKey===context.fieldKey&&data.period===context.period){
  const allowed=new Map([...definitions,...(configuration.observationMetricDefinitions||[])].filter(m=>!['String','Image'].includes(m.dataType)&&m.unit!=='待核验').map(m=>[m.id,m]));
  const overviewMetrics=[...(data.metrics||[]),...(data.observationMetrics||[])].filter(m=>allowed.has(m.id)&&m.derived==='value').map(m=>({metricId:m.id,label:allowed.get(m.id).originalName||m.label,unit:allowed.get(m.id).unit,value:!m.missingCurrent&&Number.isFinite(m.value)?m.value:null,previousValue:!m.missingPrevious&&Number.isFinite(m.previousValue)?m.previousValue:null}));
  result.metricAnalysis=[...new Map([...overviewMetrics,...(result.metricAnalysis||[])].map(m=>[m.metricId,m])).values()];
 }
 const goalMode=/目标|达标|达成|补差|缺口/.test(question);
 const includeGoal=goalMode||/经营表现|经营情况|经营小结|整体经营|总体经营/.test(question);
 const scopeActionIds=new Set((configuration.frameworkCandidates||[]).filter(f=>result.coverage?.frameworks?.some(x=>x.id===f.id)).flatMap(f=>f.actionIds||[]));
 const goalActions=goalMode&&['success','partial'].includes(result.status)?(configuration.actions||[]).filter(a=>a.id&&a.name&&scopeActionIds.has(a.id)).slice(0,8):[];
 result.actions=[...new Map([...(result.actions||[]),...goalActions].map(a=>[a.id,a])).values()];
 const ranked=merchantRankIssues(result.diagnosis||[],result,definitions).filter(x=>!excluded.has(x.id));
 const selected=ranked.slice(0,3),remaining=ranked.slice(3);
 const selectedFindings=selected.map(x=>({...x.finding,priorityReason:x.reason}));
 const goal=result.goal||{},validGoal=Number.isFinite(goal.actual)&&Number.isFinite(goal.target)&&goal.target>0;
 if(validGoal)result.goal={...goal,rate:100*goal.actual/goal.target,gap:Math.max(0,goal.target-goal.actual),excess:Math.max(0,goal.actual-goal.target)};
 const grounding=buildAssistantGrounding({...result,diagnosis:selectedFindings},configuration,data);
 const materials={question,grounding,observations:result.metricAnalysis||[],businessEvidence:data.businessEvidence||null,frameworks:(configuration.frameworkCandidates||[]).filter(f=>result.coverage?.frameworks?.some(x=>x.id===f.id)).map(f=>({name:f.name,goal:f.goal,decomposition:f.decomposition||[],drilldown:f.drilldown||'',businessBoundary:f.businessBoundary||'',missingMetricOrEvidence:f.missingMetricOrEvidence||[],branches:f.branches})),context:result.context,dataMode:'demo',scopeErrors:result.missing||[],goal:validGoal&&includeGoal?result.goal:null,fieldBreakdown:includeGoal?result.fieldBreakdown||[]:[],issues:selectedFindings.map(f=>{
  const s=(configuration.strategies||[]).find(s=>s.id===f.strategyId),a=f.analysis||{};
  return {strategyId:f.strategyId,name:f.name,priorityReason:f.priorityReason,ruleMeaning:s?.businessMeaning||'',decisionLevel:s?.decisionLevel||'metric_signal',confirmationRule:s?.confirmationRule||'',missingMetricOrEvidence:grounding.issues.find(g=>g.strategyId===f.strategyId)?.requirements||[],evidence:f.evidence,calculations:a.calculations||[],facts:a.facts||[],limitations:a.limitation||'',actions:(f.actionIds||[]).map(id=>result.actions.find(a=>a.id===id)).filter(Boolean).map(a=>({id:a.id,name:a.name,capability:a.description||'',evidenceSource:'未声明的经营明细须先人工取得，不能声称由此工具提供。',purpose:s?.actionSubtitles?.[a.id]||a.description||'',instruction:s?.actionMappings?.find(x=>x.id===a.id)?.instruction||s?.actionSubtitles?.[a.id]||'',verification:s?.actionMappings?.find(x=>x.id===a.id)?.verification||''}))};
 }),goalActions:goalActions.map(a=>({id:a.id,name:a.name,capability:a.description||'',purpose:a.description||'',instruction:(configuration.strategies||[]).flatMap(s=>s.actionMappings||[]).filter(m=>m.id===a.id).map(m=>m.instruction).filter(Boolean).join('；')||'先核实对象级问题；只在工具声明能力内操作。',verification:'沿用相同周期和归因，复看指标、成交、退款与成本。'}))};
 // Do not send all 18 findings through a model when only three are actionable.
 return {result:{...result,diagnosis:selectedFindings,explanationSource:'workflow_model',workflowContract:1,pendingIssues:remaining.map(x=>({strategyId:x.id,name:x.finding.name})),handledStrategyIds:[...excluded]},materials};
}

function assertsRefundIncrease(text){
 for(const match of text.matchAll(/(退款金额|退款订单数|退款量).{0,6}(增加|上升|上涨)/g)){
  if(/是否|会否/.test(match[0]))continue;
  const prefix=text.slice(0,match.index).split(/[。；;，]/).at(-1);
  if(/(?:不能|无法|尚不能|尚未|不代表|不等于|不等同于|不说明|未)(?:据此|直接|证明|认定|说明|判断|推断|等同于|视为|说|确定|证实|确认)*$/.test(prefix))continue;
  return true;
 }
 return false;
}
function assertsUnsupportedExposureCause(text){
 return String(text).split(/[。；;！!\n]/).some(sentence=>{
  const clauses=sentence.split('，');
  return clauses.some((clause,i)=>{
   if(/不能|无法|尚不能|尚未|未证实|未确认|待验证|待核|可能|假设|若|如果/.test(clause))return false;
   const scope=(clauses[i-1]||'')+'，'+clause;
   return /付费|投放|停投|预算/.test(scope)&&/导致|造成|引起|使得|拉低/.test(clause)&&/总|整体|自然/.test(scope)
    ||/自然(?:流量|曝光|人数|用户).{0,12}(?:枯竭|下降|减少|回落|下滑)/.test(clause);
  });
 });
}
function unsupportedBusinessClaims(text){
 const errors=[];
 for(const clause of String(text).split(/[。；;，！!\n]/)){
  if(/不能|无法|不代表|不等于|不证明|不说明|不认定|未证实|未确认|待核|待验证|尚待|可能|假设|是否|需核|须核|尚不能|若|如果/.test(clause))continue;
  if(/未影响|没有影响|不影响|不会影响|未造成|没有造成/.test(clause))errors.push('指标未同步变化不能证明没有业务影响');
  if(/缺播|漏播|取消(?:了)?(?:直播|场次)|停投|预算不足|自然流量枯竭|库存不足|缺货导致|选品错误|标题模糊|主图不清|内容质量差|人群错配|佣金过高/.test(clause))errors.push('汇总指标不能确认经营对象的具体原因');
  if(/内容|标题|主图|素材|主播|话术|库存|价格|优惠|投放|预算|流量来源|渠道|粉丝|排期|排品|供给不足/.test(clause)&&/导致|造成|引起|使得|是.{0,6}(?:根因|原因)/.test(clause))errors.push('缺少对象明细或对照，经营因果尚未证实');
  if(/显著恶化|显著下降|严重异常|低于正常|低于行业|已确认根因/.test(clause))errors.push('未核定有效样本、业务阈值或根因证据');
 }
 return [...new Set(errors)];
}
function unsupportedToolUse(text,action){
 const name=action?.name||'';
 const direct=new RegExp('(?:通过|使用|借助|打开|进入|在)'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[^。；;，]*');
 const usage=String(text).match(direct)?.[0]||'';
 if(name==='商品列表'&&/退款(?:明细|原因|批次|观察窗口|统计)|渠道流量|来源报表|归因报表/.test(usage))return '商品列表只声明商品信息管理，不能声称提供退款或渠道归因明细';
 if(name==='快分销'&&/结算批次|结算状态|结算明细|佣金结算/.test(usage))return '快分销未声明结算核验功能，须先人工取得结算及订单记录';
 return '';
}
export function finalizeWorkflowDiagnosis(calculation,model={}){
 const base=calculation.result,materials=calculation.materials,errors=[],clean=x=>typeof x==='string'?x.trim().replace(/[，；](?:符合|命中)[^。；]*(?:规则|策略|阈值)[^。；]*/g,''):'';
 const goalMode=/目标|达标|达成|补差|缺口/.test(materials.question);
 // A specific issue is delivered through its checked model judgment. Do not
 // attach a second free-form overview with unrelated targets or comparisons.
 const issueOnly=!goalMode&&!materials.summaryRequired&&base.diagnosis.length>0;
 const displayedOverview=issueOnly?'':clean(model.summary);
 const summaryErrors=materials.summaryRequired&&!goalMode&&base.diagnosis.length?validateBusinessSummary(clean(model.summary),materials.businessOverview):[];
 errors.push(...summaryErrors);
 const records=Array.isArray(model.explanations)?model.explanations:[];
 const findings=(goalMode?[]:base.diagnosis).map(f=>{
  const errorStart=errors.length;
  const m=records.find(x=>x.strategyId===f.strategyId),available=new Set(f.actionIds||[]);
  if(!m||!clean(m.judgment)||!clean(m.basis)||!clean(m.uncertainty))errors.push((f.name||f.strategyId)+'：工作流模型返回的原因依据不完整');
  const actions=(Array.isArray(m?.actions)?m.actions:[]).filter(a=>available.has(a.actionId)&&clean(a.text)&&clean(a.verification));
  if(m&&((m.actions||[]).length!==actions.length||!actions.length))errors.push((f.name||f.strategyId)+'：行动引用或验证方法不完整');
  const claims=clean(m?.judgment)+'；'+clean(m?.basis),facts=(materials.issues.find(i=>i.strategyId===f.strategyId)?.facts||[]).join('；');
  if(records.filter(x=>x.strategyId===f.strategyId).length!==1)errors.push((f.name||f.strategyId)+'：问题说明缺失或重复');
  errors.push(...unsupportedBusinessClaims(claims+'；'+displayedOverview).map(e=>(f.name||f.strategyId)+'：'+e));
  for(const a of actions){const asset=materials.issues.find(i=>i.strategyId===f.strategyId)?.actions.find(x=>x.id===a.actionId),error=unsupportedToolUse(a.text,asset);if(error)errors.push((f.name||f.strategyId)+'：'+error);}
  if(/^research-strategy-20-/.test(f.strategyId)&&assertsUnsupportedExposureCause(claims+'；'+displayedOverview))errors.push((f.name||f.strategyId)+'：总覆盖与付费覆盖同步变化只确认相关，不能写成付费变化导致整体曝光下降，也不能认定自然流量下降；请保留人均次数的算术关系并明确根因待核。');
  if(/^research-strategy-20-/.test(f.strategyId)&&(claims+'；'+displayedOverview).split(/[。；;\n]/).some(s=>!/未提供|没有|缺少|无法判断|不能判断|尚不能判断/.test(s)&&/曝光.{0,8}(?:未达成目标|未完成目标|未达标|达成目标|已达标|目标完成)/.test(s)))errors.push('本次未提供曝光目标，不能把成交金额目标当作曝光目标或断言曝光未达标。');
  if(/每单成交金额/.test(facts)&&/客单价/.test(claims))errors.push((f.name||f.strategyId)+'：每单成交金额不能误称为按买家人数计算的客单价');
  if(/动销/.test(f.name)&&/(原有|原|同一批).{0,8}(动销商品|成交商品)/.test(claims))errors.push((f.name||f.strategyId)+'：缺少商品集合明细，不能从比例推断同一批商品的变化');
  if(/退款率/.test(f.name)&&assertsRefundIncrease(claims))errors.push((f.name||f.strategyId)+'：退款比例上升不证明退款绝对量增加');
  if(actions.some(a=>/(准备发布|发布新品|新增商品|补充新品|立即投放|增加预算|加投|下架商品|调整价格|调整排期)/.test(a.text)&&!/(若|如果|确认.{0,30}后|核实.{0,30}后|仅当|满足)/.test(a.text)))errors.push((f.name||f.strategyId)+'：调整经营动作前须说明核查对象及确认条件，不能未经验证直接发布、调整或加投');
  // Failed repair must never leak the rejected judgment or tool recommendation.
  const valid=errors.length===errorStart,safeJudgment='已确认指标变化；原因说明未通过证据核验，具体经营原因暂无法确认。';
  return {...f,evidenceDetail:JSON.stringify({facts:f.analysis?.facts||[],calculations:f.analysis?.calculations||[],limitation:f.analysis?.limitation||''}),explanation:valid?clean(m?.judgment):safeJudgment,reasonItems:valid?[{label:'判断',text:clean(m.judgment)},{label:'依据',text:clean(m.basis)},{label:'待验证',text:clean(m.uncertainty)}]:[{label:'判断',text:safeJudgment},{label:'依据',text:facts}],actionItems:valid?actions.map(a=>({label:'执行',text:clean(a.text),actionId:a.actionId,verification:clean(a.verification)})):[],actionIds:valid?[...new Set(actions.map(a=>a.actionId))]:[],uncertainty:valid?clean(m?.uncertainty):'需补齐同对象经营明细或重新核验说明，当前不推荐经营工具。'};
 });
 if(records.some(m=>!base.diagnosis.some(f=>f.strategyId===m.strategyId)))errors.push('模型返回了本次未选择的问题，已排除');
 const g=model.goalDiagnosis||{},goal=base.goal;
 const goalActionIds=new Set(materials.goalActions.map(a=>a.id));
 const goalPlans=(Array.isArray(g.plans)?g.plans:[]).filter(p=>clean(p.title)&&clean(p.detail)&&clean(p.verification)&&goalActionIds.has(p.actionId));
 if(goalMode&&goal?.target>0&&(!clean(g.judgment)||!clean(g.basis)||!clean(g.uncertainty)||!goalPlans.length))errors.push('目标诊断的模型判断、依据或行动不完整');
 if(goalMode)errors.push(...unsupportedBusinessClaims(clean(g.judgment)+'；'+clean(g.basis)+'；'+displayedOverview));
 const goalDiagnosis=goalMode&&goal?.target>0&&errors.length===0?{judgment:clean(g.judgment),basis:clean(g.basis),uncertainty:clean(g.uncertainty),plans:goalPlans}:undefined;
 const status=errors.length?'partial':base.status;
 const noIssues=!goalMode&&!base.diagnosis.length,blocked=noIssues&&(base.missing||[]).filter(x=>!/当前使用合成演示数据/.test(x));
 const answer=noIssues?(blocked.length?'本场景暂无法完成判断：'+blocked.join('；')+'。当前不确认具体经营原因，也不推荐经营工具。':'本次可执行规则未发现对应变化信号；这不代表经营完全健康，具体原因仍需对象明细和有效样本。'):issueOnly?findings.map(f=>f.explanation).filter(Boolean).join('；'):clean(model.summary)||base.answer;
 const actionIds=new Set([...findings.flatMap(f=>f.actionIds),...(goalDiagnosis?.plans||[]).map(p=>p.actionId)]);
 return {...base,status,diagnosis:findings,goalDiagnosis,actions:(base.actions||[]).filter(a=>actionIds.has(a.id)),answer:!noIssues&&!issueOnly&&errors.length?'本次经营说明尚未通过完整证据核验，请补齐资料后重新诊断。':answer,missing:[...new Set([...(base.missing||[]),...errors])],quality:{validated:errors.length===0,errors},workflow:{contract:1,revision:'diagnosis-v4-evidence-boundaries',explanationOrigin:noIssues?'evidence_gate':errors.length?'quality_gate':'model_node',modelOutputReceived:typeof model._modelOutputReceived==='boolean'?model._modelOutputReceived:typeof model.summary==='string'&&Array.isArray(model.explanations),validated:errors.length===0}};
}
