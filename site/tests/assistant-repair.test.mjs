import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assistantConfirmedRequest} from '../shared/conversation-task.js';
import {buildAssistantGrounding} from '../shared/assistant-grounding.js';
import {groundAssistantModel,validateAssistantModelSafety} from '../shared/assistant-model-guard.js';
import {workflowInputPayload} from '../worker/resource-contract.js';
import {prepareWorkflowDiagnosis} from '../shared/workflow-diagnosis.js';
const catalog=JSON.parse(readFileSync(new URL('../worker/demo-catalog.json',import.meta.url)));
const h=content=>[{role:'user',content},{role:'assistant',content:'好的，继续该范围。'}];
test('追问承接最近明确任务，明确新指令覆盖旧任务，未知任务保留模型判断',()=>{
 assert.equal(assistantConfirmedRequest({question:'那这一块呢？',history:h('继续看近7天直播整体经营情况'),intent:'data'}).intent,'diagnosis');
 assert.equal(assistantConfirmedRequest({question:'那这一块呢？',history:h('只查成交金额数值'),intent:'diagnosis'}).intent,'data');
 assert.equal(assistantConfirmedRequest({question:'那这一块呢？',history:h('商品动销率是什么？'),intent:'diagnosis'}).intent,'knowledge');
 assert.equal(assistantConfirmedRequest({question:'只返回近7天成交金额数字，不用分析',history:h('分析整体经营'),intent:'diagnosis'}).intent,'data');
 assert.equal(assistantConfirmedRequest({question:'观看人数是什么？',history:h('分析整体经营'),intent:'diagnosis'}).intent,'knowledge');
 assert.equal(assistantConfirmedRequest({question:'那这一块呢？',history:[],intent:'clarification'}).intent,'clarification');
});
const metric=(id,label,unit,value,previousValue)=>({metricId:id,label,unit,value,previousValue});
test('明确成交环节不被比较用的金额指标改路由',()=>{
 const {config,data}=structuredClone(catalog['live:week']);
 const p=workflowInputPayload(config,data,'live',{question:'分析近7天直播成交，核对每单成交金额的变化。'});
 assert.ok(p.configuration.frameworkCandidates.some(f=>f.sceneName==='直播-成交'||f.name==='直播-成交诊断框架'));
 const c=prepareWorkflowDiagnosis({...p,question:'分析近7天直播成交，核对每单成交金额的变化。',context:{sellerId:'DEMO_10001',fieldKey:'live',period:'week',tags:[]}});assert.ok(c.result.execution.selectedStrategyIds.some(id=>id.startsWith('research-strategy-16-')));
});
test('辅助观看人数保留为事实，仍不扩大已编译诊断指标范围',()=>{
 const {config,data}=structuredClone(catalog['live:week']);
 const p=workflowInputPayload(config,data,'live',{question:'分析近7天直播点击是否存在问题。'});
 const watcher=p.configuration.observationMetricDefinitions.find(m=>(m.originalName||m.name)==='观看人数');assert.ok(watcher);
 assert.ok(p.data.observationMetrics.some(m=>m.id===watcher.id));
 p.data.fieldKey='live';p.data.period='week';
 const c=prepareWorkflowDiagnosis({...p,question:'分析近7天直播点击是否存在问题。',context:{sellerId:'DEMO_10001',fieldKey:'live',period:'week',tags:[]}});
 assert.ok(c.materials.grounding.observations.some(m=>m.metricId===watcher.id));
 const spoof=metric('not-published','虚构辅助指标','元',99,88);p.data.observationMetrics.push({...spoof,id:spoof.metricId,derived:'value'});
 const c2=prepareWorkflowDiagnosis({...p,question:'分析近7天直播点击是否存在问题。',context:{sellerId:'DEMO_10001',fieldKey:'live',period:'week',tags:[]}});assert.ok(!c2.materials.grounding.observations.some(m=>m.metricId==='not-published'));
});
test('事件点击率和每单金额用新数值精确计算，不混淆买家口径',()=>{
 const result={metricAnalysis:[metric('a','商品曝光次数','次',240000,300000),metric('b','商品点击次数','次',24000,30000),metric('c','成交金额','元',200000,250000),metric('d','成交订单数','单',2250,2750)],diagnosis:[{strategyId:'s',name:'商品曝光与点击同步减少',evidence:[{metricId:'a'},{metricId:'b'}],actionIds:[],analysis:{}}],actions:[]};
 const g=buildAssistantGrounding(result,{strategies:[]},{sameAttribution:true});assert.match(g.issues[0].basis,/前期10%，本期10%/);
 const per=g.observations.find(x=>x.metricId==='computed-per-order-amount');assert.ok(Math.abs(per.value-88.8888889)<.00001);assert.ok(per.value<per.previousValue);
 const model={summary:'',explanations:[{strategyId:'s',judgment:'错误8%',basis:'错误8%',uncertainty:'需来源明细',actions:[]}]};
 const corrected=groundAssistantModel({materials:{grounding:g}},model);assert.doesNotMatch(corrected.explanations[0].basis,/8%/);assert.match(corrected.explanations[0].basis,/10%/);assert.equal(corrected.explanations[0].uncertainty,model.explanations[0].uncertainty);
 assert.deepEqual(groundAssistantModel({materials:{grounding:g}}, {explanations:[]}).explanations,[]);
});
test('曝光稳定而观看减少时补齐观看率与正确人数分母，缺失分母不编造算式',()=>{
 const result={metricAnalysis:[metric('e','曝光人数','人',17000,17000),metric('w','观看人数','人',5950,8500),metric('r','曝光-观看率(人数)','%',35,50)],diagnosis:[{strategyId:'s',name:'曝光未减但观看人数减少',evidence:[{metricId:'e'},{metricId:'w'}],actionIds:[]}],actions:[]};
 const basis=buildAssistantGrounding(result,{strategies:[]},{}).issues[0].basis;
 assert.match(basis,/下降15个百分点/);assert.match(basis,/观看人数÷曝光人数/);assert.match(basis,/5,950÷17,000≈35%/);
 result.metricAnalysis=result.metricAnalysis.filter(m=>m.metricId!=='e');
 const missing=buildAssistantGrounding(result,{strategies:[]},{}).issues[0].basis;
 assert.doesNotMatch(missing,/5,950÷17,000/);assert.match(missing,/须同对象、同周期与同归因/);
});
test('转化问题仍核对金额和订单分解，订单分母为零时不制造每单金额',()=>{
 const amount=metric('source-live-01','成交金额','元',71000,91000),orders=metric('source-live-02','成交订单数','单',800,1000);
 const result={metricAnalysis:[amount,orders],diagnosis:[{strategyId:'s',name:'点击稳定但成交承接走弱',evidence:[],actionIds:[]}],actions:[]};
 const g=buildAssistantGrounding(result,{strategies:[]},{}).issues[0];
 assert.match(g.basis,/前期91元，本期88.75元，下降/);assert.match(g.basis,/−17,975元/);assert.match(g.basis,/−2,025元/);assert.match(g.basis,/合计−20,000元/);
 orders.value=0;
 assert.doesNotMatch(buildAssistantGrounding(result,{strategies:[]},{}).issues[0].basis,/订单数变化对应|Infinity|NaN/);
});
test('行动条件按工具与已发布前提核查，缺播与来源收缩不可用或连接',()=>{
 const actions=[{id:'a',name:'创建直播计划',instruction:'确认缺播后补排'},{id:'b',name:'快分销',instruction:'确认商品匹配问题后调整'}];
 const calculation={materials:{grounding:{providedMetrics:[],issues:[{strategyId:'s',actions}]}}};
 const check=text=>validateAssistantModelSafety(calculation,{explanations:[{strategyId:'s',actions:[{actionId:'a',text}]}]});
 assert.ok(check('若确认缺播或来源收缩，再补排有效时段。').length);
 assert.equal(check('先核查开播记录；若确认缺播，再补排有效时段。').length,0);
 assert.ok(validateAssistantModelSafety(calculation,{explanations:[{strategyId:'s',actions:[{actionId:'b',text:'若确认订单下滑，再调整达人商品匹配。'}]}]}).length);
 assert.equal(validateAssistantModelSafety(calculation,{explanations:[{strategyId:'s',actions:[{actionId:'b',text:'若确认达人商品匹配不足，再调整合作货盘。'}]}]}).length,0);
});
test('商品列表不能提供退款报表，聚合指标与对象明细的缺数表述分开',()=>{
 const calculation={materials:{grounding:{providedMetrics:['观看人数'],issues:[]}}};
 assert.ok(validateAssistantModelSafety(calculation,{summary:'从商品列表调取支付日退款明细'}).length);
 assert.ok(validateAssistantModelSafety(calculation,{summary:'缺少观看人数，暂无法判断'}).length);
 assert.deepEqual(validateAssistantModelSafety(calculation,{summary:'观看人数聚合值已提供，尚缺按场次观看明细；商品列表不能提供退款明细，须先人工取得。'}),[]);
});
test('真实目标诊断的商品列表越界被拦截，人工取数后管理商品仍可执行',()=>{
 const c={materials:{grounding:{providedMetrics:[],issues:[]},goalActions:[]}};
 const check=detail=>validateAssistantModelSafety(c,{goalDiagnosis:{plans:[{actionId:'research-action-28',detail}]}});
 assert.ok(check('先核查商品列表中各商品成交件数、实付金额及缺货、下架记录，确认是否存在订单集中变化；若确认供给中断，再通过商品列表恢复有效供给。').length);
 assert.deepEqual(check('先人工取得同商品订单与实付明细；若确认供给中断，再通过商品列表核对在售状态并恢复有效供给，随后复看成交金额。'),[]);
});
test('活动与付费测试保留毛利库存资格和预算前提，事后复看成本不能替代执行条件',()=>{
 const actions=[{id:'a',name:'限时秒杀',instruction:'仅在毛利库存及资格核实后调整活动'},{id:'b',name:'直播投流',instruction:'核对承接后测试'}];
 const c={materials:{grounding:{providedMetrics:[],issues:[{strategyId:'s',actions}]}}};
 const check=(id,text)=>validateAssistantModelSafety(c,{explanations:[{strategyId:'s',actions:[{actionId:id,text,verification:'复看成交退款成本'}]}]});
 assert.ok(check('a','先核查商品实付价格及库存；若确认活动让利导致每单金额下降，再调整活动。').length);
 assert.equal(check('a','先核查活动让利结构；若确认配置问题，且毛利、库存和活动资格均满足，再调整活动。').length,0);
 assert.ok(check('b','若确认流量缺口且承接可验证，再做小范围测试。').length);
 assert.equal(check('b','先核查流量来源与承接；若确认缺口且承接正常，并核定预算上限，再做小范围测试。').length,0);
});

