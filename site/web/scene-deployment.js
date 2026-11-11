
const SCENE_ACCEPTANCE_TEXT_REPAIRS=[
 ['先核对相同支付日的成交批次、退款观察窗口及商品退款原因，定位新增退款贡献。','先人工取得同支付批次及观察窗口的退款明细；若证实商品说明与实际交付不一致，再通过商品列表更正说明。'],
 ['先匹配结算批次与成交订单，再检查费率变更和结算状态。','先人工取得结算批次、对应成交订单及费率版本；若证实合作匹配问题，再用快分销调整达人与商品匹配，不把结算背离当作佣金过高。'],
 ['先匹配结算批次与订单再核费率。','先人工取得结算与对应订单、核对费率版本；若确认达人商品匹配问题，再通过快分销调整匹配。'],
 ['优先核对取消、缩短或无效场次及其商品准备。','仅确认实际场次与成交同步减少；取消、缩短或无效场次及其原因须核对计划与实际记录。'],
 ['核对新增介入订单及处理记录，确认超时或沟通断点后逐单闭环。','先核对两期争议订单及介入记录；若确认超时或沟通断点，再通过售后工作台逐单处理，不由比率上升推断介入量增加。'],
 ['按高金额退款订单核实品质、承诺及履约原因。','先核对同批次退款订单金额分布；若证实风险集中于高金额订单，再用售后工作台处理对应品质、承诺或履约问题。'],
 ['归集低金额退款原因及商品批次，核实后处理。','先核对同批次退款订单金额分布；若证实风险集中于低金额订单，再用售后工作台按实际原因处理。'],
];

// Apply only reviewed textual corrections. Keep IDs, user assets and edits;
// retain the original affected definitions rather than rebuilding the catalog.
function repairReviewedSceneCatalog(input){
 if(input?.businessAcceptanceRepairVersion===1)return input;
 const data=JSON.parse(JSON.stringify(input));
 const patch=value=>{
  if(typeof value==='string')return SCENE_ACCEPTANCE_TEXT_REPAIRS.reduce((s,[before,after])=>s.replaceAll(before,after),value);
  if(Array.isArray(value))return value.map(patch);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='history'?v:patch(v)]));
  return value;
 };
 for(const kind of ['strategies','frameworks'])data[kind]=(data[kind]||[]).map(asset=>{
  const next=patch(asset);
  if(JSON.stringify(next)!==JSON.stringify(asset))next.history=[...(asset.history||[]),{revisionReason:'全场景验收：证据与工具能力边界修正',textChanges:SCENE_ACCEPTANCE_TEXT_REPAIRS.filter(([before])=>JSON.stringify(asset).includes(before)).map(([before,after])=>({before,after}))}];
  return next;
 });
 data.published=patch(data.published);
 const normalizeFrame=frame=>{
  if(frame.sceneId==='research-scene-011'){
   for(const branch of frame.branches||[])if(branch.name==='缺播')branch.name='开播规模';
   for(const key of ['prompt','draftText','text'])if(frame[key])frame[key]=frame[key].replace('1. 缺播\n','1. 开播规模\n');
  }
  return frame;
 };
 data.frameworks=data.frameworks.map(normalizeFrame);
 for(const publication of Object.values(data.published||{}))for(const snapshot of Object.values(publication.periods||{})){
  snapshot.frameworkDefinition=normalizeFrame(snapshot.frameworkDefinition);
  snapshot.framework=snapshot.frameworkDefinition.text;
 }
 for(const s of data.strategies)if(s.id==='research-strategy-11-1')s.direction='开播规模';
 for(const publication of Object.values(data.published||{}))for(const snapshot of Object.values(publication.periods||{}))for(const s of snapshot.strategies||[])if(s.id==='research-strategy-11-1')s.direction='开播规模';
 data.businessAcceptanceRepairVersion=1;
 return data;
}

