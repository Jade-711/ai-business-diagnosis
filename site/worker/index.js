import {configurationPayload,metricsPayload} from './resource-contract.js';
import {runAiddProduction,aiddModelConfigured} from './aidd-production.js';
import {readDashboardSnapshots,saveDashboardSnapshot,dashboardSnapshotQuestion,dashboardSnapshotSignature} from './dashboard-snapshots.js';
import {sanitizePublicDemoRequest,reservePublicDemoBudget} from './public-demo.js';
import {summarizeModelUsage} from '../shared/model-usage.js';
import {workflowProgressStages} from '../shared/workflow-progress.js';
import {readActionPublications,saveActionPublication} from './action-publications.js';
import {applyActionMappingPublications,applyActionMappingCatalog} from '../shared/published-actions.js';
const STATIC_ASSETS = {};
const DEMO_CATALOG = {};
const WORKFLOW_ID='7699762508375294003';
const limits=new Map();
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
function identity(request,env){
 const email=request.headers.get('oai-authenticated-user-email')||'';
 const allowed=String(env.COZE_ALLOWED_EMAIL||'').split(',').map(e=>e.trim().toLowerCase()).filter(Boolean);
 return {signedIn:!!email,authorized:!!email&&allowed.includes(email.toLowerCase())};
}
function extract(content){
 let value=content;
 for(let n=0;n<5;n++){
  if(typeof value==='string'){try{value=JSON.parse(value);}catch{return null;}}
  else if(value?.schemaVersion===1&&typeof value.answer==='string')return value;
  else if(value&&typeof value==='object'&&Object.hasOwn(value,'result'))value=value.result;
  else if(value&&typeof value==='object'&&Object.hasOwn(value,'candidateFramework'))return {...value,schemaVersion:1,candidate:value.operation==='generate_framework'?value.candidateFramework:value.candidateStrategies};
  else if(value&&typeof value==='object'&&Object.hasOwn(value,'output'))value=value.output;
  else return null;
 }
 return value?.schemaVersion===1&&typeof value.answer==='string'?value:null;
}
function readEvent(frame){
 const lines=frame.replace(/\r/g,'').split('\n');
 return {event:lines.find(l=>l.startsWith('event:'))?.slice(6).trim()||'message',data:lines.filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n')};
}
const STREAM_NODES=new Set(['流式进度｜场景','流式进度｜任务与分析范围','流式进度｜框架、方向与策略','流式进度｜数据','先展示已取得的指标','流式进度｜规则','流式结果｜诊断卡片','流式结果｜完整回答']);
const TEXT_NODES=new Set(['流式回答｜诊断说明','流式回答｜知识问答']);
function cozeScopeHistory(body){
 const history=Array.isArray(body.history)?body.history:[],question=String(body.question||'');
 const explicitMetric=Object.values(body.runtimeConfigurations||{}).some(config=>(config?.metrics||[]).some(m=>m.originalName&&question.includes(m.originalName)));
 if(!explicitMetric)return history;
 // A specifically named new metric supersedes the previous answer's metric.
 // Keep prior text, field and period; do not let the legacy router inherit an
 // unrelated old alias when it cannot recognize the new metric name itself.
 return history.map(message=>{if(!message.context?.metricKey)return message;const {metricKey,...context}=message.context;return {...message,context};});
}
function cozeQuestion(body){return String(body.question||'');}
function workflowNumbers(value,key=''){
 const numeric=new Set(['value','previousValue','change','actual','target','rate','gap','excess','priority','configVersion','frameworkVersion','schemaVersion','workflowContract','contract']);
 if(typeof value==='string'&&numeric.has(key)&&/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)&&Number.isFinite(Number(value)))return Number(value);
 if(Array.isArray(value))return value.map(v=>workflowNumbers(v));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,workflowNumbers(v,k)]));
 return value;
}

