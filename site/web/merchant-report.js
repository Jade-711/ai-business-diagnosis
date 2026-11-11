'use strict';

// Dates belong to the existing, fixed demonstration reporting window.
function merchantScopeInfo(result,question=''){
 if(typeof curatedActive==='function'&&curatedActive())return curatedScopeInfo(result,question);
 const context=result.context||{},scene={overview:'全店',live:'直播',video:'短视频',shelf:'货架',creator:'达人合作'}[context.fieldKey]||'当前场景';
 const day=context.period==='day',period=day?'昨日':'近7天',demo=result.dataMode==='demo'||context.demo;
 const dates=demo?(day?'2026年10月20日':'2026年10月14日—10月20日'):String(context.range||'');
 const comparison=demo?(day?'前一日（10月19日）':'前7天（10月7日—10月13日）'):String(context.comparisonRange||'同口径上一周期');
 const explicitScene=/全店|整店|直播|短视频|货架|达人/.test(question),explicitTime=/近\s*(7|七)\s*天|最近\s*(7|七)\s*天|过去\s*(7|七)\s*天|昨天|昨日|10[.月/-]/.test(question);
 const inherited=!explicitScene&&!explicitTime?'未指定场域和具体时间，沿用当前页面或会话范围。':!explicitTime?'未指定具体时间，沿用当前页面或会话的时间范围。':!explicitScene?'未指定场域，沿用当前页面或会话的场景。':'';
 const label=result.branch==='data'?'本次查询':'本次分析',text=`${label}：${scene} · ${period}${dates?'（'+dates+'）':''}；对比${comparison}。`;
 return {text,inherited,scene,period};
}
function merchantScopeHTML(result,question=''){
 const scope=merchantScopeInfo(result,question);
 return `<div class="merchant-answer-scope"><p>${esc(scope.text)}</p>${scope.inherited?`<p class="scope-assumption">${esc(scope.inherited)}</p>`:''}</div>`;
}

