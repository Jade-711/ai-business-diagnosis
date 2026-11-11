// The published v16 graph has fixed predecessor paths. A checkpoint or final
// branch confirms that path; this is not a substitute for per-node Trace spans.
export function workflowProgressStages({result={},modelUsage,cozeUsage,checkpoint=false,knownGraph=false}={}){
 if(!knownGraph)return [];
 const branch=checkpoint?'diagnosis':result.branch;
 if(!['diagnosis','data','knowledge','clarification'].includes(branch))return [];
 const usage=modelUsage||result.modelUsage,calls=usage?.calls||[];
 const cozeZero=cozeUsage?.totalTokens===0||result.cozeUsage?.totalTokens===0;
 const stages=[],names={overview:'全店',live:'直播',video:'短视频',shelf:'货架',creator:'达人合作'};
 const stage=(id,name,nodeNames,detail,modelStage)=>{
  const receipts=modelStage?calls.filter(c=>c.stage===modelStage):[];
  const available=modelStage?usage?.complete===true||receipts.length>0&&receipts.every(c=>c.available!==false&&Number.isSafeInteger(c.totalTokens)):true;
  stages.push({id,name,nodeNames,status:'complete',source:'published_workflow_path',detail,
   ...(cozeZero?{cozeTokens:0}:{}),...(available?{deepseekTokens:receipts.reduce((sum,c)=>sum+c.totalTokens,0)}:{}),
   ...(receipts.length?{modelStage,callCount:receipts.length,parallel:modelStage==='explanation'&&receipts.length>1}:{} )});
 };
 const intentName=branch==='knowledge'?'意图识别':branch==='data'?'意图识别与查询范围确认':'意图识别与分析范围确认';
 stage('intent',intentName,['理解问题与分析范围',...(calls.some(c=>c.stage==='understanding')?['理解复杂问法','确认本次分析范围']:[]),'汇合已确认的需求'],checkpoint?'已返回诊断资料，前置范围确认路径已执行。':branch==='knowledge'?'识别为通用知识问答，无需经营场域或统计周期。':`${names[result.context?.fieldKey]||'本次问题'}${result.context?.period?' · '+(result.context.period==='day'?'昨日':'近7天'):''}`,'understanding');
 stage('routing',{diagnosis:'任务分流：经营诊断',data:'任务分流：智能取数',knowledge:'任务分流：知识问答',clarification:'任务分流：补充信息'}[branch],['选择经营任务'],{diagnosis:'进入经营诊断分支。',data:'进入经营指标查询分支。',knowledge:'进入通用知识问答分支。',clarification:'进入补充信息分支。'}[branch]);
 if(branch==='diagnosis'){
  stage('matching','匹配诊断框架与诊断策略',['读取指标并匹配诊断策略'],checkpoint?'已取得本次诊断资料。':`选用已发布配置${result.coverage?.frameworks?.length?'，涉及 '+result.coverage.frameworks.length+' 个框架':''}；具体规则与命中见正式回答。`);
  stage('calculation','核对指标与计算结果',['核对数据与计算结果'],checkpoint?'已收到部分指标，具体数值在正式回答中展示。':'核对同口径指标、变化与计算结果；具体数值见正式回答。');
  if(!checkpoint){
   if(calls.some(c=>c.stage==='explanation'))stage('explanation','生成原因判断与行动建议',['生成原因判断与行动建议'],'按本次证据解释问题并引用已发布行动。','explanation');
   stage('validation','核查诊断说明与行动',['核查诊断说明与行动','回答通过核查了吗？'],calls.some(c=>c.stage==='repair')?'初次核查触发了一次补全。':result.workflow?.explanationOrigin==='evidence_gate'?'证据不足时返回判断边界。':result.quality?.validated===false?'部分说明未通过核验，保留判断边界。':'已执行配置中的证据与行动引用核查。');
   if(calls.some(c=>c.stage==='repair')){
    stage('repair','补全未通过核查的回答',['补全未通过核查的回答'],'按核查缺口补全一次。','repair');
    stage('recheck','复核补全后的回答',['复核补全后的回答'],result.quality?.validated===true?'补全后的回答通过核查。':'未通过的说明与建议按证据边界处理。');
   }
  }
 }else if(branch==='data')stage('query','查询经营指标',['查询经营指标'],'返回本轮范围内的指标；未进入诊断解释分支。');
 else if(branch==='knowledge')stage('knowledge','回答经营知识问题',['回答经营知识问题'],'本轮知识问答不执行诊断框架匹配。','knowledge');
 else stage('clarification','请商家补充信息',['请商家补充信息'],'范围或资料不足，等待补充信息。');
 if(!checkpoint)stage('delivery','整理并返回正式回答',['整理统一返回格式','结束'],'本次工作流分支已返回。');
 return stages;
}
