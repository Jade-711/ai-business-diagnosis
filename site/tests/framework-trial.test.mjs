import test from 'node:test';
import assert from 'node:assert/strict';
import {produceAiddAsset} from '../worker/aidd-production.js';
import {FRAMEWORK_TRIAL_SYSTEM_PROMPT} from '../worker/framework-trial.js';
import {budgetDb} from './budget-db.mjs';

const metric={id:'video-gmv-change',name:'短视频支付金额环比变化',fieldKey:'video',metricKey:'gmv',derived:'change',unit:'%'};
const otherMetric={id:'video-plays-value',name:'视频播放量',fieldKey:'video',metricKey:'plays',derived:'value',unit:'次'};
const action={id:'video-action',name:'查看视频表现',subtitle:'按视频核查成交与播放',metricIds:[metric.id],pcLink:'',mobileLink:''};
const branch={id:'sales',name:'成交变化',meaning:'按框架判断成交环比是否小于零。',priority:1,metricIds:[metric.id],actionIds:[action.id]};
const frame={id:'review-frame',name:'当前短视频框架',sceneId:'scene-video',version:2,draftText:'当前审核稿：成交环比小于零，诊断成交回落，关联查看视频表现。',branches:[branch]};
const sample={id:'seller-a-week',merchantId:'seller-a',merchantName:'案例商家',label:'案例商家 · 短视频 · 近7天',fieldKey:'video',period:'week',periodRange:'10.14—10.20',metricValues:[{id:metric.id,value:-20},{id:otherMetric.id,value:180000}]};
const inputs={operation:'generate_framework',phase:'test',frameworkName:frame.name,strategyMode:'ai',parsed:false,scenes:[{id:'scene-video',name:'短视频诊断',fieldKey:'video',metricIds:[metric.id,otherMetric.id],actionIds:[action.id]}],metrics:[metric,otherMetric],actions:[action],goal:'识别成交回落',scope:'当前场景商家',review:{reviewedText:frame.draftText},candidateFramework:frame,trialCases:[sample]};
const env=()=>({DEEPSEEK_API_KEY:'fake-test-key',DB:budgetDb()});
const verdict=(overrides={})=>({branchId:branch.id,assessment:'problem',title:'短视频成交回落',finding:'成交较对比期下降，需优先排查。',method:'按当前框架对照成交环比。',cause:'现有数据能确认成交下降，需结合视频明细核查流量与承接。',causeStatus:'needs_verification',evidenceMetricIds:[metric.id],actions:[{actionId:action.id,recommendation:'对比各视频的成交与播放，优先排查成交下降集中的视频。'}],missing:[],...overrides});
const modelResult=(diagnosis=verdict(),currentFrame=frame)=>({productionDraft:{operation:'generate_framework',strategyMode:'',draftText:'',candidateFramework:{...currentFrame,draftText:''},candidateStrategies:[],pipelineErrors:[],missing:[]},caseResults:[{caseId:sample.id,summary:'成交回落，需要先核查视频成交来源。',branches:[diagnosis]}]});
const response=value=>new Response(JSON.stringify({status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}]}));
const run=(p=inputs,fetchModel=async()=>response(modelResult()))=>produceAiddAsset({operation:'generate_framework',productionInput:p},env(),{fetchModel});

