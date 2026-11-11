import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../web/chat-stream.js',import.meta.url),'utf8');
const clientSource=await readFile(new URL('../web/coze-client.js',import.meta.url),'utf8');
const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const runtime=()=>{const c=vm.createContext({esc:escape,icon:()=>''});vm.runInContext(source,c);return c;};
test('旧聊天依据实际分支修正路由误标，保留原步骤数量、用量和耗时',()=>{
 const c=runtime();
 for(const branch of ['data','knowledge']){
  const original={recordVersion:2,branch,durationMs:9100,executionStages:[{id:'intent',name:'意图识别与分析范围确认',status:'complete',source:'published_workflow_path',deepseekTokens:100},{id:'routing',name:'经营分析场景路由',status:'complete',source:'published_workflow_path',deepseekTokens:0}]};
  const record=c.chatEvidenceRecord(null,original);assert.equal(record.executionStages.length,2);assert.equal(record.durationMs,9100);assert.equal(record.executionStages[0].deepseekTokens,100);assert.equal(record.executionStages[0].name,branch==='data'?'意图识别与查询范围确认':'意图识别');assert.equal(record.executionStages[1].name,branch==='data'?'任务分流：智能取数':'任务分流：知识问答');assert.equal(original.executionStages[1].name,'经营分析场景路由');
 }
});
test('等待阶段只显示请求状态，未经返回确认不展示推测的统计口径',()=>{
 const c=runtime();c.merchantScopeHTML=()=>'<p>返回范围</p>';
 const v=c.chatStreamState({fieldKey:'live',period:'week'},'分析近30天直播');
 assert.match(c.chatStreamHTML(v),/正在准备请求/);assert.doesNotMatch(c.chatStreamHTML(v),/返回范围|已完成|已确定/);
 c.chatStreamUpdate(v,'update',{kind:'context',branch:'clarification',context:{}});
 assert.doesNotMatch(c.chatStreamHTML(v),/返回范围/);
 c.chatStreamUpdate(v,'update',{kind:'context',branch:'data',context:{fieldKey:'video',period:'day'}});
 assert.match(c.chatStreamHTML(v),/返回范围/);
});
test('真实增量文本累积，数据到达不伪装为按步骤完成的分析过程',()=>{
 const c=runtime(),v=c.chatStreamState();assert.equal(v.metrics.length,0);
 c.chatStreamUpdate(v,'progress',{stage:'已深度思考',elapsedMs:2400});
 c.chatStreamUpdate(v,'update',{kind:'evidence',metrics:[{label:'支付金额',value:48560,unit:'元'}]});
 c.chatStreamUpdate(v,'update',{kind:'findings',findings:[{name:'点击环节需核查'}]});
 c.chatStreamUpdate(v,'delta',{text:'点击率下降，'});c.chatStreamUpdate(v,'delta',{text:'先查看商品展示。'});
 assert.equal(v.text,'点击率下降，先查看商品展示。');
 const html=c.chatStreamHTML(v);assert.match(html,/正在接收回复内容/);assert.match(html,/已收到诊断所需的部分指标/);assert.doesNotMatch(html,/48,560/);assert.match(html,/完整诊断尚未返回/);
 assert.doesNotMatch(html,/已深度思考|2\.4秒|点击环节需核查/);
 const snapshot=c.chatAnalysisSnapshot(v);assert.equal(snapshot.timeline,undefined);assert.equal(snapshot.steps,undefined);
});
test('返回的指标与文本按纯文本处理，不根据空结果编造核对进展',()=>{
 const c=runtime(),v=c.chatStreamState();c.chatStreamUpdate(v,'update',{kind:'findings',findings:[]});
 assert.doesNotMatch(c.chatStreamHTML(v),/已完成|已定位|已核对/);
 c.chatStreamComplete(v,{evidence:[{label:'<script>bad</script>',value:1,unit:'<img>'}],diagnosis:[]});
 const html=c.chatStreamStepsHTML(v,true);assert.doesNotMatch(html,/<script>|<img>/);assert.doesNotMatch(html,/&lt;script&gt;|&lt;img&gt;/);assert.match(html,/本次返回的指标：1 项/);
 assert.match(c.chatStreamTextHTML('### 问题1\n<script>x</script>'),/<h4>问题1<\/h4><p>&lt;script&gt;/);
});
test('浏览器在最终结果到达之前收到真实delta，兼容拆分UTF8与CRLF，错误不提交半成品',async()=>{
 let upstream;const events=[],encoder=new TextEncoder();
 const context=vm.createContext({TextDecoder,localStorage:{getItem:()=>null},document:{addEventListener(){}},fetch:async()=>new Response(new ReadableStream({start(c){upstream=c;}}),{headers:{'content-type':'text/event-stream'}})});
 vm.runInContext(clientSource,context);
 let finished=false;const request=context.cozeRequest({question:'测试'},{onUpdate:(e,d)=>events.push([e,d])}).finally(()=>finished=true);
 await new Promise(r=>setImmediate(r));
 const frame=encoder.encode('event: delta\r\ndata: {"text":"订单减少"}\r\n\r\n');
 for(let i=0;i<frame.length;i+=7)upstream.enqueue(frame.slice(i,i+7));
 await new Promise(r=>setImmediate(r));assert.equal(finished,false);assert.equal(events[0][1].text,'订单减少');
 upstream.enqueue(encoder.encode('event: result\ndata: {"schemaVersion":1,"answer":"最终答案"}\n\n'));upstream.close();assert.equal((await request).answer,'最终答案');
});