// Merchant presentation uses returned evidence only. It never changes rule hits,
// adds a strategy, or treats a plausible business cause as a confirmed fact.
function buildMerchantBrief(result,question='',options={}){
 if(typeof workflowResult==='function'&&workflowResult(result))return isGoalQuestion(question)?workflowGoalBrief(result,question):workflowMerchantBrief(result,question,options);
 if(typeof isGoalQuestion==='function'&&isGoalQuestion(question))return buildMerchantGoalBrief(result,question);
 if(typeof curatedActive==='function'&&curatedActive())return curatedBuildBrief(result,question,options);
 const names={overview:'全店',live:'直播',video:'短视频',shelf:'货架',creator:'达人合作'};
 const labels={gmv:'支付金额',buyers:'支付人数',orders:'支付订单数',exposure:'商品曝光人数',clickRate:'商品点击率',payRate:'点击支付转化率',newBuyerRate:'新客支付占比',plays:'视频播放量',videos:'发布带货视频数',creators:'有成交达人数',activeRate:'合作达人成交率'};
 const context=result.context||{},fieldKey=context.fieldKey||'overview',scene=names[fieldKey]||'当前场景',period=context.period==='day'?'昨日':'近7天';
 const finite=value=>typeof value==='number'&&Number.isFinite(value);
 const number=value=>value.toLocaleString('zh-CN',{maximumFractionDigits:2});
 const percent=value=>Math.abs(value).toFixed(1)+'%';
 const movement=value=>!finite(value)?'暂无可比数据':Math.abs(value)<.05?'环比持平':`环比${value<0?'下降':'增长'}${percent(value)}`;
 const collected=new Map();
 for(const item of [...(result.metricAnalysis||[]),...(result.evidence||[]),...(result.diagnosis||[]).flatMap(d=>d.evidence||[])]){
  const id=item.metricId||item.id||'',match=id.match(/-(gmv|buyers|orders|exposure|clickRate|payRate|newBuyerRate|plays|videos|creators|activeRate)-(value|change)$/);
  if(!match||!id.startsWith(fieldKey+'-')||!finite(item.value))continue;
  const key=match[1],kind=match[2],old=collected.get(key)||{key,label:labels[key]};
  if(kind==='change')old.returnedChange=item.value;
  else {old.value=item.value;old.unit=item.unit||'';if(finite(item.previousValue))old.previousValue=item.previousValue;}
  collected.set(key,old);
 }
 for(const m of collected.values()){
  m.change=finite(m.previousValue)&&m.previousValue>0&&finite(m.value)?100*(m.value-m.previousValue)/m.previousValue:m.returnedChange;
  m.display=finite(m.value)?number(m.value)+m.unit:'未提供';
  m.comparison=movement(m.change);
 }
 const get=key=>collected.get(key),down=key=>finite(get(key)?.change)&&get(key).change<-.05;
 const wholeScene=/经营表现|整体表现|全店诊断|目标差距/.test(question)&&!/点击率|转化率|订单|支付人数|新客占比/.test(question);
 const focus=!wholeScene&&labels[context.metricKey]?context.metricKey:'',gmv=get('gmv'),orders=get('orders');
 const valid=['success','partial'].includes(result.status)&&(!focus||finite(get(focus)?.value)),findings=(result.diagnosis||[]).filter(d=>d.triggered!==false);
 const relevant=focus?findings.filter(d=>(d.evidence||[]).some(e=>(e.metricId||e.id||'').includes('-'+focus+'-'))):findings;
 const goal=result.goal||{},goalText=finite(goal.rate)&&finite(goal.gap)?`目标完成${goal.rate.toFixed(1)}%，${goal.gap>0?'还差'+number(goal.gap)+'元':'已达成目标'}`:'';
 const gaps=(result.fieldBreakdown||[]).filter(x=>finite(x.gap)&&x.gap>0).sort((a,b)=>b.gap-a.gap),topGap=fieldKey==='overview'?gaps[0]:null;
 const share=topGap&&finite(goal.gap)&&goal.gap>0&&Math.abs(gaps.reduce((sum,x)=>sum+x.gap,0)-goal.gap)<1?100*topGap.gap/goal.gap:null;
 const topName=topGap&&(names[topGap.fieldKey]||topGap.name),problems=[],actions=[];
 const brief={version:1,fieldKey,scene,period,demo:result.dataMode==='demo',verdict:'',tone:'watch',problems,metrics:[],reason:'',uncertainty:'',actions,goalText,followUp:null};
 const addProblem=(title,detail='')=>{if(problems.length<2)problems.push({title,detail});};
 const addAction=(title,detail)=>{if(actions.length<2)actions.push({title,detail});};
 const ratioChange=(total,count)=>finite(total?.value)&&finite(total?.previousValue)&&total.previousValue>0&&finite(count?.value)&&count.value>0&&finite(count?.previousValue)&&count.previousValue>0?100*((total.value/count.value)/(total.previousValue/count.previousValue)-1):null;
 const ratioMovement=value=>`${value<0?'下降':'上升'}${percent(value)}`;
 if(!valid){
  brief.verdict=result.status==='not_applicable'?'当前商家不在已配置诊断的适用范围内':'资料不足，暂不能完成诊断';
  addProblem('本次诊断尚不具备完整判断条件');
  brief.reason='当前配置或指标不完整，不能据此判断经营是否正常。';
  brief.uncertainty='补齐本场景可用配置和同周期数据后，再发起诊断。';
  addAction('先补齐诊断资料','查看下方缺失信息，确认当前场景有已生效配置及可用指标。');
 }else{
  const focal=get(focus);
  brief.tone=relevant.length||focus&&down(focus)?'attention':'watch';
  brief.verdict=focus==='newBuyerRate'?'新客占比发生变化，需结合用户规模判断':focus&&finite(focal?.value)?`${focal.label}${down(focus)?'回落，需优先关注':relevant.length?'有待改善项':'暂未发现已配置的优先异常'}`:down('gmv')?`${scene}成交回落${percent(gmv.change)}${findings.length?'，有需要改善的问题':''}`:findings.length?`${scene}有需要改善的经营环节`:'当前已配置规则范围内，未发现优先异常';
  if(focus==='newBuyerRate')brief.tone='watch';
  if(focus){
   addProblem(focus==='newBuyerRate'?'新客与老客的成交结构变化':`${labels[focus]}${down(focus)?'回落':relevant.length?'需核查':'当前表现'}`,focus==='newBuyerRate'?'占比变化本身不能认定经营变差。':focal?.previousValue!==undefined?`由${number(focal.previousValue)}${focal.unit}变为${focal.display}。`:'按当前可用指标判断。');
  }else if(fieldKey==='overview'&&(down('orders')||down('buyers'))){
   addProblem(down('orders')&&down('buyers')?'下单规模收缩：支付人数与订单数同时减少':down('orders')?'下单规模收缩：支付订单数减少':'支付用户规模收缩');
  }else{
   const priorities={live:['clickRate','exposure','payRate','orders','buyers'],video:['plays','videos','clickRate','orders'],shelf:['payRate','clickRate','buyers','orders'],creator:['creators','activeRate','orders','buyers']}[fieldKey]||['orders','buyers','exposure','clickRate'];
   const key=priorities.find(down);
   if(key)addProblem({clickRate:'商品被看到后，点击意愿下降',payRate:'点击后的支付承接走弱',plays:'内容触达规模减少',videos:'带货内容供给减少',creators:'有成交的达人覆盖减少',activeRate:'合作达人的成交覆盖走弱',exposure:'商品获得的曝光减少',orders:'支付订单规模减少',buyers:'支付用户规模减少'}[key]);
   else addProblem(relevant.length?'存在已配置规则提示的待改善项':'继续观察当前有效的经营表现');
  }
  if(topGap)addProblem(`${topName}是优先检查场域`,`${topName}目标缺口${number(topGap.gap)}元${finite(share)?`，占全店缺口${share.toFixed(1)}%`:''}。`);
  const orderValueChange=ratioChange(gmv,orders),perVideoChange=ratioChange(get('plays'),get('videos')),perCreatorChange=ratioChange(gmv,get('creators'));
  if(focus==='clickRate'||!focus&&fieldKey==='live'&&down('clickRate')){
   brief.reason=focus&&get('clickRate')?.previousValue!==undefined?`点击率由${number(get('clickRate').previousValue)}%${down('clickRate')?'降':'升'}至${get('clickRate').display}，看到商品后愿意点击的比例${down('clickRate')?'降低':'提升'}。`:`点击率${movement(get('clickRate')?.change)}${finite(get('payRate')?.change)?`，支付转化率${movement(get('payRate').change)}`:''}；优先检查商品展示到点击的环节。`;
   brief.uncertainty='是否与商品呈现、讲解或价格有关，还需逐商品数据和直播回放验证。';
   addAction(down('clickRate')?'先找点击流失的商品':'复盘点击表现较好的商品',down('clickRate')?'按商品对比曝光与点击，找出点击率下降最集中的商品，再核查对应展示、讲解和商品链接。':'按商品对比曝光与点击，复盘有效的商品呈现和讲解方式。');
   addAction(down('clickRate')?'调整后看点击是否回升':'持续观察点击后的支付',down('clickRate')?'分批调整商品呈现或讲解，比较同口径点击率，同时观察支付转化率。':'保留有效的点击承接方式，同时观察支付转化率与订单数。');
  }else if(focus==='payRate'||!focus&&fieldKey==='shelf'&&down('payRate')){
   brief.reason=`支付转化率${movement(get('payRate')?.change)}，${down('payRate')?'需优先核查点击后到支付的承接':'当前点击后的支付承接有所改善'}。`;
   brief.uncertainty='价格、优惠、库存和详情是否造成流失，需商品与下单明细验证。';
   addAction('先查有点击但支付减少的商品','优先核对这些商品的可售库存、到手价、优惠和详情信息。');
   addAction('验证支付承接是否改善','调整后比较相同流量来源的支付转化率与订单数。');
  }else if(!focus&&fieldKey==='video'&&down('plays')&&finite(perVideoChange)){
   brief.reason=`视频发布数${movement(get('videos')?.change)}，每条视频平均播放${ratioMovement(perVideoChange)}；${perVideoChange>=0?'播放回落主要伴随内容供给减少':down('videos')?'内容供给与单条表现均需关注':'优先关注单条内容的触达'}。`;
   brief.uncertainty='平均播放由总播放量÷发布数计算；流量来源及内容原因仍需单条明细验证。';
   addAction('先检查内容供给与排期','对照发布排期和带货视频数量，查看减少的内容集中在哪些商品或题材。');
   addAction('复盘单条内容的触达','对比同类视频的播放和商品点击，沿用表现有效的选题与呈现方式。');
  }else if(!focus&&fieldKey==='creator'&&down('creators')&&finite(perCreatorChange)){
   brief.reason=`有成交达人数${movement(get('creators')?.change)}，每位成交达人的平均成交额${ratioMovement(perCreatorChange)}；优先检查有效合作覆盖。`;
   brief.uncertainty='均值由成交额÷有成交达人数计算；具体流失达人及原因需合作明细验证。';
   addAction('先核对未成交达人的合作进展','按达人查看带货排期、商品挂载和成交变化，定位覆盖减少的合作关系。');
   addAction('恢复有证据支持的有效合作','复盘有成交达人的商品匹配和内容安排，再检查订单是否回升。');
  }else if((!focus||['gmv','orders','buyers'].includes(focus))&&down('orders')&&finite(orderValueChange)){
   brief.reason=`成交额＝订单数×每单金额。订单减少${percent(orders.change)}，每单金额${ratioMovement(orderValueChange)}；${down('gmv')?orderValueChange>=0?'成交回落主要体现为订单量收缩':'订单量与每单金额均需关注':'每单金额的增长支撑了本期成交'}。`;
   brief.uncertainty='订单减少是流量、商品还是活动变化所致，还需来源与商品明细验证。';
   if(topGap)addAction(`先分析${topName}`,`${topName}占全店目标缺口${finite(share)?share.toFixed(1)+'%':'较大部分'}，先拆解该场域的曝光、点击和支付表现。`);
   addAction('定位订单减少最集中的商品','按商品对比支付人数与订单数，检查重点商品的库存、到手价和优惠，再观察订单是否回升。');
  }else{
   const metric=get(focus)||[...collected.values()].find(m=>finite(m.change)&&m.change<0);
   brief.reason=focus==='newBuyerRate'?'新客占比描述用户结构，需与支付人数、成交金额一起判断。':metric?`${metric.label}${movement(metric.change)}，现有汇总数据可以定位变化环节。`:'现有可用指标未给出需要优先处理的异常证据。';
   brief.uncertainty='具体经营原因尚未确认，需同口径的来源、商品或用户明细进一步验证。';
   addAction(focus==='newBuyerRate'?'分别查看新老客规模':'先定位变化集中的对象',focus==='newBuyerRate'?'同时比较新客人数、老客人数和成交金额，判断是结构变化还是用户规模下降。':'按流量来源、商品或合作对象对比变化，找出下降最集中的环节。');
   if(relevant.length)addAction('针对已定位的问题调整','结合实际经营记录检查对应商品或内容，调整后复看同口径指标。');
  }
 }
 const priority=focus?[focus,...({clickRate:['exposure','payRate'],payRate:['orders','gmv'],newBuyerRate:['buyers','gmv']}[focus]||['gmv','orders'])]:fieldKey==='overview'?['gmv','orders','buyers']:({live:['gmv','clickRate','exposure','payRate'],video:['gmv','plays','videos','clickRate'],shelf:['gmv','payRate','exposure','orders'],creator:['gmv','creators','orders','activeRate']}[fieldKey]||['gmv','orders','buyers']);
 brief.metrics=[...new Set(priority)].map(get).filter(m=>finite(m?.value)).slice(0,4).map(m=>({key:m.key,label:m.label,value:m.display,comparison:m.comparison,change:m.change}));
 if(valid&&topGap)brief.followUp={label:`继续分析${topName}`,question:`帮我分析${period}${topName}的经营表现，先指出问题，再解释依据和优先行动`};
 else if(valid&&focus)brief.followUp={label:`查看${scene}整体表现`,question:`帮我分析${period}${scene}的经营表现`};
 const chartMetric=focus||({overview:'orders',live:'clickRate',video:'plays',shelf:'payRate',creator:'creators'}[fieldKey]||'gmv');
 const chart=(field,metric,label)=>({kind:'data',label,href:`#merchant/dashboard/${field}/${context.period==='day'?'day':'week'}/${metric}`});
 const advice=fieldKey==='overview'&&!focus?actions.find(a=>/商品/.test(a.title))||actions[0]:actions[0];
 const actionLabel={clickRate:'检查商品展示与讲解',payRate:'检查库存与到手价',newBuyerRate:'检查新老客经营',plays:'调整内容发布安排',videos:'调整内容发布安排',creators:'检查达人合作安排'}[focus||chartMetric]||'检查重点商品';
 const firstActions=[chart(fieldKey,chartMetric,valid?`查看${labels[chartMetric]||'经营数据'}趋势`:'查看经营数据')];
 if(valid&&advice)firstActions.push({kind:'advice',label:actionLabel,title:advice.title,detail:fieldKey==='overview'&&!focus?advice.detail:actions.map(a=>a.detail).join('\n')});
 const relatedIds=new Set(relevant.flatMap(d=>d.actionIds||[]));
 const configured=(result.actions||[]).find(a=>(relatedIds.has(a.id)||(a.metricIds||[]).some(id=>brief.metrics.some(m=>id===`${fieldKey}-${m.key}-value`||id===`${fieldKey}-${m.key}-change`)))&&(merchantBriefURL(a.pcLink)||merchantBriefURL(a.mobileLink)));
 if(valid&&configured)firstActions.splice(1,1,{kind:'external',label:configured.name||actionLabel,pcLink:merchantBriefURL(configured.pcLink),mobileLink:merchantBriefURL(configured.mobileLink)});
 brief.version=2;
 brief.issues=[{title:valid?problems[0]?.title||'本期经营表现':'诊断资料待补齐',metrics:brief.metrics,reason:brief.reason,uncertainty:brief.uncertainty,actions:firstActions}];
 if(valid&&topGap&&!focus){
  const gapMetrics=[['actual','支付金额'],['target','目标金额'],['gap','目标缺口']].filter(([key])=>finite(topGap[key])).map(([key,label])=>({key,label,value:number(topGap[key])+'元',comparison:'',change:null}));
  brief.issues.push({title:`${topName}目标缺口最大`,metrics:gapMetrics,reason:`${topName}目标缺口${number(topGap.gap)}元${finite(share)?`，占全店缺口${share.toFixed(1)}%`:''}，应优先拆解这个场域的经营环节。`,uncertainty:'缺口用于确定排查优先级，具体原因需继续查看该场域的曝光、点击和支付表现。',actions:[{kind:'diagnose',label:`分析${topName}问题`,question:brief.followUp.question},chart(topGap.fieldKey,'gmv',`查看${topName}数据`)]});
 }
 brief.text=[merchantScopeInfo(result,question).text,`${brief.verdict}${goalText?'。'+goalText:''}`,...brief.issues.map((issue,i)=>`问题${i+1}：${issue.title}\n关联指标：${issue.metrics.map(m=>`${m.label}${m.value}${m.comparison?'，'+m.comparison:''}`).join('；')}\n原因判断：${issue.reason} ${issue.uncertainty}\n行动建议：${issue.actions.map(a=>`${a.label}${a.detail?'：'+a.detail:''}`).join('；')}`)].join('\n\n');
 return brief;
}

