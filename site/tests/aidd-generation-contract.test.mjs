import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProductionRule,validateProductionRule} from '../shared/production-rules.js';
import {aiddModelMaterials,aiddGenerationSchema,adaptAiddProductionDraft} from '../worker/aidd-generation-contract.js';
import {produceAiddAsset} from '../worker/aidd-production.js';
import {budgetDb} from './budget-db.mjs';
const metric={id:'m',code:'METRIC',name:'曝光人数',unit:'人',derived:'value',derivations:['均值'],description:'按指定周期去重。口径约束必须保留。',provenance:{evidence:'定义待官方核验'},updatedAt:'UNNECESSARY_TIMESTAMP'};
const action={id:'a',name:'发布短视频',description:'仅当供给不足且完成资质检查时使用。',pcLink:'https://not-needed.example/tool'};
const frame={id:'f',sceneId:'s',active:true,version:3,text:'已发布业务方法。无法从总量认定内容质量原因。',draftText:'已发布业务方法。无法从总量认定内容质量原因。',branches:[{id:'b',name:'供给',meaning:'核查曝光变化，原因需进一步证据',metricIds:['m'],actionIds:['a'],priority:1}]};
const materials={operation:'generate_strategies',phase:'generate',strategyMode:'ai',sourceFramework:frame,scenes:[{id:'s',name:'短视频-曝光',fieldKey:'video',metricIds:['m','unselected'],actionIds:['a','unselected']}],metrics:[metric],actions:[action],scope:'跃迁期商家',goal:'核查曝光变化',prompt:'按已发布框架生产候选',candidateFramework:{},candidateStrategies:[],review:{}};
const candidate={name:'曝光人数回落待核查',branchIds:['b'],priority:1,actionIds:[],actionTrigger:'match',businessMeaning:'只识别可比周期回落信号，不推断原因。',thresholdBasis:'本期对比前期，零增长为方向边界，不定性统计异常。',exceptionHandling:'前期缺失或口径不一致时无法判断，不推荐行动。',pendingItems:['缺少供给与内容证据；暂不映射行动'],rule:{metricId:'m',op:'<',rightType:'metric',rightMetricId:'m',rightTransform:'previous',rightCalc:'none',factor:1}};
const parsed=item=>({productionDraft:{candidateStrategies:[item],missing:[],pipelineErrors:[]}});
const env={DEEPSEEK_API_KEY:'FAKE',DB:budgetDb()};
const response=value=>new Response(JSON.stringify({status:'completed',usage:{input_tokens:100,output_tokens:40,total_tokens:140},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(value)}]}]}));