test('完成记录只保留实际总耗时、返回指标与目标计算，不保留伪造步骤或内部推理',()=>{
 const c=runtime(),v=c.chatStreamState({fieldKey:'overview',period:'week'},'分析目标差距');v.startedAt-=1250;
 c.isGoalQuestion=()=>true;c.buildMerchantGoalBrief=()=>({valid:true,actual:190000,target:143000,gap:0,rate:190000/143000*100});
 for(let i=0;i<8;i++)c.chatStreamUpdate(v,'progress',{stage:'伪装执行阶段'+i,reasoning_content:'PRIVATE_REASONING',elapsedMs:2400});
 const metrics=Array.from({length:24},(_,i)=>({metricId:'metric-'+i,label:'指标'+i,value:i,previousValue:i+1,unit:'元'}));
 c.chatStreamComplete(v,{status:'success',dataMode:'demo',branch:'diagnosis',context:{fieldKey:'overview',period:'week'},metricAnalysis:metrics,evidence:metrics,diagnosis:[],missing:['缺少明细'],performance:{route:'goal_calculation',serverMs:4},execution:{frameworkName:'交易框架',frameworkVersion:1,selectedStrategyIds:['s1'],diagnosisPlan:{steps:[{branchName:'未经执行证明的计划',objective:'核对成交'}]}},reasoning_content:'PRIVATE_REASONING'});
 const snapshot=c.chatAnalysisSnapshot(v),html=c.chatStreamStepsHTML(snapshot,true);
 assert.equal(snapshot.metrics.length,24);assert.equal(snapshot.timeline,undefined);assert.equal(snapshot.steps,undefined);assert.equal(snapshot.plans,undefined);assert.ok(snapshot.durationMs>=1250);
 assert.match(html,/查看本次执行过程/);assert.match(html,/总耗时/);assert.match(html,/1\.\d秒/);assert.match(html,/包含请求准备、网络等待和结果接收/);assert.match(html,/处理用时：4毫秒/);
 assert.match(html,/本次返回的指标：24 项/);assert.doesNotMatch(html,/<th>指标<\/th>|132\.9%|190,000|143,000/);assert.match(html,/交易框架 v1/);assert.match(html,/预设配置或表达模板/);assert.match(html,/本次未调用大模型/);assert.match(html,/合成演示数据/);
 assert.doesNotMatch(html,/ open|PRIVATE_REASONING|伪装执行阶段|未经执行证明的计划|2\.4秒|已完成核对/);
});
test('失败记录保留已收到的信息，但不把未知处理方式显示成模型调用成功',()=>{
 const c=runtime(),v=c.chatStreamState();c.chatStreamUpdate(v,'progress',{stage:'宣称已执行所有检查'});
 c.chatStreamUpdate(v,'update',{kind:'evidence',metrics:[{label:'点击人数',value:100}],errors:['来源缺失']});c.chatStreamComplete(v,null,{failed:true});
 const snapshot=c.chatAnalysisSnapshot(v),html=c.chatStreamStepsHTML(snapshot,true);
 assert.equal(snapshot.failed,true);assert.match(html,/查看未完成请求记录/);assert.match(html,/仅保留已收到的信息/);assert.match(html,/未记录处理方式/);assert.match(html,/未提供可核验的模型调用记录/);assert.match(html,/来源缺失/);
 assert.doesNotMatch(html,/宣称已执行|已完成|本次未调用大模型/);
});
test('返回指标数量、框架与检查数量来自明确字段，不推算已完成方向或策略命中数',()=>{
 const c=runtime(),v=c.chatStreamState(),metrics=[{metricId:'rate',label:'商品点击成交率',value:20,previousValue:25,unit:'%'},{metricId:'clicks',label:'商品点击人数',value:4000,previousValue:4000,unit:'人'}];
 c.chatStreamComplete(v,{status:'success',branch:'diagnosis',evidence:metrics,metricAnalysis:metrics,diagnosis:[{name:'待核查'}],coverage:{frameworks:[{name:'直播-成交诊断框架'}],evaluatedStrategyCount:3}});
 const html=c.chatStreamStepsHTML(v,true);assert.match(html,/本次返回的指标：2 项/);assert.match(html,/直播-成交诊断框架/);assert.match(html,/规则检查 3 条/);assert.match(html,/返回诊断问题 1 项/);
 assert.doesNotMatch(html,/P0方向|已读取|已核对|策略命中|选用策略/);
});
test('仅展示返回中明确提供的公式，不根据诊断类型拼造已执行计算',()=>{
 const c=runtime(),v=c.chatStreamState();c.chatStreamComplete(v,{branch:'diagnosis',evidence:[],diagnosis:[{analysis:{calculations:[{kind:'live_revenue',formula:'-25,833.33 + 5,833.33 = -20,000'},{kind:'revenue'}]}}]});
 const html=c.chatStreamStepsHTML(v,true);assert.equal(v.formulas[0],'-25,833.33 + 5,833.33 = -20,000');assert.doesNotMatch(html,/-25,833\.33/);assert.doesNotMatch(html,/已计算|对称分解|订单量、每单金额/);
});
test('规则路线与工作流响应准确区分，工作流返回不证明内部调用模型',()=>{
 const c=runtime();
 for(const route of ['published_rules','goal_calculation','published_data','scope_validation','browser_demo','fixed_reply']){
  const r=c.chatEvidenceRecord({performance:{route,modelInvoked:true}});assert.equal(r.modelInvoked,false);assert.equal(r.workflowInvoked,false);
  assert.match(c.chatStreamStepsHTML(r,true),/本次未调用大模型/);
 }
 const r=c.chatEvidenceRecord({performance:{route:'coze_workflow',modelInvoked:true,serverMs:0}}),html=c.chatStreamStepsHTML(r,true);
 assert.equal(r.workflowInvoked,true);assert.equal(r.modelInvoked,null);assert.match(html,/本轮没有可核验的模型节点返回记录/);assert.match(html,/未提供可核验的模型调用记录/);assert.match(html,/计时精度限制/);
 assert.doesNotMatch(html,/本次未调用大模型|本次有模型调用记录/);
 const unknown=c.chatEvidenceRecord({performance:{route:'unrecognized'}});assert.equal(unknown.mode,'');assert.equal(unknown.modelInvoked,null);assert.equal(unknown.workflowInvoked,null);
 const local=c.chatStreamStepsHTML(c.chatEvidenceRecord(null,{recordVersion:2,mode:'browser_demo',durationMs:12}),true);
 assert.match(local,/本地处理耗时/);assert.match(local,/0\.01秒/);assert.match(local,/没有网络或模型调用/);assert.doesNotMatch(local,/请求总耗时|包含请求准备、网络等待/);
});
test('旧版重复时间与模拟延时不会重新显示，缺失来源和框架不被补成事实',()=>{
 const c=runtime(),legacy={engine:'本地演示',routeHint:'browser_demo',durationMs:2400,timeline:[{elapsedMs:2400,label:'已读取24项指标'}],plans:[{name:'虚构路径'}],steps:['已完成核查']};
 const r=c.chatEvidenceRecord(null,legacy),again=c.chatEvidenceRecord(null,r),html=c.chatStreamStepsHTML(again,true);
 assert.equal(again.durationMs,undefined);assert.equal(again.legacyTimingRemoved,true);assert.match(html,/旧版演示动画的耗时不再作为处理用时/);
 assert.doesNotMatch(html,/2\.4秒|已读取24|虚构路径|已完成核查/);
 const unknown=c.chatStreamStepsHTML({metrics:[{label:'金额',value:1}],goalCheck:{actual:10,target:0,rate:null}},true);
 assert.match(unknown,/未提供数据来源信息/);assert.doesNotMatch(unknown,/返回的框架|规则检查|目标核算依据|NaN|undefined/);
});