// Only assembles individually authored profiles; missing business content fails.
const buildAllSceneDeployment = (() => {
 const revision='syt-business-framework-20261103-v4',stamp='2026/11/03',copy=x=>JSON.parse(JSON.stringify(x)),unique=xs=>[...new Set(xs)];
 return input=>{
  const data=copy(input);if(data.businessFrameworkVersion===2)return data;
  const scenes=new Map(data.scenes.map(s=>[s.name,s])),metrics=new Map(data.metrics.map(m=>[m.sourceKey+'|'+m.originalName,m])),idsMap=new Map(data.metrics.map(m=>[m.id,m]));
  const metric=(source,name)=>{const m=metrics.get(source+'|'+name);if(!m)throw Error('Missing metric: '+source+'/'+name);return m;};
  const ruleIds=r=>r.children?unique(r.children.flatMap(ruleIds)):unique([r.metricId,r.rightType==='metric'?r.rightMetricId:''].filter(Boolean));
  const compile=r=>r.conditions?{join:r.join,children:r.conditions.map(compile)}:{metricId:metric(r[0],r[1]).id,op:r[2],rightType:'metric',rightMetricId:metric(r[0],r[1]).id,leftTransform:'value',leftCalc:'none',leftNumber:1,rightTransform:'previous',rightCalc:'*',factor:1};
  const describe=r=>r.children?'('+r.children.map(describe).join(r.join==='OR'?' OR ':' AND ')+')':idsMap.get(r.metricId).originalName+'本期 '+r.op+' '+idsMap.get(r.rightMetricId).originalName+'前期';
  const oldFrames=new Map(data.frameworks.filter(f=>f.status==='生效中').map(f=>[f.sceneId,f])),oldStrategies=new Map(data.strategies.map(s=>[s.id,s]));
  data.frameworks=[];data.strategies=[];data.groups=[];data.published={};
  data.catalog.sourceRevision=data.catalog.sourceRevision||data.catalogRevision;data.catalogRevision=revision;
  for(const scene of data.scenes){
   const spec=BUSINESS_SCENE_SPECS[scene.name];if(!spec)throw Error('Business profile missing: '+scene.name);
   const number=Number(scene.id.split('-').at(-1)),prefix=String(number).padStart(2,'0'),frameId='research-framework-'+prefix,groupId='research-group-'+number,old=oldFrames.get(scene.id),version=(old?.version||0)+1;
   scene.requiredEvidence=copy(spec.requiredEvidence||(scene.name==='货架-商品供给'?spec.gaps:[]));
   Object.assign(scene,{executionScope:'deepest_explicit_scene',catalogRevision:revision,version:(scene.version||1)+1,updatedAt:stamp,goal:spec.decomposition[0]});
   const strategies=spec.issues.map((s,index)=>{
    const rule=compile(s.rule),id='research-strategy-'+prefix+'-'+(s.slot||index+1),metricIds=ruleIds(rule),diagnosticIds=(s.diagnosticRefs||[]).map(ref=>metric(...ref).id);
    for(const ref of [...metricIds,...diagnosticIds])if(!scene.metricIds.includes(ref))scene.metricIds.push(ref);
    const mappings=s.actions.map(([name,instruction])=>{
     const a=data.actions.find(a=>a.name===name);if(!a||!scene.actionIds.includes(a.id))throw Error(scene.name+': unbound action '+name);
     return {id:a.id,instruction,verification:'保持对象、周期和来源可比，复核'+metricIds.map(id=>idsMap.get(id).originalName).join('、')+'；同时检查成交、退款及成本。'};
    });
    const unverified=metricIds.filter(id=>idsMap.get(id).unit==='待核验').map(id=>idsMap.get(id).originalName+'单位待核验');
    const missing=unique([...(s.missing||[]),...spec.gaps,...unverified]),requiredEvidence=s.blocked?unique([...(spec.requiredEvidence||[]),...(s.missing||[])]):[];
    const confirmation=s.confirmationRule||(s.blocked?'补齐证据并核实：'+missing.join('；'):'仅确认数值变化；具体原因须另取经营对象明细验证。');
    const item={id,sceneId:scene.id,groupId,group:scene.name,name:s.name,description:s.meaning,businessMeaning:s.meaning,direction:s.direction,problemId:scene.id+'-problem-'+(index+1),problemDefinition:s.name,
     metricIds,diagnosticMetricIds:unique([...metricIds,...diagnosticIds]),actionIds:mappings.map(a=>a.id),actionSubtitles:Object.fromEntries(mappings.map(a=>[a.id,a.instruction])),actionMappings:mappings,
     execution:s.blocked?'模型理解':'指标规则',rule,metricRuleText:describe(rule),confirmationRule:confirmation,contentObjects:s.blocked?copy(requiredEvidence):[],contentPrompt:s.blocked?'指标仅作核查入口。确认条件：'+confirmation+'。核查项：'+(s.evidenceChecks||missing).join('；')+'。证据不足返回无法判断；不得由汇总波动认定本问题。':'',
     enabled:true,status:'生效中',executionReadiness:s.blocked?'待补证据与判断执行器':unverified.length?'指标单位待核验':'数值变化可判，根因待明细',decisionLevel:s.blocked?'evidence_required':s.signalType==='结构观察'?'observation':'metric_signal',
     evidenceCategory:s.evidenceCategory||'',evidenceChecks:s.evidenceChecks||[],requiredEvidence,missingMetricOrEvidence:missing,evidenceDecision:s.evidenceCategory?{field:'category',equals:s.evidenceCategory,requiresValidatedExecutor:true}:null,
     exclusiveGroup:s.exclusiveGroup?scene.id+':'+s.exclusiveGroup:'',exclusionPolicy:s.exclusiveGroup==='object_defect'?'同对象先判第一优先缺陷；其不存在才判第二类，指标不代替内容分类。':'同组条件互斥；独立问题按对象、链路和损失去重。',issueKey:scene.id+':'+s.direction,handoffSceneId:s.handoff?scenes.get(s.handoff)?.id:'',
     signalType:s.signalType||'变化线索',priority:index+1,actionTrigger:'match',frameworkId:frameId,frameworkVersion:version,merchantScope:scene.merchantScope,version:(oldStrategies.get(id)?.version||0)+1,production:'逐场景业务重整',createdAt:oldStrategies.get(id)?.createdAt||stamp,updatedAt:stamp,
     reviewStatus:'业务定义已梳理；合成边界校验，不代表真实效果',thresholdBasis:'昨日对比前一完整日；近7天对比前一个完整7天。仅识别变化，不把任意下降定性为统计异常；样本量和业务阈值待核定。',exceptionHandling:'缺失、非数值、单位未核验、前期基数为零、周期不完整或归因不可比时返回无法判断；证据执行器未接入时不触发原因及工具建议。',
     pendingItems:unique([...missing,'真实取数与经营样本验证',...(s.blocked?['同对象证据采集与经校验的判断执行器']:['最小有效样本与业务阈值'])]),dataRequirements:{sameSeller:true,sameAttribution:true,completePeriods:true,sameTimezone:true,requirePrevious:true,positivePrevious:true},businessFrameworkVersion:2,catalogRevision:revision,executionScope:'explicit_scene_only',ownershipKey:scene.id,
     ...(s.diagnosticKind?{diagnosticKind:s.diagnosticKind,displayMetricIds:diagnosticIds.filter(id=>id!==metric('live','观看-成交率(人数)').id)}:{}),...(s.suppressesSlots?{suppressesStrategyIds:s.suppressesSlots.map(n=>'research-strategy-'+prefix+'-'+n)}:{}),
    };
    const oldStrategy=oldStrategies.get(id);if(oldStrategy)item.history=[...(oldStrategy.history||[]),{...copy(oldStrategy),history:undefined}];
    if(number===5&&index>0)item.suppressesStrategyIds=['research-strategy-05-1'];
    item.protocol={sceneId:scene.id,strategyCode:id,groupId,execution:item.execution,businessMeaning:item.businessMeaning,rule:copy(rule),actionTrigger:'match',actions:mappings.map(a=>({id:a.id,subtitle:a.instruction,verification:a.verification})),confirmationRule:confirmation,requiredEvidence,decisionLevel:item.decisionLevel,exclusiveGroup:item.exclusiveGroup,exclusionPolicy:item.exclusionPolicy,missingMetricOrEvidence:missing,reviewStatus:item.reviewStatus,thresholdBasis:item.thresholdBasis,exceptionHandling:item.exceptionHandling,pendingItems:item.pendingItems};
    return item;
   });
   const branches=unique(strategies.map(s=>s.direction)).map((name,index)=>{const rows=strategies.filter(s=>s.direction===name);return {id:frameId+'-branch-'+(index+1),name,meaning:rows.map(s=>s.businessMeaning).join('；'),metricIds:unique(rows.flatMap(s=>s.diagnosticMetricIds)),actionIds:unique(rows.flatMap(s=>s.actionIds)),priority:index+1,problemIds:rows.map(s=>s.problemId),minimumProblems:rows.map(s=>s.name),requiredEvidence:unique(rows.flatMap(s=>s.requiredEvidence))};});
   const used=new Set(branches.flatMap(b=>b.metricIds));for(const id of scene.metricIds)if(!used.has(id))branches[0].metricIds.push(id);
   const lines=['一、指标拆解','1. 基础拆解',...spec.decomposition.map((t,i)=>(i+1)+') '+t),'2. 下钻顺序（漏斗）',spec.drilldown,'3. 判断前提','商家、对象、完整周期、渠道、归因与去重口径一致。零基数、样本不足或不可比时不作异常定性；真实取数未接入，演示值仅作合成校验。','','二、诊断方向'];
   for(const [i,b] of branches.entries())lines.push((i+1)+'. '+b.name,'最小颗粒度问题：'+b.minimumProblems.join('；'),'关联指标：'+b.metricIds.map(id=>idsMap.get(id).originalName).join('、'),'核查方法：'+b.meaning,'证据要求：'+(b.requiredEvidence.length?b.requiredEvidence.join('；'):'先确认同口径指标变化，再补齐商品、来源及经营对象明细，不直接认定根因。'));
   lines.push('','三、典型问题总结 + 行动建议映射 → 策略');
   for(const [i,s] of strategies.entries())lines.push((i+1)+'. 策略名：'+s.name,'问题定义：'+s.businessMeaning,'指标规则：'+s.metricRuleText+(s.decisionLevel==='evidence_required'?'（仅为核查入口，不能据此命中具体原因）':'（变化信号，不代表统计异常）'),'确认条件：'+s.confirmationRule,'行动建议映射：'+s.actionMappings.map(a=>data.actions.find(x=>x.id===a.id).name+' → '+a.instruction+' 验证：'+a.verification).join('；'),'缺少指标或证据：'+(s.missingMetricOrEvidence.join('；')||'真实取数、对象明细、最小样本及业务阈值待接入和核定。'),'执行状态：定义已发布；'+s.executionReadiness,'去重边界：'+s.exclusionPolicy+(s.handoffSceneId?' 转交'+spec.issues[i].handoff+'继续定位。':''),'');
   lines.push('场景边界：'+(spec.boundary||'只诊断本场景；显式提问选择最细场景，父子不并行重复输出；共享同一对象时合并损失。'),'待补充：'+unique([...spec.gaps,'真实经营样本验证']).join('；'));
   const prompt=lines.join('\n');
   const frame={id:frameId,assetId:frameId,sceneId:scene.id,name:scene.name+'诊断框架',goal:spec.decomposition[0],scope:scene.merchantScope,metricIds:[...scene.metricIds],actionIds:[...scene.actionIds],knowledge:spec.decomposition.concat(spec.gaps).join('\n'),logic:spec.drilldown,priority:'先基础经营与数据可用性，再按目标影响、证据充分度和可行动性排序，不捏造评分。',maxDepth:4,prompt,draftText:prompt,branches,version,generation:0,workflowSchema:1,production:'逐场景业务重整',status:'生效中',stage:'active',updatedAt:stamp,createdAt:old?.createdAt||stamp,catalogRevision:revision,requiredEvidence:scene.requiredEvidence,sceneLevel:scene.level,parentSceneId:scene.parentId,businessFrameworkVersion:2,missingMetricOrEvidence:copy(spec.gaps),decomposition:copy(spec.decomposition),drilldown:spec.drilldown,businessBoundary:spec.boundary,reviewStatus:'结构、业务案例及去重边界校验；真实效果待验证',releaseScope:'框架与策略定义已发布；证据不足的策略返回无法判断'};
   if(old)frame.history=[...(old.history||[]),{...copy(old),history:undefined}];
   const group={id:groupId,sceneId:scene.id,name:scene.name,mode:'策略优先级执行',priority:number,tags:'同口径完整周期',prompt:'按明确问题、指标信号和必要证据判断；同对象同根因合并，不以变化代替根因。'};
   data.frameworks.push(frame);data.strategies.push(...strategies);data.groups.push(group);
   const definition={id:frameId,sceneId:scene.id,sceneName:scene.name,name:frame.name,fieldKey:scene.fieldKey,goal:frame.goal,scope:frame.scope,text:prompt,active:true,version,sourceWorkflow:frame.production,metricIds:frame.metricIds,actionIds:frame.actionIds,branches,priority:scene.priority,level:scene.level,parentId:scene.parentId,requiredEvidence:scene.requiredEvidence,businessFrameworkVersion:2,missingMetricOrEvidence:spec.gaps,businessBoundary:spec.boundary};
   data.published[scene.id]={publishedAt:Date.now(),periods:Object.fromEntries(['week','day'].map(period=>[period,{sceneId:scene.id,sceneName:scene.name,fieldKey:scene.fieldKey,period,version:scene.version,framework:prompt,frameworkVersion:version,frameworkDefinition:copy(definition),strategies:copy(strategies.map(({history,...strategy})=>strategy)),groups:[copy(group)],metrics:data.metrics.filter(m=>scene.metricIds.includes(m.id)),actions:data.actions.filter(a=>scene.actionIds.includes(a.id)),active:true,catalogRevision:revision,dataAvailability:{status:'demo_only',message:'定义已发布；真实取数与经营证据待接入，内容原因不自动确认。'}}]))};
  }
  Object.assign(data,{businessFrameworkVersion:2,sceneDeploymentVersion:2,strategyScopeVersion:1,liveRevenueDiagnosisVersion:1});
  Object.assign(data.catalog,{revision,name:'逐场景三段式诊断配置 · 2026-11-03',frameworkCount:data.frameworks.length,strategyCount:data.strategies.length,deploymentVersion:2,deployedAt:stamp,businessReview:'逐场景定义及合成业务案例，真实经营效果未验证'});
  return data;
 };
})();
