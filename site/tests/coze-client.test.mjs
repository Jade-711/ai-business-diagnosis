import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../web/coze-client.js',import.meta.url),'utf8');
const rulesSource=(await readFile(new URL('../shared/production-rules.js',import.meta.url),'utf8')).replace(/^export /gm,'');
const usageSource=await readFile(new URL('../web/production-usage.js',import.meta.url),'utf8');
const dataSource=await readFile(new URL('../web/aidd-data.js',import.meta.url),'utf8');
const trialDataSource=dataSource.slice(dataSource.indexOf('const AIDD_LIVE_EXPOSURE_CASES='),dataSource.indexOf('function aiddCompare('));
const appSource=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
function client(fetch=()=>{throw new Error('欢迎语不应发出网络请求');},storedMode=null){
 const context=vm.createContext({localStorage:{getItem:key=>key==='aidd-coze-mode'?storedMode:null},document:{addEventListener(){}},fetch});
 vm.runInContext(trialDataSource,context);vm.runInContext(rulesSource,context);vm.runInContext(usageSource,context);vm.runInContext(source,context);return context;
}
test('问候与功能说明在网站入口直接回答，经营问题继续进入业务处理',()=>{
 const c=client();
 for(const question of ['你好！','您好','hi','你能帮我做什么？','使用说明'])assert.equal(typeof c.cozeEntryReply(question),'string');
 for(const question of ['为什么直播成交下降？','你好，帮我分析直播','点击率是多少？'])assert.equal(c.cozeEntryReply(question),null);
});
test('网站将框架与策略生产发送到后台专用入口',async()=>{
 const paths=[],c=client(async(path,options)=>{paths.push(path);assert.equal(typeof JSON.parse(options.body).question,'string');return new Response(JSON.stringify({schemaVersion:1,answer:'结果'}),{headers:{'content-type':'application/json'}});});
 await c.cozeRequest({question:'商家诊断'});
 await c.cozeRequest({question:'框架生产',operation:'generate_framework'});
 await c.cozeRequest({question:'策略生产',operation:'generate_strategies'});
 assert.deepEqual(paths,['/api/diagnose','/api/aidd/generate','/api/aidd/generate']);
});
test('请求中的页面背景来自实际看板，不冒充聊天已解析范围，也不打包经营数值',()=>{
 const c=client();vm.runInContext("var state={fieldKey:'live',period:'week',metricKey:'clickRate',chat:{id:'chat_existing'}}",c);
 const p=c.cozeRequestSnapshot('昨天短视频表现如何',{fieldKey:'video',period:'day'});
 assert.equal(p.pageContext.fieldKey,'live');assert.equal(p.pageContext.period,'week');assert.equal(p.chatId,'chat_existing');assert.equal(p.context,undefined);assert.equal(p.data,undefined);assert.equal(p.config,undefined);
});
test('澄清说明只显示一次，其他独立缺口仍保留',()=>{
 const c=client();c.esc=value=>String(value);c.icon=()=>'';
 const answer='请选一个已接入周期。';
 const html=c.cozeAnswerHTML({branch:'clarification',answer,missing:[answer,'还需提供商家编号','还需提供商家编号']});
 assert.equal(html.split(answer).length-1,1);assert.equal(html.split('还需提供商家编号').length-1,1);
});

test('临时试跑不标为人工确认，确认只有后端检查通过才继续',async()=>{
 const c=client(),calls=[];c.cozeProductionInput=(inputs,options)=>({...inputs,...options});
 c.aiddProductionRequest=async payload=>{calls.push(payload);return {status:'needs_review',trialReport:{executed:true}};};
 await c.cozeReviewProduction('generate_strategies',{goal:'点击诊断'},{text:'待审核阈值',phase:'test'});
 assert.equal(calls[0].productionInput.review.confirmed,false);assert.equal(calls[0].productionInput.phase,'test');
 await assert.rejects(()=>c.cozeReviewProduction('generate_strategies',{goal:'点击诊断'},{text:'确认阈值'}));
 assert.equal(calls[1].productionInput.review.confirmed,true);assert.equal(calls[1].productionInput.review.reviewedText,'确认阈值');
});

test('生产测试案例省略缺失数字，保留有效的零值，不向 Coze 数字字段传 null',()=>{
 const c=client();
 c.aiddData={scenes:[{id:'s',fieldKey:'live',name:'直播'}],frameworks:[],metrics:[{id:'change',fieldKey:'live',metricKey:'clickRate',derived:'change'},{id:'value',fieldKey:'live',metricKey:'clickRate',derived:'value'}],actions:[]};
 c.aiddRuntimeConfig=()=>null;c.aiddMetricValue=()=>2;c.clone=value=>JSON.parse(JSON.stringify(value));
 c.MERCHANT_FIELDS={live:{metrics:{clickRate:{week:{previousValue:0,current:[2]},day:{previousValue:null}}}}};
 const inputs={sceneIds:['s'],metricIds:['change','value'],actionIds:[]};
 assert.equal(c.cozeProductionInput(inputs).trialCases.length,0);
 const result=c.cozeProductionInput(inputs,{phase:'test',period:'week'}),day=c.cozeProductionInput(inputs,{phase:'test',period:'day'});
 assert.equal(result.trialCases[0].metricValues[0].previousValue,undefined);
 assert.equal(result.trialCases[0].metricValues[1].previousValue,0);
 assert.equal(day.trialCases[0].metricValues[1].previousValue,undefined);
 assert.deepEqual(JSON.parse(JSON.stringify(day.trialCases[0].metricValues[1].currentValues)),[]);
});