test('可核验的本轮模型返回记录与节点名称跨聊天存储保留',()=>{
 const c=runtime(),v=c.chatStreamState();c.chatStreamComplete(v,{branch:'diagnosis',dataMode:'demo',performance:{route:'coze_workflow',modelInvoked:true,modelEvidenceSource:'workflow_model_output',serverMs:18000},workflowExecution:{nodes:[{name:'基于本次证据形成原因判断与行动建议',complete:true}]},diagnosis:[]});const saved=c.chatAnalysisSnapshot(v),html=c.chatStreamStepsHTML(saved,true);assert.equal(saved.modelInvoked,true);assert.equal(saved.workflowNodes.length,1);assert.match(html,/已收到工作流模型节点返回记录/);assert.match(html,/收到返回的节点/);assert.doesNotMatch(html,/2\.4秒|没有可核验/);
});

test('目标标题收短时完整模型说明仍在展开依据和持久化记录中',()=>{
 const c=runtime(),v=c.chatStreamState();c.isGoalQuestion=()=>true;c.buildMerchantGoalBrief=()=>({valid:true,actual:190000,target:143000,gap:0,rate:190000/143000*100});c.chatStreamComplete(v,{branch:'diagnosis',goalDiagnosis:{judgment:'本轮模型完整目标说明及环比观察'},performance:{route:'coze_workflow',modelInvoked:true,modelEvidenceSource:'workflow_model_output'},diagnosis:[]});const saved=c.chatAnalysisSnapshot(v);assert.equal(saved.goalNarrative,'本轮模型完整目标说明及环比观察');assert.match(c.chatStreamStepsHTML(saved,true),/工作流返回的目标说明：本轮模型完整目标说明及环比观察/);
});
test('执行过程显示每个模型调用的实际Token，刷新快照保留，缺失值不冒充零',()=>{
 const c=runtime(),v=c.chatStreamState();
 const usage={provider:'DeepSeek',accounting:'provider_usage',complete:true,model:'deepseek-flash',callCount:2,inputTokens:300,outputTokens:120,totalTokens:420,cachedInputTokens:40,reasoningTokens:10,calls:[{stage:'understanding',nodeName:'理解复杂问法',callIndex:1,reasoningEffort:'low',inputTokens:100,outputTokens:40,totalTokens:140,reasoningTokens:10},{stage:'explanation',nodeName:'原因判断与行动建议',callIndex:2,reasoningEffort:'none',inputTokens:200,outputTokens:80,totalTokens:280,reasoningTokens:0}]};
 c.chatStreamComplete(v,{modelUsage:usage,performance:{route:'coze_workflow',modelInvoked:true,modelEvidenceSource:'server_model_usage'}});
 const saved=c.chatAnalysisSnapshot(v),html=c.chatStreamStepsHTML(saved,true);
 assert.equal(saved.modelUsage.calls[1].totalTokens,280);assert.match(html,/本次模型节点 Token 用量/);assert.match(html,/理解复杂问法（low）/);assert.match(html,/问题2（none）/);assert.match(html,/合计 420 Token/);assert.match(html,/输出已包含推理 Token/);
 const old=c.chatModelUsageHTML({complete:false,calls:[{stage:'repair',available:false}]});assert.match(old,/未记录/);assert.doesNotMatch(old,/>0<\/td>/);
});


