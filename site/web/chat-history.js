'use strict';

const CHAT_HISTORY_KEY='workflow-lab-merchant-chats-v1';
const CHAT_RETENTION_MS=24*60*60*1000;
let chatHistoryMemory={version:1,activeId:null,conversations:[]},chatStorageNotice=false;

function pruneChatHistory(value,now=Date.now()){
 const conversations=[];
 for(const item of Array.isArray(value?.conversations)?value.conversations:[]){
  if(!item||typeof item.id!=='string'||!/^[-\w]+$/.test(item.id)||!Array.isArray(item.exchanges))continue;
  const exchanges=item.exchanges.filter(e=>e&&typeof e.id==='string'&&/^answer-[-\w]+$/.test(e.id)&&typeof e.question==='string'&&Number.isFinite(e.createdAt)&&e.createdAt>now-CHAT_RETENTION_MS&&e.createdAt<=now+60000&&['pending','complete','error','interrupted'].includes(e.status)).map(e=>({...e}));
  if(!exchanges.length)continue;
  conversations.push({id:item.id,source:typeof item.source==='string'?item.source:'智能助手',context:chatStoredContext(item.context),createdAt:Number.isFinite(item.createdAt)?item.createdAt:exchanges[0].createdAt,updatedAt:Number.isFinite(item.updatedAt)?item.updatedAt:exchanges.at(-1).createdAt,scrollTop:Math.max(0,Number(item.scrollTop)||0),draft:typeof item.draft==='string'?item.draft.slice(0,300):'',workflowHandledStrategyIds:Array.isArray(item.workflowHandledStrategyIds)?[...new Set(item.workflowHandledStrategyIds.filter(id=>typeof id==='string'))].slice(0,120):[],exchanges});
 }
 conversations.sort((a,b)=>b.updatedAt-a.updatedAt);
 return {version:1,activeId:conversations.some(c=>c.id===value?.activeId)?value.activeId:conversations[0]?.id||null,conversations};
}
function chatStoredContext(context){
 const fieldKey=['overview','live','video','shelf','creator'].includes(context?.fieldKey)?context.fieldKey:'overview';
 return {fieldKey,period:context?.period==='day'?'day':'week',...(typeof context?.metricKey==='string'&&/^[\w-]+$/.test(context.metricKey)?{metricKey:context.metricKey}:{})};
}
function readChatHistory(now=Date.now()){
 let value=chatHistoryMemory;
 try{const raw=chatStorageNotice?null:localStorage.getItem(CHAT_HISTORY_KEY);if(raw)value=JSON.parse(raw);}catch{}
 chatHistoryMemory=pruneChatHistory(value,now);
 return chatHistoryMemory;
}
function writeChatHistory(value){
 chatHistoryMemory=pruneChatHistory(value);
 try{localStorage.setItem(CHAT_HISTORY_KEY,JSON.stringify(chatHistoryMemory));}
 catch{if(!chatStorageNotice){chatStorageNotice=true;if(typeof toast==='function')toast('浏览器无法保存聊天记录，本次页面内仍可恢复');}}
 return chatHistoryMemory;
}
function saveChatHistory(chat){
 if(!chat)return;
 const history=readChatHistory();
 const snapshot={id:chat.id,source:chat.source,context:chatStoredContext(chat.context),createdAt:chat.createdAt,updatedAt:chat.updatedAt||chat.createdAt,scrollTop:chat.scrollTop||0,draft:chat.draft||'',workflowHandledStrategyIds:chat.workflowHandledStrategyIds||[],exchanges:chat.exchanges||[]};
 history.conversations=history.conversations.filter(c=>c.id!==chat.id);history.conversations.push(snapshot);history.activeId=chat.id;
 writeChatHistory(history);
}
function restoreChatHistory(id){
 const history=writeChatHistory(readChatHistory()),saved=id?history.conversations.find(c=>c.id===id):history.conversations.find(c=>c.id===history.activeId);
 if(!saved)return null;
 const chat=JSON.parse(JSON.stringify(saved));
 chat.exchanges.forEach(e=>{if(e.status==='pending')e.status='interrupted';});
 return chat;
}
function chatModelHistory(chat,excludeId){
 const retained=pruneChatHistory({activeId:chat.id,conversations:[chat]}).conversations[0];
 return (retained?.exchanges||[]).filter(e=>e.id!==excludeId&&e.status==='complete'&&typeof e.text==='string').flatMap(e=>{
  const result=e.answer?.result,scope=result?.context,validScope=['diagnosis','data'].includes(result?.branch)&&['success','partial'].includes(result?.status)&&['overview','live','video','shelf','creator'].includes(scope?.fieldKey)&&['day','week'].includes(scope?.period);
  const text=result?.branch==='diagnosis'&&typeof curatedActive==='function'&&curatedActive()&&typeof buildMerchantBrief==='function'?buildMerchantBrief(result,e.question,{progress:e.answer.issueProgress}).text:e.text;
  return [{role:'user',content:e.question},{role:'assistant',content:text,...(validScope?{context:chatStoredContext(scope)}:{})}];
 }).slice(-12);
}
function beginChatExchange(chat,id,question,context,branch){
 const now=Date.now();chat.updatedAt=now;chat.draft='';
 chat.exchanges.push({id,question,context:chatStoredContext(context),branch,createdAt:now,status:'pending'});saveChatHistory(chat);
}
function chatResultSnapshot(result){
 const snapshot={context:chatStoredContext(result.context)};
 for(const key of ['schemaVersion','status','branch','answer','dataMode','configVersion','evidence','diagnosis','actions','missing','problemBreakdown','metricAnalysis','goal','fieldBreakdown','execution','performance','explanationSource','coverage','workflowContract','workflow','quality','pendingIssues','handledStrategyIds','goalDiagnosis','workflowExecution'])if(result[key]!==undefined)snapshot[key]=result[key];
 return JSON.parse(JSON.stringify(snapshot));
}
function finishChatExchange(chat,id,answer,text,status='complete'){
 const exchange=chat.exchanges.find(e=>e.id===id);if(!exchange)return;
 Object.assign(exchange,{status,answer,text});chat.updatedAt=Date.now();saveChatHistory(chat);return exchange;
}
function chatAnswerHTML(exchange){
 let body;let analysis=exchange.answer?.analysis;
 if(analysis&&typeof chatEvidenceRecord==='function')analysis=chatEvidenceRecord(exchange.answer?.result,{...analysis,routeHint:['demo','diagnosis'].includes(exchange.answer?.kind)?'browser_demo':undefined});
 if(analysis&&exchange.answer?.result?.branch==='diagnosis'&&typeof curatedActive==='function'&&curatedActive()){
  const brief=buildMerchantBrief(exchange.answer.result,exchange.question,{progress:exchange.answer.issueProgress});
  if(Array.isArray(brief.issues))analysis={...analysis,findings:brief.issues.map(i=>({name:i.title}))};
 }
 const processHTML=analysis?chatStreamStepsHTML(analysis,true):Array.isArray(exchange.answer?.progress)&&exchange.answer.progress.length?chatStreamStepsHTML({steps:exchange.answer.progress},true):'';
 if(exchange.status==='pending')body='<div class="typing"><span></span><span></span><span></span></div><p class="muted">等待请求结果…</p>';
 else if(exchange.status==='interrupted'||exchange.status==='error')body=(analysis?chatStreamStepsHTML({...analysis,failed:true},true):'')+`<p${exchange.status==='error'?' role="alert"':''}>${esc(exchange.status==='error'?exchange.text||'本次分析未完成，请重试。':'上次分析已中断，已保留你的问题。')}</p><button class="merchant-issue-action" type="button" data-chat-retry="${esc(exchange.id)}">重新分析 ${icon('refresh')}</button>`;
 else{
  const answer=exchange.answer||{};
  try{
   const options={exchangeId:exchange.id,progress:answer.issueProgress};
   body=processHTML+(answer.kind==='coze'?cozeAnswerHTML(answer.result,exchange.question,options):answer.kind==='diagnosis'?merchantBriefHTML(answer.result,exchange.question,false,options):answer.kind==='demo'?merchantAnswer(exchange.branch,exchange.question,answer.config||{},exchange.context):`<p>${esc(exchange.text||'')}</p>`);
  }catch{body=`<p>${esc(exchange.text||'这条回答暂时无法展示，请重新分析。')}</p>`;}
 }
 return String(body||'').replaceAll('生意通','');
}
function chatExchangeHTML(exchange){return `<div class="message user"><div class="user-bubble">${esc(exchange.question)}</div></div>${assistantMessage(chatAnswerHTML(exchange),exchange.id)}`;}
function captureChatPosition(){
 const chat=state.chat;if(!chat)return;
 chat.scrollTop=$('#chat-messages')?.scrollTop||0;chat.draft=$('#chat-input')?.value||'';saveChatHistory(chat);
}
function showChatHistory(){
 captureChatPosition();
 const records=writeChatHistory(readChatHistory()).conversations;
 const body=records.length?`<div class="chat-history-list">${records.map(c=>`<button type="button" data-chat-resume="${esc(c.id)}"><strong>${esc(c.exchanges[0].question)}</strong><span>${esc(fieldData(c.context.fieldKey).name)} · ${new Date(c.updatedAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})} · ${c.exchanges.length}轮对话</span></button>`).join('')}</div>`:'<p class="chat-history-empty">最近24小时还没有聊天记录。</p>';
 modal('聊天记录','当前浏览器内，保留最近24小时的对话',body,`<button class="btn primary" data-action="close-modal">返回聊天</button>`);
}
function resumeChatHistory(id){if(state.modal)closeModal();if(state.chat)closeChat();openChat('历史会话',undefined,undefined,{id});}
function retryChatExchange(id){const exchange=state.chat?.exchanges.find(e=>e.id===id);if(!exchange)return;state.chat.context=chatStoredContext(exchange.context);sendQuestion(exchange.question);}
function chatIssueProgress(exchangeId,operation,issueId){
 if(chatRunning()){toast('请等待当前回答完成');return;}
 const exchange=state.chat?.exchanges.find(e=>e.id===exchangeId),answer=exchange?.answer,result=answer?.result;
 if(exchange?.status!=='complete'||!result||!['coze','diagnosis'].includes(answer.kind)||typeof curatedActive!=='function'||!curatedActive()||isGoalQuestion(exchange.question))return;
 const before=buildMerchantBrief(result,exchange.question,{progress:answer.issueProgress});
 if(operation==='next'&&!before.queue.canNext){toast('请先将本批问题标记为已处理，再查看下一批');return;}
 if(operation==='next'&&typeof workflowResult==='function'&&workflowResult(result)){state.chat.workflowHandledStrategyIds=[...new Set([...(result.handledStrategyIds||[]),...before.queue.handledIds])];sendQuestion('继续'+exchange.question.replace(/^帮我/,'')+'，查看下一批未处理问题');return;}
 answer.issueProgress=merchantAdvanceIssueQueue(before.ranked,answer.issueProgress,operation,issueId);
 const brief=buildMerchantBrief(result,exchange.question,{progress:answer.issueProgress});exchange.text=brief.text;
 if(answer.analysis)answer.analysis.findings=brief.queue.active.map(r=>({name:r.finding.name}));
 state.chat.updatedAt=Date.now();saveChatHistory(state.chat);
 const root=document.querySelector(`#${exchangeId} .message-content`);if(root){const open=root.querySelector('.chat-analysis')?.open;root.innerHTML=chatAnswerHTML(exchange);const process=root.querySelector('.chat-analysis');if(process)process.open=open;if(operation==='toggle')[...root.querySelectorAll('button[data-issue-id]')].find(b=>b.dataset.issueId===issueId)?.focus({preventScroll:true});}
 if(operation==='next')scrollChatAnswer(exchangeId);captureChatPosition();
}