test('框架生产不混入其他已发布框架正文，审核框优先显示本次完整自然语言稿',async()=>{
 const c=client(),calls=[];
 c.cozeIsActive=()=>true;c.aiddFrameScene=()=>({fieldKey:'live',merchantScope:'跃迁期商家'});c.aiddNow=()=> 'test';
 c.cozeProductionInput=()=>({sourceFramework:{id:'published-other',text:'其他框架旧正文',branches:[{id:'old'}]}});
 c.aiddProductionRequest=async payload=>{calls.push(payload);return {status:'needs_review',draftText:'本次完整可审核正文',candidate:{id:'new-frame',draftText:'简短结构预览',branches:[]}};};
 const frame={id:'new-frame',name:'直播点击框架',sceneId:'scene-live',scope:'商家输入的适用范围',goal:'点击诊断',metricIds:['m'],actionIds:['a'],productionPrompt:'旧版本的额外Prompt'};
 await c.cozeBuildFrameDraft(frame);
 assert.equal(calls[0].productionInput.sourceFramework.id,'new-frame');
 assert.equal(calls[0].productionInput.sourceFramework.text,undefined);
 assert.equal(calls[0].productionInput.sourceFramework.branches,undefined);
 assert.equal(calls[0].productionInput.frameworkName,'直播点击框架');assert.equal(calls[0].productionInput.prompt,'');
 assert.equal(frame.draftText,'本次完整可审核正文');assert.equal(frame.protocolConfirmed,false);
});

test('框架试跑传递本次周期与框架名称，更换商家不会借用默认商家的昨日数据',async()=>{
 const c=client(),calls=[];c.aiddFrameScene=()=>({fieldKey:'live',merchantScope:'商家'});c.aiddFrameDraftFingerprint=()=> 'current';
 c.cozeProductionInput=(inputs,options)=>({...inputs,...options});c.aiddProductionRequest=async(payload,options)=>{calls.push({payload,options});return {trialReport:{executed:true}};};
 const progress=()=>{};await c.cozeTrialFramework({id:'current-frame',name:'当前审核框架',sceneId:'s',metricIds:['m'],actionIds:[],draftText:'本次方法',casePeriod:'day'}, {id:'DEMO_10001'},{onProgress:progress});
 assert.equal(calls[0].payload.productionInput.period,'day');assert.equal(calls[0].payload.productionInput.frameworkName,'当前审核框架');assert.equal(calls[0].options.onProgress,progress);
 const d=client();d.aiddData={scenes:[{id:'s',fieldKey:'live',name:'直播'}],metrics:[{id:'m',fieldKey:'live',metricKey:'clickRate',derived:'value'}],actions:[]};d.aiddRuntimeConfig=()=>null;d.clone=value=>JSON.parse(JSON.stringify(value));d.MERCHANT_FIELDS={live:{metrics:{clickRate:{day:{previousValue:3,current:[4]}}}}};
 const input=d.cozeProductionInput({sceneIds:['s'],metricIds:['m'],actionIds:[]},{phase:'test',period:'day',sample:{id:'DEMO_10002',name:'其他商家'}});
 assert.equal(input.trialCases[0].merchantId,'DEMO_10002');assert.equal(input.trialCases[0].period,'day');assert.equal(input.trialCases[0].metricValues.length,0);
});

