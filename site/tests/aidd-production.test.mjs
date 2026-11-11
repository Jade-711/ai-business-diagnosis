import {legacyDemoCatalog} from './legacy-catalog.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {produceAiddAsset,runAiddProduction} from '../worker/aidd-production.js';
import {AIDD_PRODUCTION_MODELS} from '../worker/aidd-production-models.js';
import {budgetDb} from './budget-db.mjs';
import {FRAMEWORK_TRIAL_SYSTEM_PROMPT} from '../worker/framework-trial.js';
import {AIDD_FRAMEWORK_SYSTEM_PROMPT} from '../shared/framework-prompt.js';
const {config,data}=legacyDemoCatalog['live:week'];
const scene={id:'scene-live',name:'直播诊断',fieldKey:'live',metricIds:config.metrics.map(m=>m.id),actionIds:[]};
const frame={id:'frame-direct',sceneId:scene.id,active:true,version:1,branches:[{id:'branch-direct',name:'点击变化',meaning:'按所选点击率变化定位环节，原因仍需业务证据。',metricIds:['live-clickRate-change'],actionIds:[],priority:1}]};
const strategy={id:'strategy-direct',sceneId:scene.id,name:'点击下降',merchantScope:'跃迁期商家',execution:'指标规则',period:'week',metricIds:['live-clickRate-change'],actionIds:[],businessMeaning:'点击率下降可能影响成交，需核查承接。',thresholdBasis:'草稿示例阈值-10%，需人工确认。',exceptionHandling:'缺少可比数据时无法判断，不推断原因。',pendingItems:['确认阈值适用范围'],rule:{metricId:'live-clickRate-change',op:'<',rightType:'value',value:-10}};
const base={operation:'generate_strategies',strategyMode:'manual',scenes:[scene],goal:'识别点击下降',scope:'跃迁期商家',metrics:config.metrics,actions:[],sourceFramework:frame,manualStrategies:[strategy]};
const body=job=>({operation:job.operation,productionInput:job});
const env={DEEPSEEK_API_KEY:'test-key-must-not-leak',DEEPSEEK_MODEL:'deepseek-flash',DB:budgetDb()};
const draft={operation:'generate_strategies',strategyMode:'ai',draftText:'仅在点击率环比下降超过10%时触发。',candidateFramework:{},candidateStrategies:[strategy],missing:[],pipelineErrors:[]};
const answer=(value,status='completed')=>new Response(JSON.stringify({status,incomplete_details:status==='incomplete'?{reason:'max_output_tokens'}:null,output:[{type:'reasoning',summary:[{type:'summary_text',text:'不得显示的模型思考'}]},{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}]}),{headers:{'content-type':'application/json'}});

