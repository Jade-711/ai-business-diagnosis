import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowProgressStages} from '../shared/workflow-progress.js';
const usage=calls=>({complete:calls.every(c=>c.available!==false),calls});
const call=(stage,totalTokens,extra={})=>({stage,totalTokens,available:true,...extra});
const base={knownGraph:true,result:{branch:'diagnosis',context:{fieldKey:'overview',period:'week'},quality:{validated:true}},cozeUsage:{totalTokens:0}};
test('已发布路径按本次分支输出，三路解释用量只汇总一次，不伪造逐节点时间',()=>{
 const stages=workflowProgressStages({...base,modelUsage:usage([call('explanation',5519),call('explanation',3252),call('explanation',3298)])});
 assert.deepEqual(stages.map(s=>s.id),['intent','routing','matching','calculation','explanation','validation','delivery']);
 assert.equal(stages.find(s=>s.id==='explanation').deepseekTokens,12069);assert.equal(stages.find(s=>s.id==='explanation').parallel,true);
 assert.equal(stages.reduce((sum,s)=>sum+s.deepseekTokens,0),12069);assert.ok(stages.every(s=>s.cozeTokens===0&&!Object.hasOwn(s,'durationMs')));
 assert.deepEqual(workflowProgressStages({...base,knownGraph:false}),[]);
});
test('中途回执只证明前置路径，未返回的模型用量不写成零或已执行',()=>{
 const stages=workflowProgressStages({knownGraph:true,checkpoint:true});
 assert.deepEqual(stages.map(s=>s.id),['intent','routing','matching','calculation']);assert.equal(stages[0].deepseekTokens,undefined);assert.ok(stages.every(s=>s.cozeTokens===undefined));
});
test('知识、查数、澄清按实际分支展示；有补全回执才显示补全',()=>{
 for(const [branch,last,modelCalls] of [['knowledge','knowledge',[call('knowledge',100)]],['data','query',[]],['clarification','clarification',[call('understanding',80)]]]){
  const stages=workflowProgressStages({...base,result:{branch},modelUsage:usage(modelCalls)});
  assert.ok(stages.some(s=>s.id===last));assert.ok(stages.every(s=>!['matching','calculation','explanation','validation','repair'].includes(s.id)));
  assert.equal(stages.find(s=>s.id==='routing').name,{knowledge:'任务分流：知识问答',data:'任务分流：智能取数',clarification:'任务分流：补充信息'}[branch]);
  assert.ok(stages.every(s=>!s.name.includes('经营分析场景路由')));
  if(branch==='knowledge'){assert.equal(stages[0].name,'意图识别');assert.match(stages[0].detail,/无需经营场域或统计周期/);}
  if(branch==='data')assert.equal(stages[0].name,'意图识别与查询范围确认');
 }
 const stages=workflowProgressStages({...base,modelUsage:usage([call('understanding',100),call('explanation',200),call('repair',300)])});
 assert.deepEqual(stages.slice(-3).map(s=>s.id),['repair','recheck','delivery']);assert.equal(stages[0].deepseekTokens,100);assert.equal(stages.reduce((sum,s)=>sum+s.deepseekTokens,0),600);
});
test('缺失的DeepSeek用量及不能归属节点的Coze用量保留未知',()=>{
 const stages=workflowProgressStages({...base,cozeUsage:{totalTokens:17},modelUsage:usage([call('explanation',undefined,{available:false})])});
 assert.ok(stages.every(s=>s.cozeTokens===undefined));assert.equal(stages.find(s=>s.id==='explanation').deepseekTokens,undefined);
});
