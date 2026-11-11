import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
async function setup(){
 const app=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
 const elements=new Map();
 class FormData {constructor(form){this.values=form.values||{};}get(key){return this.values[key]??null;}getAll(key){return this.values[key]||[];}}
 const c=vm.createContext({setInterval,clearInterval,FormData,localStorage:{getItem:()=>null,setItem(){}},document:{addEventListener(){},querySelector:selector=>elements.get(selector)||null},window:{addEventListener(){}}});c.elements=elements;c.render=()=>{};c.toast=()=>{};c.persist=()=>{};
 vm.runInContext(app.slice(0,app.indexOf('const NODES =')),c);
 for(const helper of ['pill','navItem'])vm.runInContext(app.split('\n').find(line=>line.startsWith('function '+helper+'(')),c);
 for(const n of ['merchant-data','merchant-ui','demo-coverage','production-rules','aidd-data','production-usage','aidd-ui','framework-prompt','framework-ui','coze-client'])vm.runInContext(await readFile(new URL('../web/'+n+'.js',import.meta.url),'utf8'),c);
 vm.runInContext('initAidd()',c);return c;
}
test('生产入口只准备生成资产；案例按需单独提交，保持待审核交接',async()=>{
 const c=await setup(),p=vm.runInContext("(()=>{const scene=aiddData.scenes.find(s=>s.fieldKey==='live');return cozeProductionInput({sceneIds:[scene.id],goal:'分析点击下降',scope:'近7天',metricIds:scene.metricIds,actionIds:scene.actionIds})})()",c);
 assert.equal(p.sourceFramework.active,true);assert.ok(p.sourceFramework.id);assert.ok(p.sourceFramework.version>0);assert.ok(p.sourceFramework.branches.length);assert.equal(p.trialCases.length,0);
 const trial=vm.runInContext("(()=>{const scene=aiddData.scenes.find(s=>s.fieldKey==='live');return cozeProductionInput({sceneIds:[scene.id],goal:'点击问题',scope:'近7天',metricIds:scene.metricIds,actionIds:[]},{phase:'test'})})()",c);assert.equal(trial.trialCases.length,1);assert.ok(trial.trialCases[0].metricValues.length);assert.equal(trial.knowledge.length,0);
 const html=c.aiddProductionDelivery({productionHandoff:{consumerWorkflow:'Main_agent'},productionTrial:{executed:true,caseCount:2}});assert.match(html,/灰度发布后供智能助手主流程/);
});
test('商家快照保留结构化发布框架与版本，草稿不进入执行候选',async()=>{
 const c=await setup();const p=vm.runInContext("merchantLocalSnapshot('分析直播表现',{fieldKey:'live',period:'week'})",c);
 assert.ok(p.config.frameworkCandidates.length);assert.ok(p.config.frameworkCandidates.every(f=>f.active&&f.version&&f.branches.length));
 assert.ok(p.config.strategies.every(s=>s.frameworkId&&s.frameworkVersion));
 const before=p.config.frameworkCandidates.length;
 vm.runInContext("aiddData.frameworks.push({id:'draft_unpublished',sceneId:'scene-live',status:'待生效',branches:[],metricIds:[],actionIds:[]})",c);
 const after=vm.runInContext("merchantLocalSnapshot('分析直播表现',{fieldKey:'live',period:'week'})",c);
 assert.equal(after.config.frameworkCandidates.length,before);assert.ok(!after.config.frameworkCandidates.some(f=>f.id==='draft_unpublished'));
});

test('框架发布承接人工确认与同一份报告，修改或未验收的试跑不能复用',async()=>{
 const c=await setup();
 assert.equal(c.aiddFrameCanPublish({protocolConfirmed:false}),false);
 assert.equal(c.aiddFrameCanPublish({protocolConfirmed:true}),false);
 const frame={protocolConfirmed:true,generation:2,caseId:'picked',reviewPassed:true,draftText:'本次草稿',trial:{generation:2,caseId:'picked',report:{schemaVersion:2,analysisMode:'draft_framework_diagnosis',status:'completed',executed:true,cases:[{merchantId:'picked',period:'week',frameworkId:undefined}]}}};
 frame.protocolDraftFingerprint=c.aiddFrameDraftFingerprint(frame);frame.trial.draftFingerprint=frame.protocolDraftFingerprint;
 assert.equal(c.aiddFrameCanPublish(frame),true);
 assert.equal(c.aiddFrameCanPublish({...frame,reviewPassed:false}),false);
 assert.equal(c.aiddFrameCanPublish({...frame,generation:3}),false);
 assert.equal(c.aiddFrameCanPublish({...frame,trial:{...frame.trial,report:{status:'incomplete'}}}),false);
});

