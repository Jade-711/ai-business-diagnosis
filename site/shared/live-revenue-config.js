export const repairLiveRevenueCatalog=(()=>{
 const copy=x=>JSON.parse(JSON.stringify(x)),id='research-strategy-07-4',stamp='2026/11/03';
 return input=>{
  const data=copy(input);if(!data.catalog||data.liveRevenueDiagnosisVersion===1)return data;
  const scene=data.scenes.find(s=>s.id==='research-scene-007'),frame=data.frameworks.find(f=>f.sceneId===scene?.id&&f.status==='生效中'),strategy=data.strategies.find(s=>s.id===id);
  if(!scene||!frame||!strategy)return data;
  const old=copy(strategy),oldFrame=copy(frame),amount='research-metric-live-02';
  Object.assign(strategy,{name:'直播成交金额回落',metricIds:[amount],diagnosticMetricIds:[amount,'research-metric-live-10','research-metric-live-01','research-metric-live-17'],displayMetricIds:[amount,'research-metric-live-10','research-metric-live-01'],diagnosticKind:'live_revenue',suppressesStrategyIds:['research-strategy-07-1','research-strategy-07-2','research-strategy-07-3'],businessMeaning:'成交金额下降即进入诊断；用同口径观看人数拆分观看规模与每位观看者成交产出，再以开播计划、来源及商品明细验证原因。千次观看产出未降不再阻断诊断。',rule:{join:'AND',children:[{metricId:amount,op:'<',rightType:'metric',rightMetricId:amount,leftTransform:'value',leftCalc:'none',leftNumber:1,rightTransform:'previous',rightCalc:'*',factor:1}]},actionIds:['research-action-02','research-action-01','research-action-07'],actionSubtitles:{'research-action-02':'对照前后期开播计划，定位取消或缩短的场次；确认主播、货盘和库存后补排有效时段。','research-action-01':'缺播原因核实、备货与讲品准备完成后执行补播，复核该场次的观看与成交。','research-action-07':'先拆自然和付费来源，确认减少集中来源；仅在预算与增量效果可验证时小范围测试投流。'},version:(strategy.version||1)+1,updatedAt:stamp,reviewStatus:'已完成配置与下降场景校验',thresholdBasis:'当前成交金额小于同口径前期值；不再要求千次观看产出同时下降。',exceptionHandling:'关联原因指标缺失时保留成交回落事实及补数行动，不伪造原因；零观看人数不计算人均产出。',history:[...(strategy.history||[]),old]});
  const block='\n#### 成交金额回落专项诊断\n- 触发：同口径成交金额小于前期值，独立于千次观看产出是否下降。\n- 取数：成交金额、观看人数、直播场次、观看-成交率(人数)；这些是原因判断依赖，不能因商家只点名成交金额而裁剪。\n- 观看人数为正且可比时，以“成交金额 = 观看人数 × 每位观看者成交产出（成交金额÷观看人数）”作对称算术分解，区分规模与产出变化，合计必须等于成交差额。此恒等式不构成因果证明。\n- 观看人数下降时核对开播计划及自然/付费来源；人数未降但成交下降时核查成交承接与商品结构。直播场次与去重观看人数只作并列线索，不相除为单场效果。\n- 观看-成交率只作为承接线索；不得把“观看人数”与“千次观看成交金额”的观看次数口径混用。\n- 先给出数值支持的判断，再指出最小验证对象，并匹配创建直播计划、立即开播、直播投流；不自动开播或投放。\n- 广泛直播诊断中，成交回落卡已包含的场次、观看和转化线索合并展示，不重复成多个问题。\n';
  frame.prompt=frame.prompt.replace(/4\. 成交与千次观看产出同时回落：[\s\S]*?(?=\n#### 3\.)/,'4. 直播成交金额回落：成交金额下降即诊断，按观看规模与人均产出定位变化。');
  frame.prompt=frame.prompt.replace(/- 成交与千次观看产出同时回落[^\n]*\n/,'');
  frame.prompt+=block;frame.draftText=frame.prompt;frame.version=(frame.version||1)+1;frame.updatedAt=stamp;frame.history=[...(frame.history||[]),oldFrame];
  strategy.frameworkVersion=frame.version;
  if(strategy.protocol)Object.assign(strategy.protocol,{businessMeaning:strategy.businessMeaning,rule:copy(strategy.rule),actions:strategy.actionIds.map(id=>({id,subtitle:strategy.actionSubtitles[id]})),diagnosticKind:strategy.diagnosticKind,diagnosticMetricIds:strategy.diagnosticMetricIds,thresholdBasis:strategy.thresholdBasis,exceptionHandling:strategy.exceptionHandling,reviewStatus:strategy.reviewStatus});
  for(const snapshot of Object.values(data.published[scene.id]?.periods||{})){
   snapshot.framework=frame.prompt;snapshot.frameworkVersion=frame.version;
   Object.assign(snapshot.frameworkDefinition,{text:frame.prompt,version:frame.version});
   snapshot.strategies=snapshot.strategies.map(s=>s.id===id?copy(strategy):{...s,frameworkVersion:frame.version});
  }
  for(const s of data.strategies)if(s.sceneId===scene.id)s.frameworkVersion=frame.version;
  data.liveRevenueDiagnosisVersion=1;return data;
 };
})();
