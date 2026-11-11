import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const c=vm.createContext({document:{addEventListener(){}},esc:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;')});
vm.runInContext(await readFile(new URL('../web/ai-strategy-ui.js',import.meta.url),'utf8'),c);
test('策略规则试跑独立展示命中、不命中和缺数结果，不误作旧框架诊断报告',()=>{
 const html=c.aiddStrategyTrialReportHTML({executed:true,analysisMode:'strategy_rule_trial',cases:[{label:'命中案例',ruleResults:[{name:'发布与曝光下降',applies:true,matched:true,triggered:true,reason:'按确定性规则判断'}],evidence:[{label:'发布数',value:0,previousValue:2,unit:'条'}]},{label:'不命中案例',ruleResults:[{name:'未下降',applies:true,matched:false,triggered:false,reason:'未满足条件'}],evidence:[]},{label:'缺数案例',ruleResults:[],missing:['缺少前周期曝光人数'],evidence:[]}],limitations:['合成案例，尚未发布']});
 for(const text of ['策略规则试跑','规则结果：满足','规则结果：不满足','规则暂无法判断','缺少前周期曝光人数','0条','2条'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/旧报告|商家诊断预览/);
 const scope=c.aiddStrategyTrialReportHTML({executed:true,analysisMode:'strategy_rule_trial',cases:[{label:'范围未满足',ruleResults:[{name:'<script>',applies:false,matched:null,triggered:false,reason:'商家适用标签不满足，跳过'}]}]});
 assert.match(scope,/适用范围：未满足/);assert.match(scope,/无法判断/);assert.match(scope,/&lt;script&gt;/);assert.doesNotMatch(scope,/<script>/);
});
test('失败后重试成功会清除旧错误，不在有效候选旁保留上次失败提示',async()=>{
 const error={textContent:'上一次失败'},host={innerHTML:''};let rendered=0;
 c.aiddUI={};c.$=selector=>selector==='#aidd-ai-form'?{reportValidity:()=>true}:selector==='#aidd-ai-input-error'?error:selector==='#aidd-candidate-output'?host:null;
 c.aiddAIInputs=()=>({sceneIds:['s']});c.aiddValidateAIInputs=()=>null;c.aiddIsOnline=()=>true;c.cozeGenerateStrategies=async()=>[{id:'valid'}];c.aiddRenderCandidate=()=>{rendered++;};c.clone=value=>JSON.parse(JSON.stringify(value));c.setInterval=()=>1;c.clearInterval=()=>{};
 await c.aiddBuildCandidate();assert.equal(error.textContent,'');assert.equal(rendered,1);assert.equal(c.aiddUI.candidate.id,'valid');assert.equal(c.aiddUI.aiGenerating,false);
});