test('人工规则确认不依赖 Coze、模型或生产资料接口，保留原审核与待发布状态',async()=>{
 const result=await produceAiddAsset(body({...base,phase:'confirm',review:{confirmed:true,reviewer:'产运'}}),{}, {fetchModel:()=>{throw Error('不得调用模型');}});
 assert.equal(result.status,'ready_for_gray');assert.equal(result.candidate[0].frameworkId,frame.id);
 assert.equal(result.trialReport.executed,false);assert.equal(result.candidate[0].enabled,false);
 assert.equal(result.releasePlan.requiresBackendPublish,true);assert.equal(result.handoff.executionEligible,false);
 assert.equal(result.handoff.consumerWorkflow,'Main_agent');assert.equal(result.handoff.consumerWorkflowId,'7699762508375294003');
});
test('已解析案例试跑仍只执行所选案例，返回实际指标和原命中结果',async()=>{
 const result=await produceAiddAsset(body({...base,phase:'test',trialCases:[{id:'chosen',label:'所选案例',fieldKey:'live',period:'week',metricValues:data.metrics,expectedStrategies:['点击下降']}]}),{});
 assert.equal(result.trialReport.caseCount,1);assert.equal(result.trialReport.cases[0].id,'chosen');
 assert.deepEqual(result.trialReport.cases[0].matchedStrategyNames,['点击下降']);
 assert.ok(result.trialReport.cases[0].evidence.length);assert.equal(result.status,'needs_review');assert.equal(result.trialReport.analysisMode,'strategy_rule_trial');assert.equal(result.trialReport.cases[0].ruleResults[0].triggered,true);
});
test('AI生成直连所选DeepSeek模型，保持业务提示词、精简响应字段和待审核交接',async()=>{
 let calls=0;
 const result=await produceAiddAsset(body({...base,strategyMode:'ai',phase:'generate',prompt:'按已选框架生产点击诊断策略'}),env,{fetchModel:async(url,options)=>{
  calls++;assert.equal(url,'https://api.deepseek.com/responses');
  assert.equal(options.headers.authorization,'Bearer '+env.DEEPSEEK_API_KEY);
  const sent=JSON.parse(options.body);assert.equal(sent.model,env.DEEPSEEK_MODEL);
  assert.equal(sent.instructions,AIDD_PRODUCTION_MODELS.ai.systemPrompt);assert.equal(sent.max_output_tokens,6144);
  assert.equal(sent.text.format.type,'json_schema');assert.equal(sent.store,false);assert.match(sent.input,/按已选框架/);
  assert.equal(sent.reasoning.effort,'low');
  assert.match(sent.input,/"enum":\["<","<=",">",">=","==","!="\]/);
  return answer({productionDraft:draft});
 }});
 assert.equal(calls,1);assert.equal(result.status,'needs_review');assert.equal(result.trialReport.executed,false);
 assert.equal(result.modelUsage.provider,'DeepSeek');assert.ok(result.modelUsage.budget.reservedUSD>0);
 assert.equal(result.draftText,draft.draftText);assert.doesNotMatch(JSON.stringify(result),/test-key|模型思考/);
});
test('审核稿出现未支持的比较符时保留失败，不猜测或偷偷替换经营规则',async()=>{
 let calls=0;await assert.rejects(()=>produceAiddAsset(body({...base,strategyMode:'ai',phase:'confirm',review:{confirmed:true,reviewer:'产运',reviewedText:'点击率变化低于-10%'}}),env,{fetchModel:async(url,options)=>{calls++;assert.match(JSON.parse(options.body).input,/点击率变化低于-10%/);return answer({productionDraft:{...draft,candidateStrategies:[{...strategy,rule:{...strategy.rule,op:'lt'}}]}});}}),/规则比较符不受支持/);
 assert.equal(calls,2);assert.equal(strategy.rule.op,'<');
});
test('审核正文解析不携带旧生成 Prompt、知识或未选择的案例',async()=>{
 await produceAiddAsset(body({...base,strategyMode:'ai',phase:'confirm',prompt:'不应读的旧Prompt',knowledge:[{content:'不应读的知识'}],review:{confirmed:true,reviewer:'产运',reviewedText:'本次确认稿：点击率下降超过10%'},candidateStrategies:[strategy]}),env,{fetchModel:async(url,options)=>{
  const sent=JSON.parse(options.body);assert.equal(sent.instructions,AIDD_PRODUCTION_MODELS.parse.systemPrompt);
  assert.match(sent.input,/本次确认稿/);assert.doesNotMatch(sent.input,/不应读/);
  return answer({productionDraft:draft});
 }});
});
test('缺模型配置、被截断结果和不完整 JSON 均明确失败，不用演示文本冒充 AI 成功',async()=>{
 const input=body({...base,strategyMode:'ai',prompt:'生产策略'});
 await assert.rejects(()=>produceAiddAsset(input,{}),/尚未配置/);
 await assert.rejects(()=>produceAiddAsset(input,env,{fetchModel:async()=>answer({productionDraft:draft},'incomplete')}),/被截断/);
 await assert.rejects(()=>produceAiddAsset(input,env,{fetchModel:async()=>answer({productionDraft:{draftText:'不完整'}})}),/不符合原生产协议/);
 await assert.rejects(()=>produceAiddAsset(input,env,{fetchModel:async()=>new Response(env.DEEPSEEK_API_KEY,{status:401})}),error=>/鉴权失败/.test(error.message)&&!error.message.includes(env.DEEPSEEK_API_KEY));
 await assert.rejects(()=>produceAiddAsset(input,env,{fetchModel:async()=>{throw Error(env.DEEPSEEK_API_KEY);}}),error=>/连接失败/.test(error.message)&&!error.message.includes(env.DEEPSEEK_API_KEY));
 await assert.rejects(()=>produceAiddAsset(input,env,{fetchModel:async()=>new Response('',{status:402})}),/余额不足/);
});
test('使用默认DeepSeek模型，拒绝缺失正文与被拒绝的结果',async()=>{
 const input=body({...base,strategyMode:'ai',prompt:'生产策略'});
 await produceAiddAsset(input,{DEEPSEEK_API_KEY:env.DEEPSEEK_API_KEY,DB:env.DB},{fetchModel:async(url,options)=>{assert.equal(JSON.parse(options.body).model,'deepseek-flash');return answer({productionDraft:draft});}});
 for(const output of [[],[{type:'reasoning',summary:[]}],[{type:'message',role:'assistant',status:'completed',content:[{type:'refusal',refusal:'不得作为候选'}]}]]){
  await assert.rejects(()=>produceAiddAsset(input,env,{fetchModel:async()=>new Response(JSON.stringify({status:'completed',output}))}),/未返回可用/);
 }
});
test('消费保护先于付费模型请求，数据库异常或额度不足时不发送密钥',async()=>{
 const input=body({...base,strategyMode:'ai',prompt:'生产策略'});let calls=0;
 const fetchModel=async()=>{calls++;throw Error('不得发起网络请求');};
 await assert.rejects(()=>produceAiddAsset(input,{DEEPSEEK_API_KEY:env.DEEPSEEK_API_KEY},{fetchModel}),/保护暂不可用/);
 await assert.rejects(()=>produceAiddAsset(input,{...env,AIDD_MONTHLY_LIMIT_USD:'0'},{fetchModel}),/保护上限/);
 assert.equal(calls,0);
});
test('输入缺口在模型前停止，SSE 保持原前端结果协议且不泄露密钥',async()=>{
 const invalid=await produceAiddAsset(body({...base,strategyMode:'ai',metrics:[],prompt:''}),env,{fetchModel:()=>{throw Error('不得调用');}});
 assert.equal(invalid.status,'invalid_input');assert.ok(invalid.missing.length);
 const request=new Request('http://localhost/api/aidd/generate');
 const response=runAiddProduction(request,env,body({...base,phase:'confirm',review:{confirmed:true,reviewer:'产运'}}));
 const text=await response.text();assert.match(text,/event: progress/);assert.match(text,/event: result/);assert.match(text,/ready_for_gray/);
 assert.doesNotMatch(text,/test-key|reasoning_content|workflow\/stream_run/);
});
test('框架生产以表单变量套用固定方法，无需额外Prompt，旧Prompt不会覆盖方法',async()=>{
 const input=body({...base,operation:'generate_framework',frameworkName:'直播点击框架',phase:'generate',prompt:'不应使用的旧场景Prompt'});
 const productionDraft={operation:'generate_framework',strategyMode:'',draftText:'按已选指标拆解目标与行动。',candidateFramework:{...frame,name:'直播点击框架',draftText:'按已选指标拆解目标与行动。'},candidateStrategies:[],missing:[],pipelineErrors:[]};
 const result=await produceAiddAsset(input,env,{fetchModel:async(url,options)=>{
  const sent=JSON.parse(options.body);assert.equal(sent.instructions,AIDD_FRAMEWORK_SYSTEM_PROMPT);assert.match(sent.input,/直播点击框架/);assert.match(sent.input,/跃迁期商家/);assert.doesNotMatch(sent.input,/不应使用的旧场景Prompt/);assert.match(sent.instructions,/杜邦拆解/);assert.match(sent.instructions,/不超过10/);return answer({productionDraft});
 }});
 assert.equal(result.status,'needs_review');assert.equal(result.candidate.name,'直播点击框架');
 await assert.rejects(()=>produceAiddAsset(input,env,{fetchModel:async()=>answer({productionDraft:{...productionDraft,candidateFramework:{...frame,branches:[{...frame.branches[0],metricIds:['unselected-metric']}]}}})}),/未选择的指标/);
});
test('框架输入和输出协议均限于本次选中资产，不泄漏场景中其他资产引用',async()=>{
 const metric=config.metrics.find(m=>m.id==='live-clickRate-change');
 const input=body({...base,operation:'generate_framework',phase:'generate',metrics:[metric],scenes:[{...scene,metricIds:[metric.id,'unselected-scene-metric'],actionIds:['unselected-scene-action']}]});
 const productionDraft={operation:'generate_framework',strategyMode:'',draftText:'检查点击效率变化。',candidateFramework:frame,candidateStrategies:[],missing:[],pipelineErrors:[]};
 await produceAiddAsset(input,env,{fetchModel:async(url,options)=>{
  const sent=JSON.parse(options.body),protocol=sent.text.format.schema;assert.equal(sent.text.format.type,'json_schema');
  assert.doesNotMatch(sent.input,/unselected-scene-/);
  const fields=protocol.properties.productionDraft.properties.candidateFramework.properties.branches.items.properties;
  assert.deepEqual(fields.metricIds.items.enum,[metric.id]);assert.equal(fields.actionIds.maxItems,0);
  return answer({productionDraft});
 }});
});
test('仅将选中资产的唯一精确code映射到id，未选或歧义引用继续拒绝',async()=>{
 const metric={...config.metrics.find(m=>m.id==='live-clickRate-change'),code:'DEMO_SELECTED_CLICK'},action={id:'selected-action',code:'DEMO_SELECTED_ACTION',name:'检查讲解'};
 const input=body({...base,operation:'generate_framework',phase:'generate',metrics:[metric],actions:[action]});
 const productionDraft={operation:'generate_framework',strategyMode:'',draftText:'检查点击效率。',candidateFramework:{...frame,branches:[{...frame.branches[0],metricIds:[metric.code],actionIds:[action.code]}]},candidateStrategies:[],missing:[],pipelineErrors:[]};
 const result=await produceAiddAsset(input,env,{fetchModel:async()=>answer({productionDraft})});
 assert.deepEqual(result.candidate.branches[0].metricIds,[metric.id]);assert.deepEqual(result.candidate.branches[0].actionIds,[action.id]);
 await assert.rejects(()=>produceAiddAsset(body({...input.productionInput,metrics:[metric,{...metric,id:'other-selected'}]}),env,{fetchModel:async()=>answer({productionDraft})}),/未选择的指标/);
 await assert.rejects(()=>produceAiddAsset(input,env,{fetchModel:async()=>answer({productionDraft:{...productionDraft,candidateFramework:{...frame,branches:[{...frame.branches[0],metricIds:['UNSELECTED_CODE'],actionIds:[]}]}}})}),/未选择的指标/);
});
test('框架临时试跑只解析当前修改稿，旧预览差异不作错误，也不混入已发布框架',async()=>{
 const text='当前人工修改稿：点击率环比小于0时，按本次指标核查点击效率。';
 const current={...frame,id:'frame-current-review',name:'当前审核框架',branches:[{...frame.branches[0],meaning:'OLD_PREVIEW_CONTENT'}]};
 const input=body({...base,operation:'generate_framework',strategyMode:'ai',phase:'test',parsed:false,sourceFramework:{...frame,id:'published-other',draftText:'UNRELATED_PUBLISHED_CONTENT'},candidateFramework:current,review:{confirmed:false,reviewedText:text},trialCases:[{id:'selected-case',fieldKey:'live',period:'week',metricValues:data.metrics}]});
 const productionDraft={operation:'generate_framework',strategyMode:'',draftText:'不得采用模型改写',candidateFramework:{...frame,id:'wrong-id',draftText:'不得采用模型改写'},candidateStrategies:[],missing:[],pipelineErrors:[]};
 let calls=0;const result=await produceAiddAsset(input,env,{fetchModel:async(url,options)=>{
  calls++;
  const sent=JSON.parse(options.body);assert.equal(sent.instructions,FRAMEWORK_TRIAL_SYSTEM_PROMPT);
  assert.match(sent.input,/当前人工修改稿/);assert.match(sent.input,/frame-current-review/);assert.doesNotMatch(sent.input,/OLD_PREVIEW_CONTENT|UNRELATED_PUBLISHED_CONTENT|published-other/);
  assert.equal(sent.text.format.type,'json_schema');assert.equal(Object.hasOwn(sent.text.format.schema.properties.productionDraft.properties,'draftText'),false);assert.deepEqual(sent.text.format.schema.required,['productionDraft','caseResults']);
  return answer({productionDraft,caseResults:[{caseId:'selected-case',summary:'点击效率下降，需核查。',branches:[{branchId:frame.branches[0].id,assessment:'problem',title:'点击效率下降',finding:'点击率环比回落。',method:'按当前稿对比点击率变化。',cause:'需结合商品展示核查。',causeStatus:'needs_verification',evidenceMetricIds:['live-clickRate-change'],actions:[],missing:[]}]}]});
 }});
 assert.equal(calls,1);assert.equal(result.status,'needs_review',result.answer);assert.equal(result.trialReport.executed,true);assert.equal(result.candidate.id,current.id);assert.equal(result.draftText,text);assert.equal(result.candidate.draftText,text);assert.equal(result.handoff.executionEligible,false);
});