test('综合小结引用同一条模型行动，避免摘要另给不同执行前提',()=>{
 const g={issues:[{strategyId:'s',judgment:'观看减少',basis:'观看10到6',actions:[]}],summary:{conclusion:'观看减少',basis:'10到6',reason:'根因待核'}};
 const c={result:{diagnosis:[{strategyId:'s'}]},materials:{grounding:g,summaryRequired:true}};
 const m={summary:'结论：观看减少\n依据：10到6\n原因：待核\n建议：来源减少就补排',explanations:[{strategyId:'s',judgment:'观看减少',basis:'10到6',uncertainty:'明细待核',actions:[{text:'先核查开播记录；若确认缺播，再补排有效时段。'}]}]};
 const x=groundAssistantModel(c,m);assert.match(x.summary,/建议：先核查开播记录；若确认缺播，再补排有效时段。/);assert.doesNotMatch(x.summary,/来源减少就补排/);
});

test('泛化为什么问题保留知识意图，不因单个疑问词强制经营分析',()=>{
 const p={question:'请解释比率口径：分子从10降到8、分母从20降到10，比率从多少变到多少？为什么分子变少比率还能升？',history:[],intent:'knowledge'};
 assert.equal(assistantConfirmedRequest(p).intent,'knowledge');
 assert.equal(assistantConfirmedRequest({question:'分析近7天直播成交下降的原因',history:[],intent:'knowledge'}).intent,'diagnosis');
});

test('含多少的计算口径问题保留知识意图，明确数量追问则切查数',()=>{
 assert.equal(assistantConfirmedRequest({question:'商品点击率如何计算？20000次曝光和1600次点击是多少？比较时需要哪些相同口径？',intent:'knowledge',history:[]}).intent,'knowledge');
 assert.equal(assistantConfirmedRequest({question:'那近7天直播成交金额是多少？',intent:'diagnosis',history:h('分析近7天直播经营情况')}).intent,'data');
});

test('明确分析指令优先于句尾是什么，所有已冻结有效任务不被确认规则误改',()=>{
 const cases=JSON.parse(readFileSync(new URL('./fixtures/assistant-task-contract.json',import.meta.url)));
 for(const c of cases)assert.equal(assistantConfirmedRequest({...c.request,intent:c.expected}).intent,c.expected,c.id+' '+c.request.question);
 assert.equal(assistantConfirmedRequest({question:'帮我分析近7天流量，主要异常是什么？',intent:'knowledge',history:[]}).intent,'diagnosis');
 assert.equal(assistantConfirmedRequest({question:'经营分析是什么意思？',intent:'knowledge',history:[]}).intent,'knowledge');
});