test('实际回执确认零调用的指标查询，明确显示未调用且刷新后保留',()=>{
 const c=runtime(),v=c.chatStreamState();
 c.chatStreamComplete(v,{branch:'data',modelUsage:{provider:'DeepSeek',accounting:'provider_usage',complete:true,callCount:0,inputTokens:0,outputTokens:0,totalTokens:0,cachedInputTokens:0,reasoningTokens:0,calls:[]},performance:{route:'coze_workflow',modelInvoked:false,modelEvidenceSource:'server_model_usage'}});
 const saved=c.chatAnalysisSnapshot(v),html=c.chatStreamStepsHTML(saved,true);
 assert.equal(saved.modelInvoked,false);assert.match(html,/本次未调用大模型/);assert.match(html,/实际模型调用 0 次，合计 0 Token/);
 assert.equal(c.chatEvidenceRecord({performance:{route:'coze_workflow',modelInvoked:false}}).modelInvoked,null);
});


test('扣子接口Token与自有DeepSeek用量分别显示并持久化，零Token不冒充零积分',()=>{
 const c=runtime(),v=c.chatStreamState();
 c.chatStreamComplete(v,{performance:{route:'coze_workflow',modelInvoked:true,modelEvidenceSource:'server_model_usage'},cozeUsage:{accounting:'coze_api_reported',totalTokens:0,inputTokens:null,outputTokens:null,reportedCost:'0.00',costUnit:'not_supplied',trace:'enabled'},modelUsage:{provider:'DeepSeek',accounting:'provider_usage',complete:true,callCount:1,totalTokens:420,cachedInputTokens:40,calls:[{stage:'knowledge',inputTokens:300,outputTokens:120,totalTokens:420,reasoningTokens:0}]}});
 const saved=c.chatAnalysisSnapshot(v),html=c.chatStreamStepsHTML(saved,true);
 assert.equal(saved.cozeUsage.totalTokens,0);assert.equal(saved.cozeUsage.inputTokens,undefined);assert.equal(saved.cozeUsage.reportedCost,'0.00');
 assert.match(html,/扣子 Coze · 工作流用量/);assert.match(html,/扣子接口记录 Token：0/);assert.match(html,/接口未提供单次结算值/);assert.match(html,/Token 为 0 不代表扣子积分消耗为 0/);assert.match(html,/Trace 已启用/);assert.match(html,/扣费账户：自有 DeepSeek API/);assert.match(html,/合计 420 Token/);assert.doesNotMatch(html,/0\.00\s*积分/);
 const unknown=c.chatStreamStepsHTML({recordVersion:2,mode:'coze_workflow',workflowInvoked:true},true);assert.match(unknown,/扣子接口记录 Token：未提供/);assert.doesNotMatch(unknown,/扣子接口记录 Token：0/);
});

