'use strict';
const COZE_CONNECTION={configured:false,authorized:false,signedIn:false,checked:false};
function cozeIsActive(){return COZE_CONNECTION.configured&&COZE_CONNECTION.authorized;}
function aiddIsOnline(){if(COZE_CONNECTION.adminAuthorized===false)return false;return COZE_CONNECTION.productionBackend==='direct_model'?COZE_CONNECTION.productionConfigured&&COZE_CONNECTION.authorized:cozeIsActive();}
function cozeEntryReply(question){
 if(/^(你好|您好|hi|hello)[！!。.?？]*$/i.test(question.trim()))return '你好，我是智能助手。你可以问经营表现、经营数据或优化方法。';
 if(/^(你能(帮我)?做什么|使用说明|功能介绍)[？?]*$/.test(question.trim()))return '我可以分析经营表现、查询已提供的经营指标、解释经营方法。请告诉我想查看的场域与周期。诊断配置后台用于建设诊断框架和策略；当前经营数据为演示样例。';
 return null;
}
function cozeComposerNote(){return cozeIsActive()?'合成演示数据 · 由工作流处理 · 可展开查看本次依据':'在线工作流尚未就绪 · 本次未执行工作流';}
async function cozeRefreshConnection(){
 try{const r=await fetch('/api/coze/status',{cache:'no-store'});if(r.ok)Object.assign(COZE_CONNECTION,await r.json());}catch{}
 COZE_CONNECTION.checked=true;
 if(typeof aiddRefreshActionPublications==='function')await aiddRefreshActionPublications(true);
 const button=document.getElementById('coze-connection');
 if(button){button.textContent=cozeIsActive()?(COZE_CONNECTION.publicDemo?'助手可直接试用':'助手服务已配置'):COZE_CONNECTION.configured&&!COZE_CONNECTION.authorized?'登录后使用':'在线服务未配置';button.dataset.connected=String(cozeIsActive());}
 const note=document.querySelector('.composer-note span');if(note)note.textContent=cozeComposerNote();
 if(typeof render==='function'&&typeof state!=='undefined'&&state.view==='merchant')render();
 return COZE_CONNECTION;
}
function cozeOpenConnection(){
 const connected=cozeIsActive();
 const message=connected?(COZE_CONNECTION.publicDemo?'智能助手已开放访客试用，无需登录账号。':'已配置在线助手服务与当前账号权限。')+'经营诊断、目标诊断、查询和追问统一发送到工作流服务。工作流内执行取数与规则校验，并按任务调用模型。':!COZE_CONNECTION.configured?'在线助手服务尚未配置，本次尚未执行工作流。':'当前账号尚未获得在线助手调用授权。登录并获得授权后可使用在线诊断。';
 const signIn='/signin-with-chatgpt?return_to='+encodeURIComponent('/'+location.hash);
 modal('助手处理方式','经营看板AI版与诊断配置后台',`<p>${esc(message)}</p><p class="form-help">当前经营数据为合成演示数据，真实店铺取数尚未接入。在线诊断由工作流读取发布资产、执行数值校验并生成说明。</p>`,`${cancelModalBtn()}${COZE_CONNECTION.configured&&!COZE_CONNECTION.authorized?`<a class="btn primary" href="${signIn}" target="_top">登录后使用</a>`:''}`);
}
function merchantLocalSnapshot(question,context){
 const runtime=aiddRuntimeConfig(context.fieldKey,context.period,{question}),scene=aiddData.scenes.find(s=>s.id===runtime?.sceneId)||aiddData.scenes.find(s=>s.fieldKey===context.fieldKey);
 if(runtime?.catalogRevision&&typeof curatedLocalSnapshot==='function')return curatedLocalSnapshot(context,runtime);
 if(runtime?.catalogRevision&&runtime.dataAvailability?.status==='not_connected')return {data:{mode:'unavailable',fieldKey:context.fieldKey,period:context.period,metrics:runtime.metrics.map(m=>({id:m.id,label:m.name,metricKey:m.metricKey,derived:m.derived,value:null,previousValue:null,unit:m.unit})),goal:null,fieldBreakdown:[],missing:['新指标定义已核验，真实取数服务未接入；不能使用旧演示值代替。']},config:{...runtime}};
 const metrics=aiddData.metrics.filter(m=>m.fieldKey===context.fieldKey&&!['String','Image'].includes(m.dataType)).map(m=>{
  const raw=MERCHANT_FIELDS[m.fieldKey]?.metrics[m.metricKey]?.[context.period];
  return {id:m.id,label:m.name,metricKey:m.metricKey,derived:m.derived,value:aiddMetricValue(m,context.period),unit:m.unit,previousValue:m.derived==='value'?raw?.previousValue:null,currentValues:m.derived==='value'?raw?.current:undefined};
 });
 const field=MERCHANT_FIELDS[context.fieldKey],actual=field.metrics.gmv[context.period].value,target=field.goal[context.period];
 const goal={actual,target,rate:+(100*actual/target).toFixed(1),gap:Math.max(0,target-actual)};
 const fieldBreakdown=context.fieldKey==='overview'?FIELD_KEYS.map(key=>({fieldKey:key,name:MERCHANT_FIELDS[key].name,actual:MERCHANT_FIELDS[key].metrics.gmv[context.period].value,target:MERCHANT_FIELDS[key].goal[context.period],gap:Math.max(0,MERCHANT_FIELDS[key].goal[context.period]-MERCHANT_FIELDS[key].metrics.gmv[context.period].value)})):[];
 return {data:{mode:'demo',fieldKey:context.fieldKey,period:context.period,metrics,goal,fieldBreakdown},config:runtime?{...runtime}:{active:false,inactiveReason:'当前场景没有已生效的诊断配置',metrics:[],actions:[],strategies:[]}};
}
function cozeRequestSnapshot(question,context){
 return {schemaVersion:1,question,sellerId:'DEMO_10001',chatId:state.chat?.id||'',pageContext:{fieldKey:state.fieldKey,period:state.period,metricKey:state.metricKey||''},excludeStrategyIds:state.chat?.workflowHandledStrategyIds||[]};
}
function cozeRuntimeTransport(config){
 if(!config?.catalogRevision)return config;
 const pick=(v,keys)=>Object.fromEntries(keys.filter(k=>v[k]!==undefined).map(k=>[k,v[k]]));
 const framework=f=>pick(typeof publishedFrameworkMethod==='function'?publishedFrameworkMethod(f):f,['id','sceneId','sceneName','name','fieldKey','goal','scope','active','version','sourceWorkflow','metricIds','actionIds','branches','priority','level','parentId','requiredEvidence','businessFrameworkVersion','missingMetricOrEvidence','businessBoundary','decomposition','drilldown']);
 return {...pick(config,['sceneId','sceneName','fieldKey','version','frameworkVersion','active','catalogRevision','scopeClarification','inactiveReason']),frameworkCandidates:(config.frameworkCandidates||[]).map(framework),frameworkDefinition:config.frameworkDefinition?framework(config.frameworkDefinition):undefined,strategies:(config.strategies||[]).map(s=>pick(s,['id','name','sceneId','frameworkId','frameworkVersion','enabled','status','execution','priority','merchantScope','actionTrigger','rule','metricIds','actionIds','actionSubtitles','actionMappings','diagnosticMetricIds','displayMetricIds','diagnosticKind','suppressesStrategyIds','dataRequirements','businessMeaning','description','thresholdBasis','exceptionHandling','contentPrompt','contentObjects','decisionLevel','requiredEvidence','businessFrameworkVersion','exclusiveGroup','issueKey','missingMetricOrEvidence','confirmationRule'])),metrics:config.metrics,actions:config.actions};
}
async function cozeRequest(payload,{signal,onProgress,onUpdate}={}){
 if(['generate_framework','generate_strategies'].includes(payload.operation))return aiddProductionRequest(payload,{signal,onProgress,onUpdate});
 if(!payload.operation&&typeof aiddData!=='undefined'&&!(COZE_CONNECTION.publicDemo&&COZE_CONNECTION.adminAuthorized===false))payload={...payload,runtimeConfigurations:Object.fromEntries(Object.keys(MERCHANT_FIELDS).flatMap(fieldKey=>['week','day'].map(period=>[fieldKey+':'+period,cozeRuntimeTransport(aiddRuntimeConfig(fieldKey,period,{question:payload.question}))])))};
 return requestAppStream(payload.dashboardSnapshot===true?'/api/dashboard/snapshot':'/api/diagnose',payload,{signal,onProgress,onUpdate});
}
async function aiddProductionRequest(payload,options={}){
 return requestAppStream('/api/aidd/generate',payload,options);
}
async function requestAppStream(path,payload,{signal,onProgress,onUpdate,headers={}}={}){
 const startedAt=Date.now(),finish=value=>{if(value?.productionUsage)value.productionUsage.elapsedMs=Date.now()-startedAt;return value;};
 const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(payload),signal});
 if(!response.ok){const value=await response.json().catch(()=>({}));throw new Error(value.error||'Coze暂时无法处理，请稍后重试。');}
 if(!response.headers.get('content-type')?.includes('text/event-stream'))return finish(await response.json());
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',result=null,error=null;
 function handle(frame){
  const lines=frame.split('\n'),event=lines.find(l=>l.startsWith('event:'))?.slice(6).trim();
  const text=lines.filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');let data;try{data=JSON.parse(text);}catch{return;}
  if(event==='progress')onProgress?.(data.stage);if(['progress','update','delta'].includes(event))onUpdate?.(event,data);if(event==='result')result=data;if(event==='error'){error=new Error(data.error||'Coze执行失败。');if(data.productionUsage)error.productionUsage=finish(data).productionUsage;}
 }
 while(true){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});let match;while((match=/\r?\n\r?\n/.exec(buffer))){handle(buffer.slice(0,match.index).replace(/\r/g,''));buffer=buffer.slice(match.index+match[0].length);}}
 buffer+=decoder.decode();if(buffer.trim())handle(buffer.replace(/\r/g,''));
 if(error)throw error;if(!result)throw new Error('Coze未返回完整结果，请重试。');return finish(result);
}
function cozeProductionError(result,message){const error=new Error(message);if(result.productionUsage)error.productionUsage={...result.productionUsage,status:'failed'};return error;}
function cozeAnswerHTML(result,question='',options={}){
 if(result.branch==='diagnosis')return merchantBriefHTML(result,question,true,options);
 // Preserve the checked server answer and every requested metric. Resolving a
 // single frontend focus here used to hide the other metrics in one question.
 const answer=String(result.answer||'').replace(/(-?\d+\.\d{3,})(?=[%％])/g,value=>Number(value).toFixed(1)).split(/\n+/).filter(Boolean).map(line=>`<p>${esc(line)}</p>`).join('');
 const evidence=(result.evidence||[]).length?`<div class="coze-evidence"><h4>诊断依据</h4>${result.evidence.map(m=>`<div><span>${esc(m.label)}</span><strong>${m.value===null?'无法判断':esc(typeof m.value==='number'?m.value.toLocaleString('zh-CN',{maximumFractionDigits:2}):m.value)+esc(m.unit||'')}</strong></div>`).join('')}</div>`:'';
 const actions=(result.actions||[]).map(a=>{
  const links=[...new Set([a.mobileLink,a.pcLink])].filter(link=>/^https:\/\//.test(link));
  return links.length?`<a class="btn" href="${esc(window.innerWidth<700?(a.mobileLink||a.pcLink):(a.pcLink||a.mobileLink))}" target="_blank" rel="noopener">${esc(a.name)} ${icon('arrow')}</a>`:merchantActionLinks({title:a.name,action:a.name,actions:[{...a,recommendation:a.description}]},'btn');
 }).join('');
 const remainingMissing=[...new Set(result.missing||[])].filter(item=>String(item).trim()!==String(result.answer||'').trim());
 const missing=remainingMissing.length?`<p class="form-help">待补充：${esc(remainingMissing.join('；'))}</p>`:'';
 const reasoning=(result.diagnosis||[]).filter(d=>d.explanation).map(d=>`<p><strong>${esc(d.name)}</strong>：${esc(d.explanation)}</p>`).join('');
 const breakdown=result.problemBreakdown?.length?`<details><summary>服务返回的分析说明</summary><ol>${result.problemBreakdown.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></details>`:'';
 return `<div class="answer-label">${icon('spark')}${result.branch==='data'?'数据查询':result.branch==='knowledge'?'经营知识':'分析说明'}${result.dataMode==='demo'?' · 演示数据':''}</div>${result.branch==='data'?merchantScopeHTML(result,question):''}${answer}${evidence}${reasoning}${breakdown}${actions?`<div class="diagnosis-actions">${actions}</div>`:''}${missing}`;
}
function cozeApplyContext(chat,context){
 chat.context={...context,...chatStoredContext(context)};
 saveChatHistory(chat);
}
async function cozeSendQuestion(question,chat,id,context){
 chat.cozePending=true;chat.cozeAbort=new AbortController();
 const payload=cozeRequestSnapshot(question,context);payload.history=chatModelHistory(chat,id);
 const live=chatStreamState(context,question);renderChatStream(id,live);
 const elapsedTimer=setInterval(()=>{const label=document.querySelector(`#${id} .stream-elapsed`);if(label)label.textContent=chatDuration(Date.now()-live.startedAt);},1000);
 try{
  const result=await cozeRequest(payload,{signal:chat.cozeAbort.signal,onUpdate:(event,data)=>{if(state.chat===chat){chatStreamUpdate(live,event,data);renderChatStream(id,live);if(event!=='delta'){const exchange=chat.exchanges.find(e=>e.id===id);if(exchange)exchange.answer={kind:'coze',analysis:chatAnalysisSnapshot(live)};saveChatHistory(chat);}if(event==='update'&&data.kind==='context'&&['diagnosis','data'].includes(data.branch)&&data.context?.fieldKey&&data.context?.period)cozeApplyContext(chat,{...context,...data.context,metricKey:''});}}});
  if(state.chat!==chat)return;
  chatStreamComplete(live,result);
  const responseText=result.branch==='diagnosis'?buildMerchantBrief(result,question).text:result.answer;
  const exchange=finishChatExchange(chat,id,{kind:'coze',result:chatResultSnapshot(result),analysis:chatAnalysisSnapshot(live)},responseText);
  document.querySelector(`#${id} .message-content`).innerHTML=chatAnswerHTML(exchange);
  if(['diagnosis','data'].includes(result.branch)&&result.context?.fieldKey&&result.context?.period)cozeApplyContext(chat,{...context,...result.context});
 }catch(error){if(state.chat===chat&&error.name!=='AbortError'){chatStreamComplete(live,null,{failed:true});const exchange=finishChatExchange(chat,id,{kind:'text',analysis:chatAnalysisSnapshot(live)},error.message,'error');document.querySelector(`#${id} .message-content`).innerHTML=chatAnswerHTML(exchange);}}
 finally{clearInterval(elapsedTimer);chat.cozePending=false;chat.cozeAbort=null;if(state.chat===chat){document.querySelector('#chat-input').disabled=false;document.querySelector('.send-btn').disabled=false;document.querySelector('#chat-input').focus({preventScroll:true});scrollChatAnswer(id);captureChatPosition();}}
}
function aiddProductionFramework(scene){
 if(!scene||scene.status!=='生效中')return {};
 const published=aiddData.published?.[scene.id];if(!published)return {};
 const frame=aiddData.frameworks.find(item=>item.sceneId===scene.id&&item.status==='生效中');if(!frame)return {};
 const configs=published.periods?[published.periods.week,published.periods.day].filter(Boolean):[published];
 for(const config of configs){
  if(config.active===false)continue;
  const definition=config.frameworkDefinition||aiddPublishedFramework(frame,scene,config);
  if(definition.sceneId===scene.id&&definition.active!==false)return {...clone(definition),active:true};
 }
 return {};
}
function cozeProductionInput(inputs,{phase='generate',strategyMode='ai',sample,period='week',parsed=false}={}){
 const scenes=aiddData.scenes.filter(s=>inputs.sceneIds.includes(s.id));
 const knowledge=phase==='generate'&&strategyMode!=='manual'?(inputs.knowledge||scenes.map(scene=>({title:scene.name+'业务口径',content:aiddData.frameworks.find(f=>f.sceneId===scene.id&&f.status==='生效中')?.knowledge||'',source:'AIDD后台人工业务说明'})).filter(k=>k.content)):[];
 const metrics=aiddData.metrics.filter(m=>inputs.metricIds.includes(m.id)),actions=aiddData.actions.filter(a=>inputs.actionIds.includes(a.id));
 const sourceFramework=scenes.length===1?aiddProductionFramework(scenes[0]):{};
 const trialCases=phase==='test'?scenes.map(scene=>{
  const {metricValues,dataNote}=aiddTrialCaseData(scene,scenes.length===1?metrics:metrics.filter(m=>scene.metricIds.includes(m.id)),sample,period);
  return {id:(sample?.id||'DEMO_10001')+'-'+scene.id+'-'+period,merchantId:sample?.id||'DEMO_10001',merchantName:sample?.name||'演示商家',label:(sample?.name||'演示商家')+' · '+scene.name+' · '+(period==='week'?'近7天':'昨日'),fieldKey:scene.fieldKey,period,periodRange:typeof periodRange==='function'?periodRange(period):'',dataMode:'demo',dataNote,expectedStrategies:[],metricValues};
 }):[];
 return {...inputs,phase,strategyMode,parsed,prompt:phase==='generate'&&strategyMode!=='manual'?inputs.prompt||'':'',knowledge:clone(knowledge),scenes:clone(scenes),metrics:clone(metrics),actions:clone(actions),sourceFramework:clone(sourceFramework),trialCases};
}
function cozeNormalizeRule(rule){
 return normalizeProductionRule(rule);
}
async function cozeGenerateStrategies(inputs){
 if(inputs.sceneIds.length>1){const candidates=[];for(const sceneId of inputs.sceneIds){const scene=aiddData.scenes.find(s=>s.id===sceneId);candidates.push(...await cozeGenerateStrategies({...inputs,sceneIds:[sceneId],metricIds:inputs.metricIds.filter(id=>scene.metricIds.includes(id)),actionIds:inputs.actionIds.filter(id=>scene.actionIds.includes(id))}));}return candidates;}
 const strategyMode=inputs.strategyMode||'ai';
 const result=await aiddProductionRequest({schemaVersion:1,operation:'generate_strategies',question:inputs.goal,productionInput:{...cozeProductionInput(inputs,{strategyMode}),prompt:inputs.prompt||aiddStrategyTemplate(inputs)}});
 if(result.status!=='needs_review'||!Array.isArray(result.candidate))throw cozeProductionError(result,result.answer||'未返回有效候选。');
 return result.candidate.map(remote=>{
  remote={...remote,rule:cozeNormalizeRule(remote.rule)};
  const scene=aiddData.scenes.find(s=>s.id===remote.sceneId),base=aiddBuildSceneCandidate(scene,inputs);
  const strategy={...base,...remote,id:aiddId('strategy_coze'),sourceAssetId:remote.id,production:'AI辅助生成',productionHandoff:result.handoff,productionTrial:result.trialReport,productionDraftText:result.draftText,status:'待生效',reviewStatus:'待审核',enabled:remote.execution!=='模型理解',description:inputs.goal,merchantScope:inputs.scope,inputSnapshot:clone(inputs),pendingItems:[...(remote.pendingItems||[]),'DeepSeek生成，阈值和业务依据需人工审核'],actionSubtitles:Object.fromEntries(remote.actionIds.map(id=>[id,aiddFind('actions',id)?.subtitle||aiddFind('actions',id)?.description||'结合诊断证据核查']))};
  const error=aiddValidateStrategy(strategy);if(error)throw cozeProductionError(result,'后台候选校验失败：'+error);
  aiddSaveProductionUsage(strategy,result);strategy.aiOriginal=clone({...strategy,aiOriginal:undefined});return strategy;
 });
}
function aiddFrameProductionInput(frame){
 const inputs={frameworkName:frame.name,sceneIds:[frame.sceneId],goal:frame.goal,scope:frame.scope||aiddFrameScene(frame)?.merchantScope||'当前场景适用商家',metricIds:frame.metricIds,actionIds:frame.actionIds};
 const materials=cozeProductionInput(inputs);
 return {...materials,frameworkName:frame.name,prompt:'',sourceFramework:{id:frame.assetId||frame.id,name:frame.name,sceneId:frame.sceneId,version:frame.version||1,active:false}};
}
async function cozeBuildFrameDraft(frame,{onProgress}={}){
 if(!aiddIsOnline())return aiddBuildFrameDraft(frame);
 const productionInput=aiddFrameProductionInput(frame);
 const result=await aiddProductionRequest({schemaVersion:1,operation:'generate_framework',question:frame.goal,productionInput},{onProgress});
 if(result.status!=='needs_review'||!result.candidate||!String(result.draftText||result.candidate.draftText||'').trim())throw cozeProductionError(result,result.answer||'框架生成失败。');
 const next=result.candidate,draftText=result.draftText||next.draftText;
 Object.assign(frame,{assetId:next.id||frame.id,branches:next.branches,draftText,prompt:draftText,draftEdited:false,stage:'draft',status:'待生效',production:'DeepSeek生成',productionHandoff:result.handoff,productionTrial:result.trialReport,productionInput,protocolConfirmed:false,trial:null,reviewPassed:false,updatedAt:aiddNow(),workflowSchema:1,generation:(frame.generation||0)+1,pendingItems:result.missing,productionUsage:{}});
 if(typeof aiddFrameDraftFingerprint==='function')frame.parsedDraftFingerprint=aiddFrameDraftFingerprint(frame);
 return aiddSaveProductionUsage(frame,result);
}
async function cozeReviewProduction(operation,inputs,{text='',candidateFramework={},candidateStrategies=[],manualStrategies=[],phase='confirm',strategyMode='ai',parsed=false,sample,period='week',onProgress}){
 const materials=cozeProductionInput(inputs,{phase,strategyMode,parsed,sample,period});
 if(operation==='generate_framework')materials.sourceFramework={id:candidateFramework.id,sceneId:candidateFramework.sceneId,version:candidateFramework.version,active:false};
 const result=await aiddProductionRequest({operation,question:inputs.goal||'审核诊断资产',productionInput:{...materials,candidateFramework,candidateStrategies,manualStrategies,review:{confirmed:phase==='confirm',reviewer:phase==='confirm'?'当前登录产运':'',reviewedText:text}}},{onProgress});
 if(phase==='confirm'&&result.status!=='ready_for_gray')throw cozeProductionError(result,result.answer||'审核后的配置尚未通过系统校验。');
 if(phase==='test'&&!result.trialReport?.executed)throw cozeProductionError(result,result.answer||'案例试跑没有执行。');
 return result;
}
async function cozeReviewFrame(frame,text){
 const inputs={sceneIds:[frame.sceneId],goal:frame.goal,scope:aiddFrameScene(frame).merchantScope||'当前场景适用商家',metricIds:frame.metricIds,actionIds:frame.actionIds};
 const result=await cozeReviewProduction('generate_framework',inputs,{text,candidateFramework:{id:frame.assetId||frame.id,sceneId:frame.sceneId,version:frame.version||1,sourceWorkflow:'AIDD后台',draftText:text,branches:frame.branches||[]}});
 Object.assign(frame,{branches:result.candidate.branches,draftText:text,prompt:text,protocolConfirmed:true,productionTrial:result.trialReport,productionReleasePlan:result.releasePlan,trial:null,reviewPassed:false});
 aiddSaveProductionUsage(frame,result);
 return result;
}
async function cozeReviewStrategy(strategy,text,phase='confirm'){
 const result=await cozeReviewProduction('generate_strategies',strategy.inputSnapshot,{text,candidateStrategies:[{...strategy,id:strategy.sourceAssetId||strategy.id}],phase,strategyMode:strategy.execution==='模型理解'?'content':'ai'});
 const next=result.candidate?.[0];if(!next)throw new Error('未返回审核后策略。');
 return aiddSaveProductionUsage({...strategy,...next,id:strategy.id,sourceAssetId:next.id,rule:cozeNormalizeRule(next.rule),productionDraftText:text,productionTrial:result.trialReport,productionReleasePlan:result.releasePlan,productionHandoff:result.handoff,status:'待生效',reviewStatus:phase==='confirm'?'人工确认':'待审核',enabled:next.execution!=='模型理解'},result);
}
async function cozeTrialFramework(frame,sample,{period=frame.casePeriod||'week',onProgress}={}){
 const inputs={frameworkName:frame.name,sceneIds:[frame.sceneId],goal:frame.goal,scope:frame.scope||aiddFrameScene(frame).merchantScope||'当前场景适用商家',metricIds:frame.metricIds,actionIds:frame.actionIds};
 const parsed=frame.parsedDraftFingerprint===aiddFrameDraftFingerprint(frame);
 try{
  const result=await cozeReviewProduction('generate_framework',inputs,{phase:'test',parsed,sample,period,onProgress,text:frame.draftText,candidateFramework:{id:frame.assetId||frame.id,name:frame.name,sceneId:frame.sceneId,version:frame.version||1,sourceWorkflow:'AIDD后台',draftText:frame.draftText,branches:frame.branches||[]}});
  aiddSaveProductionUsage(frame,result);return result;
 }catch(error){aiddSaveProductionUsage(frame,error);throw error;}
}
async function cozeConfirmConfiguredStrategy(strategy){
 const metricIds=aiddStrategyMetricIds(strategy),inputs={sceneIds:[strategy.sceneId],goal:strategy.description,scope:strategy.merchantScope,metricIds,actionIds:strategy.actionIds};
 const manual=strategy.execution!=='模型理解';
 const result=await cozeReviewProduction('generate_strategies',inputs,{phase:'confirm',parsed:true,strategyMode:manual?'manual':'content',manualStrategies:manual?[{...strategy,metricIds}]:[],candidateStrategies:[{...strategy,metricIds}]});
 return aiddSaveProductionUsage({...strategy,...result.candidate[0],id:strategy.id,enabled:manual,productionHandoff:result.handoff,productionReleasePlan:result.releasePlan,protocolConfirmed:true},result);
}
document.addEventListener('DOMContentLoaded',cozeRefreshConnection);
document.addEventListener('click',event=>{if(event.target.closest('#coze-connection'))cozeOpenConnection();});