test('框架页面仅填写输入，完整固定模板可展开查看，表单与后台不再接收额外场景Prompt',async()=>{
 const c=await setup();
 const html=vm.runInContext('aiddFrameworkPanel()',c);assert.match(html,/诊断框架列表/);
 const form=vm.runInContext("(()=>{const scene=aiddData.scenes[0];aiddUI.frameEditing={sceneId:scene.id,name:'测试框架',goal:'分析',metricIds:[],actionIds:[]};return aiddFrameForm()})()",c);
 assert.doesNotMatch(form,/name="productionPrompt"|场景生产 Prompt/);assert.match(form,/name="scope"/);assert.match(form,/查看完整生产 Prompt/);assert.match(form,/杜邦拆解/);assert.match(form,/MECE/);assert.match(form,/奥卡姆剃刀/);assert.match(form,/不超过10/);
});

function draftFrame(c){return vm.runInContext("(()=>{const scene=aiddData.scenes.find(s=>s.fieldKey==='live');const frame={id:'test-frame',name:'演示框架',sceneId:scene.id,goal:'分析点击下降',scope:'跃迁期商家',metricIds:['live-clickRate-value'],actionIds:[],generation:1,version:1,workflowSchema:1,status:'待生效',stage:'draft',draftText:'点击表现分析',branches:[{id:'b',name:'点击',metricIds:['live-clickRate-value'],actionIds:[]}]};aiddData.frameworks.push(frame);aiddUI.frameId=frame.id;aiddUI.frameView='detail';return frame;})()",c);}
test('提交后立即进入审核页显示真实进度，等待时不可重复试跑或重新生成',async()=>{
 const c=await setup();let finish;
 c.cozeBuildFrameDraft=(frame,{onProgress})=>new Promise(resolve=>{onProgress('已连接模型，正在生成');finish=()=>{Object.assign(frame,{generation:1,draftText:'生成后的本次正文',branches:[],production:'DeepSeek生成'});resolve(frame);};});
 const frame=draftFrame(c);frame.draftText='';
 const request=c.aiddGenerateFramework(frame);
 const pending=c.aiddFrameDetail(frame);assert.match(pending,/正在生成诊断框架/);assert.match(pending,/已连接模型，正在生成/);assert.match(pending,/本次生产输入/);assert.match(pending,/data-frame-regenerate disabled/);
 finish();await request;assert.match(c.aiddFrameDetail(frame),/生成后的本次正文/);assert.equal(frame.status,'待生效');assert.equal(frame.protocolConfirmed,false);
});
test('生成失败保留输入与可重试入口，不把半成品当成功草稿',async()=>{
 const c=await setup(),frame=draftFrame(c);frame.draftText='';c.cozeBuildFrameDraft=async()=>{throw Error('网络失败');};
 await c.aiddGenerateFramework(frame);assert.equal(frame.name,'演示框架');assert.equal(frame.metricIds[0],'live-clickRate-value');assert.match(c.aiddFrameDetail(frame),/网络失败/);assert.match(c.aiddFrameDetail(frame),/生成未完成/);assert.doesNotMatch(c.aiddFrameDetail(frame),/本地示例/);assert.equal(frame.status,'待生效');assert.equal(c.aiddFrameCanPublish(frame),false);
});
test('未确认框架即可试跑；人工审核后演示校验保留同一报告，最后才允许灰度发布',async()=>{
 const c=await setup(),frame=draftFrame(c);c.aiddIsOnline=()=>true;
 const report={schemaVersion:2,analysisMode:'draft_framework_diagnosis',executed:true,status:'completed',caseCount:1,cases:[{merchantId:'DEMO_10001',period:'week',frameworkId:frame.id,label:'所选商家',frameworkName:frame.name,summary:'点击效率待核查',problems:[],unresolved:[],clear:[],frameworkBranches:[],evidence:[]}],limitations:[]};
 c.cozeTrialFramework=async f=>{assert.equal(f.protocolConfirmed,false);return {candidate:{branches:f.branches},trialReport:report};};
 c.cozeReviewFrame=()=>{throw Error('演示确认不应再次调用模型');};
 await c.aiddRunFrameworkTrial({values:{merchantId:'DEMO_10001'}});
 assert.equal(c.aiddFrameTrialCurrent(frame),true);assert.equal(c.aiddFrameCanPublish(frame),false);
 c.aiddConfirmFrameworkProtocol();assert.equal(frame.protocolConfirmed,false);
 assert.equal(c.aiddSetFrameworkTrialReviewed(true),true);c.aiddConfirmFrameworkProtocol();
 assert.equal(frame.protocolValidation.mode,'demo');assert.equal(frame.trial.report,report);assert.equal(c.aiddFrameCanPublish(frame),true);
 const actions=c.aiddFrameTrialPanel(frame);const order=['data-frame-trial-submit','data-frame-regenerate','data-frame-confirm-protocol','data-frame-publish'].map(key=>actions.indexOf(key));assert.ok(order.every((value,index)=>index===0||value>order[index-1]));
 c.aiddPublishFramework();assert.equal(frame.status,'生效中');assert.equal(frame.releaseSellerAllowlist[0],'DEMO_10001');
});
test('编辑草稿或更换案例后撤销旧报告及演示确认，必须重新试跑和人工审核',async()=>{
 const c=await setup(),frame=draftFrame(c);frame.caseId='DEMO_10001';frame.reviewPassed=true;frame.protocolConfirmed=true;frame.protocolDraftFingerprint=c.aiddFrameDraftFingerprint(frame);frame.trial={generation:1,caseId:frame.caseId,draftFingerprint:frame.protocolDraftFingerprint,report:{schemaVersion:2,analysisMode:'draft_framework_diagnosis',executed:true,status:'completed',cases:[{merchantId:'DEMO_10001',period:'week',frameworkId:frame.id}]}};
 assert.equal(c.aiddFrameCanPublish(frame),true);c.aiddInvalidateFrameDraft(frame,'人工修改后的草稿');assert.equal(frame.trial,null);assert.equal(frame.protocolConfirmed,false);assert.equal(c.aiddFrameCanPublish(frame),false);assert.equal(c.aiddSetFrameworkTrialReviewed(true),false);
 frame.caseId='DEMO_10001';frame.trial={generation:1,caseId:frame.caseId,draftFingerprint:c.aiddFrameDraftFingerprint(frame),report:{schemaVersion:2,analysisMode:'draft_framework_diagnosis',executed:true,status:'completed',cases:[{merchantId:'DEMO_10001',period:'week',frameworkId:frame.id}]}};c.aiddInvalidateFrameTrial('DEMO_10002');assert.equal(frame.trial,null);assert.equal(frame.reviewPassed,false);
});