test('模型输入只精简重复元数据，业务定义、证据边界和行动条件仍保留',()=>{
 const lean=aiddModelMaterials(materials),text=JSON.stringify(lean);
 assert.match(text,/口径约束必须保留/);assert.match(text,/定义待官方核验/);assert.match(text,/无法从总量认定内容质量原因/);assert.match(text,/完成资质检查/);
 assert.doesNotMatch(text,/UNNECESSARY_TIMESTAMP|not-needed.example|unselected/);
 assert.equal(lean.sourceFramework.draftText,undefined);assert.equal(materials.sourceFramework.draftText,frame.text);
 assert.ok(text.length<JSON.stringify(materials).length);
});
test('框架正文仅生成一次，元数据由输入还原；审核原文保留不被模型改写',()=>{
 const m={...materials,operation:'generate_framework',frameworkName:'当前框架'};
 const schema=aiddGenerationSchema(m).properties.productionDraft.properties;
 assert.equal(schema.candidateFramework.properties.draftText,undefined);
 const result=adaptAiddProductionDraft({productionDraft:{draftText:'一、指标拆解\n二、诊断方向\n三、典型问题和行动映射',candidateFramework:{branches:frame.branches},missing:[],pipelineErrors:[]}},m).productionDraft;
 assert.equal(result.candidateFramework.draftText,result.draftText);assert.equal(result.candidateFramework.sceneId,'s');assert.equal(result.candidateFramework.version,3);assert.equal(result.candidateFramework.name,'当前框架');
 const review={...m,phase:'confirm',candidateFramework:frame,review:{reviewedText:'人工当前稿'}};
 const reviewed=adaptAiddProductionDraft({productionDraft:{draftText:'不得使用',candidateFramework:{branches:frame.branches},missing:[],pipelineErrors:[]}},review).productionDraft;
 assert.equal(reviewed.draftText,'人工当前稿');assert.equal(aiddGenerationSchema(review).properties.productionDraft.properties.draftText,undefined);
});
test('精简策略响应能生成同一份可编辑正文，保留框架身份、待审核状态和缺证边界',()=>{
 const result=adaptAiddProductionDraft(parsed(candidate),materials).productionDraft,s=result.candidateStrategies[0];
 assert.deepEqual(s.metricIds,['m']);assert.equal(s.frameworkId,'f');assert.equal(s.frameworkVersion,3);assert.equal(s.enabled,false);assert.equal(s.status,'待生效');assert.deepEqual(s.actionIds,[]);
 assert.match(result.draftText,/前周期值/);assert.match(result.draftText,/缺少供给与内容证据/);assert.match(result.draftText,/未关联，需人工确认/);assert.match(result.draftText,/优先级：1/);assert.match(result.draftText,/关联诊断方向：供给（b）/);
 assert.equal(aiddGenerationSchema(materials).properties.productionDraft.properties.draftText,undefined);
});
test('生产与编辑共用规则协议：只兼容字段别名，不猜阈值、比较资产或运算系数',()=>{
 const validate=rule=>validateProductionRule(normalizeProductionRule(rule),[metric,{...metric,id:'wrong-unit',unit:'元'}],['m','wrong-unit']);
 const base=candidate.rule;
 for(const rule of [{...base,factor:undefined},{...base,rightCalc:'*',rightNumber:0,factor:undefined},{...base,rightCalc:'*',rightNumber:1.1,factor:undefined}])assert.equal(validate(rule),null);
 assert.equal(normalizeProductionRule({...base,rightCalc:'*',factor:undefined,rightNumber:0}).factor,0);
 for(const rule of [{...base,rightMetricId:'unknown'},{...base,rightMetricId:'wrong-unit'},{...base,rightCalc:'*',factor:undefined},{...base,op:'lt'},{...base,rightNumber:2},{...base,rightCalc:'/',factor:0},{metricId:'m',op:'<',rightType:'value',value:undefined}])assert.equal(typeof validate(rule),'string');
 assert.equal(validate({...base,rightTransform:'peerMean'}),'请先在指标管理中启用同行均值');
});
test('协议修复最多一次，统计两次实际用量，保留原始业务资料；可用候选可确认并跑真实规则',async()=>{
 let calls=0;const result=await produceAiddAsset({operation:materials.operation,productionInput:materials},env,{fetchModel:async(url,options)=>{
  assert.equal(url,'https://api.deepseek.com/responses');const request=JSON.parse(options.body);assert.equal(request.reasoning.effort,'low');assert.match(request.input,/按已发布框架生产候选/);
  return response(parsed(++calls===1?{...candidate,rule:{...candidate.rule,rightCalc:'*',factor:undefined}}:candidate));
 }});
 assert.equal(calls,2);assert.equal(result.modelUsage.tokens,280);assert.equal(result.productionUsage.cozeTokens,0);assert.equal(result.status,'needs_review');
 const manual={...materials,strategyMode:'manual',phase:'test',manualStrategies:result.candidate,parsed:true,trialCases:[{id:'case',fieldKey:'video',period:'week',metricValues:[{id:'m',value:90,previousValue:100}],expectedStrategies:[candidate.name]}]};
 const trial=await produceAiddAsset({operation:materials.operation,productionInput:manual},{},{fetchModel:()=>{throw Error('不得调用任何模型或工作流');}});
 assert.deepEqual(trial.trialReport.cases[0].matchedStrategyNames,[candidate.name]);
 const confirmed=await produceAiddAsset({operation:materials.operation,productionInput:{...manual,phase:'confirm',review:{confirmed:true,reviewer:'产运'}}},{},{fetchModel:()=>{throw Error('不得调用模型');}});
 assert.equal(confirmed.status,'ready_for_gray');assert.equal(confirmed.candidate[0].enabled,false);
});
test('资料或审核条件缺失时允许明确返回缺口，不为填满Schema编造规则或结论',async()=>{
 let calls=0;const result=await produceAiddAsset({operation:materials.operation,productionInput:materials},env,{fetchModel:async()=>{calls++;return response({productionDraft:{candidateStrategies:[],missing:['缺少对比口径'],pipelineErrors:['审核稿没有明确规则，无法解析']}});}});
 assert.equal(calls,1);assert.equal(result.status,'invalid_input');assert.deepEqual(result.candidate,[]);assert.match(result.answer,/没有明确规则/);assert.equal(result.handoff.executionEligible,false);
});