test('总耗时和两类Token总量先于阶段表，阶段记录跨刷新保留且不展示完整指标表',()=>{
 const c=runtime(),v=c.chatStreamState();v.startedAt-=9500;
 const stages=[{id:'intent',name:'意图识别与分析范围确认',nodeNames:['理解问题与分析范围'],detail:'全店 · 近7天',status:'complete',source:'published_workflow_path',cozeTokens:0,deepseekTokens:0,durationMs:123},{id:'explanation',name:'生成原因判断与行动建议',nodeNames:['生成原因判断与行动建议'],detail:'<script>不可执行</script>',status:'complete',source:'published_workflow_path',cozeTokens:0,deepseekTokens:420,parallel:true,callCount:3}];
 c.chatStreamComplete(v,{branch:'diagnosis',workflowExecution:{stages},cozeUsage:{accounting:'coze_api_reported',totalTokens:0},modelUsage:{provider:'DeepSeek',accounting:'provider_usage',complete:true,totalTokens:420,calls:[]},evidence:[{label:'不应在面板重复的完整指标',value:9999}],performance:{route:'coze_workflow'}});
 const saved=c.chatAnalysisSnapshot(v),html=c.chatStreamStepsHTML(saved,true);
 assert.equal(saved.executionStages.length,2);assert.equal(saved.executionStages[0].durationMs,undefined);assert.ok(html.indexOf('workflow-run-summary')<html.indexOf('本次执行路径'));
 assert.match(html,/总 Token<\/small><strong>420/);assert.match(html,/Coze Token<\/small><strong>0/);assert.match(html,/DeepSeek Token<\/small><strong>420/);assert.match(html,/并行 3 次调用/);assert.match(html,/耗时<\/th>/);assert.match(html,/未提供/);assert.doesNotMatch(html,/不应在面板重复的完整指标|9,999|<th>指标<\/th>|0\.123秒|<script>/);assert.match(html,/&lt;script&gt;/);
});
test('没有收到完整账户回执时总Token保持未知，真实中途路径保留但不扩成完整成功链路',()=>{
 const c=runtime(),v=c.chatStreamState();c.chatStreamUpdate(v,'update',{kind:'execution',stages:[{id:'matching',name:'匹配诊断框架与诊断策略',nodeNames:[],detail:'已取得资料',status:'complete',source:'published_workflow_path'}]});
 const pending=c.chatStreamStepsHTML(v);assert.match(pending,/总 Token<\/small><strong>待回执/);assert.match(pending,/匹配诊断框架/);assert.doesNotMatch(pending,/生成原因判断|已完成核查/);
 c.chatStreamComplete(v,null,{failed:true});const saved=c.chatAnalysisSnapshot(v),html=c.chatStreamStepsHTML(saved,true);assert.equal(saved.executionStages.length,1);assert.match(html,/总 Token<\/small><strong>未提供/);assert.match(html,/本次请求未完成/);
 const total=c.chatRunSummaryHTML({}, {cozeUsage:{totalTokens:17},modelUsage:{complete:true,totalTokens:420}},true);assert.match(total,/总 Token<\/small><strong>437/);assert.match(total,/Coze Token<\/small><strong>17/);
});