test('旧覆盖报告不能用于人工验收，周期改变后当前诊断报告也必须重跑',async()=>{
 const c=await setup(),frame=draftFrame(c);frame.caseId='DEMO_10001';frame.reviewPassed=true;
 frame.trial={generation:frame.generation,caseId:frame.caseId,draftFingerprint:c.aiddFrameDraftFingerprint(frame),report:{executed:true,status:'completed',cases:[]}};
 assert.equal(c.aiddFrameTrialCurrent(frame),false);assert.match(c.aiddTrialReportHTML(frame.trial.report),/旧报告只检查/);
 frame.trial.report={schemaVersion:2,analysisMode:'draft_framework_diagnosis',executed:true,status:'completed',cases:[{merchantId:frame.caseId,period:'week',frameworkId:frame.id}]};
 assert.equal(c.aiddFrameTrialCurrent(frame),true);c.aiddInvalidateFrameTrial(frame.caseId,'day');assert.equal(frame.casePeriod,'day');assert.equal(frame.trial,null);assert.equal(frame.reviewPassed,false);assert.equal(c.aiddFrameCanConfirm(frame),false);
});
test('诊断报告围绕每个问题展示指标、方法、原因和行动按钮，数值明细折叠并转义模型文字',async()=>{
 const c=await setup();
 const problem={title:'成交回落<script>',finding:'支付金额环比下降',priority:1,evidence:[{metricId:'m',label:'成交环比',value:-20,unit:'%'}],method:'先看成交环比，再定位驱动因素。',cause:'需要结合视频来源核查。',causeStatus:'needs_verification',actions:[{name:'查看视频表现',recommendation:'按视频对比成交与播放，优先排查下降来源。',pcLink:'',mobileLink:''}],missing:[]};
 const html=c.aiddTrialReportHTML({executed:true,status:'completed',schemaVersion:2,analysisMode:'draft_framework_diagnosis',cases:[{label:'商家 · 短视频 · 近7天',merchantId:'DEMO_10001',periodLabel:'近7天',frameworkName:'当前框架',summary:'成交回落，先核查来源',problems:[problem],clear:[],unresolved:[],frameworkBranches:[],evidence:problem.evidence}],limitations:[]});
 assert.match(html,/商家诊断预览/);assert.match(html,/成交回落&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/-20%/);assert.match(html,/data-frame-trial-action="0\|0\|0"/);assert.match(html,/<details class="trial-data-details">/);
 const order=['问题 1','关联指标','判断方法','原因分析','行动建议'].map(t=>html.indexOf(t));assert.ok(order.every((value,index)=>value>=0&&(index===0||value>order[index-1])));
});
test('商家ID手动切换后可用周期同步更新，不借用其他商家的昨日数据',async()=>{
 const c=await setup();draftFrame(c);const day={disabled:false};c.elements.set('#frame-case-period',{querySelector:()=>day});
 c.aiddInvalidateFrameTrial('DEMO_10002');assert.equal(day.disabled,true);
 c.aiddInvalidateFrameTrial('DEMO_10001');assert.equal(day.disabled,false);
});
