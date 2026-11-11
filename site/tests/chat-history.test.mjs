import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../web/chat-history.js',import.meta.url),'utf8');
const appSource=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
const ttl=24*60*60*1000;
test('旧聊天记录的助手名称按当前展示要求去除，存储正文不被改写',()=>{
 const rt=runtime(),e=exchange('brand',Date.now(),{text:'你好，我是生意通智能助手。'});
 assert.match(rt.chatAnswerHTML(e),/你好，我是智能助手/);assert.doesNotMatch(rt.chatAnswerHTML(e),/生意通/);assert.match(e.text,/生意通/);
});
function runtime(storage=new Map(),writeFails=false){
 const context=vm.createContext({Date,console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(writeFails)throw new Error('quota');storage.set(k,v);}},esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),icon:()=>'',assistantMessage:(body,id)=>`<div id="${id}">${body}</div>`,toast:()=>{}});
 vm.runInContext(source,context);return context;
}
function exchange(id,createdAt,extra={}){return {id:'answer-'+id,question:'分析近7天表现',createdAt,status:'complete',text:'订单减少，先检查商品',answer:{kind:'text'},context:{fieldKey:'live',period:'week'},...extra};}
function chat(id='DEMO_A',exchanges=[exchange('one',Date.now())]){return {id,source:'智能助手',context:{fieldKey:'live',period:'week'},createdAt:Date.now(),updatedAt:Date.now(),scrollTop:180,draft:'继续看看',exchanges};}
test('关闭与刷新后恢复完整对话、上下文、草稿及阅读位置',()=>{
 const storage=new Map(),first=runtime(storage),c=chat();
 first.saveChatHistory(c);
 const restored=runtime(storage).restoreChatHistory();
 assert.equal(restored.id,c.id);assert.equal(restored.exchanges[0].text,c.exchanges[0].text);assert.equal(restored.context.fieldKey,'live');assert.equal(restored.scrollTop,180);assert.equal(restored.draft,'继续看看');
});

