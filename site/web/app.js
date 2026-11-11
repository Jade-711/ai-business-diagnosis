'use strict';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const icon = (name, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc = value => String(value ?? '').replaceAll('生意通','').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = value => JSON.parse(JSON.stringify(value));
const STORAGE_KEY = 'workflow-lab-aidd-v1';
const defaultConfig = {
  version: 1,
  framework: '先校验数据条件，再按商品曝光、点击效率、支付效率拆解直播成交变化。仅依据可观察指标定位异常；价格、主图、选品等具体原因需进一步核查。将命中结果关联到可用行动点，并返回诊断依据。',
  strategies: [
    {id:'demo_click_01',name:'商品点击效率下降',group:'点击效率',production:'人工配置',execution:'指标规则',metric:'click_drop',operator:'<=',threshold:-15,minExposure:1000,action:'检查商品展示与讲解',enabled:true},
    {id:'demo_exposure_02',name:'商品曝光规模下降',group:'曝光规模',production:'人工配置',execution:'指标规则',metric:'exposure_drop',operator:'<=',threshold:-20,minExposure:1000,action:'检查流量渠道与开播安排',enabled:true},
    {id:'demo_payment_03',name:'点击支付效率下降',group:'支付效率',production:'AI辅助生成',execution:'指标规则',metric:'payment_drop',operator:'<=',threshold:-15,minExposure:1000,action:'检查库存、价格与商品详情',enabled:true},
    {id:'demo_image_04',name:'商品主图内容核查',group:'内容核查',production:'人工配置',execution:'模型理解',metric:'content',operator:'<=',threshold:0,minExposure:1000,action:'完善商品主图与标题',enabled:false}
  ]
};
let saved;
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch {}
const validSaved = saved && Array.isArray(saved.published?.strategies) && Array.isArray(saved.draft?.strategies) && Number.isInteger(saved.published.version) && typeof saved.published.framework === 'string' && saved.published.strategies.every(s => typeof s.name === 'string' && typeof s.id === 'string' && (Number.isFinite(s.threshold)||s.rule&&typeof s.rule==='object'));
const state = {
  view:'merchant', merchantScreen:'home', backendTab:'strategies', backendSection:'scene', period:'week', fieldKey:'overview', metricKey:'gmv', floatPosition:null,
  published: validSaved ? saved.published : clone(defaultConfig),
  draft: validSaved ? saved.draft : clone(defaultConfig),
  logs:[], search:'',
  run:null, chat:null, modal:null, candidate:null, testResult:null, focusBeforeOverlay:null,
  returnView:'merchant', counter:0, hasTest:false, testSample:'normal'
};
const BRANCH_NAMES = {diagnosis:'经营分析 · 完整调用',data:'自然语言查数',knowledge:'知识问答',fixed:'固定问答',early:'经营分析 · 提前返回'};
const METRIC_LABELS = {click_drop:'商品点击率环比变化',exposure_drop:'商品曝光人数环比变化',payment_drop:'点击支付转化率环比变化',content:'商品内容核查'};
const SAMPLE = {normal:{name:'山野生活旗舰店',id:'DEMO_10001',gmv:48560,exposure:84200,clickRate:2.8,payRate:12.5,click_drop:-31.7,exposure_drop:-6.2,payment_drop:2.5},healthy:{name:'晴日好物店',id:'DEMO_10002',gmv:62800,exposure:92000,clickRate:4.6,payRate:13.1,click_drop:8.2,exposure_drop:7.5,payment_drop:5.1},small:{name:'初见生活小店',id:'DEMO_10003',gmv:1260,exposure:260,clickRate:2.8,payRate:9.1,click_drop:-31.7,exposure_drop:-10,payment_drop:-2}};
const NODES = {
 'm-context':{name:'构建 Context',level:1,type:'上下文',icon:'code',desc:'接收商家问题与用户、店铺、会话信息，组装本次请求上下文。',input:['question','sellerId / chatUserId','chatId'],output:['context'],basis:'主流程截图及架构梳理'},
 'm-session':{name:'创建会话',level:1,type:'会话',icon:'chat',desc:'创建或承接会话，将当前问题置于会话上下文。具体历史消息管理方式未展开。',input:['context'],output:['session / result'],basis:'主流程截图'},
 'm-fixed':{name:'固定问题处理',level:1,type:'前置处理',icon:'settings',desc:'处理预设的固定问题，再按流程决定是否继续识别业务意图。固定问题的实际清单未展开。',input:['ProcessingContext'],output:['result'],basis:'主流程截图'},
 'm-intent':{name:'意图识别',level:1,type:'模型节点',icon:'spark',desc:'识别当前提问的意图，为经营分析、自然语言查数、知识问答等分支提供路由依据。演示通过关键词选择路线。',input:['context / question'],output:['intent'],basis:'主流程截图及架构梳理'},
 'm-route':{name:'意图条件分流',level:1,type:'条件',icon:'flow',desc:'根据意图选择对应能力。经营诊断进入经营分析子流程，查数与知识问答走各自分支。三层关系展开的是经营分析这一条调用链。',input:['intent','context'],output:['经营分析 / 查数 / 知识问答'],basis:'主流程截图及架构梳理'},
 'm-return':{name:'返回商家',level:1,type:'返回',icon:'check',desc:'接收对应能力返回的结果，将响应交给商家聊天窗口。卡片与按钮由演示前端渲染。',input:['子流程结果'],output:['商家可见回答'],basis:'主流程与前端承接关系'},
 'b-infer':{name:'推论',level:2,type:'推论',icon:'spark',desc:'结合当前上下文进行推论，提供后续条件判断所需的信息。此处演示的是节点衔接，不还原未展开的内部 Prompt。',input:['context'],output:['推论结果'],basis:'经营分析子流程截图'},
 'b-condition':{name:'条件判断',level:2,type:'分支',icon:'flow',desc:'继续分支先获取配置并取数，再调用 AIDD；ELSE 分支在取数与 AIDD 之前结束当前子流程。真实条件表达式未展开。',input:['推论结果','条件相关结果'],output:['继续 / ELSE 提前返回'],basis:'架构梳理第27轮核实口径',note:'“提前返回”的条件待确认，不将数据不足等情况当作已确认条件。'},
 'b-data':{name:'配置与取数',level:2,type:'工具',icon:'data',desc:'取得本次经营分析需要的配置与数据。原型读取浏览器内发布的示例规则和固定演示数据。',input:['context','module / 场景信息'],output:['outputRenderData','诊断所需上下文'],basis:'经营分析子流程截图'},
 'b-aidd':{name:'AIDD 处理器',level:2,type:'子流程调用',icon:'layers',desc:'将当前请求与上下文交给 AIDD 内部执行。展开该节点即可看到参数校验、Think、结果解析与 Action 的顺序。',input:['context','请求 / 数据'],output:['resultStr'],basis:'三层工作流截图'},
 'b-stream':{name:'流式输出结果',level:2,type:'输出衔接',icon:'chat',desc:'位于 AIDD 处理器之后、再次推论之前。节点名称和位置已确认，具体是整理、封装还是转发结果流尚需内部配置。',input:['AIDD 返回结果'],output:['文本 / 流式结果'],basis:'架构梳理第27轮核实口径',note:'流式表示分块交付，不表示经营数据实时，也不能据此推断诊断速度。'},
 'b-summary':{name:'再次推论',level:2,type:'推论',icon:'spark',desc:'AIDD 和流式输出处理之后，子流程仍有一个推论节点，再将结果交回主流程。内部 Prompt 未展开。',input:['前序结果','context'],output:['子流程返回结果'],basis:'经营分析子流程截图'},
 'b-return':{name:'返回主流程',level:2,type:'返回',icon:'arrow',desc:'将经营分析子流程处理结果交回主流程，由主流程完成前端响应。不会从头重新执行主流程。',input:['经营分析结果'],output:['主流程结果'],basis:'三层工作流及后续核实'},
 'b-early':{name:'ELSE 提前返回',level:2,type:'提前结束',icon:'arrow',desc:'在取数和 AIDD 之前结束经营分析子流程，将已有处理结果交回主流程。实际触发条件仍待配置证据。',input:['条件判断 ELSE'],output:['当前子流程结果 → 主流程'],basis:'架构梳理第27轮核实口径',note:'该分支不是“诊断之后没有发现问题”；它位于诊断取数之前。'},
 'a-params':{name:'参数校验与构建',level:3,type:'准备',icon:'code',desc:'检查并构建后续执行所需的请求参数。字段细节与校验规则未展开。',input:['context'],output:['thinkRequest'],basis:'AIDD 执行流程截图'},
 'a-think':{name:'Think 执行',level:3,type:'执行',icon:'spark',desc:'执行 Think 并产出 thinkResult。根据后续策略执行结果列表，可以合理理解为结合框架与策略形成判断；内部模型、工具与调用次数未确认。',input:['context','request'],output:['thinkResult'],basis:'执行节点与结果字段；业务解释为推测',note:'框架和策略共同提供分析依据，不能把 Think 简单等同于“框架”。'},
 'a-parse':{name:'解析 Think 结果',level:3,type:'解析',icon:'code',desc:'将本次 Think 输出解析为后续 Action 可消费的策略执行结果列表。此处不是建设侧把候选文字策略转成规则协议。',input:['thinkResult'],output:['strategyExecuteResList'],basis:'AIDD 执行流程字段'},
 'a-action':{name:'Action 执行',level:3,type:'执行',icon:'target',desc:'承接策略执行结果，输出响应信息 infoResponse。组织响应与行动点相关处理是合理推测；不据此认定系统会自动修改商家经营配置。',input:['context','executeResList'],output:['infoResponse'],basis:'执行节点与结果字段；业务解释为推测',note:'Action 是运行时处理分工，不能简单等同于“策略”，也不等于自动执行真实经营操作。'},
 'a-return':{name:'返回上层',level:3,type:'返回',icon:'arrow',desc:'将 AIDD 内部结果交回经营分析子流程，继续流式输出衔接与再次推论。',input:['infoResponse'],output:['result'],basis:'AIDD 执行流程截图'},
 'x-data':{name:'自然语言查数',level:1,type:'其他分支',icon:'data',desc:'查数意图调用独立的数据查询能力。原型展示固定示例结果，不调用 AIDD。',input:['question / context'],output:['数据查询结果'],basis:'主流程独立分支'},
 'x-knowledge':{name:'知识问答',level:1,type:'其他分支',icon:'book',desc:'知识问答意图调用独立能力。原型提供示例知识文本，不连接实际知识库。',input:['question / context'],output:['知识回答'],basis:'主流程独立分支'},
 'x-fixed':{name:'固定回答',level:1,type:'预设回答',icon:'chat',desc:'对固定能力介绍问题返回原型预设回答。固定问题处理发生在意图分流前。',input:['固定问题'],output:['预设回答'],basis:'固定问题前置处理的演示'}
};
const PATHS = {
 diagnosis:['m-context','m-session','m-fixed','m-intent','m-route','b-infer','b-condition','b-data','b-aidd','a-params','a-think','a-parse','a-action','a-return','b-stream','b-summary','b-return','m-return'],
 data:['m-context','m-session','m-fixed','m-intent','m-route','x-data','m-return'],
 knowledge:['m-context','m-session','m-fixed','m-intent','m-route','x-knowledge','m-return'],
 fixed:['m-context','m-session','m-fixed','x-fixed','m-return'],
 early:['m-context','m-session','m-fixed','m-intent','m-route','b-infer','b-condition','b-early','m-return']
};
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({published:state.published,draft:state.draft}));}catch{toast('浏览器未允许本地保存，本次页面内仍可继续操作');}}
function dirty(){return JSON.stringify(state.draft)!==JSON.stringify(state.published);}
let toastTimer;
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3300);}
function money(v){return v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
function sid(){return `DEMO_${Date.now().toString(36).toUpperCase()}_${++state.counter}`;}
function pill(text,kind=''){return `<span class="pill ${kind}">${esc(text)}</span>`;}
function navItem(label,name,active,attrs=''){return `<button class="side-link ${active?'active':''}" ${attrs}>${icon(name)}<span>${label}</span></button>`;}

function render(){
  document.body.dataset.view=state.view;
  $$('.lab-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));
  $('#app').innerHTML=state.view==='merchant'?merchantView():backendView();
  document.title={merchant:'经营看板AI版',aidd:'诊断配置后台'}[state.view]+' · AI经营诊断';
  watchMerchantChart();
  if(typeof dashboardSnapshotSchedule==='function')dashboardSnapshotSchedule();
  if(state.view==='merchant'&&state.floatPosition)positionFloat($('.diagnosis-float'),state.floatPosition.x,state.floatPosition.y);
}
function setView(view,tab,merchantScreen='home'){
  if(!['merchant','aidd'].includes(view))return;
  if(state.chat)closeChat();
  state.view=view;
  if(view==='merchant'){state.merchantScreen=merchantScreen;if(merchantScreen==='home'&&!merchantCoreMetricKeys().includes(state.metricKey))state.metricKey='gmv';}
  if(tab)state.backendTab=tab;
  const hash=view==='merchant'?merchantHash():'#configuration';
  if(location.hash!==hash)history.replaceState(null,'',hash);
  render();
  window.scrollTo({top:0,behavior:'instant'});
}

let floatDrag=null,floatClickBlockedUntil=0;
function positionFloat(button,x,y){if(!button)return;const rect=button.getBoundingClientRect(),top=($('.lab-header')?.getBoundingClientRect().bottom||0)+8;const position={x:Math.max(8,Math.min(x,window.innerWidth-rect.width-8)),y:Math.max(top,Math.min(y,window.innerHeight-rect.height-8))};Object.assign(button.style,{left:`${position.x}px`,top:`${position.y}px`,right:'auto',bottom:'auto'});state.floatPosition=position;}
document.addEventListener('pointerdown',event=>{const button=event.target.closest('[data-draggable-float]');if(!button||event.button!==0)return;const rect=button.getBoundingClientRect();floatClickBlockedUntil=0;floatDrag={button,id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,moved:false};button.setPointerCapture(event.pointerId);});
document.addEventListener('pointermove',event=>{if(!floatDrag||event.pointerId!==floatDrag.id)return;const dx=event.clientX-floatDrag.x,dy=event.clientY-floatDrag.y;if(!floatDrag.moved&&Math.hypot(dx,dy)<6)return;floatDrag.moved=true;floatDrag.button.classList.add('dragging');positionFloat(floatDrag.button,floatDrag.left+dx,floatDrag.top+dy);event.preventDefault();},{passive:false});
function finishFloatDrag(event){if(!floatDrag||event.pointerId!==floatDrag.id)return;const {button,moved,id}=floatDrag;floatDrag=null;if(moved&&event.type==='pointerup')floatClickBlockedUntil=performance.now()+300;button.classList.remove('dragging');if(button.hasPointerCapture(id))button.releasePointerCapture(id);}
document.addEventListener('pointerup',finishFloatDrag);
document.addEventListener('pointercancel',finishFloatDrag);
document.addEventListener('lostpointercapture',finishFloatDrag);
window.addEventListener('resize',()=>{if(state.floatPosition&&state.view==='merchant')positionFloat($('.diagnosis-float'),state.floatPosition.x,state.floatPosition.y);});

function evaluate(config,sample){return config.strategies.map(strategy=>{if(strategy.rule){const hit=strategy.enabled&&strategy.execution!=='模型理解'&&aiddEvaluateRule(strategy.rule,config.metrics||aiddData.metrics,strategy.period||'week',sample);return {strategy,hit:!!hit,reason:aiddRuleText(strategy.rule,config.metrics||aiddData.metrics)};}return {strategy,hit:strategy.enabled&&strategy.metric!=='content'&&sample.exposure>=Number(strategy.minExposure)&&compare(sample[strategy.metric],strategy.operator,Number(strategy.threshold)),reason:!strategy.enabled?'策略已停用':strategy.metric==='content'?'需实际内容与模型，原型不执行':sample.exposure<Number(strategy.minExposure)?`未满足最低曝光 ${strategy.minExposure}`:`${sample[strategy.metric]}% ${strategy.operator} ${strategy.threshold}%`};});}
function compare(value,op,threshold){return op==='<='?value<=threshold:op==='<'?value<threshold:op==='>='?value>=threshold:value>threshold;}

function routeQuestion(q){if(/^(你好|您好|hi|hello|你能帮我做什么[？?]?)$/i.test(q.trim()))return 'fixed';if(/政策|扶持|补贴|权益|入驻规则|头部商家|优秀案例|行业经验|别人怎么做|(?:(?:如何|怎么).*(?:标题|主图)|(?:标题|主图).*(?:如何|怎么|优化|完善|调整))/.test(q))return 'knowledge';if(/多少|几单|查一下|查数|金额是/.test(q)&&!(/为什么|原因|下降|下滑|分析|诊断|最高|最低|行业|同行/.test(q)))return 'data';return /经营|生意|成交|支付|订单|曝光|流量|点击|转化|用户|新客|目标|差距|完成率|退货|退款|售后|行业|同行|竞对|商品|达人|视频|直播|指标|原因|怎么改|为什么|改善|下一步|利润|毛利|时长|发货|客服/.test(q)?'diagnosis':'knowledge';}
let runTimer;
function stopTimer(){clearTimeout(runTimer);runTimer=null;}
function startRun(branch,{source='工作流演示',question=BRANCH_NAMES[branch],auto=true,onComplete=null,context=null}={}){
 if(state.run?.status==='running'||state.run?.status==='paused'){toast('当前回答正在生成，请稍候');return false;}
 stopTimer();
 state.run={id:sid(),branch,path:PATHS[branch].slice(),index:0,status:auto?'running':'paused',events:[],source,question,config:aiddRequestConfig(context),context:context?clone(context):null,onComplete};
 if(auto)scheduleRun();return true;
}
function scheduleRun(){stopTimer();if(state.run?.status!=='running')return;const n=state.run.path[state.run.index];runTimer=setTimeout(advanceRun,n==='a-think'?850:n==='a-action'?650:350);}
function advanceRun(){if(!state.run||state.run.status==='complete')return;const run=state.run;const current=run.path[run.index];run.events.push({id:current,note:NODES[current].output.join(' · ')});run.index++;
 if(run.index>=run.path.length){run.status='complete';stopTimer();const record={id:run.id,question:run.question,source:run.source,branch:run.branch,version:run.config.version,context:run.context,events:clone(run.events),results:run.branch==='diagnosis'&&(!run.context||(run.context.fieldKey==='live'&&run.context.period==='week'))?evaluate(run.config,SAMPLE.normal):[]};state.logs.push(record);if(run.onComplete)run.onComplete(record,run.config);return;}
 if(run.status==='running')scheduleRun();
}
function chatRunning(){return !!state.chat?.cozePending||!!state.chat&&!!state.run&&state.run.status!=='complete'&&state.run.source!=='工作流演示';}
function openChat(source='智能助手',question,context={fieldKey:state.fieldKey,period:state.period},options={}){
 if(state.chat)return;
 if(state.run&&['running','paused'].includes(state.run.status)){toast('当前诊断正在处理，请稍候再打开聊天');return;}
 state.focusBeforeOverlay=document.activeElement;state.returnView=state.view;
 const previous=!options.fresh&&(options.id||options.resume===true)?restoreChatHistory(options.id):null,now=Date.now();
 const chat=state.chat=previous||{source,id:sid(),context:clone(context),createdAt:now,updatedAt:now,exchanges:[],draft:'',scrollTop:0};
 if(question){chat.context=clone(context);chat.draft=question;}
 const field=fieldData(chat.context.fieldKey),period=chat.context.period,date=new Date(chat.createdAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
 $('#overlay-root').innerHTML=`<div class="chat-scrim" data-action="close-chat"></div><section class="chat-shell merchant-chat" role="dialog" aria-modal="true" aria-labelledby="chat-title"><div class="chat-main"><header class="chat-header"><div class="row"><span class="assistant-avatar">${icon('spark')}</span><div><h3 id="chat-title">智能助手</h3><p>一起看懂数据，找到经营的下一步</p></div></div><div class="row"><button class="icon-btn" data-action="chat-history" title="最近24小时聊天记录" aria-label="聊天记录">${icon('clock')}</button><button class="icon-btn" data-action="clear-chat" title="新建会话" aria-label="新建会话">${icon('plus')}</button><button class="icon-btn" data-action="close-chat" title="关闭聊天" aria-label="关闭聊天">${icon('close')}</button></div></header><div class="chat-messages" id="chat-messages" aria-live="polite"><div class="chat-time">${esc(date)}</div>${assistantMessage(`<h3>你好，我是你的智能助手。</h3><p>已带入<strong>${field.name} · ${periodName(period)}</strong>作为参考，你也可以直接询问其他场域或周期，或继续追问。</p><div class="chat-suggestions"><button data-chat-question="${merchantQuestion(chat.context.fieldKey,period)}">分析${field.name}经营表现</button><button data-chat-question="${merchantQuestion(chat.context.fieldKey,period,'目标差距')}">分析目标差距</button><button data-chat-question="查一下${periodName(period)}${field.name}的经营数据">查看经营数据</button></div>`) }${chat.exchanges.map(chatExchangeHTML).join('')}</div><form class="chat-composer" id="chat-form"><div class="composer-box"><textarea id="chat-input" rows="1" maxlength="300" placeholder="继续追问，例如：目标差距主要在哪里？" aria-label="输入商家问题">${esc(chat.draft)}</textarea><button class="send-btn" type="submit" aria-label="发送消息">${icon('up')}</button></div><div class="composer-note"><span>${cozeComposerNote()} · 本浏览器保留24小时记录</span><span>Enter 发送 · Shift+Enter 换行</span></div></form></div></section>`;
 document.body.style.overflow='hidden';$('#chat-input').focus({preventScroll:true});
 if(previous&&!question)$('#chat-messages').scrollTop=chat.scrollTop;
 saveChatHistory(chat);
}
function assistantMessage(body,id=''){return `<div class="message assistant" ${id?`id="${esc(id)}"`:''}><span class="message-avatar">${icon('spark')}</span><div class="message-content">${body}</div></div>`;}
function closeChat(){
 const chat=state.chat;if(!chat)return;
 captureChatPosition();chat.exchanges.forEach(e=>{if(e.status==='pending')e.status='interrupted';});saveChatHistory(chat);chat.cozeAbort?.abort();
 if(state.run?.source===chat.source&&state.run.status!=='complete'){stopTimer();state.run.status='complete';}
 state.chat=null;$('#overlay-root').innerHTML='';document.body.style.overflow='';state.focusBeforeOverlay?.focus?.();
}
function sendQuestion(raw){
 const q=raw.trim();if(!q)return;if(chatRunning()){toast('当前回答正在生成，请稍候');return;}if(state.run?.status==='running'||state.run?.status==='paused'){toast('当前流程尚未结束');return;}
 const chat=state.chat;if(!chat)return;
 const id=`answer-${sid()}`,branch=routeQuestion(q),context=resolveQuestionContext(q,chat.context);chat.context=context;
 beginChatExchange(chat,id,q,context,branch);
 $('#chat-messages').insertAdjacentHTML('beforeend',chatExchangeHTML(chat.exchanges.at(-1)));$('#chat-input').value='';$('#chat-input').disabled=true;$('.send-btn').disabled=true;scrollChat();
 const entryReply=cozeEntryReply(q);
 if(entryReply){const exchange=finishChatExchange(chat,id,{kind:'text',analysis:chatEvidenceRecord(null,{mode:'fixed_reply'})},entryReply);$(`#${id} .message-content`).innerHTML=chatAnswerHTML(exchange);$('#chat-input').disabled=false;$('.send-btn').disabled=false;$('#chat-input').focus({preventScroll:true});scrollChatAnswer(id);captureChatPosition();return;}
 if(cozeIsActive())cozeSendQuestion(q,chat,id,context);
 else{const e=finishChatExchange(chat,id,{kind:'text'},COZE_CONNECTION.configured?'请先登录并获得在线助手权限；本次尚未执行工作流。':'在线助手服务尚未就绪；本次尚未执行工作流。','error');$(`#${id} .message-content`).innerHTML=chatAnswerHTML(e);$('#chat-input').disabled=false;$('.send-btn').disabled=false;}
}
function scrollChat(){const el=$('#chat-messages');if(el)el.scrollTop=el.scrollHeight;}
function scrollChatAnswer(id){const messages=$('#chat-messages'),answer=document.getElementById(id);if(messages&&answer)messages.scrollTop+=answer.getBoundingClientRect().top-messages.getBoundingClientRect().top-10;}
document.addEventListener('click',event=>{
 const summary=event.target.closest?.('.chat-analysis[data-analysis-complete]>summary');if(!summary)return;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{if(summary.parentElement.open)summary.scrollIntoView({block:'start',inline:'nearest',behavior:'auto'});}));
});
function modal(title,subtitle,body,footer='',wide=false){
 const previousFocus=state.modal?state.modalFocus:document.activeElement;
 $$('[id="modal-host"]').forEach(host=>host.remove());
 state.modal=true;state.modalFocus=previousFocus;
 const host=document.createElement('div');host.id='modal-host';host.innerHTML=`<div class="modal-scrim"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><div><h2 id="modal-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-btn" data-action="close-modal" aria-label="关闭对话框">${icon('close')}</button></header><div class="modal-body">${body}</div>${footer?`<footer class="modal-footer">${footer}</footer>`:''}</section></div>`;document.body.appendChild(host);document.body.style.overflow='hidden';const first=$('input:not([readonly]),textarea,select',host)||$('.icon-btn',host);first?.focus();
}
function closeModal(){if(!state.modal&&!$('#modal-host'))return;$$('[id="modal-host"]').forEach(host=>host.remove());state.modal=null;document.body.style.overflow=state.chat?'hidden':'';state.modalFocus?.focus?.();}
function cancelModalBtn(){return `<button class="btn" data-action="close-modal">取消</button>`;}
function about(){modal('关于这个交互原型','AI经营诊断 · 经营看板商家体验与诊断配置',`<div class="about-block"><h3>经营看板</h3><p>经营概览、关键指标诊断、目标诊断与智能助手使用同一工作流服务。流程负责识别任务与范围、读取已发布资产、调用取数与计算工具、校验证据、生成原因判断和行动建议。普通诊断最多并行解释3个问题，目标诊断单次生成；复杂问法增加一次任务识别。</p></div><div class="about-block"><h3>诊断配置</h3><p>按全店、场域、环节、要素管理场景，关联指标和行动点，再生产并发布诊断框架与策略。页面选择的周期影响取数，不产生重复策略。</p></div><div class="note">当前指标和目标为合成演示数据，真实店铺取数尚未接入。原因说明区分数值关系与待验证的经营假设；每轮依据保留实际返回和浏览器记录的总耗时。本地规则演示需主动选择，在线失败会提示重试。后台生产使用独立模型服务，生成内容需审核后发布。</div>`,`<button class="btn primary" data-action="close-modal">开始探索 ${icon('arrow')}</button>`);}
function viewJSON(title,data,subtitle='示例协议结构，字段仅用于理解本原型'){modal(title,subtitle,`<pre class="expression">${esc(JSON.stringify(data,null,2))}</pre>`,`<button class="btn primary" data-action="close-modal">关闭</button>`,true);}
document.addEventListener('click',event=>{
 const b=event.target.closest('button,a');if(!b)return;
 if(b.hasAttribute('data-draggable-float')&&event.detail!==0&&performance.now()<floatClickBlockedUntil)return;
 if(b.dataset.chatResume){resumeChatHistory(b.dataset.chatResume);return;}
 if(b.dataset.chatRetry){retryChatExchange(b.dataset.chatRetry);return;}
 if(b.dataset.issueProgress){chatIssueProgress(b.dataset.exchangeId,b.dataset.issueProgress,b.dataset.issueId);return;}
 if(b.dataset.field){selectField(b.dataset.field);return;}
 if(b.dataset.goField){selectField(b.dataset.goField,true);return;}
 if(b.dataset.insightQuestion||b.dataset.diagnosisQuestion){openChat(b.dataset.insightQuestion?'指标诊断':'经营诊断',b.dataset.insightQuestion||b.dataset.diagnosisQuestion,{fieldKey:b.dataset.contextField,period:state.period});return;}
 if(b.dataset.askGoal){openChat('目标诊断',merchantQuestion(b.dataset.askGoal,state.period,'目标差距'),{fieldKey:b.dataset.askGoal,period:state.period});return;}
 if(b.dataset.businessTool){event.preventDefault();if(typeof curatedActive==='function'&&curatedActive()){curatedOpenTool(b.dataset.businessTool);return;}b.classList.add('is-pressed');setTimeout(()=>b.classList.remove('is-pressed'),500);return;}
 if(b.dataset.actionSuggestion){showActionSuggestion(b.dataset.actionSuggestion,b.dataset.actionAdvice,b.dataset.actionTool);return;}
 if(b.dataset.metricKey){selectMetric(b.dataset.metricKey);return;}
 if(b.dataset.view){setView(b.dataset.view);return;}
 if(b.dataset.question){openChat('智能助手',b.dataset.question);return;}
 if(b.dataset.chatQuestion){sendQuestion(b.dataset.chatQuestion);return;}
 const action=b.dataset.action;
 switch(action){
  case 'about':about();break;
  case 'merchant-home':selectField('overview');window.scrollTo({top:0,behavior:'smooth'});break;
  case 'open-assistant':openChat();break;
  case 'open-float':openChat('智能助手浮标',undefined,undefined,{resume:true});break;
  case 'merchant-data':openChat('智能助手','昨天直播卖了多少单？');break;
  case 'merchant-live':openChat('智能助手','为什么最近直播成交下降了？');break;
  case 'close-chat':closeChat();break;
  case 'chat-history':showChatHistory();break;
  case 'clear-chat':if(chatRunning()){toast('请等待当前回答完成');break;}const src=state.chat.source,ctx=clone(state.chat.context);closeChat();openChat(src,undefined,ctx,{fresh:true});break;
  case 'close-modal':closeModal();break;
 }
});
document.addEventListener('click',event=>{if(event.target.classList.contains('chat-scrim'))closeChat();if(event.target.classList.contains('modal-scrim'))closeModal();});
document.addEventListener('change',event=>{
 if(event.target.id==='merchant-period'){state.period=event.target.value;syncMerchantRoute();render();}
});
document.addEventListener('submit',event=>{
 if(event.target.getAttribute('id')==='chat-form'){event.preventDefault();sendQuestion($('#chat-input').value);}
});
document.addEventListener('keydown',event=>{
 if(event.target.dataset.field&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
  event.preventDefault();const keys=Object.keys(MERCHANT_FIELDS),index=keys.indexOf(event.target.dataset.field),next=event.key==='Home'?0:event.key==='End'?keys.length-1:(index+(event.key==='ArrowRight'?1:-1)+keys.length)%keys.length;selectField(keys[next]);$(`[data-field="${keys[next]}"]`).focus();
 }
 if(event.key==='Escape'){if(state.modal)closeModal();else if(state.chat)closeChat();}
 if(event.target.id==='chat-input'&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();sendQuestion(event.target.value);}
 if(event.key==='Tab'&&(state.modal||state.chat)){const root=state.modal?$('#modal-host'):$('.chat-shell');const focusable=$$('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',root).filter(e=>e.offsetParent!==null);if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
});
function applyRoute(){
 const [view,screen,field,period,metric]=location.hash.slice(1).split('/'),dashboard=view==='merchant'&&screen==='dashboard';
 if(dashboard){if(Object.hasOwn(MERCHANT_FIELDS,field))state.fieldKey=field;if(['week','day'].includes(period))state.period=period;state.metricKey=typeof curatedActive==='function'&&curatedActive()?(curatedMetrics().some(m=>m.id===metric)?metric:curatedCoreMetricIds()[0]):Object.hasOwn(fieldMetrics(),metric)?metric:'gmv';}
 setView(['aidd','configuration'].includes(view)?'aidd':'merchant',undefined,dashboard?'dashboard':'home');
}
window.addEventListener('hashchange',applyRoute);
initAidd();
applyRoute();

let chatDraftTimer;
document.addEventListener('input',event=>{if(event.target.id!=='chat-input')return;const chat=state.chat;clearTimeout(chatDraftTimer);chatDraftTimer=setTimeout(()=>{if(state.chat===chat)captureChatPosition();},250);});
window.addEventListener('pagehide',captureChatPosition);
function expireChatRecords(){
 writeChatHistory(readChatHistory());const chat=state.chat;if(!chat)return;
 const cutoff=Date.now()-CHAT_RETENTION_MS,expired=chat.exchanges.filter(e=>e.createdAt<=cutoff);
 for(const exchange of expired){const node=document.getElementById(exchange.id);if(node?.previousElementSibling?.classList.contains('user'))node.previousElementSibling.remove();node?.remove();}
 chat.exchanges=chat.exchanges.filter(e=>e.createdAt>cutoff);saveChatHistory(chat);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)captureChatPosition();else expireChatRecords();});
expireChatRecords();setInterval(expireChatRecords,60000);