function streamCheckpoint(content){
 if(!content.startsWith('AIDD_STREAM_V1\n'))return null;
 let p;try{p=JSON.parse(content.slice(15));}catch{return null;}
 const string=v=>typeof v==='string'?v.slice(0,600):'',number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const metric=m=>({metricId:string(m.metricId||m.id),label:string(m.label||m.name),value:number(m.value),unit:string(m.unit),previousValue:number(m.previousValue)});
 if(p.kind==='context')return {kind:'context',branch:['diagnosis','data','knowledge','clarification'].includes(p.branch)?p.branch:'clarification',context:{...(['overview','live','video','shelf','creator'].includes(p.context?.fieldKey)?{fieldKey:p.context.fieldKey}:{}),...(['week','day'].includes(p.context?.period)?{period:p.context.period}:{})}};
 if(p.kind==='evidence')return {kind:'evidence',metrics:(Array.isArray(p.metrics)?p.metrics:[]).slice(0,12).map(metric),source:string(p.source),errors:(Array.isArray(p.errors)?p.errors:[]).slice(0,4).map(string)};
 if(p.kind==='findings')return {kind:'findings',findings:(Array.isArray(p.findings)?p.findings:[]).slice(0,4).map(f=>({name:string(f.name),evidence:(Array.isArray(f.evidence)?f.evidence:[]).slice(0,4).map(metric)})),errors:(Array.isArray(p.errors)?p.errors:[]).slice(0,4).map(string)};
 if(p.kind==='plan')return {kind:'plan',frameworkName:string(p.frameworkName),frameworkVersion:number(p.frameworkVersion),steps:(Array.isArray(p.steps)?p.steps:[]).slice(0,8).map(string),strategyCount:number(p.strategyCount),errors:(Array.isArray(p.errors)?p.errors:[]).slice(0,4).map(string)};
 if(p.kind==='result'){const result=extract(p.result);return result?{kind:'preview',result}:null;}
 return null;
}
async function runCoze(request,env,body,evaluation=null){
 const encoder=new TextEncoder(),upstream=new AbortController(),started=Date.now();
 request.signal.addEventListener('abort',()=>upstream.abort(),{once:true});
 let closed=false;
 const stream=new ReadableStream({async start(controller){
  const route='coze_workflow',observedNodes=new Map(),executionIdentity={},knownGraph=(env.COZE_WORKFLOW_ID||WORKFLOW_ID)===WORKFLOW_ID&&env.COZE_WORKFLOW_VERSION==='v0.0.16';
  const modelTitles=new Set(['基于本次证据形成原因判断与行动建议','生成原因判断与行动建议','按校验意见补全本轮诊断','补全未通过核查的回答','理解复杂问题与指代','理解复杂问法','知识问答（模型通用知识，未接RAG）','回答经营知识问题']);
  const send=(event,data)=>{if(!closed){
   const nodes=[...observedNodes.values()],modelNodes=nodes.filter(n=>n.complete&&modelTitles.has(n.name)),modelReceipt=data?.workflowContract===1&&data.workflow?.modelOutputReceived===true,providerReceipt=data?.modelUsage?.accounting==='provider_usage'&&data.modelUsage.complete===true;
   const value=event==='result'?{...workflowNumbers(data),performance:{route,serverMs:Math.max(0,Date.now()-started),modelInvoked:providerReceipt?data.modelUsage.callCount>0:modelNodes.length||modelReceipt?true:null,modelEvidenceSource:providerReceipt?'server_model_usage':modelNodes.length?'coze_node_response':modelReceipt?'workflow_model_output':'unavailable',workflowInvoked:true},workflowExecution:{nodes,...executionIdentity,modelNodeCount:modelNodes.length,stages:workflowProgressStages({result:data,knownGraph})}}:{...data,elapsedMs:Math.max(0,Date.now()-started)};
   controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`));
  }};
  let reader,cozeUsage=null;
  const deliverResult=async result=>{
   if(typeof result.modelUsageJson==='string'){
    try{const receipt=JSON.parse(result.modelUsageJson);if(!Array.isArray(receipt.calls))throw new Error('用量缺少调用记录');result={...result,modelUsage:summarizeModelUsage(receipt.calls)};}catch{result={...result,modelUsage:{provider:'DeepSeek',accounting:'provider_usage',complete:false,calls:[]}};}
    delete result.modelUsageJson;
   }
   if(cozeUsage)result={...result,cozeUsage};
   if(body.dashboardSnapshot===true){
    await saveDashboardSnapshot(env.DB,request.headers.get('oai-authenticated-user-email'),body,workflowNumbers(result),DEMO_CATALOG);
    const key=body.pageContext.fieldKey+':'+body.pageContext.period,resource=DEMO_CATALOG[key],config=body.runtimeConfigurations?.[key];
    if(env.COZE_PUBLIC_DEMO==='1'&&resource?.dashboardConfig&&await dashboardSnapshotSignature(config,resource.data)===await dashboardSnapshotSignature(resource.dashboardConfig,resource.data))await saveDashboardSnapshot(env.DB,'public-demo',body,workflowNumbers(result),DEMO_CATALOG);
   }
   send('result',result);
  };
  try{
   send('progress',{stage:'正在准备工作流请求',step:'preparing_workflow'});
   const workflowId=evaluation?.workflowId||env.COZE_WORKFLOW_ID||WORKFLOW_ID;
   let parameters={input:JSON.stringify(body)};
   if(evaluation)parameters=evaluation.parameters;
   else if(env.COZE_TYPED_INPUTS==='1'){
     if(!env.RESOURCE_API_BASE||!env.RESOURCE_WRITE_KEY)throw new Error('诊断资源接口尚未连接，请稍后重试。');
     const staged=await fetch(env.RESOURCE_API_BASE+'/request',{method:'POST',signal:upstream.signal,headers:{'content-type':'application/json','x-resource-key':env.RESOURCE_WRITE_KEY},body:JSON.stringify({configurations:{...(body.runtimeConfigurations||{}),__request:{question:body.question,pageContext:body.pageContext||body.context||{},excludeStrategyIds:Array.isArray(body.excludeStrategyIds)?body.excludeStrategyIds.filter(id=>typeof id==='string').slice(0,120):[]}}})});
     if(!staged.ok)throw new Error('诊断资源暂存失败，请稍后重试。');
     const {requestId}=await staged.json();
     if(!/^[0-9a-f-]{36}$/.test(requestId||''))throw new Error('未取得有效的诊断请求标识。');
     const page=body.pageContext||body.context||{};
     parameters={question:cozeQuestion(body),sellerId:body.sellerId||body.context?.sellerId||'DEMO_10001',pageContext:{fieldKey:typeof page.fieldKey==='string'?page.fieldKey:'',period:typeof page.period==='string'?page.period:'',metricKey:typeof page.metricKey==='string'?page.metricKey:''},history:cozeScopeHistory(body),chatId:body.chatId||body.context?.chatId||'',requestId};
   }
   const version=evaluation?.workflowVersion||env.COZE_WORKFLOW_VERSION;
   const response=await fetch('https://api.coze.cn/v1/workflow/stream_run',{method:'POST',signal:upstream.signal,headers:{'content-type':'application/json',authorization:'Bearer '+env.COZE_API_TOKEN},body:JSON.stringify({workflow_id:workflowId,...(version?{workflow_version:version}:{}),parameters})});
   if(!response.ok)throw new Error(response.status===401?'Coze访问令牌无效或已过期。':'Coze服务暂时无法执行，请检查工作流发布状态和调用权限。');
   send('progress',{stage:'工作流接口已响应，等待完整结果',step:'workflow_response_received'});
   if(!response.headers.get('content-type')?.includes('text/event-stream')){
    const value=await response.json().catch(()=>({})),result=extract(value.data);
    if(!result)throw new Error(Number(value.code)===4028?'扣子账户积分不足（4028），本次诊断未完成；积分恢复后可重试。':'Coze未返回有效工作流结果，请检查发布版本。');
    await deliverResult(result);return;
   }
   let buffer='',candidate=null,done=false,failed=false;
   const contents=new Map(),seenIds=new Set(),sentCheckpoints=new Set();
   const handle=frame=>{
    const event=readEvent(frame);let data;try{data=JSON.parse(event.data);}catch{return;}
    const eventId=frame.replace(/\r/g,'').split('\n').find(l=>l.startsWith('id:'))?.slice(3).trim();
    if(eventId){if(seenIds.has(eventId))return;seenIds.add(eventId);}
    if(event.event==='Error'||event.event==='Interrupt'){
     const code=data.error_code||data.code||'WORKFLOW_ERROR';
     failed=true;send('error',{error:event.event==='Interrupt'?'工作流需要补充输入，请明确场域与周期后重新发起。':Number(code)===4028?'扣子账户积分不足（4028），本次诊断未完成；积分恢复后可重试。':'Coze工作流执行失败，请重新分析；已显示的内容尚未完成核对。',code});return;
    }
    if(event.event==='Message'){
     const title=String(data.node_title||''),key=String(data.node_execute_uuid||data.node_id||title||'end');
     if((!title||String(data.node_id)==='900001'||['End','结束'].includes(title))&&data.node_is_finish===true&&(Number.isFinite(data.token)||data.usage||typeof data.cost==='string'))cozeUsage={accounting:'coze_api_reported',totalTokens:Number.isFinite(data.usage?.token_count)?data.usage.token_count:Number.isFinite(data.token)?data.token:null,inputTokens:Number.isFinite(data.usage?.input_count)?data.usage.input_count:null,outputTokens:Number.isFinite(data.usage?.output_count)?data.usage.output_count:null,reportedCost:typeof data.cost==='string'?data.cost:null,costUnit:'not_supplied',trace:'enabled'};
     if(title){const previous=observedNodes.get(key);observedNodes.set(key,{nodeId:String(data.node_id||''),nodeExecuteId:String(data.node_execute_uuid||''),name:title,complete:previous?.complete||data.node_is_finish===true});}
     const text=typeof data.content==='string'?data.content:'';
     // Only explicitly public Output nodes may supply live text. Never forward model reasoning fields.
     if(TEXT_NODES.has(title)&&text)send('delta',{kind:title.includes('知识')?'knowledge':'diagnosis',text:text.slice(0,12000)});
     const combined=(contents.get(key)||'')+text;
     if(combined.length>262144)throw new Error('工作流返回内容过长，请缩小分析范围。');
     contents.set(key,combined);
     if(STREAM_NODES.has(title)){
      const checkpoint=streamCheckpoint(combined);
      if(checkpoint&&!sentCheckpoints.has(key)){sentCheckpoints.add(key);send('update',checkpoint);if(checkpoint.kind==='evidence'&&title==='先展示已取得的指标'&&knownGraph)send('update',{kind:'execution',stages:workflowProgressStages({checkpoint:true,knownGraph})});if(checkpoint.kind==='preview')candidate=checkpoint.result;}
     }
     const result=extract(combined)||extract(text);if(result)candidate=result;
    }
    if(event.event==='PING')send('ping',{});
    if(event.event==='Done'){
     done=true;
     if(typeof data.debug_url==='string'&&data.debug_url.startsWith('https://www.coze.cn/work_flow?')){
      executionIdentity.debugUrl=data.debug_url;
      executionIdentity.executeId=new URL(data.debug_url).searchParams.get('execute_id')||'';
     }
    }
   };
   reader=response.body.getReader();const decoder=new TextDecoder();
   while(true){
    const chunk=await reader.read();if(chunk.done)break;
    buffer+=decoder.decode(chunk.value,{stream:true});let match;
    while((match=/\r?\n\r?\n/.exec(buffer))){handle(buffer.slice(0,match.index));buffer=buffer.slice(match.index+match[0].length);}
    if(buffer.length>262144)throw new Error('工作流消息过长，请重新分析。');
    if(failed){await reader.cancel();break;}
   }
   buffer+=decoder.decode();if(buffer.trim())handle(buffer);
   if(!failed){if(!done||!candidate)send('error',{error:'Coze未返回完整结果，请稍后重试；已显示的内容尚未完成核对。',code:'INCOMPLETE_RESULT'});else await deliverResult(candidate);}
  }catch(error){if(!upstream.signal.aborted)send('error',{error:error.message||'Coze连接中断，请重新发送问题。',code:'CONNECTION_INTERRUPTED'});}
  finally{reader?.releaseLock();if(!closed){closed=true;controller.close();}}
 },cancel(){closed=true;upstream.abort();}});
 return new Response(stream,{headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-store, no-transform','x-content-type-options':'nosniff','x-accel-buffering':'no'}});
}
async function api(request,env,url){
 if(request.method==='GET'&&['/api/workflow/configuration','/api/workflow/metrics'].includes(url.pathname))return workflowResource(request,env,url);
 const user=identity(request,env),publicDemo=env.COZE_PUBLIC_DEMO==='1',configured=!!env.COZE_API_TOKEN&&(publicDemo||!!env.COZE_ALLOWED_EMAIL),chatAuthorized=user.authorized||publicDemo;
 if(url.pathname==='/api/evaluation/resource'){
  if(request.method!=='POST')return json({error:'操作不支持'},405);
  if(!env.EVAL_RUN_KEY||Date.now()>Number(env.EVAL_RUN_UNTIL||0)||!env.EVAL_RESOURCE_PREVIEW)return json({error:'本轮评测资源入口未启用'},503);
  const id=request.headers.get('x-diagnosis-request')||'';
  if(!/^[0-9a-f-]{36}$/.test(id))return json({error:'必须使用已暂存的测试快照'},403);
  const text=await request.text();if(new TextEncoder().encode(text).length>16000)return json({error:'请求过大'},413);
  let p;try{p=JSON.parse(text);}catch{return json({error:'请求格式无效'},400);}
  if(!['diagnosis','data'].includes(p.mode)||p.context?.sellerId!=='DEMO_10001'||p.context?.requestId!==id||typeof p.question!=='string')return json({error:'评测资源范围无效'},400);
  const preview=new URL(env.EVAL_RESOURCE_PREVIEW);
  if(preview.origin!=='https://evaluation-resource.example')return json({error:'评测资源地址无效'},503);
  const target=new URL('/api/'+(p.mode==='diagnosis'?'workflow-calculate':'workflow-input'),preview.origin);target.search=preview.search;
  const upstream=await fetch(target,{method:'POST',headers:{'content-type':'application/json','x-diagnosis-request':id},body:JSON.stringify({context:p.context,question:p.question,mode:p.mode})});
  const value=await upstream.json().catch(()=>({error:'评测资源响应无效'}));return json(value,upstream.status);
 }
 if(url.pathname==='/api/evaluation/run'){
  if(request.method!=='POST')return json({error:'操作不支持'},405);
  const serviceKey=request.headers.get('x-evaluation-key')||'';
  const serviceAuthorized=!!env.EVAL_RUN_KEY&&serviceKey.length>=32&&serviceKey===env.EVAL_RUN_KEY;
  if(!serviceAuthorized&&(!user.authorized||request.headers.get('origin')!==url.origin))return json({error:'此入口仅供项目授权评测使用'},403);
  if(!env.EVAL_RUN_KEY||Date.now()>Number(env.EVAL_RUN_UNTIL||0)||!env.COZE_API_TOKEN)return json({error:'本轮评测入口未启用'},503);
  const text=await request.text();if(new TextEncoder().encode(text).length>64000)return json({error:'评测请求过大'},413);
  let p;try{p=JSON.parse(text);}catch{return json({error:'请求格式无效'},400);}
  if(!p||p.sellerId!=='DEMO_10001'||typeof p.question!=='string'||!p.question.trim()||p.question.length>2000||!/^[0-9a-f-]{36}$/.test(p.requestId||'')||typeof p.chatId!=='string'||!p.chatId.startsWith('eval-'))return json({error:'评测范围或快照无效'},400);
  if(Object.keys(p).some(k=>!['sellerId','question','requestId','chatId','pageContext','history'].includes(k)))return json({error:'评测入口不接受替换规则、答案或模型配置'},400);
  const parameters={sellerId:p.sellerId,question:p.question,requestId:p.requestId,chatId:p.chatId,pageContext:p.pageContext||{},history:Array.isArray(p.history)?p.history:[]};
  return runCoze(request,env,parameters,{workflowId:'7704887885451542582',workflowVersion:env.EVAL_WORKFLOW_VERSION||'v0.0.1',parameters});
 }
 if(url.pathname==='/api/coze/status'&&request.method==='GET')return json({configured,authorized:chatAuthorized,adminAuthorized:user.authorized,publicDemo,signedIn:user.signedIn,workflowId:env.COZE_WORKFLOW_ID||WORKFLOW_ID,productionBackend:'direct_model',productionConfigured:aiddModelConfigured(env),mode:configured&&chatAuthorized?'coze':'demo'});
 if(url.pathname==='/api/dashboard/action-mappings'){
  if(request.method==='GET'){
   if(!publicDemo&&!user.authorized)return json({error:'请登录有权限的账号'},user.signedIn?403:401);
   try{return json(await readActionPublications(env.DB));}catch{return json({error:'行动映射暂时无法读取'},503);}
  }
  if(request.method!=='POST')return json({error:'操作不支持'},405);
  if(request.headers.get('origin')!==url.origin)return json({error:'请从当前应用页面发布'},403);
  if(!user.authorized)return json({error:'只有后台管理员可发布行动映射'},user.signedIn?403:401);
  const text=await request.text();if(new TextEncoder().encode(text).length>200000)return json({error:'行动映射内容过大'},413);
  let body;try{body=JSON.parse(text);}catch{return json({error:'行动映射JSON无效'},400);}
  try{return json({publication:await saveActionPublication(env.DB,body)});}catch(error){return json({error:error.message},error.message.includes('无效')?400:503);}
 }
 const isProduction=url.pathname==='/api/aidd/generate',isSnapshot=url.pathname==='/api/dashboard/snapshot';
 if(!['/api/diagnose','/api/aidd/generate','/api/dashboard/snapshot'].includes(url.pathname)||request.method!=='POST')return json({error:'接口不存在'},404);
 if(request.headers.get('origin')!==url.origin)return json({error:'请从当前应用页面发起请求。'},403);
 if(!isProduction&&!isSnapshot&&!configured)return json({error:'Coze服务端接入尚未配置完成。',code:'COZE_NOT_CONFIGURED'},503);
 if(isProduction&&!env.COZE_ALLOWED_EMAIL)return json({error:'AIDD后台的访问授权尚未配置。',code:'AIDD_NOT_CONFIGURED'},503);
 const requireOwner=()=>!user.signedIn?json({error:'此操作需要后台管理员登录。',code:'SIGN_IN_REQUIRED'},401):!user.authorized?json({error:'当前账号没有后台配置权限。',code:'FORBIDDEN'},403):null;
 if(isProduction||!publicDemo){const denied=requireOwner();if(denied)return denied;}
 if(Number(request.headers.get('content-length')||0)>800000)return json({error:'请求内容过大。'},413);
 const text=await request.text();if(new TextEncoder().encode(text).length>800000)return json({error:'请求内容过大。'},413);
 let body;try{body=JSON.parse(text);}catch{return json({error:'请求JSON无效。'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'请求JSON无效。'},400);
 if(isSnapshot){
  if(body.operation==='read')try{return json(await readDashboardSnapshots(env.DB,user.authorized?request.headers.get('oai-authenticated-user-email'):'public-demo',body.runtimeConfigurations,DEMO_CATALOG));}catch{return json({error:'看板快照暂时无法读取',snapshots:{}},503);}
  const denied=requireOwner();if(denied)return denied;
  const field=body.pageContext?.fieldKey,period=body.pageContext?.period;
  if(body.operation!=='generate'||!DEMO_CATALOG[field+':'+period])return json({error:'请选择有效的快照场域和周期'},400);
  if(!configured)return json({error:'生成快照需要已配置的工作流服务'},503);
  body={...body,operation:undefined,dashboardSnapshot:true,question:dashboardSnapshotQuestion(field,period),history:[],excludeStrategyIds:[],chatId:'snapshot-'+field+'-'+period};
 }else if(body.dashboardSnapshot) return json({error:'请从快照管理入口更新看板结果'},400);
 if(typeof body.question!=='string'||!body.question.trim()||body.question.length>2000)return json({error:'请填写有效问题。'},400);
 if(isProduction&&!['generate_framework','generate_strategies'].includes(body.operation))return json({error:'请选择生成框架或生成策略。'},400);
 if(!isProduction&&body.operation)return json({error:'框架与策略生产请从AIDD后台入口发起。'},400);
 if(!user.authorized){
  try{let catalog=DEMO_CATALOG;try{catalog=applyActionMappingCatalog(catalog,(await readActionPublications(env.DB)).scenes);}catch{}body=sanitizePublicDemoRequest(body,catalog);}catch(error){return json({error:error.message},400);}
  const allowance=await reservePublicDemoBudget(request,env);if(!allowance.ok)return json({error:allowance.error,code:'PUBLIC_TRIAL_LIMIT'},allowance.status);
 }else{
  const key=request.headers.get('oai-authenticated-user-email'),now=Date.now(),entry=limits.get(key);
  if(entry&&now-entry.at<60000&&entry.count>=10)return json({error:'请求较频繁，请稍后重试。'},429);
  limits.set(key,entry&&now-entry.at<60000?{at:entry.at,count:entry.count+1}:{at:now,count:1});
 }
 return isProduction?runAiddProduction(request,env,body):runCoze(request,env,body);
}
export default {async fetch(request,env={}){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return api(request,env,url);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method Not Allowed',{status:405});
 const key=url.pathname==='/'?'/index.html':url.pathname,asset=STATIC_ASSETS[key];
 if(!asset)return new Response('Not Found',{status:404});
 const body=asset.binary?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body;
 return new Response(request.method==='HEAD'?null:body,{headers:{'content-type':asset.type,'cache-control':key==='/index.html'?'no-cache':'public, max-age=300','x-content-type-options':'nosniff'}});
}};
export {extract,readEvent};

async function workflowResource(request,env,url){
 const fieldKey=url.searchParams.get('fieldKey')||'overview',period=url.searchParams.get('period')||'week',sellerId=url.searchParams.get('sellerId')||'DEMO_10001',requestId=url.searchParams.get('requestId')||'demo';
 if(!['overview','live','video','shelf','creator'].includes(fieldKey)||!['week','day'].includes(period))return json({error:'场域或周期不受支持。'},400);
 if(sellerId!=='DEMO_10001')return json({error:'当前只接入演示商家，未取得该商家的授权数据。'},404);
 let configurations=null;
 if(requestId!=='demo'){
  if(!/^[0-9a-f-]{36}$/.test(requestId)||!env.DB)return json({error:'本次请求标识无效。'},404);
  const row=await env.DB.prepare('SELECT configurations, expires_at FROM workflow_requests WHERE id = ?').bind(requestId).first();
  if(!row||row.expires_at<Date.now())return json({error:'本次诊断资源已过期，请重新提问。'},410);
  configurations=JSON.parse(row.configurations);
 }
 const resource=DEMO_CATALOG[fieldKey+':'+period];
 if(!resource)return json({error:'该场景的演示资源尚未准备。'},404);
 if(url.pathname.endsWith('/metrics'))return json(metricsPayload(resource.data,url.searchParams.get('metricIds'),configurations?.__request||{}));
 let config=configurations&&Object.hasOwn(configurations,fieldKey+':'+period)?configurations[fieldKey+':'+period]:resource.config;
 try{config=applyActionMappingPublications(config,(await readActionPublications(env.DB)).scenes);}catch{}
 return json(configurationPayload(config,fieldKey,requestId==='demo'?'演示预置配置':'本次请求的AIDD已发布快照',configurations?.__request||{}));
}
