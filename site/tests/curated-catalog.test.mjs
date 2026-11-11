import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {merchantFastResult} from '../worker/merchant-fast-path.js';
const merchantCatalog=JSON.parse(await readFile(new URL('../worker/demo-catalog.json',import.meta.url),'utf8'));
const read=name=>readFile(new URL('../web/'+name+'.js',import.meta.url),'utf8');
async function context({previous,failBackup=false}={}){
 const store=new Map(previous?[['workflow-lab-aidd-builder-v2',JSON.stringify(previous)]]:[]);
 const c=vm.createContext({localStorage:{getItem:k=>store.get(k)||null,setItem(k,v){if(failBackup&&k==='workflow-lab-aidd-catalog-backups-v1')throw new Error('quota');store.set(k,v);}},document:{addEventListener(){}},window:{addEventListener(){}}});
 const app=await read('app');vm.runInContext(app.slice(0,app.indexOf('const NODES =')),c);
 vm.runInContext('function persist(){};function toast(){};function render(){};function closeModal(){};function cancelModalBtn(){return "";};function pill(text){return text;};function navItem(label){return label;};function money(value){return value.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});}',c);
 for(const name of ['vendor/lz-string-1.5.0.min','catalog-storage','scene-routing','scene-business-specs','scene-deployment','live-revenue-config','merchant-data','merchant-ui','merchant-evidence','merchant-priority','merchant-report','goal-report','demo-coverage','strategy-scope','curated-catalog','curated-control','production-rules','aidd-data','production-usage','aidd-ui','framework-prompt','framework-ui','strategy-ui','ai-strategy-ui','coze-client','curated-merchant'])vm.runInContext(await read(name),c);
 vm.runInContext('initAidd()',c);return {c,store};
}
const evaluate=(c,code)=>JSON.parse(vm.runInContext(`JSON.stringify(${code})`,c));
test('校正旧浏览器的短视频曝光合成样本时保留已编辑框架和指标，原样本可追溯且只迁移一次',async()=>{
 const previous=JSON.parse((await read('curated-catalog')).split('const AIDD_CURATED_CATALOG = ')[1].trim().replace(/;$/,''));
 delete previous.demoData.videoExposureFixtureVersion;previous.demoData.metrics['research-metric-video-06'].week.value=204;
 previous.frameworks[0].ownerNote='用户编辑';previous.metrics[0].description='保留自定义口径';
 const {c}=await context({previous});
 const first=evaluate(c,`({value:aiddData.demoData.metrics['research-metric-video-06'].week.value,prior:aiddData.demoData.fixtureHistory[0].metrics['research-metric-video-06'].week.value,note:aiddData.frameworks[0].ownerNote,metric:aiddData.metrics[0].description})`);
 assert.deepEqual(first,{value:300000,prior:204,note:'用户编辑',metric:'保留自定义口径'});
 assert.equal(evaluate(c,'aiddPrepareCuratedCatalog(aiddData).demoData.fixtureHistory.length'),1);
});
test('商家回答实际展示数值分解、退款百分点、具体核查动作和覆盖范围，不再照搬固定说明',async()=>{
 const {c}=await context(),question='帮我分析近7天全店的经营表现';
 c.qualityResult=merchantFastResult({question,sellerId:'DEMO_10001',pageContext:{fieldKey:'overview',period:'week'}},merchantCatalog).result;
 const rendered=evaluate(c,`({brief:curatedBuildBrief(qualityResult,'${question}'),html:merchantBriefHTML(qualityResult,'${question}')})`);
 assert.match(rendered.brief.verdict,/最高的 3 项/);assert.match(rendered.brief.goalText,/6.*21/);assert.match(rendered.html,/28,948\.72/);assert.match(rendered.html,/3,948\.72/);assert.match(rendered.html,/1\.4个百分点/);assert.match(rendered.html,/先核对相同支付日/);assert.match(rendered.html,/不是因果证明/);assert.doesNotMatch(rendered.html,/数值为合成示例；具体原因未确认/);
 assert.doesNotMatch(rendered.html,/本次先处理优先级最高的|按目标关联度、异常幅度与证据完整度排序|已检查 6 个已发布P0方向/);
 const refund=rendered.brief.issues.find(i=>i.title==='支付日口径退款率上升');assert.equal(refund.metrics[0].tone,'down');assert.match(refund.actions[0].detail,/退款订单/);
 c.qualityResult={...c.qualityResult,explanationSource:undefined,diagnosis:[{...c.qualityResult.diagnosis[0],explanation:'需核对分商品成交贡献，才能判断经营原因。'}]};
 assert.match(evaluate(c,"merchantBriefHTML(qualityResult,'分析全店经营表现')"),/补充解释（待明细核实）：需核对分商品成交贡献/);
});
test('聊天只展示3项与编号内容，处理完一批再解锁后续，进度跨刷新保留且不混入其他会话',async()=>{
 const {c}=await context(),question='帮我分析近7天全店的经营表现';
 c.queueResult=merchantFastResult({question,sellerId:'DEMO_10001',pageContext:{fieldKey:'overview',period:'week'}},merchantCatalog).result;
 c.document.querySelector=selector=>selector.includes('.message-content')?c.queueRoot:selector==='#chat-messages'?{scrollTop:20}:selector==='#chat-input'?{value:''}:null;
 c.queueRoot={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};
 vm.runInContext(await read('chat-history'),c);
 vm.runInContext(`function chatRunning(){return false;}function scrollChatAnswer(){};state.chat={id:'queue-session',source:'智能助手',context:{fieldKey:'overview',period:'week'},createdAt:Date.now(),exchanges:[{id:'answer-queue',question:'${question}',context:{fieldKey:'overview',period:'week'},status:'complete',createdAt:Date.now(),text:'旧版18项文本',answer:{kind:'coze',result:queueResult}}]};`,c);
 let rendered=evaluate(c,"({html:chatAnswerHTML(state.chat.exchanges[0]),brief:buildMerchantBrief(queueResult,'全店经营表现')})");
 assert.equal((rendered.html.match(/class="merchant-issue(?: is-handled)?"/g)||[]).length,3);assert.match(rendered.html,/<ol class="merchant-issue-list" type="1">/);assert.match(rendered.html,/<ol class="merchant-issue-list" type="a">/);assert.match(rendered.html,/data-issue-progress="next"[^>]*disabled/);
 const first=rendered.brief.queue.active.map(x=>x.id),future=rendered.brief.ranked.slice(3).map(x=>x.finding.name);
 for(const name of future)assert.ok(!rendered.html.includes(name),name+' must stay deferred');
 c.firstBatchIds=first;
 vm.runInContext("chatIssueProgress('answer-queue','next');",c);assert.equal(evaluate(c,"state.chat.exchanges[0].answer.issueProgress?.batchIndex||0"),0);
 vm.runInContext("firstBatchIds.forEach(id=>chatIssueProgress('answer-queue','toggle',id));",c);
 assert.equal(evaluate(c,"buildMerchantBrief(queueResult,'全店经营表现',{progress:state.chat.exchanges[0].answer.issueProgress}).queue.canNext"),true);
 vm.runInContext("chatIssueProgress('answer-queue','next');",c);
 const saved=evaluate(c,"restoreChatHistory('queue-session')"),second=saved.exchanges[0].answer.issueProgress;
 assert.equal(second.batchIndex,1);assert.equal(second.handledIds.length,3);
 rendered=evaluate(c,"({html:chatAnswerHTML(state.chat.exchanges[0]),brief:buildMerchantBrief(queueResult,'全店经营表现',{progress:state.chat.exchanges[0].answer.issueProgress}),modelHistory:chatModelHistory(state.chat)})");
 assert.equal((rendered.html.match(/class="merchant-issue(?: is-handled)?"/g)||[]).length,3);assert.ok(rendered.brief.queue.active.every(x=>!first.includes(x.id)));assert.match(rendered.modelHistory[1].content,/问题1：/);assert.doesNotMatch(rendered.modelHistory[1].content,/问题4：|旧版18项文本/);
 const unseen=rendered.brief.ranked.slice(6).map(x=>x.finding.name);for(const name of unseen)assert.ok(!rendered.modelHistory[1].content.includes(name),name+' must not enter model history');
 assert.match(rendered.modelHistory[1].content,/商家已标记处理（待数据复核）：成交金额与订单量同时回落/);
 assert.equal(evaluate(c,"buildMerchantBrief(queueResult,'全店经营表现').queue.handledIds.length"),0);
});
test('整批替换只保留91场景、164指标、39行动点，91个框架与228条跨周期策略全部引用新资产',async()=>{
 const {c}=await context();const result=evaluate(c,`({counts:['scenes','metrics','actions','frameworks','strategies'].map(k=>aiddData[k].length),p0:aiddData.scenes.filter(s=>s.priority==='P0').length,invalid:aiddData.strategies.map(aiddValidateStrategy).filter(Boolean),old:[...aiddData.scenes,...aiddData.metrics,...aiddData.actions,...aiddData.frameworks,...aiddData.strategies].filter(x=>!x.id.startsWith('research-')).length,allActive:aiddData.frameworks.every(f=>f.status==='生效中')&&aiddData.strategies.every(s=>s.status==='生效中')})`);
 assert.deepEqual(result.counts,[91,164,39,91,228]);assert.equal(result.p0,10);assert.deepEqual(result.invalid,[]);assert.equal(result.old,0);assert.equal(result.allActive,true);
});
test('问候及资产来源等展示文字去除旧品牌，后台原始来源和指标仍保留',async()=>{
 const {c}=await context();const shown=evaluate(c,`({greeting:cozeEntryReply('你好'),source:esc(aiddData.metrics[0].description),original:aiddData.metrics[0].description})`);
 assert.match(shown.greeting,/智能助手/);assert.doesNotMatch(shown.greeting+shown.source,/生意通/);assert.match(shown.original,/生意通/);
});
test('本地与线上按同一最细场景执行，要素缺素材或单位未核验时不生成原因',async()=>{
 const {c}=await context();const result=evaluate(c,`(()=>{const ctx={fieldKey:'live',period:'week'},p=aiddRequestConfig(ctx);return {conversion:curatedDemoResult('分析直播转化',ctx,p),title:curatedDemoResult('分析直播曝光标题',ctx,p),retention:curatedDemoResult('分析直播留人',ctx,p),defaultFrames:aiddRuntimeConfig('live','week').frameworkCandidates.length};})()`);
 assert.equal(result.defaultFrames,1);assert.ok(result.conversion.metricAnalysis.some(m=>m.metricId==='research-metric-live-12'));
 assert.equal(result.title.status,'missing_data');assert.equal(result.title.diagnosis.length,0);assert.match(result.title.missing.join('；'),/标题原文/);
 assert.equal(result.retention.status,'missing_data');assert.match(result.retention.missing.join('；'),/单位尚未核验/);assert.equal(result.retention.metricAnalysis.find(m=>m.metricId==='research-metric-live-13').value,null);
});
test('诊断请求只传本次匹配的快照，91场景不会把请求膨胀到接口上限',async()=>{
 const {c}=await context();c.fetch=async(url,options)=>{c.lastRequest=JSON.parse(options.body);return {ok:true,headers:{get:()=>''},json:async()=>({schemaVersion:1,answer:'ok'})};};
 for(const question of ['帮我分析近7天全店的经营表现','帮我分析近7天直播转化','分析近7天直播曝光标题']){
  await vm.runInContext(`cozeRequest({question:${JSON.stringify(question)},sellerId:'DEMO_10001',pageContext:{fieldKey:'overview',period:'week'}})`,c);
  const request=c.lastRequest;assert.ok(Buffer.byteLength(JSON.stringify(request))<800000,question);
  const frames=request.runtimeConfigurations['live:week'].frameworkCandidates;if(question.includes('直播转化'))assert.deepEqual(frames.map(f=>f.sceneId),['research-scene-016']);if(question.includes('标题'))assert.deepEqual(frames.map(f=>f.sceneId),['research-scene-038']);
 }
});
test('真实成交金额入口展示诊断原因与行动，前后端不会误当成交环节或只返回变化值',async()=>{
 const {c}=await context(),question='帮我分析近7天直播的成交金额变化的原因和改善建议';
 c.fetch=async(url,options)=>{c.lastRequest=JSON.parse(options.body);return {ok:true,headers:{get:()=>''},json:async()=>({answer:'ok'})};};
 await vm.runInContext(`cozeRequest({question:${JSON.stringify(question)},sellerId:'DEMO_10001',pageContext:{fieldKey:'live',period:'week'}})`,c);
 assert.deepEqual(c.lastRequest.runtimeConfigurations['live:week'].frameworkCandidates.map(f=>f.sceneId),['research-scene-007']);
 c.focusedResult=merchantFastResult(c.lastRequest,merchantCatalog).result;
 const rendered=evaluate(c,`({brief:curatedBuildBrief(focusedResult,${JSON.stringify(question)}),html:merchantBriefHTML(focusedResult,${JSON.stringify(question)})})`);
 assert.match(rendered.html,/80,000/);assert.match(rendered.html,/100,000/);assert.match(rendered.html,/下降 20\.0%/);assert.match(rendered.html,/观看规模收缩/);assert.match(rendered.html,/25,833\.33/);assert.match(rendered.html,/创建直播计划/);assert.doesNotMatch(rendered.html,/未命中该指标|缺少本次场景可用|NaN/);
 c.focusedResult.diagnosis=c.focusedResult.diagnosis.map(d=>{const copy={...d,evidence:d.evidence.filter(m=>m.metricId==='research-metric-live-02')};delete copy.diagnosticKind;return copy;});
 c.focusedResult.metricAnalysis=c.focusedResult.evidence;assert.match(evaluate(c,`merchantBriefHTML(focusedResult,${JSON.stringify(question)})`),/观看规模收缩/);
 c.focusedResult.metricAnalysis=[];c.focusedResult.evidence=c.focusedResult.evidence.filter(m=>m.metricId==='research-metric-live-02');const missing=evaluate(c,`merchantBriefHTML(focusedResult,${JSON.stringify(question)})`);assert.match(missing,/补齐/);assert.doesNotMatch(missing,/25,833\.33|观看规模收缩/);
});
test('替换前备份包含旧资产和发布配置，刷新不重复替换，恢复前再次备份当前数据',async()=>{
 const {c:seed}=await context();const previous=evaluate(seed,'seedAidd()');previous.scenes[0].name='用户原有自定义场景';
 const {c,store}=await context({previous});
 assert.equal(evaluate(c,'aiddCatalogBackups()[0].data.scenes[0].name'),'用户原有自定义场景');
 assert.deepEqual(evaluate(c,'aiddCatalogBackups()[0].data.published'),previous.published);
 vm.runInContext('aiddData=undefined;initAidd()',c);assert.equal(evaluate(c,'aiddCatalogBackups().length'),1);
 vm.runInContext('aiddUI.catalogBackupId=aiddCatalogBackups()[0].id;aiddRestoreCatalogBackup()',c);
 assert.equal(evaluate(c,'aiddData.scenes[0].name'),'用户原有自定义场景');assert.equal(evaluate(c,'aiddCatalogBackups().length'),2);
 assert.equal(c.aiddStorageDecode(store.get('workflow-lab-aidd-builder-v2')).restoredFromBackup.length>0,true);
});
test('既有v73配置先备份再修订直播框架与策略，刷新不重复修订且保留其他修改',async()=>{
 const {c:seed}=await context(),previous=evaluate(seed,'aiddData');
 const frame=previous.frameworks.find(f=>f.id==='research-framework-07'),strategy=previous.strategies.find(s=>s.id==='research-strategy-07-4');
 const oldFrame=frame.history.find(f=>f.version===1),oldStrategy=strategy.history.find(s=>s.name==='成交与千次观看产出同时回落');
 previous.frameworks=previous.frameworks.map(f=>f.id===frame.id?oldFrame:f);previous.strategies=previous.strategies.map(s=>s.id===strategy.id?oldStrategy:s);
 for(const snapshot of Object.values(previous.published['research-scene-007'].periods)){snapshot.framework=oldFrame.prompt;snapshot.frameworkVersion=1;snapshot.frameworkDefinition.text=oldFrame.prompt;snapshot.frameworkDefinition.version=1;snapshot.strategies=snapshot.strategies.map(s=>s.id===strategy.id?oldStrategy:{...s,frameworkVersion:1});}
 delete previous.liveRevenueDiagnosisVersion;previous.actions[0].ownerNote='保留商家原有修改';
 const {c}=await context({previous});assert.equal(evaluate(c,"aiddData.strategies.find(s=>s.id==='research-strategy-07-4').version"),2);assert.equal(evaluate(c,'aiddData.actions[0].ownerNote'),'保留商家原有修改');
 assert.equal(evaluate(c,"aiddCatalogBackups()[0].data.strategies.find(s=>s.id==='research-strategy-07-4').name"),'成交与千次观看产出同时回落');
 vm.runInContext('aiddData=undefined;initAidd()',c);assert.equal(evaluate(c,'aiddCatalogBackups().length'),1);
 const {c:blocked}=await context({previous,failBackup:true});assert.equal(evaluate(blocked,"aiddData.strategies.find(s=>s.id==='research-strategy-07-4').version"),1);
});
test('备份不能持久化时保留旧资产，不执行破坏性替换',async()=>{
 const {c:seed}=await context();const previous=evaluate(seed,'seedAidd()');
 const {c}=await context({previous,failBackup:true});assert.equal(evaluate(c,'aiddData.scenes[0].id'),previous.scenes[0].id);
});
test('旧双周期策略原地备份合并为228条，刷新不重复迁移，已发布规则不丢失',async()=>{
 // Construct an earlier period-scoped catalog from the current approved set.
 const {c:base}=await context();const previous=evaluate(base,'aiddData');delete previous.strategyScopeVersion;
 const periodize=(s,period)=>{const id=s.id.replace(/^(research-strategy-\d+)-(\d+)$/,'$1-'+period+'-$2');return {...s,id,period,groupId:s.groupId+'-'+period,group:s.group+(period==='week'?'（近7天）':'（昨日）'),name:s.name+(period==='week'?'（近7天）':'（昨日）'),protocol:{...s.protocol,strategyCode:id,groupId:s.groupId+'-'+period,period}};};
 previous.groups=previous.groups.flatMap(g=>['week','day'].map(period=>({...g,id:g.id+'-'+period,period,name:g.name+(period==='week'?'（近7天）':'（昨日）')})));
 previous.strategies=previous.strategies.flatMap(s=>['week','day'].map(period=>periodize(s,period)));
 for(const p of Object.values(previous.published))for(const [period,config] of Object.entries(p.periods))config.strategies=config.strategies.map(s=>periodize(s,period));
 const {c}=await context({previous});const merged=evaluate(c,'aiddData');assert.equal(merged.strategies.length,228);assert.equal(merged.strategyScopeVersion,1);assert.ok(merged.strategies.every(s=>!Object.hasOwn(s,'period')&&!Object.hasOwn(s.protocol||{},'period')));assert.equal(evaluate(c,'aiddCatalogBackups()[0].data.strategies.length'),456);
 vm.runInContext('aiddData=undefined;initAidd()',c);assert.equal(evaluate(c,'aiddCatalogBackups().length'),1);
 for(const p of Object.values(merged.published))assert.deepEqual(p.periods.week.strategies,p.periods.day.strategies);
});
test('新建与编辑策略不提供周期字段，一次发布同步两个取数周期且不重复执行',async()=>{
 const {c}=await context();const result=evaluate(c,`(()=>{const scene=aiddData.scenes.find(s=>s.fieldKey==='live'&&s.priority==='P0');aiddUI.sceneId=scene.id;const s=aiddSceneStrategies(scene.id)[0];aiddPublishScene(scene.id,s.id);const week=aiddRuntimeConfig('live','week'),day=aiddRuntimeConfig('live','day');let html='';modal=(a,b,body)=>html=body;aiddEditStrategy(s.id);const edit=html;aiddEditGroup(s.groupId);return {week,day,edit,group:html,protocol:aiddProtocol(s)};})()`);
 assert.deepEqual(result.week.strategies,result.day.strategies);assert.equal(new Set(result.week.strategies.map(s=>s.id)).size,result.week.strategies.length);assert.ok(result.week.catalogRevision);assert.equal(result.week.period,'week');assert.equal(result.day.period,'day');assert.doesNotMatch(result.edit+result.group,/周期标签|name="period"/);assert.equal(Object.hasOwn(result.protocol,'period'),false);
});
test('所有新策略分别验证命中、不命中与缺失值三条路径',async()=>{
 const {c}=await context();
 const result=evaluate(c,`(()=>{
  const fixture=(r,hit)=>{const leaves=[];const walk=n=>n.children?n.children.forEach(walk):leaves.push(n);walk(r);return {metricValues:leaves.map(n=>({id:n.metricId,previousValue:100,value:hit?({'<':80,'>':120,'>=':100,'<=':100,'!=':120,'==':100}[n.op]):({'<':120,'>':80,'>=':80,'<=':120,'!=':100,'==':80}[n.op])}))};};
  return aiddData.strategies.map(s=>({id:s.id,yes:aiddEvaluateRule(s.rule,aiddData.metrics,'week',fixture(s.rule,true)),no:aiddEvaluateRule(s.rule,aiddData.metrics,'week',fixture(s.rule,false)),missing:aiddEvaluateRule(s.rule,aiddData.metrics,'week',{metricValues:[]})}));
 })()`);
 for(const r of result){assert.equal(r.yes,true,r.id);assert.equal(r.no,false,r.id);assert.equal(r.missing,null,r.id);}
});
test('五个场域及双周期商家页从发布配置加载指标、策略及实际工具名',async()=>{
 const {c}=await context();
 const result=evaluate(c,`(()=>Object.keys(MERCHANT_FIELDS).flatMap(fieldKey=>['week','day'].map(period=>{
  state.fieldKey=fieldKey;state.period=period;state.metricKey='gmv';state.merchantScreen='home';
  const runtime=aiddRuntimeConfig(fieldKey,period),html=curatedMerchantView(),ids=curatedCoreMetricIds(fieldKey),snapshot=merchantLocalSnapshot('',{fieldKey,period});
  return {fieldKey,period,core:ids.length,refs:ids.every(id=>runtime.metrics.some(m=>m.id===id)),active:runtime.active,frames:runtime.frameworkCandidates.length,metrics:snapshot.data.metrics.length,values:snapshot.data.metrics.every(m=>Number.isFinite(m.value)),synthetic:snapshot.data.synthetic,stale:/有成交达人数|合作达人成交率|支付金额|视频播放量/.test(html),tools:curatedDiagnosticRows(fieldKey,period,runtime).flatMap(r=>(r.actions||[]).map(a=>a.name)).every(n=>aiddData.actions.some(a=>a.name===n))};
 })))()`);
 for(const r of result){assert.equal(r.core,3);assert.equal(r.refs,true);assert.equal(r.active,true);assert.equal(r.frames,r.fieldKey==='overview'?6:1);assert.equal(r.values,true);assert.equal(r.synthetic,true);assert.equal(r.stale,false,r.fieldKey);assert.equal(r.tools,true);}
});
test('新指标缺样例时不回填旧值；下线框架后商家诊断同步失效',async()=>{
 const {c}=await context();
 const result=evaluate(c,`(()=>{const m=aiddData.metrics.find(m=>m.sourceKey==='live');delete aiddData.demoData.metrics[m.id];const missing=aiddMetricValue(m,'week');const f=aiddData.frameworks.find(f=>aiddData.scenes.find(s=>s.id===f.sceneId).fieldKey==='live');aiddOfflineFramework(f.id);const runtime=aiddRuntimeConfig('live','week');return {missing,active:runtime.active,findings:curatedDiagnosticRows('live','week',runtime).filter(x=>x.warning).length};})()`);
 assert.equal(result.missing,null);assert.equal(result.active,false);assert.equal(result.findings,0);
});
test('全店一个P0框架下线只移除其策略，其他P0框架及完整策略组继续连通',async()=>{
 const {c}=await context();const result=evaluate(c,`(()=>{const f=aiddData.frameworks[0];aiddOfflineFramework(f.id);const x=aiddRuntimeConfig('overview','week');return {active:x.active,frames:x.frameworkCandidates.filter(f=>f.active).length,removed:x.strategies.every(s=>s.frameworkId!==f.id),groups:x.strategies.every(s=>x.groups.some(g=>g.id===s.groupId))};})()`);
 assert.deepEqual(result,{active:true,frames:5,removed:true,groups:true});
});
test('合成数据的比例不超100%、体验分不超5、计数无小数，聊天记录保留新指标及工具依据',async()=>{
 const {c}=await context();const result=evaluate(c,`(()=>{
 const valid=aiddData.metrics.every(m=>['week','day'].every(p=>{const d=curatedMetricData(m.id,p),values=[d.value,d.previousValue,...d.current,...d.previous];return values.every(v=>Number.isFinite(v)&&v>=0&&(m.unit!=='%'||v<=100)&&(m.unit!=='分'||v<=5)&&(!['人','次','场','单','个','件','条'].includes(m.unit)||Number.isInteger(v)));}));
 const q='分析近7天直播观看人数',context={fieldKey:'live',period:'week'},r=curatedDemoResult(q,context,aiddRequestConfig(context)),text=curatedBuildBrief(r,q).text;return {valid,text};})()`);
 assert.equal(result.valid,true);assert.match(result.text,/观看人数/);assert.match(result.text,/直播投流|创建直播计划/);assert.doesNotMatch(result.text,/配置或指标不完整/);
});
test('线上结果的旧路由别名按新指标名聚焦，缺少新指标证据不能显示为未命中',async()=>{
 const {c}=await context();
 const result=evaluate(c,`(()=>{const context={fieldKey:'live',period:'week'},r=curatedDemoResult('分析直播观看人数',context,aiddRequestConfig(context));r.context={...context,metricKey:'exposure'};const brief=curatedBuildBrief(r,'分析直播观看人数');const empty={...r,status:'not_applicable',metricAnalysis:[],evidence:[],diagnosis:[]};return {brief:brief.text,html:curatedResultHTML(empty,''),verdict:curatedBuildBrief(empty,'').verdict};})()`);
 assert.match(result.brief,/观看人数/);assert.doesNotMatch(result.brief,/开播场次减少/);assert.match(result.html,/暂无法判断/);assert.doesNotMatch(result.verdict,/未命中/);
});
test('指标、行动点和框架列表的场域筛选可与文字、状态和分页组合，覆盖全店及四场域',async()=>{
 const {c}=await context();
 const rows=evaluate(c,`(()=>Object.keys(MERCHANT_FIELDS).map(field=>{aiddUI.fieldFilter=field;aiddUI.assetTab='metrics';aiddUI.query='';aiddUI.status='all';aiddUI.page=1;const metrics=aiddMetricsPanel(),actions=aiddActionsPanel(),frameworks=aiddFrameList();const expected={metrics:aiddData.metrics.filter(m=>m.fieldKey===field).length,actions:aiddData.actions.filter(a=>a.fieldKey===field).length,frameworks:aiddData.frameworks.filter(f=>aiddFrameScene(f).fieldKey===field).length};aiddUI.query='没有这个条目';const empty=[aiddMetricsPanel(),aiddActionsPanel(),aiddFrameList()];aiddUI.query='';aiddUI.status='已失效';const inactive=aiddFrameList();return {field,metrics,actions,frameworks,expected,empty,inactive};}))()`);
 for(const row of rows){for(const type of ['metrics','actions','frameworks']){assert.match(row[type],/<th>场域<\/th>/);assert.match(row[type],/aria-label="经营场域"/);assert.match(row[type],new RegExp('共 '+row.expected[type]+' 条'));assert.match(row[type],/value="overview"[^>]*>全店<\/option>/);}assert.doesNotMatch(row.actions,/跳转方式|链接待配置/);assert.ok(row.empty.every(html=>html.includes('共 0 条')));assert.match(row.inactive,/共 0 条/);}
});
test('原商家模板保留指标数值及目标与问题分区，移除指标重复诊断',async()=>{
 const {c}=await context();const result=evaluate(c,`(()=>{const before=JSON.stringify(aiddData);const views=Object.keys(MERCHANT_FIELDS).flatMap(fieldKey=>['week','day'].map(period=>{state.fieldKey=fieldKey;state.period=period;state.metricKey='gmv';state.merchantScreen='home';const html=merchantView(),metric=fieldMetrics()[state.metricKey];return {html,value:metric[period].value,source:curatedMetricData(state.metricKey,period).value,core:merchantCoreMetricKeys().length};}));return {views,unchanged:before===JSON.stringify(aiddData),backend:backendView()};})()`);
 assert.equal(result.unchanged,true);
 for(const view of result.views){assert.equal(view.value,view.source);assert.equal(view.core,3);for(const mark of ['class="diagnosis-body"','class="goal-panel"','class="diagnosis-findings"','class="chart"','山野生活旗舰店','跃迁期 · 多场域经营'])assert.ok(view.html.includes(mark),mark);assert.doesNotMatch(view.html,/metric-bound-diagnosis|data-insight-question|curated-data-notice|curated-diagnosis-body|data-curated-insight|经营演示店|NaN|undefined/);assert.match(view.html,/分场域目标达成/);}
 assert.doesNotMatch(result.backend,/资产入库批次|生意通资料重整稿/);assert.match(result.backend,/诊断配置后台/);
});
test('目标卡片、目标报告和聊天记录共同使用原演示目标及当前成交，覆盖五场域双周期且不改原数据',async()=>{
 const {c}=await context();const result=evaluate(c,`(()=>{const before=JSON.stringify(aiddData);const views=Object.keys(MERCHANT_FIELDS).flatMap(fieldKey=>['week','day'].map(period=>{state.fieldKey=fieldKey;state.period=period;const context={fieldKey,period},q=merchantQuestion(fieldKey,period,'目标差距'),r=curatedDemoResult(q,context,aiddRequestConfig(context)),raw=JSON.stringify(r),brief=buildMerchantGoalBrief(r,q),history=buildMerchantBrief(r,q),id=curatedGoalMetricId(fieldKey,period,'gmv');return {fieldKey,period,actual:brief.actual,expectedActual:curatedMetricData(id,period).value,target:brief.target,expectedTarget:MERCHANT_FIELDS[fieldKey].goal[period],rate:brief.rate,gap:brief.gap,valid:brief.valid,plans:brief.plans.length,history:history.text,card:curatedGoalDiagnosis(),html:merchantBriefHTML(r,q),responseUnchanged:raw===JSON.stringify(r),links:brief.plans.flatMap(p=>p.actions.filter(a=>a.kind==='data').map(a=>a.href))};}));return {views,unchanged:before===JSON.stringify(aiddData)};})()`);
 assert.equal(result.unchanged,true);
 for(const row of result.views){assert.equal(row.actual,row.expectedActual);assert.equal(row.target,row.expectedTarget);assert.equal(row.rate,100*row.actual/row.target);assert.equal(row.gap,Math.max(0,row.target-row.actual));assert.equal(row.valid,true);assert.ok(row.plans>0);assert.equal(row.responseUnchanged,true);assert.ok(row.card.includes(row.rate.toFixed(1)));assert.match(row.card,/分场域目标达成/);assert.doesNotMatch(row.card,/待补充|尚未配置/);assert.match(row.html,/演示目标金额/);assert.doesNotMatch(row.history,/目标资料不足|未录入同周期/);assert.ok(row.links.every(href=>href.includes('research-metric-')));}
});
test('目标诊断保护缺失与真实数据，不覆盖已有目标；补差使用新指标名称和正确单位',async()=>{
 const {c}=await context();const result=evaluate(c,`(()=>{const context={fieldKey:'live',period:'week'},q='分析近7天直播目标差距',r=curatedDemoResult(q,context,aiddRequestConfig(context)),id=curatedGoalMetricId('live','week','gmv'),missing=clone(r);missing.metricAnalysis=missing.metricAnalysis.filter(m=>m.id!==id);missing.evidence=missing.evidence.filter(m=>m.id!==id);const real=clone(r);real.dataMode='real';const configured=clone(r);configured.goal={actual:80000,target:100000};const deficit=buildMerchantGoalBrief(configured,q),zero=clone(r);for(const m of [...zero.metricAnalysis,...zero.evidence])if(m.id===id)m.value=0;const zeroBrief=buildMerchantGoalBrief(zero,q);return {missing:buildMerchantGoalBrief(missing,q).valid,real:buildMerchantGoalBrief(real,q).valid,configured:configured.goal,deficit,zero:zeroBrief};})()`);
 assert.equal(result.missing,false);assert.equal(result.real,false);assert.deepEqual(result.configured,{actual:80000,target:100000});assert.equal(result.deficit.gap,20000);assert.match(result.deficit.plans[0].detail,/观看-成交率\(人数\).*5%提高到约6.25%/);assert.doesNotMatch(result.deficit.text,/商品点击率|有成交达人数/);assert.equal(result.zero.actual,0);assert.equal(result.zero.uplift,null);assert.match(result.zero.text,/先恢复/);assert.doesNotMatch(result.zero.text,/NaN|Infinity/);
});


test('全部91场景的后台策略生产按明确场景直读已发布框架，完全不经过商家路由',async()=>{
 const {c}=await context();c.aiddRuntimeConfig=()=>{throw Error('后台生产不得调用商家场景路由');};
 const result=evaluate(c,`aiddData.scenes.map(scene=>{const source=cozeProductionInput({sceneIds:[scene.id],metricIds:scene.metricIds,actionIds:scene.actionIds}).sourceFramework;return {sceneId:scene.id,sourceScene:source.sceneId,id:source.id,active:source.active};})`);
 assert.equal(result.length,91);for(const item of result){assert.equal(item.sourceScene,item.sceneId,item.sceneId);assert.ok(item.id);assert.equal(item.active,true);}
 const scene=evaluate(c,`aiddData.scenes.find(s=>s.name==='短视频-曝光')`);assert.ok(scene);
 vm.runInContext(`aiddData.scenes.find(s=>s.id===${JSON.stringify(scene.id)}).status='已下线'`,c);
 assert.deepEqual(evaluate(c,`aiddProductionFramework(aiddData.scenes.find(s=>s.id===${JSON.stringify(scene.id)}))`),{});
});
