import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {projectKnowledgeQuestion,PROJECT_KNOWLEDGE_CARDS} from '../shared/project-knowledge.js';
test('knowledge receives project definitions and the selected published scene',()=>{
 assert.equal(PROJECT_KNOWLEDGE_CARDS.length,91);
 const q=projectKnowledgeQuestion('成交金额除以成交订单数就是客单价吗？');
 assert(q.startsWith('成交金额除以成交订单数就是客单价吗？'));
 assert.match(q,/客单价按成交金额÷去重成交人数/);assert.match(q,/称每单成交金额/);
 assert.doesNotMatch(q,/100000|1000单|800人|FX-|K02/);
 const scene=JSON.parse(projectKnowledgeQuestion('货架-加购应如何判断？').split('【本产品口径参考】\n')[1].split('\n请')[0]);
 assert.equal(scene.scenes.length,1);assert.equal(scene.scenes[0].name,'货架-加购');
 assert(scene.scenes[0].requiredEvidence.length);
});
test('data rendering retains multiple requested metrics and a missing-value explanation',()=>{
 const sandbox=vm.createContext({document:{addEventListener(){}},esc:String,icon:()=>'',merchantScopeHTML:()=>'',merchantActionLinks:()=>'',window:{innerWidth:1200},curatedActive:()=>true,curatedResolveContext:()=>({metricKey:'a'}),curatedMetric:()=>({id:'a',originalName:'成交金额'}),curatedValue:(_,v)=>String(v)});
 new vm.Script(readFileSync(new URL('../web/coze-client.js',import.meta.url),'utf8')).runInContext(sandbox);
 const html=sandbox.cozeAnswerHTML({branch:'data',answer:'成交金额100000元、成交订单数1000单',evidence:[{metricId:'a',label:'成交金额',value:100000,unit:'元'},{metricId:'b',label:'成交订单数',value:1000,unit:'单'}]},'成交金额和成交订单数分别多少？');
 assert.match(html,/成交金额100000元、成交订单数1000单/);assert.match(html,/1,000单/);
 const missing=sandbox.cozeAnswerHTML({branch:'data',answer:'退款率本期缺失，无法提供具体数值。',evidence:[{metricId:'a',label:'退款率',value:null,unit:'%'}]},'退款率多少？');
 assert.match(missing,/本期缺失/);assert.doesNotMatch(missing,/null%/);
});