test('旧记录跨刷新保留真实总耗时与依据，旧步骤和重复时刻不再透出',async()=>{
 const storage=new Map(),first=runtime(storage),stream=await readFile(new URL('../web/chat-stream.js',import.meta.url),'utf8');
 vm.runInContext(stream,first);
 const analysis={timeline:[{label:'确认全店近7天',elapsedMs:30},{label:'核对成交金额',elapsedMs:70}],steps:[],durationMs:90,goalCheck:{actual:190000,target:143000,gap:0,rate:132.867},metrics:[{label:'成交金额',value:190000,previousValue:215000,unit:'元'}],engine:'目标核算'};
 const saved=chat('process',[exchange('process',Date.now(),{answer:{kind:'text',analysis},text:'目标已达成'})]);first.saveChatHistory(saved);
 const restored=runtime(storage);vm.runInContext(stream,restored);const e=restored.restoreChatHistory().exchanges[0],html=restored.chatAnswerHTML(e);
 assert.equal(e.answer.analysis.durationMs,90);assert.doesNotMatch(html,/确认全店近7天|核对成交金额|0\.03秒|0\.07秒/);assert.match(html,/未记录处理方式/);assert.match(html,/查看本次执行过程/);assert.match(html,/本次返回的指标：1 项/);assert.doesNotMatch(html,/<th>指标<\/th>/);assert.match(html,/目标已达成/);
 e.status='interrupted';assert.match(restored.chatAnswerHTML(e),/查看未完成请求记录/);
 e.status='error';assert.match(restored.chatAnswerHTML(e),/data-chat-retry/);
});
test('24小时边界按每轮提问清理，新消息不会延长旧消息寿命',()=>{
 const rt=runtime(),now=Date.now(),c=chat('DEMO_A',[exchange('old',now-ttl),exchange('kept',now-ttl+1)]);
 c.updatedAt=now;
 const pruned=rt.pruneChatHistory({activeId:c.id,conversations:[c]},now);
 assert.equal(pruned.conversations[0].exchanges.length,1);assert.equal(pruned.conversations[0].exchanges[0].id,'answer-kept');
 assert.equal(rt.pruneChatHistory(pruned,now+1).conversations.length,0);
});
test('新建会话仍保留旧会话，可按会话ID恢复',()=>{
 const rt=runtime(),a=chat('DEMO_A'),b=chat('DEMO_B',[exchange('two',Date.now(),{question:'分析直播点击'})]);
 rt.saveChatHistory(a);rt.saveChatHistory(b);
 assert.equal(rt.readChatHistory().conversations.length,2);assert.equal(rt.restoreChatHistory().id,b.id);assert.equal(rt.restoreChatHistory(a.id).exchanges[0].question,a.exchanges[0].question);
});
test('页面诊断入口每次新建独立对话，追问和显式恢复仍保留本会话历史',()=>{
 const rt=runtime(),old=chat('overview-history',[exchange('overview',Date.now(),{question:'分析全店目标差距',text:'全店目标已达成',context:{fieldKey:'overview',period:'week'}})]);
 old.context={fieldKey:'overview',period:'week'};rt.saveChatHistory(old);
 const elements=new Map(),element=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',scrollTop:0,focus(){}});return elements.get(selector);};
 let sequence=0;
 Object.assign(rt,{state:{chat:null,run:null,view:'merchant',fieldKey:'overview',period:'week'},document:{activeElement:{focus(){}},body:{style:{}}},$:element,sid:()=>`session-${++sequence}`,clone:x=>JSON.parse(JSON.stringify(x)),fieldData:key=>({name:key}),periodName:x=>x,merchantQuestion:()=>'',cozeComposerNote:()=>''});
 rt.sendQuestion=question=>rt.beginChatExchange(rt.state.chat,`answer-${++sequence}`,question,rt.state.chat.context,'diagnosis');
 vm.runInContext(appSource.slice(appSource.indexOf('function openChat('),appSource.indexOf('function assistantMessage(')),rt);
 rt.openChat('经营概览');const overview=rt.state.chat;
 assert.notEqual(overview.id,old.id);assert.equal(overview.exchanges.length,0);assert.equal(rt.chatModelHistory(overview).length,0);
 rt.sendQuestion('分析近7天全店表现');rt.finishChatExchange(overview,overview.exchanges[0].id,{kind:'text'},'概览回答');rt.state.chat=null;
 const scope={fieldKey:'live',period:'day',metricKey:'gmv'};
 rt.openChat('指标诊断','分析直播成交金额',scope);const metric=rt.state.chat;
 assert.notEqual(metric.id,overview.id);assert.equal(metric.exchanges.length,0);assert.equal(metric.draft,'分析直播成交金额');rt.sendQuestion(metric.draft);assert.equal(metric.exchanges[0].question,'分析直播成交金额');assert.equal(metric.context.metricKey,'gmv');assert.equal(rt.chatModelHistory(metric).length,0);
 rt.finishChatExchange(metric,metric.exchanges[0].id,{kind:'text'},'成交金额回答');rt.sendQuestion('主要原因是什么？');
 assert.deepEqual(JSON.parse(JSON.stringify(rt.chatModelHistory(metric))),[{role:'user',content:'分析直播成交金额'},{role:'assistant',content:'成交金额回答'}]);
 rt.state.chat=null;rt.openChat('指标诊断','分析直播成交金额',scope);
 assert.notEqual(rt.state.chat.id,metric.id);assert.equal(rt.state.chat.exchanges.length,0);assert.equal(rt.state.chat.draft,'分析直播成交金额');
 rt.state.chat=null;rt.openChat('历史会话',undefined,undefined,{id:overview.id});
 assert.equal(rt.state.chat.id,overview.id);assert.equal(rt.state.chat.exchanges[0].text,'概览回答');
 rt.state.chat=null;rt.openChat('智能助手浮标',undefined,undefined,{resume:true});assert.equal(rt.state.chat.id,overview.id);
 rt.state.chat=null;rt.openChat('智能助手',undefined,undefined,{fresh:true,id:overview.id,resume:true});assert.notEqual(rt.state.chat.id,overview.id);assert.equal(rt.state.chat.exchanges.length,0);
 assert.ok(rt.readChatHistory().conversations.some(c=>c.id===old.id));
});
test('刷新时未完成的请求保留问题并显示重新分析，不伪造成功结果',()=>{
 const rt=runtime(),c=chat('DEMO_A',[exchange('pending',Date.now(),{status:'pending',text:undefined,answer:undefined})]);rt.saveChatHistory(c);
 const restored=rt.restoreChatHistory(),e=restored.exchanges[0];assert.equal(e.status,'interrupted');assert.match(rt.chatExchangeHTML(e),/上次分析已中断/);assert.match(rt.chatExchangeHTML(e),/data-chat-retry="answer-pending"/);
 assert.equal(rt.chatModelHistory(restored).length,0);
});
test('恢复的追问历史只包含有效完成轮次，并排除当前问题与过期记录',()=>{
 const rt=runtime(),now=Date.now(),exchanges=[exchange('expired',now-ttl),...Array.from({length:8},(_,i)=>exchange('n'+i,now-i,{question:'问题'+i,text:'回答'+i})),exchange('current',now,{status:'pending'})];
 const h=rt.chatModelHistory(chat('DEMO_A',exchanges),'answer-current');assert.equal(h.length,12);assert.equal(h[0].content,'问题2');assert.equal(h.at(-1).content,'回答7');assert.ok(h.every(x=>x.content!=='分析近7天表现'));
});
test('损坏存储与脚本文字不会作为HTML执行，存储失败仍保留页面内恢复',()=>{
 const storage=new Map([['workflow-lab-merchant-chats-v1','broken']]),rt=runtime(storage);assert.equal(rt.readChatHistory().conversations.length,0);
 const c=chat();c.exchanges[0].question='<img src=x onerror=alert(1)>';c.exchanges[0].text='<script>alert(1)</script>';
 const html=rt.chatExchangeHTML(c.exchanges[0]);assert.doesNotMatch(html,/<img|<script/);assert.match(html,/&lt;img/);
 rt.saveChatHistory(c);const unavailable=runtime(storage,true),newChat=chat('DEMO_NEW');unavailable.saveChatHistory(newChat);assert.equal(unavailable.restoreChatHistory().id,'DEMO_NEW');
});
test('聊天快照只保存显示结果，不保存临时请求标识、鉴权或执行对象',()=>{
 const rt=runtime();const snapshot=rt.chatResultSnapshot({branch:'diagnosis',status:'success',context:{fieldKey:'live',period:'week',requestId:'private-request'},answer:'回答',token:'secret',trace:[{secret:true}],configuration:{credentials:'secret'}});
 assert.equal(snapshot.context.fieldKey,'live');assert.equal(snapshot.context.requestId,undefined);assert.equal(snapshot.token,undefined);assert.equal(snapshot.configuration,undefined);assert.equal(snapshot.trace,undefined);
});
test('目标回答不属于问题队列，仍可正常显示已保存的分析过程',()=>{
 const rt=runtime();Object.assign(rt,{curatedActive:()=>true,buildMerchantBrief:()=>({type:'goal',text:'目标已达成'}),chatStreamStepsHTML:()=>'<details>查看本次执行过程</details>',cozeAnswerHTML:()=>'<article>目标已达成</article>'});
 const e=exchange('goal',Date.now(),{question:'分析全店目标差距',answer:{kind:'coze',analysis:{steps:['已核算目标']},result:{branch:'diagnosis'}}});
 assert.match(rt.chatAnswerHTML(e),/查看本次执行过程.*目标已达成/);
});
test('后续意图识别只继承已完成经营回答的实际范围，不把知识与澄清当成分析范围',()=>{
 const rt=runtime(),now=Date.now(),c=chat('scope',[
  exchange('data',now,{answer:{kind:'coze',result:{branch:'data',status:'success',context:{fieldKey:'video',period:'day',metricKey:'gmv',requestId:'must-not-send'}}}}),
  exchange('knowledge',now,{answer:{kind:'coze',result:{branch:'knowledge',status:'success',context:{fieldKey:'live',period:'week'}}}})
 ]);
 const h=rt.chatModelHistory(c);assert.equal(h[1].context.fieldKey,'video');assert.equal(h[1].context.period,'day');assert.equal(h[1].context.requestId,undefined);assert.equal(h[3].context,undefined);
});

