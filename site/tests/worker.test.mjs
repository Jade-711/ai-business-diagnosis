import {legacyDemoCatalog} from './legacy-catalog.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker,{extract} from '../worker/index.js';
const origin='https://example.chatgpt.site';
const req=(body,headers={},path='/api/diagnose')=>new Request(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(body)});
test('网站只调用固定版本扣子主流程，不增加网站模型网关往返',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.coze.cn/v1/workflow/stream_run');assert.equal(JSON.parse(options.body).workflow_version,'v0.0.16');return new Response(JSON.stringify({data:{result:{schemaVersion:1,answer:'已核验',workflow:{modelOutputReceived:true}}}}),{headers:{'content-type':'application/json'}});};
 try{const r=await worker.fetch(req({question:'诊断短视频-曝光'},{'oai-authenticated-user-email':'owner@example.com'}),{COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'owner@example.com',COZE_WORKFLOW_VERSION:'v0.0.16'});assert.match(await r.text(),/已核验/);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('扣子API报告的零模型token与原始cost单独保留，不冒充包含Trace的积分账单',async()=>{
 const original=globalThis.fetch;
 const data={node_title:'',node_is_finish:true,content:JSON.stringify({result:{schemaVersion:1,answer:'完成'}}),token:0,cost:'0.00'};
 globalThis.fetch=async()=>new Response(`event: Message\ndata: ${JSON.stringify(data)}\n\nevent: Done\ndata: {}\n\n`,{headers:{'content-type':'text/event-stream'}});
 try{const r=await worker.fetch(req({question:'诊断'},{'oai-authenticated-user-email':'owner@example.com'}),{COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'owner@example.com'});const t=await r.text(),v=JSON.parse(t.match(/event: result\ndata: ([^\n]+)/)[1]);assert.equal(v.cozeUsage.totalTokens,0);assert.equal(v.cozeUsage.reportedCost,'0.00');assert.equal(v.cozeUsage.costUnit,'not_supplied');assert.equal(v.cozeUsage.trace,'enabled');}finally{globalThis.fetch=original;}
});
test('服务端缺令牌返回明确状态且不暴露配置',async()=>{const response=await worker.fetch(new Request(origin+'/api/coze/status'),{});const data=await response.json();assert.equal(data.configured,false);assert.equal(JSON.stringify(data).includes('TOKEN'),false);assert.equal((await worker.fetch(req({question:'你好'}),{})).status,503);});
test('公开前端不允许匿名或未获授权账号消耗服务令牌',async()=>{const env={COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'owner@example.com'};assert.equal((await worker.fetch(req({question:'你好'}),env)).status,401);assert.equal((await worker.fetch(req({question:'你好'},{'oai-authenticated-user-email':'other@example.com'}),env)).status,403);assert.equal((await worker.fetch(req({question:'你好'},{origin:'https://foreign.example'}),env)).status,403);});
test('分块SSE只在Done之后交付完整结果，不输出模型思考',async()=>{const original=globalThis.fetch;const result={schemaVersion:1,answer:'样例诊断',dataMode:'demo',actions:[]};const envelope=JSON.stringify({output:JSON.stringify(result)});const half=Math.floor(envelope.length/2);const frames=[{event:'Message',data:{node_seq_id:'end',node_title:'结束',content:envelope.slice(0,half)}},{event:'Message',data:{node_seq_id:'end',node_title:'结束',content:envelope.slice(half),node_is_finish:true}},{event:'Done',data:{}}];globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.coze.cn/v1/workflow/stream_run');assert.equal(options.headers.authorization,'Bearer test-only');return new Response(frames.map(f=>`event: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}});};try{const response=await worker.fetch(req({question:'经营如何'},{'oai-authenticated-user-email':'owner@example.com'}),{COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'owner@example.com'});const text=await response.text();assert.match(text,/event: result/);assert.match(text,/样例诊断/);assert.doesNotMatch(text,/test-only|reasoning_content/);}finally{globalThis.fetch=original;}});
test('没有Done的半成品不得作为成功结果交付',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>new Response('event: Message\ndata: {"content":"partial"}\n\n',{headers:{'content-type':'text/event-stream'}});try{const response=await worker.fetch(req({question:'经营如何'},{'oai-authenticated-user-email':'owner@example.com'}),{COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'owner@example.com'});assert.match(await response.text(),/INCOMPLETE_RESULT/);}finally{globalThis.fetch=original;}});
test('可以解析Coze多层JSON字符串封装，不能接受普通模型文本',()=>{const result={schemaVersion:1,answer:'回答'};assert.deepEqual(extract(JSON.stringify({output:JSON.stringify(result)})),result);assert.equal(extract('模型文本'),null);});
test('商家继续调用原Coze主流程，生产请求不再提交任何工作流',async()=>{
 const original=globalThis.fetch,seen=[];
 globalThis.fetch=async(url,options)=>{seen.push({url,body:JSON.parse(options.body)});return new Response(JSON.stringify({data:{schemaVersion:1,status:'success',answer:'结果'}}),{headers:{'content-type':'application/json'}});};
 const env={COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'owner@example.com',COZE_WORKFLOW_ID:'merchant-flow'},headers={'oai-authenticated-user-email':'owner@example.com'};
 try{
  await (await worker.fetch(req({question:'为什么成交下降'},headers),env)).text();
  for(const operation of ['generate_framework','generate_strategies']){
   const response=await worker.fetch(req({question:'设计诊断',operation,productionInput:{goal:'资料不完整的生产请求'}},headers,'/api/aidd/generate'),env);
   assert.match(await response.text(),/invalid_input/);
  }
  assert.equal(seen.length,1);assert.equal(seen[0].body.workflow_id,'merchant-flow');
  assert.equal(seen[0].url,'https://api.coze.cn/v1/workflow/stream_run');
 }finally{globalThis.fetch=original;}
});
test('生产与商家入口不接受对方操作，后台生成继承相同授权检查',async()=>{
 const env={COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'owner@example.com'},headers={'oai-authenticated-user-email':'owner@example.com'};
 assert.equal((await worker.fetch(req({question:'生成',operation:'generate_framework'},headers),env)).status,400);
 assert.equal((await worker.fetch(req({question:'经营如何'},headers,'/api/aidd/generate'),env)).status,400);
 assert.equal((await worker.fetch(req({question:'生成',operation:'generate_strategies'},{},'/api/aidd/generate'),env)).status,401);
});
test('结构化请求只把问题与上下文送进主流程，配置通过鉴权接口短期存放',async()=>{
 const original=globalThis.fetch,seen=[],staged=[];
 const env={COZE_TYPED_INPUTS:'1',COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'typed@example.com',RESOURCE_API_BASE:'https://resource.example/api',RESOURCE_WRITE_KEY:'service-only'};
 globalThis.fetch=async(url,options)=>{if(url.endsWith('/request')){assert.equal(options.headers['x-resource-key'],'service-only');staged.push(JSON.parse(options.body));return new Response(JSON.stringify({requestId:'10000000-0000-4000-8000-000000000001'}),{status:201});}seen.push(JSON.parse(options.body));return new Response(JSON.stringify({data:{result:{schemaVersion:1,answer:'结果'}}}),{headers:{'content-type':'application/json'}});};
 try{const r=await worker.fetch(req({question:'分析全店',pageContext:{fieldKey:'live',period:'day'},chatId:'chat_existing',runtimeConfigurations:{'overview:week':{active:true,framework:'私有配置'}},config:{secret:'不能进入意图识别'}},{'oai-authenticated-user-email':'typed@example.com'}),env);assert.equal(r.status,200);await r.text();const p=seen[0].parameters;assert.equal(p.question,'分析全店');assert.deepEqual(p.pageContext,{fieldKey:'live',period:'day',metricKey:''});assert.equal(p.chatId,'chat_existing');assert.equal(p.fieldKey,undefined);assert.equal(p.period,undefined);assert.equal(p.input,undefined);assert.equal(p.config,undefined);assert.equal(JSON.stringify(p).includes('私有配置'),false);assert.equal(JSON.stringify(p).includes('service-only'),false);assert.match(p.requestId,/^[0-9a-f-]{36}$/);assert.equal(staged[0].configurations['overview:week'].framework,'私有配置');}finally{globalThis.fetch=original;}
});
test('资源读取拒绝过期请求与非演示商家，不泄露另一请求的配置',async()=>{
 const env={DB:{prepare(){return {bind(){return {async first(){return {configurations:'{}',expires_at:0};}};}};}}};
 const base=origin+'/api/workflow/configuration?requestId=10000000-0000-4000-8000-000000000001';
 assert.equal((await worker.fetch(new Request(base),env)).status,410);
 assert.equal((await worker.fetch(new Request(base+'&sellerId=REAL_SELLER'),env)).status,404);
 assert.equal((await worker.fetch(new Request(origin+'/api/workflow/metrics?fieldKey=unknown'),env)).status,400);
});
test('明确点名新指标时清除旧会话的指标限制，保留历史正文与场域周期',async()=>{
 const original=globalThis.fetch,seen=[];
 globalThis.fetch=async(url,options)=>{if(url.endsWith('/request'))return new Response(JSON.stringify({requestId:'10000000-0000-4000-8000-000000000001'}),{status:201});seen.push(JSON.parse(options.body).parameters);return new Response(JSON.stringify({data:{result:{schemaVersion:1,answer:'结果'}}}),{headers:{'content-type':'application/json'}});};
 const env={COZE_TYPED_INPUTS:'1',COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'typed@example.com',RESOURCE_API_BASE:'https://resource.example/api',RESOURCE_WRITE_KEY:'service-only'};
 const history=[{role:'assistant',content:'上一轮成交金额说明',context:{fieldKey:'live',period:'week',metricKey:'gmv'}}],pageContext={fieldKey:'live',period:'week',metricKey:'research-metric-live-02'};
 try{await(await worker.fetch(req({question:'分析直播观看人数',pageContext,history,runtimeConfigurations:{'live:week':{catalogRevision:'syt-research',metrics:[{id:'research-metric-live-10',originalName:'观看人数'}]}}},{'oai-authenticated-user-email':'typed@example.com'}),env)).text();assert.deepEqual(seen[0].pageContext,pageContext);assert.deepEqual(seen[0].history,[{...history[0],context:{fieldKey:'live',period:'week'}}]);assert.equal(history[0].context.metricKey,'gmv');assert.equal(seen[0].question,'分析直播观看人数');}
 finally{globalThis.fetch=original;}
});
test('可以解析结构化生产结果与嵌套诊断对象',()=>{
 assert.equal(extract({result:{schemaVersion:1,answer:'诊断'}}).answer,'诊断');
 assert.deepEqual(extract({operation:'generate_strategies',status:'needs_review',answer:'候选',candidateFramework:{},candidateStrategies:[{name:'策略'}]}).candidate,[{name:'策略'}]);
});

test('后台人工确认独立执行，不依赖Coze令牌、模型密钥或外部资料暂存',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('人工配置不应请求外部接口');};
 const {config}=legacyDemoCatalog['live:week'];
 const frame=config.frameworkCandidates[0];
 const p={phase:'confirm',strategyMode:'manual',scenes:[{id:frame.sceneId,fieldKey:'live',metricIds:config.metrics.map(m=>m.id),actionIds:[]}],goal:frame.goal,scope:frame.scope,metrics:config.metrics,actions:[],sourceFramework:frame,review:{confirmed:true,reviewer:'产运'},manualStrategies:[{id:'manual-1',sceneId:frame.sceneId,name:'点击下降',execution:'指标规则',period:'week',metricIds:['live-clickRate-change'],actionIds:[],rule:{metricId:'live-clickRate-change',op:'<',rightType:'value',value:-10}}],prompt:'无关Prompt',knowledge:[{content:'无关知识'}],trialCases:[{id:'不应提前执行'}]};
 try{
  const response=await worker.fetch(req({question:'审核点击诊断',operation:'generate_strategies',productionInput:p},{'oai-authenticated-user-email':'review@example.com'},'/api/aidd/generate'),{COZE_ALLOWED_EMAIL:'review@example.com'});
  const text=await response.text();assert.match(text,/event: result/);
  const result=JSON.parse(text.match(/event: result\ndata: ([^\n]+)/)[1]);
  assert.equal(result.status,'ready_for_gray');assert.equal(result.candidate[0].id,'manual-1');
  assert.equal(result.trialReport.executed,false);assert.equal(result.handoff.executionEligible,false);
  assert.equal(result.handoff.consumerWorkflow,'Main_agent');
 }finally{globalThis.fetch=original;}
});

test('真实SSE在上游尚未返回时就给出连接状态，随后逐块转发公开说明',async()=>{
 const original=globalThis.fetch,encoder=new TextEncoder();let upstream,resolveFetch,signal;
 const pending=new Promise(resolve=>resolveFetch=resolve);
 globalThis.fetch=async(url,options)=>{signal=options.signal;await pending;return new Response(new ReadableStream({start(c){upstream=c;}}),{headers:{'content-type':'text/event-stream'}});};
 try{
  const response=await worker.fetch(req({question:'流式测试'},{'oai-authenticated-user-email':'stream@example.com'}),{COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'stream@example.com'});
  const reader=response.body.getReader(),read=async()=>new TextDecoder().decode((await reader.read()).value);
  assert.match(await read(),/正在准备工作流请求/);resolveFetch();assert.match(await read(),/工作流接口已响应/);
  const frame=(data,event='Message')=>`event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`;
  const send=data=>upstream.enqueue(encoder.encode(frame(data)));
  send({node_title:'Think：内部推理',content:'PRIVATE',reasoning_content:'SECRET'});
  const checkpoint='AIDD_STREAM_V1\n'+JSON.stringify({kind:'evidence',metrics:[{id:'live-gmv-value',label:'支付金额',value:48560,unit:'元'}],requestId:'must-not-leak'});
  send({node_title:'先展示已取得的指标',node_execute_uuid:'data',node_seq_id:1,content:checkpoint.slice(0,23)});
  send({node_title:'先展示已取得的指标',node_execute_uuid:'data',node_seq_id:2,content:checkpoint.slice(23),node_is_finish:true});
  const evidence=await read();assert.match(evidence,/event: update/);assert.match(evidence,/48560/);assert.doesNotMatch(evidence,/PRIVATE|SECRET|must-not-leak|requestId/);
  send({node_title:'流式回答｜诊断说明',node_execute_uuid:'text',node_seq_id:1,content:'订单减少，'});
  assert.match(await read(),/订单减少，/);
  send({node_title:'流式回答｜诊断说明',node_execute_uuid:'text',node_seq_id:2,content:'建议检查重点商品。'});
  assert.match(await read(),/建议检查重点商品/);
  const result={schemaVersion:1,answer:'完整答案'},encoded=JSON.stringify({result});
  send({node_title:'结束',node_execute_uuid:'end',node_seq_id:1,content:encoded.slice(0,12)});
  send({node_title:'结束',node_execute_uuid:'end',node_seq_id:2,content:encoded.slice(12),node_is_finish:true});
  upstream.enqueue(encoder.encode(frame({},'Done')));upstream.close();
  const final=await read();assert.match(final,/event: result/);const metadata=JSON.parse(final.match(/^data: (.*)$/m)[1]).performance;assert.equal(metadata.route,'coze_workflow');assert.equal(metadata.workflowInvoked,true);assert.equal(metadata.modelInvoked,null);assert.ok(metadata.serverMs>=0);assert.equal((await reader.read()).done,true);assert.equal(signal.aborted,false);
 }finally{globalThis.fetch=original;}
});
test('公开预览之后发生错误，不能发出成功结果，关闭客户端会中止上游',async()=>{
 const original=globalThis.fetch;let upstream,signal;
 globalThis.fetch=async(url,options)=>{signal=options.signal;return new Response(new ReadableStream({start(c){upstream=c;}}),{headers:{'content-type':'text/event-stream'}});};
 try{
  const response=await worker.fetch(req({question:'中断测试'},{'oai-authenticated-user-email':'cancel@example.com'}),{COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'cancel@example.com'});
  const reader=response.body.getReader();await reader.read();await reader.read();await reader.cancel();assert.equal(signal.aborted,true);upstream.close();
  const result={schemaVersion:1,answer:'初步回答'};
  globalThis.fetch=async()=>new Response(`event: Message\ndata: ${JSON.stringify({node_title:'流式结果｜完整回答',content:'AIDD_STREAM_V1\n'+JSON.stringify({kind:'result',result})})}\n\nevent: Error\ndata: {"error_code":"TEST"}\n\n`,{headers:{'content-type':'text/event-stream'}});
  const failed=await worker.fetch(req({question:'失败测试'},{'oai-authenticated-user-email':'fail@example.com'}),{COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'fail@example.com'}),text=await failed.text();
  assert.match(text,/event: update/);assert.match(text,/event: error/);assert.doesNotMatch(text,/event: result/);
 }finally{globalThis.fetch=original;}
});

test('Coze返回的小数字符串在已知数值字段还原，缺失值不被当成零',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({data:{result:{schemaVersion:1,branch:'diagnosis',answer:'模型回复',workflowContract:1,workflow:{modelOutputReceived:true},goal:{actual:190000,target:143000,rate:'132.867132867133',gap:0},evidence:[{value:'6.2',previousValue:'4.8',label:'金额退款率（支付日）'},{value:null,previousValue:''}],diagnosis:[]}}}),{headers:{'content-type':'application/json'}});
 try{const response=await worker.fetch(req({question:'帮我分析近7天全店的目标差距'},{'oai-authenticated-user-email':'number@example.com'}),{COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'number@example.com'}),text=await response.text(),result=JSON.parse(text.match(/event: result\ndata: ([^\n]+)/)[1]);assert.equal(result.goal.rate,132.867132867133);assert.equal(result.evidence[0].value,6.2);assert.equal(result.evidence[0].previousValue,4.8);assert.equal(result.evidence[1].value,null);assert.equal(result.evidence[1].previousValue,'');assert.equal(result.performance.modelInvoked,true);assert.equal(result.performance.modelEvidenceSource,'workflow_model_output');}
 finally{globalThis.fetch=original;}
});
test('最终模型回执按实际调用汇总交给页面，原始用量JSON不透出',async()=>{
 const original=globalThis.fetch;
 const usage={stage:'explanation',responseId:'receipt-1',model:'deepseek-flash',reasoningEffort:'none',inputTokens:100,outputTokens:20,totalTokens:120,cachedInputTokens:10,reasoningTokens:0};
 globalThis.fetch=async()=>new Response(JSON.stringify({data:{result:{schemaVersion:1,answer:'完成',modelUsageJson:JSON.stringify({calls:[usage]})}}}),{headers:{'content-type':'application/json'}});
 try{const r=await worker.fetch(req({question:'分析'},{'oai-authenticated-user-email':'usage@example.com'}),{COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'usage@example.com'});const text=await r.text();const result=JSON.parse(text.match(/event: result\ndata: ([^\n]+)/)[1]);assert.equal(result.modelUsage.totalTokens,120);assert.equal(result.modelUsage.calls[0].nodeId,'310002');assert.equal(result.modelUsageJson,undefined);assert.equal(result.performance.modelInvoked,true);}finally{globalThis.fetch=original;}
});