test('服务状态只说明配置与权限，不暗示模型已运行；弹窗明确规则、模板及数据来源',async()=>{
 const c=client(async()=>new Response(JSON.stringify({configured:true,authorized:true,signedIn:true}))),button={dataset:{}},note={};let modal;
 c.document.getElementById=()=>button;c.document.querySelector=()=>note;c.location={hash:'#merchant'};c.esc=v=>String(v);c.icon=()=>'';c.cancelModalBtn=()=>'';c.modal=(...args)=>modal=args;
 await c.cozeRefreshConnection();assert.equal(button.textContent,'助手服务已配置');assert.match(note.textContent,/合成演示数据/);assert.doesNotMatch(button.textContent,/模型|已连接/);
 c.cozeOpenConnection();assert.equal(modal[0],'助手处理方式');assert.match(modal[2],/工作流内执行取数与规则校验，并按任务调用模型。/);assert.match(modal[2],/真实店铺取数尚未接入/);assert.doesNotMatch(modal.join(''),/服务已配置不代表某次请求已完成|每轮回复的依据中会标明可核验的处理方式|本地演示|data-coze-toggle/);
});
test('无在线服务时保持在线错误状态，不提供演示切换，工作流说明不冒充执行日志',async()=>{
 const c=client(async()=>new Response(JSON.stringify({configured:false,authorized:false}))),button={dataset:{}};
 c.document.getElementById=()=>button;c.document.querySelector=()=>null;await c.cozeRefreshConnection();
 assert.equal(button.textContent,'在线服务未配置');assert.match(c.cozeComposerNote(),/在线工作流尚未就绪/);assert.doesNotMatch(c.cozeComposerNote(),/浏览器内规则演示/);
 c.esc=v=>String(v);c.icon=()=>'';
 const html=c.cozeAnswerHTML({branch:'knowledge',answer:'说明',problemBreakdown:['返回的一项建议']});
 assert.match(html,/服务返回的分析说明/);assert.doesNotMatch(html,/本次分析路径|已完成/);
});
test('旧浏览器演示偏好不影响在线助手及后台权限，登录入口仍可使用',async()=>{
 const c=client(async()=>new Response(JSON.stringify({configured:true,authorized:true,adminAuthorized:true,productionBackend:'direct_model',productionConfigured:true,publicDemo:true})),'demo'),button={dataset:{}};let modal;
 c.document.getElementById=()=>button;c.document.querySelector=()=>null;c.location={hash:'#aidd'};c.esc=v=>String(v);c.cancelModalBtn=()=>'';c.modal=(...args)=>modal=args;
 await c.cozeRefreshConnection();assert.equal(c.cozeIsActive(),true);assert.equal(c.aiddIsOnline(),true);assert.equal(button.textContent,'助手可直接试用');assert.match(c.cozeComposerNote(),/由工作流处理/);
 c.cozeOpenConnection();assert.doesNotMatch(modal.join(''),/本地演示|data-coze-toggle/);
 vm.runInContext('COZE_CONNECTION.authorized=false',c);c.cozeOpenConnection();assert.match(modal[3],/signin-with-chatgpt/);assert.match(modal[3],/登录后使用/);
});
test('三类经营首问都发送到工作流，服务不可用时不会转成本地答案',()=>{
 for(const available of [true,false]){
  const c=client(undefined,'demo'),calls=[],errors=[],elements=new Map();
  vm.runInContext(`Object.assign(COZE_CONNECTION,{configured:${available},authorized:${available}})`,c);
  Object.assign(c,{state:{chat:{exchanges:[],context:{fieldKey:'overview',period:'week'}}},chatRunning:()=>false,sid:()=>String(calls.length+errors.length),routeQuestion:()=> 'diagnosis',resolveQuestionContext:(_q,ctx)=>ctx,beginChatExchange:()=>{},chatExchangeHTML:()=>'',scrollChat:()=>{},cozeSendQuestion:q=>calls.push(q),finishChatExchange:(_chat,_id,_answer,text,status)=>{errors.push({text,status});return {text};},chatAnswerHTML:e=>e.text,$:selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',insertAdjacentHTML(){}});return elements.get(selector);},merchantAnswer:()=>{throw Error('不能生成本地回答');},merchantDemoResult:()=>{throw Error('不能运行本地诊断');}});
  vm.runInContext(appSource.slice(appSource.indexOf('function sendQuestion('),appSource.indexOf('function scrollChat(')),c);
  const questions=['近7天全店成交金额是多少？','商品点击率是什么意思？','我直播具体有啥问题，怎么解决？'];for(const q of questions)c.sendQuestion(q);
  assert.deepEqual(calls,available?questions:[]);assert.equal(errors.length,available?0:3);for(const e of errors){assert.equal(e.status,'error');assert.match(e.text,/尚未执行工作流/);}
 }
});
test('访客开放状态启用工作流聊天，后台生产不借用聊天权限且不上传浏览器配置',async()=>{
 const payloads=[],c=client(async(path,options)=>{
  if(path==='/api/coze/status')return new Response(JSON.stringify({configured:true,authorized:true,signedIn:false,adminAuthorized:false,publicDemo:true,productionBackend:'direct_model',productionConfigured:true}));
  payloads.push(JSON.parse(options.body));return new Response(JSON.stringify({schemaVersion:1,answer:'工作流结果'}),{headers:{'content-type':'application/json'}});
 });
 const button={dataset:{}};c.document.getElementById=()=>button;c.document.querySelector=()=>null;
 c.aiddData={};c.aiddRuntimeConfig=()=>{throw Error('访客不应上传浏览器内配置');};
 await c.cozeRefreshConnection();assert.equal(button.textContent,'助手可直接试用');assert.equal(c.cozeIsActive(),true);assert.equal(c.aiddIsOnline(),false);
 await c.cozeRequest({question:'帮我分析近7天全店的目标差距'});assert.equal(payloads[0].runtimeConfigurations,undefined);
});