test('恢复旧在线聊天时依据实际结果重建处理方式，重复时间和步骤均不再展示',async()=>{
 const rt=runtime();vm.runInContext(await readFile(new URL('../web/chat-stream.js',import.meta.url),'utf8'),rt);rt.cozeAnswerHTML=()=>'<article>经营回答</article>';
 const result={branch:'diagnosis',dataMode:'demo',performance:{route:'published_rules',serverMs:3},evidence:[{metricId:'gmv',label:'成交金额',value:190000,previousValue:215000,unit:'元'}],diagnosis:[{name:'成交回落'}]};
 const analysis={durationMs:2400,engine:'Coze工作流',timeline:[{label:'已确定范围',elapsedMs:2400},{label:'已完成核对',elapsedMs:2400}],steps:['已模拟思考']};
 const e=exchange('legacy',Date.now(),{answer:{kind:'coze',result,analysis}}),html=rt.chatAnswerHTML(e);
 assert.match(html,/规则与数值计算.*本次未调用大模型/);assert.match(html,/总耗时/);assert.match(html,/2\.4秒/);assert.equal(html.split('2.4秒').length-1,1);assert.match(html,/本次返回的指标：1 项/);
 assert.doesNotMatch(html,/已确定范围|已完成核对|已模拟思考|Coze工作流/);assert.equal(e.answer.analysis.timeline.length,2);
});

test('工作流后续批次的已处理策略跨刷新保留，每个会话独立',()=>{
 const storage=new Map(),rt=runtime(storage),a=chat('workflow-one');a.workflowHandledStrategyIds=['s1','s2','s1'];rt.saveChatHistory(a);const b=chat('workflow-two');rt.saveChatHistory(b);const next=runtime(storage);assert.deepEqual(Array.from(next.restoreChatHistory(a.id).workflowHandledStrategyIds),['s1','s2']);assert.equal(next.restoreChatHistory(b.id).workflowHandledStrategyIds.length,0);
});