test('命名End返回的扣子usage总量单列，忽略中途输出节点用量且不累加',async()=>{
 const original=globalThis.fetch;
 const events=[{event:'Message',data:{node_title:'先展示已取得的指标',node_is_finish:true,usage:{input_count:100,output_count:50,token_count:150},content:''}},{event:'Message',data:{node_title:'End',node_id:'900001',node_is_finish:true,usage:{input_count:0,output_count:0,token_count:0},content:JSON.stringify({result:{schemaVersion:1,answer:'完成',modelUsageJson:JSON.stringify({calls:[{stage:'knowledge',responseId:'ds-sample',inputTokens:300,outputTokens:120,totalTokens:420,cachedInputTokens:10,reasoningTokens:0}]})}})}},{event:'Done',data:{}}];
 globalThis.fetch=async()=>new Response(events.map(e=>`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}});
 try{const r=await worker.fetch(req({question:'诊断'},{'oai-authenticated-user-email':'receipt@example.com'}),{COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'receipt@example.com'});const text=await r.text(),v=JSON.parse(text.match(/event: result\ndata: ([^\n]+)/)[1]);assert.equal(v.cozeUsage.totalTokens,0);assert.equal(v.cozeUsage.inputTokens,0);assert.equal(v.modelUsage.totalTokens,420);assert.equal(v.modelUsage.callCount,1);}finally{globalThis.fetch=original;}
});

test('真实中途输出与最终回执共同确认当前版本执行路径，不新增工作流调用',async()=>{
 const original=globalThis.fetch;let requests=0;
 const usage={calls:[{stage:'explanation',responseId:'stage-receipt',inputTokens:100,outputTokens:20,totalTokens:120,cachedInputTokens:0,reasoningTokens:0}]};
 const result={schemaVersion:1,answer:'完成',branch:'diagnosis',context:{fieldKey:'overview',period:'week'},modelUsageJson:JSON.stringify(usage)};
 const frames=[{event:'Message',data:{node_title:'先展示已取得的指标',node_is_finish:true,node_execute_uuid:'checkpoint',content:'AIDD_STREAM_V1\n'+JSON.stringify({kind:'evidence',metrics:[{label:'成交金额',value:190000}]})}},{event:'Message',data:{node_title:'End',node_is_finish:true,content:JSON.stringify({result}),usage:{token_count:0}}},{event:'Done',data:{}}];
 globalThis.fetch=async()=>{requests++;return new Response(frames.map(f=>`event: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}});};
 try{const response=await worker.fetch(req({question:'经营分析'},{'oai-authenticated-user-email':'stages@example.com'}),{COZE_API_TOKEN:'test-only',COZE_ALLOWED_EMAIL:'stages@example.com',COZE_WORKFLOW_VERSION:'v0.0.16'});const text=await response.text(),events=text.trim().split('\n\n').map(frame=>({event:frame.match(/^event: (.+)/)[1],data:JSON.parse(frame.match(/\ndata: (.+)/)[1])})),checkpoint=events.find(e=>e.data.kind==='execution'),final=events.find(e=>e.event==='result');assert.equal(requests,1);assert.equal(checkpoint.data.stages.length,4);assert.equal(final.data.workflowExecution.stages.length,7);assert.equal(final.data.workflowExecution.stages.find(s=>s.id==='explanation').deepseekTokens,120);assert.ok(final.data.workflowExecution.stages.every(s=>s.cozeTokens===0));assert.ok(text.indexOf('"kind":"execution"')<text.indexOf('event: result'));}finally{globalThis.fetch=original;}
});