function merchantBriefURL(value){try{const url=new URL(String(value||'').trim());return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}}
function merchantBriefActionHTML(action){
 const label=`${esc(action.label)} ${icon('arrow')}`,cls='merchant-issue-action';
 if(action.kind==='data')return `<a class="${cls} secondary" href="${esc(action.href)}">${label}</a>`;
 if(action.kind==='diagnose')return `<button type="button" class="${cls}" data-chat-question="${esc(action.question)}">${label}</button>`;
 if(action.kind==='external'){
  const link=(href,extra='')=>`<a class="${cls} ${extra}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  return action.pcLink&&action.mobileLink&&action.pcLink!==action.mobileLink?link(action.pcLink,'action-link-pc')+link(action.mobileLink,'action-link-mobile'):link(action.pcLink||action.mobileLink);
 }
 return `<button type="button" class="${cls}" data-action-suggestion="${esc(action.title||action.label)}" data-action-advice="${esc(action.detail||'')}" title="${esc(action.detail||'')}">${label}</button>`;
}
function merchantIssueListHTML(items,type='1'){
 return `<ol class="merchant-issue-list" type="${type}">${items.map(item=>`<li><strong>${esc(item.label)}</strong><span>${esc(item.text)}</span></li>`).join('')}</ol>`;
}
function merchantQueueHTML(brief,options){
 const q=brief.queue;if(!q?.total)return '';
 const count=q.active.filter(r=>r.handled).length,history=q.handledIds.filter(id=>!q.active.some(r=>r.id===id));
 const next=q.remaining&&options.exchangeId?`<button type="button" class="merchant-issue-action" data-issue-progress="next" data-exchange-id="${esc(options.exchangeId)}" ${q.canNext?'':'disabled'}>查看下一批（最多3项） ${icon('arrow')}</button>`:'';
 const done=history.length?`<details class="merchant-handled-history"><summary>已处理记录（${history.length}项，待复核）</summary><ul>${history.map(id=>`<li>${esc(brief.ranked.find(r=>r.id===id)?.finding.name||'已处理问题')}</li>`).join('')}</ul></details>`:'';
 return `<footer class="merchant-issue-queue"><p role="status">本批已处理 ${count}/${q.active.length} 项${q.remaining?`；后续 ${q.remaining} 项待本批处理后展示。`:'；本批为最后一批。'}</p>${next}<p class="merchant-queue-note">处理标记由商家确认，经营效果仍需同口径数据复核。</p>${done}</footer>`;
}
function merchantBriefHTML(result,question='',isCoze=true,options={}){
 if(typeof isGoalQuestion==='function'&&isGoalQuestion(question))return merchantGoalHTML(result,question,isCoze);
 const brief=buildMerchantBrief(result,question,options);
 const issues=brief.issues.map((issue,i)=>{
  const reasons=issue.reasonItems?merchantIssueListHTML(issue.reasonItems):`<p>${esc(issue.reason)}</p><p class="merchant-brief-uncertainty">${esc(issue.uncertainty)}</p>`;
  const steps=issue.actionItems?merchantIssueListHTML(issue.actionItems,'a'):issue.actionSummary?`<p>${esc(issue.actionSummary)}</p>`:'';
  const evidence=issue.analysis?`<details class="merchant-issue-evidence"><summary>查看完整依据与计算</summary><ul>${issue.analysis.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul><p>${esc(issue.uncertainty)}</p>${issue.modelNote?`<p>${esc(issue.modelNote)}</p>`:''}</details>`:'';
  const progress=brief.queue&&options.exchangeId?`<div class="merchant-issue-progress"><span>${issue.handled?'已处理 · 待复核':'待处理'}</span><button type="button" class="merchant-issue-action secondary" aria-pressed="${!!issue.handled}" data-issue-progress="toggle" data-exchange-id="${esc(options.exchangeId)}" data-issue-id="${esc(issue.id)}">${issue.handled?'撤销已处理标记':'标记已处理'}</button></div>`:'';
  return `<section class="merchant-issue${issue.handled?' is-handled':''}" aria-label="问题${i+1}：${esc(issue.title)}"><header class="merchant-issue-heading"><span>问题 ${i+1}</span><h4>${esc(issue.title)}</h4></header>${issue.priorityReason?`<p class="merchant-priority-reason">优先依据：${esc(issue.priorityReason)}</p>`:''}<div class="merchant-issue-block"><h5>关联指标</h5>${issue.metrics.length?`<div class="merchant-brief-metrics" data-count="${issue.metrics.length}">${issue.metrics.map(m=>`<div><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong>${m.comparison?`<small class="${m.tone||(m.change<0?'down':m.change>0?'up':'')}">${esc(m.comparison)}</small>`:''}</div>`).join('')}</div>`:'<p>当前缺少足够指标。</p>'}</div><div class="merchant-issue-block"><h5>原因判断</h5>${reasons}${evidence}</div><div class="merchant-issue-block"><h5>行动建议</h5>${steps}<div class="merchant-issue-actions">${issue.actions.map(merchantBriefActionHTML).join('')}</div></div>${progress}</section>`;
 }).join('');
 const evidence=(result.evidence||[]).map(m=>`<div><span>${esc(m.label||m.metricId)}</span><strong>${typeof m.value==='number'&&Number.isFinite(m.value)?esc(m.value.toLocaleString('zh-CN',{maximumFractionDigits:2}))+esc(m.unit||''):'未提供'}</strong></div>`).join('');
 const missing=(result.missing||[]).filter(x=>!String(x).includes('当前为演示数据与演示阈值'));
 const details=`<details class="merchant-brief-details"><summary>查看完整诊断依据${missing.length?'与缺失信息':''}</summary>${evidence?`<div class="coze-evidence">${evidence}</div>`:''}${missing.map(x=>`<p>${esc(x)}</p>`).join('')}</details>`;
 return `<article class="merchant-brief"><div class="answer-label">${icon('spark')}${isCoze?'经营诊断':'经营分析'}${brief.demo?' · 演示数据':''}</div>${merchantScopeHTML(result,question)}${brief.queue?.total?'':`<div class="merchant-brief-summary"><p class="merchant-brief-verdict ${brief.tone}">${esc(brief.verdict)}</p>${!brief.queue&&brief.goalText?`<p class="merchant-brief-goal">${esc(brief.goalText)}</p>`:''}</div>`}<div class="merchant-issues">${issues}</div>${merchantQueueHTML(brief,options)}${details}</article>`;
}

function merchantDemoResult(question,context,config){
 if(typeof curatedActive==='function'&&curatedActive())return curatedDemoResult(question,context,config);
 const snapshot=merchantLocalSnapshot(question,context),runtime=config.fieldConfigs?.[context.fieldKey]||snapshot.config;
 const rows=runtime?.active?aiddMerchantRows(context.fieldKey,context.period,runtime).filter(x=>x.warning):[];
 const metrics=snapshot.data.metrics.filter(m=>m.derived==='value').map(m=>({...m,metricId:m.id}));
 const result={schemaVersion:1,branch:'diagnosis',status:runtime?.active?'success':'missing_data',context,dataMode:'demo',metricAnalysis:metrics,evidence:metrics,goal:snapshot.data.goal,fieldBreakdown:snapshot.data.fieldBreakdown,diagnosis:rows.map(row=>({name:row.title,triggered:true,evidence:metrics.filter(m=>m.metricKey===row.metric)})),missing:runtime?.active?[]:[runtime?.inactiveReason||'当前场景没有已生效配置']};
 return result;
}
function merchantDemoBrief(question,context,config){return merchantBriefHTML(merchantDemoResult(question,context,config),question,false);}