test('试跑实际执行当前稿与所选商家周期，数值取案例、行动取关联资产，不返回只有指标齐备的报告',async()=>{
 let calls=0;const progress=[];
 const result=await produceAiddAsset({operation:'generate_framework',productionInput:{...inputs,prompt:'不应使用的旧生成Prompt',candidateFramework:{...frame,branches:[{...branch,meaning:'不应使用的旧结构'}]}}},env(),{onProgress:p=>progress.push(p),fetchModel:async(url,options)=>{
  calls++;const request=JSON.parse(options.body);assert.equal(request.instructions,FRAMEWORK_TRIAL_SYSTEM_PROMPT);assert.equal(request.text.format.name,'aidd_framework_trial');
  assert.match(request.input,/当前审核稿/);assert.match(request.input,/seller-a-week/);assert.match(request.input,/-20/);assert.doesNotMatch(request.input,/不应使用/);
  assert.deepEqual(request.text.format.schema.properties.caseResults.items.properties.caseId.enum,[sample.id]);
  return response(modelResult({...verdict(),evidence:[{value:9999}]}));
 }});
 assert.equal(calls,1);assert.ok(progress.some(p=>/按当前框架分析/.test(p)));
 const report=result.trialReport,item=report.cases[0],problem=item.problems[0];
 assert.equal(report.analysisMode,'draft_framework_diagnosis');assert.equal(report.schemaVersion,2);assert.equal(item.merchantId,sample.merchantId);assert.equal(item.period,'week');assert.equal(item.frameworkId,frame.id);assert.equal(item.frameworkVersion,2);
 assert.equal(problem.evidence[0].value,-20);assert.equal(problem.evidence[0].label,metric.name);assert.equal(problem.actions[0].name,action.name);assert.equal(problem.causeStatus,'needs_verification');assert.equal(result.handoff.executionEligible,false);
 assert.equal(result.draftText,frame.draftText);assert.doesNotMatch(JSON.stringify(result),/fake-test-key|9999/);
});
test('改善案例可以返回当前框架下无问题，不强制产生问题或优化行动',async()=>{
 const payload=modelResult(verdict({assessment:'clear',title:'成交未回落',finding:'当前成交环比改善，未触发框架的下降条件。',cause:'',actions:[]}));
 const result=await run({...inputs,trialCases:[{...sample,metricValues:[{id:metric.id,value:12}]}]},async()=>response(payload));
 assert.equal(result.trialReport.cases[0].diagnosisStatus,'no_problem');assert.equal(result.trialReport.cases[0].problems.length,0);assert.equal(result.trialReport.cases[0].clear.length,1);assert.equal(result.trialReport.cases[0].clear[0].evidence[0].value,12);
});
test('缺少指标或比较基准时明确不能判断，绝对播放量不被当作异常证据',async()=>{
 const unknown=verdict({assessment:'insufficient_data',title:'成交变化暂不能判断',finding:'没有成交环比数据。',cause:'',evidenceMetricIds:[],actions:[],missing:['需提供成交对比期数据']});
 const result=await run({...inputs,trialCases:[{...sample,metricValues:[{id:otherMetric.id,value:180000}]}]},async()=>response(modelResult(unknown)));
 assert.equal(result.trialReport.cases[0].diagnosisStatus,'insufficient_data');assert.equal(result.trialReport.cases[0].problems.length,0);assert.match(result.trialReport.cases[0].unresolved[0].missing.join('；'),/对比期/);
 let calls=0;await assert.rejects(()=>run({...inputs,trialCases:[{...sample,metricValues:[]}]},async()=>{calls++;return response(modelResult());}),error=>/未提供当前框架的任何有效指标值/.test(error.message)&&error.productionUsage.modelUsage.callCount===0);assert.equal(calls,0);
});
test('场域、周期或重复案例不匹配时在模型前拒绝，不偷换成现有案例',async()=>{
 let calls=0;const fetchModel=async()=>{calls++;return response(modelResult());};
 for(const c of [{...sample,fieldKey:'live'},{...sample,period:'month'}])await assert.rejects(()=>run({...inputs,trialCases:[c]},fetchModel),/不匹配/);
 await assert.rejects(()=>run({...inputs,trialCases:[sample,sample]},fetchModel),/重复/);assert.equal(calls,0);
});
test('拒绝错商家、漏分支、未选指标和非关联行动，不用覆盖检查冒充试跑成功',async()=>{
 const badCase=modelResult();badCase.caseResults[0].caseId='another-merchant';
 await assert.rejects(()=>run(inputs,async()=>response(badCase)),/商家不一致/);
 await assert.rejects(()=>run(inputs,async()=>response({...modelResult(),caseResults:[]})),/全部所选案例/);
 await assert.rejects(()=>run(inputs,async()=>response(modelResult(verdict({evidenceMetricIds:['unselected-metric']})))),/当前框架以外/);
 await assert.rejects(()=>run(inputs,async()=>response(modelResult(verdict({actions:[{actionId:'made-up-tool',recommendation:'伪造工具'}]})))),/未关联当前框架/);
 const empty=modelResult();empty.caseResults[0].branches=[];await assert.rejects(()=>run(inputs,async()=>response(empty)),/完整执行/);
 const legacy=modelResult();delete legacy.caseResults;await assert.rejects(()=>run(inputs,async()=>response(legacy)),/全部所选案例/);
});
test('允许同一框架内的关联指标参与原因分析，但问题必须有当前方向的核心指标',async()=>{
 const result=await run(inputs,async()=>response(modelResult(verdict({evidenceMetricIds:[metric.id,otherMetric.id]}))));
 assert.deepEqual(result.trialReport.cases[0].problems[0].evidence.map(m=>m.value),[-20,180000]);
 await assert.rejects(()=>run(inputs,async()=>response(modelResult(verdict({evidenceMetricIds:[otherMetric.id]})))),/核心指标/);
});
test('已解析草稿仍需执行商家诊断，并能使用选定的昨日数据，零值不变成缺失值',async()=>{
 const daily={...sample,id:'seller-a-day',period:'day',metricValues:[{id:metric.id,value:0,previousValue:0}]};
 const payload=modelResult(verdict({assessment:'clear',title:'成交环比持平',finding:'未出现框架定义的回落。',cause:'',actions:[]}));payload.caseResults[0].caseId=daily.id;
 let calls=0;const result=await run({...inputs,parsed:true,trialCases:[daily]},async(url,options)=>{calls++;assert.match(JSON.parse(options.body).input,/seller-a-day/);return response(payload);});
 assert.equal(calls,1);assert.equal(result.trialReport.cases[0].period,'day');assert.equal(result.trialReport.cases[0].clear[0].evidence[0].value,0);assert.equal(result.trialReport.cases[0].clear[0].evidence[0].previousValue,0);assert.equal(result.trialReport.cases[0].clear[0].evidence[0].comparisonChange,undefined);
});
test('模型偶发JSON语法错误最多重取一次，继续使用原框架与案例，失败不会保存假报告',async()=>{
 const invalid=()=>new Response(JSON.stringify({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{"productionDraft":'}]}]}));
 let calls=0;const progress=[];
 const result=await produceAiddAsset({operation:'generate_framework',productionInput:inputs},env(),{onProgress:p=>progress.push(p),fetchModel:async(url,options)=>{calls++;const sent=JSON.parse(options.body);assert.equal(sent.reasoning.effort,'none');assert.equal(sent.temperature,0);if(calls===2)assert.match(sent.input,/JSON Schema/);assert.equal(sent.text.format.type,calls===1?'json_schema':'json_object');assert.match(sent.input,/当前审核稿/);assert.match(sent.input,/seller-a-week/);assert.match(sent.input,/caseResults/);return calls===1?invalid():response(modelResult());}});
 assert.equal(calls,2);assert.equal(result.trialReport.cases[0].problems.length,1);assert.ok(progress.some(p=>/修复响应协议/.test(p)));
 calls=0;await assert.rejects(()=>run(inputs,async()=>{calls++;return invalid();}),/未完整返回/);assert.equal(calls,2);
});
test('模型返回独立说明与final_answer时，只解析最终结果，不把中间说明拼进报告',async()=>{
 let calls=0;const result=await run(inputs,async()=>{calls++;return new Response(JSON.stringify({status:'completed',output:[{type:'message',role:'assistant',phase:'commentary',content:[{type:'output_text',text:'PRIVATE_INTERMEDIATE_TEXT'}]},{type:'message',role:'assistant',phase:'final_answer',content:[{type:'output_text',text:JSON.stringify(modelResult())}]}]}));});
 assert.equal(calls,1);assert.equal(result.trialReport.cases[0].problems.length,1);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_INTERMEDIATE_TEXT/);
});
test('已解析框架试跑不重复生成分支，审核稿有改动则必须重新解析',async()=>{
 let calls=0;
 const result=await run({...inputs,parsed:true},async(url,options)=>{
  calls++;const sent=JSON.parse(options.body),schema=sent.text.format.schema;
  assert.equal(schema.properties.productionDraft.properties.candidateFramework,undefined);
  assert.match(sent.input,/parsedFramework/);assert.doesNotMatch(sent.input,/字段与类型严格按以下JSON Schema/);
  const payload=modelResult();delete payload.productionDraft.candidateFramework;return response(payload);
 });
 assert.equal(calls,1);assert.deepEqual(result.candidateFramework.branches,[branch]);
 await run(inputs,async(url,options)=>{const sent=JSON.parse(options.body);assert.ok(sent.text.format.schema.properties.productionDraft.properties.candidateFramework);assert.doesNotMatch(sent.input,/parsedFramework/);return response(modelResult());});
});
test('案例已有指标缺少数值和模型引用未选指标分别报错，唯一资产code只归一到已选ID',async()=>{
 const p={...inputs,metrics:[{...metric,code:'SELECTED_CODE'},otherMetric]};
 const result=await run(p,async()=>response(modelResult(verdict({evidenceMetricIds:['SELECTED_CODE']}))));
 assert.equal(result.trialReport.cases[0].problems[0].evidence[0].metricId,metric.id);
 await assert.rejects(()=>run({...inputs,trialCases:[{...sample,metricValues:[{id:otherMetric.id,value:180000}]}]},async()=>response(modelResult())),/案例未提供.*数值/);
 await assert.rejects(()=>run(inputs,async()=>response(modelResult(verdict({evidenceMetricIds:['wrong-id']})))),/未选指标：wrong-id/);
});
test('审核稿明确全局数据前置时，前置未过不得确认后续问题或未发现问题，更不得推荐执行行动',async()=>{
 const gate={...branch,id:'data-gate',name:'数据可用与口径前置',priority:0,actionIds:[]};
 const gatedFrame={...frame,draftText:'当前审核稿：无数据时本场景所有后续判断均不可执行。成交回落要先通过P0口径核查。',branches:[gate,branch]};
 const gateResult=verdict({branchId:gate.id,assessment:'insufficient_data',title:'口径未核实',finding:'没有同口径说明。',cause:'需核查统计口径。',actions:[],missing:['统计口径说明']});
 for(const assessment of ['problem','clear']){
  const payload=modelResult(verdict({assessment}),gatedFrame);payload.caseResults[0].branches.unshift(gateResult);
  const result=await run({...inputs,candidateFramework:gatedFrame,review:{reviewedText:gatedFrame.draftText}},async()=>response(payload));
  const item=result.trialReport.cases[0];assert.equal(item.problems.length,0);assert.equal(item.clear.length,0);assert.equal(item.unresolved.length,2);assert.deepEqual(item.prerequisites,[gate.id]);assert.match(item.summary,/暂不确认/);
  const dependent=item.unresolved.find(d=>d.id===branch.id);assert.deepEqual(dependent.actions,[]);assert.match(dependent.missing.join('；'),/须先通过：数据可用与口径前置/);assert.equal(dependent.evidence[0].value,-20);
 }
});
