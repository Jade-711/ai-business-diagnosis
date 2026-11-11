import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeKnowledgeOutput} from '../shared/knowledge-output.js';
test('真实故障结构：顶层知识回答保留原文并规范为结果对象',()=>{
 const answer='商品点击率=800÷10000=8%，曝光和点击须同对象同周期同归因。';
 const flat={schemaVersion:1,status:'success',branch:'knowledge',answer,dataMode:'demo',missing:[]};
 const r=normalizeKnowledgeOutput('knowledge',flat);assert.equal(r.result.answer,answer);assert.equal(r.result.schemaVersion,1);assert.equal(r.result.branch,'knowledge');assert.equal(flat.result,undefined);
 assert.deepEqual(normalizeKnowledgeOutput('knowledge',{result:flat}).result,r.result);
});
test('答案缺失或内外层冲突时如实失败，不生成固定回答，其他模型阶段原样保留',()=>{
 for(const a of [{},{result:{answer:''}},{answer:'  '},{answer:123},null])assert.throws(()=>normalizeKnowledgeOutput('knowledge',a));
 assert.throws(()=>normalizeKnowledgeOutput('knowledge',{answer:'A',result:{answer:'B'}}),/冲突/);
 const x={summary:'诊断',explanations:[]};assert.equal(normalizeKnowledgeOutput('explanation',x),x);assert.equal(normalizeKnowledgeOutput('repair',x),x);
});
