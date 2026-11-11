'use strict';

function fieldData(key=state.fieldKey){return MERCHANT_FIELDS[key]||MERCHANT_FIELDS.overview;}
function fieldMetrics(){return typeof curatedActive==='function'&&curatedActive()?curatedPresentationMetrics():fieldData().metrics;}
function periodName(period=state.period){return period==='week'?'近7天':'昨日';}
function compareName(period=state.period){return period==='week'?'前7天':'前一日';}
function periodRange(period=state.period){if(typeof curatedActive==='function'&&curatedActive())return period==='week'?'10.26—11.01':'11.01';return period==='week'?'10.14—10.20':'10.20';}
function metricValue(metric,value){if(!Number.isFinite(value))return '—';return metric.type==='money'?money(value):metric.type==='rate'?`${value.toFixed(2)}%`:value.toLocaleString('en-US');}
function metricChange(metric,period=state.period){const data=metric[period];return data.previousValue?(data.value/data.previousValue-1)*100:0;}
function formattedMetric(metric,value){return `${metric.type==='money'?'¥':''}${metricValue(metric,value)}${metric.type==='count'?` ${metric.unit}`:''}`;}
function comparisonText(metric,period){const change=metricChange(metric,period);return `${metric.label} ${formattedMetric(metric,metric[period].value)}，${Math.abs(change)<.05?`与${compareName(period)}持平`:`较${compareName(period)}${change>0?'上升':'下降'} ${Math.abs(change).toFixed(1)}%`}`;}
function goalData(fieldKey,period){const field=fieldData(fieldKey),actual=field.metrics.gmv[period].value,target=field.goal[period];return {actual,target,gap:Math.max(0,target-actual),rate:actual/target*100};}
function merchantQuestion(fieldKey=state.fieldKey,period=state.period,topic='经营表现'){return `帮我分析${periodName(period)}${fieldData(fieldKey).name}的${topic}`;}
function actionUrl(value){try{const url=new URL(String(value||'').trim());return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}}
function merchantBusinessTool(action){
 if(action.id?.startsWith('research-action-'))return action.name;
 if(action.toolName)return action.toolName;
 const name=action.suggestionTitle||action.executionName||action.name||'';
 if(/达人|合作|排期/.test(name))return '达人合作管理';
 if(/展示与讲解|直播画面|讲解/.test(name))return '直播复盘';
 if(/视频|内容发布|单条表现|选题/.test(name))return '短视频管理';
 if(/主图|标题|库存|商品详情|重点商品|商品成交|商品呈现/.test(name))return '商品管理';
 if(/流量渠道|开播|直播/.test(name))return '直播管理';
 if(/扶持|权益/.test(name))return '商家权益';
 return {live:'直播管理',video:'短视频管理',shelf:'商品管理',creator:'达人合作管理'}[action.fieldKey||state.fieldKey]||'营销工具';
}
function merchantBusinessTools(action){
 const explicit=action.toolNames?.length?action.toolNames:action.toolName?[action.toolName]:null;
 if(explicit)return [...new Set(explicit.filter(name=>typeof name==='string'&&name.trim()))];
 const primary=merchantBusinessTool(action),name=action.suggestionTitle||action.executionName||action.name||'';
 return /展示与讲解|直播画面|讲解/.test(name)?[primary,'商品管理']:[primary];
}
function merchantToolLink(name,buttonClass='btn',title=''){return `<button type="button" class="${buttonClass} merchant-action-btn merchant-tool-btn" data-business-tool="${esc(name)}" aria-label="经营工具：${esc(name)}"${title?` title="${esc(title)}"`:''}>${icon('bag')}<span>${esc(name)}</span>${icon('arrow')}</button>`;}
function actionDestination(action,buttonClass='text-btn',seen=new Set()){
 const pc=actionUrl(action.pcLink),mobile=actionUrl(action.mobileLink),advice=action.recommendation||action.subtitle||action.description||action.executionName||action.name||'';
 return merchantBusinessTools(action).filter(tool=>{const key=`${tool}|${pc}|${mobile}`;if(seen.has(key))return false;seen.add(key);return true;}).map(tool=>{
  const link=(url,extra='')=>`<a class="${buttonClass} merchant-action-btn merchant-tool-btn action-link ${extra}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(advice)}">${icon('bag')}<span>${esc(tool)}</span>${icon('arrow')}</a>`;
  return pc&&mobile&&pc!==mobile?link(pc,'action-link-pc')+link(mobile,'action-link-mobile'):pc||mobile?link(pc||mobile):merchantToolLink(tool,buttonClass,advice);
 }).join('');
}
function merchantActionLinks(issue,buttonClass='text-btn'){
 if(issue.hasAction===false)return '';
 const actions=issue.actions?.length?issue.actions:[{name:issue.action,description:issue.advice,pcLink:issue.pcLink,mobileLink:issue.mobileLink}];
 const seen=new Set();
 return `<div class="merchant-action-links">${actions.map(action=>actionDestination({...action,fieldKey:action.fieldKey||issue.fieldKey},buttonClass,seen)).join('')}</div>`;
}


function showActionSuggestion(title,advice,tool){modal(esc(title),'优化建议',`<div class="action-suggestion-content"><span>${icon('target')}</span><div><h3>建议这样优化</h3><p>${esc(advice)}</p>${tool?`<div class="action-suggestion-tool"><span>经营工具</span>${merchantToolLink(tool)}</div>`:''}</div></div>`,`<button class="btn primary" data-action="close-modal">知道了</button>`);}
function changePhrase(metric,period=state.period){const change=metricChange(metric,period);return Math.abs(change)<.05?'环比持平':`环比${change>0?'增长':'下降'} ${Math.abs(change).toFixed(1)}%`;}
function merchantPulse(fieldKey=state.fieldKey,period=state.period){
 const field=fieldData(fieldKey),m=field.metrics,goal=goalData(fieldKey,period),trafficKey=fieldKey==='video'?'plays':'exposure',traffic=m[trafficKey],click=m.clickRate,pay=m.payRate,buyers=m.buyers,newRate=m.newBuyerRate;
 const g=metricChange(m.gmv,period),t=metricChange(traffic,period),c=click?metricChange(click,period):null,p=metricChange(pay,period),u=metricChange(buyers,period),pointChange=newRate[period].value-newRate[period].previousValue;
 const conversionKey=click&&c<p?'clickRate':'payRate',conversion=m[conversionKey];
 const direction=(value,down,up)=>Math.abs(value)<.05?'本周期总体持平':value<0?down:up;
 const trafficNote=Math.abs(t)<.05?'流量规模总体持平，继续对照转化效率与成交表现。':t<0?(g<-.05?'流量与成交同向回落，优先定位流量变化来源。':g>.05?'流量回落但成交提升，继续对照转化效率变化。':'流量回落而成交持平，继续对照转化效率变化。'):(g<-.05?'流量提升而成交回落，需要继续定位转化短板。':g>.05?'流量与成交同步提升，继续观察增长质量。':'流量提升而成交持平，继续对照转化表现。');
 const conversionHeadline=click?(c<-.05&&p<-.05?'点击与支付效率均回落':c>.05&&p>.05?'点击与支付效率提升':c<-.05?`点击走弱，支付承接${p>.05?'提升':'稳定'}`:p<-.05?`点击${c>.05?'改善':'稳定'}，支付承接走弱`:c>.05?'点击提升，支付承接稳定':p>.05?'点击稳定，支付承接提升':'转化效率总体持平'):direction(p,'点击支付效率回落','点击支付效率提升');
 return [
 {topic:'trade',title:`${field.name}成交`,icon:'bag',metricKey:'gmv',tone:g<0?'down':'up',headline:direction(g,'成交规模回落','成交规模提升'),evidence:`${formattedMetric(m.gmv,m.gmv[period].value)} · ${changePhrase(m.gmv,period)}`,note:`目标完成 ${goal.rate.toFixed(1)}%，支付订单 ${metricValue(m.orders,m.orders[period].value)} 单。`},
 {topic:'traffic',title:`${field.name}流量`,icon:'chart',metricKey:trafficKey,tone:t<0?'down':'up',headline:direction(t,'流量规模回落','流量规模提升'),evidence:`${traffic.label} ${formattedMetric(traffic,traffic[period].value)}`,note:`${changePhrase(traffic,period)}。${trafficNote}`},
 {topic:'conversion',title:`${field.name}转化`,icon:'target',metricKey:conversionKey,tone:metricChange(conversion,period)<0?'down':'up',headline:conversionHeadline,evidence:`${conversion.label} ${formattedMetric(conversion,conversion[period].value)}`,note:click?`${click.label}${changePhrase(click,period)}；支付转化${changePhrase(pay,period)}。`:`支付转化${changePhrase(pay,period)}，优先对照达人与商品的成交承接。`},
 {topic:'users',title:`${field.name}用户`,icon:'users',metricKey:'buyers',tone:u<0?'down':'up',headline:direction(u,'支付用户减少','支付用户增加'),evidence:`支付人数 ${formattedMetric(buyers,buyers[period].value)} · ${changePhrase(buyers,period)}`,note:`新客支付占比 ${newRate[period].value.toFixed(1)}%，较${compareName(period)}${Math.abs(pointChange)<.05?'基本持平':`${pointChange>0?'提升':'下降'} ${Math.abs(pointChange).toFixed(1)} 个百分点`}。`}
 ];
}
function merchantPriorityIssue(){const rows=fieldDiagnoses();return rows.find(row=>row.warning)||rows[0]||metricDiagnosis(state.fieldKey,'gmv');}
function merchantSummaryAction(issue){
 return merchantActionLinks(issue,'btn');
}
function merchantBusinessSummary(){
 if(typeof curatedActive==='function'&&curatedActive())return curatedSummary();
 // A missing diagnostic configuration does not mean the dashboard has no data.
 // Summarize the same values as the metric cards; use AIDD only to refine an action.
 const context={fieldKey:state.fieldKey,period:state.period},field=fieldData();
 const metrics=Object.entries(field.metrics).flatMap(([key,source])=>{
  const data=source[state.period];
  return Number.isFinite(data?.value)?[{key,label:source.label,source,value:data.value,change:Number.isFinite(data.previousValue)&&data.previousValue>0?(data.value/data.previousValue-1)*100:null}]:[];
 });
 const primaryKey={overview:'orders',live:'clickRate',video:'plays',shelf:'payRate',creator:'creators'}[state.fieldKey];
 const preferred=metrics.find(m=>m.key===primaryKey&&Number.isFinite(m.change)&&m.change<-.05),metric=preferred||metrics.find(m=>!['gmv','newBuyerRate'].includes(m.key)&&Number.isFinite(m.change)&&m.change<-.05),gmv=metrics.find(m=>m.key==='gmv');
 const shortLabels={orders:'订单量',clickRate:'商品点击率',plays:'视频播放量',payRate:'支付转化率',creators:'有成交达人数'},selected=metric||gmv||metrics[0];
 let action={kind:'data',label:metric?`查看${shortLabels[metric.key]||metric.label}变化`:'查看经营数据',href:`#merchant/dashboard/${state.fieldKey}/${state.period}/${selected?.key||'gmv'}`};
 let copy='当前周期暂无可用经营数据，暂无法生成小结。';
 if(selected){
  const lead=gmv||selected,hasComparison=Number.isFinite(lead.change);
  if(hasComparison)copy=`${esc(field.name)}${gmv?'成交':esc(lead.label)}<strong>${Math.abs(lead.change)<.05?'环比持平':`${lead.change<0?'下降':'增长'}${Math.abs(lead.change).toFixed(1)}%`}</strong>`;
  else copy=`${esc(field.name)}${esc(lead.label)}<strong>${esc(formattedMetric(lead.source,lead.value))}</strong>，暂无同口径对比数据`;
  if(gmv&&metric)copy+=`，${Number.isFinite(gmv.change)&&gmv.change<-.05?'主要表现为':Number.isFinite(gmv.change)?'但':''}<strong>${esc(shortLabels[metric.key]||metric.label)}下降${Math.abs(metric.change).toFixed(1)}%</strong>`;
  if(metric&&aiddRuntimeConfig(state.fieldKey,state.period)?.active){
   const question=merchantQuestion(),result=merchantDemoResult(question,context,aiddRequestConfig(context));
   if(['success','partial'].includes(result.status)){
    const issue=buildMerchantBrief(result,question).issues[0];
    action=issue?.actions.find(a=>a.kind!=='data')||issue?.actions[0]||action;
   }
  }
  copy+=`，建议${esc(metric?action.label:hasComparison?'继续关注经营表现':'查看经营数据')}。`;
 }
 return `<section class="card merchant-summary" aria-labelledby="business-summary-title"><div class="merchant-summary-copy"><h3 id="business-summary-title">${icon('spark')}${periodName()}经营小结</h3><p>${copy}</p></div><div class="merchant-summary-actions">${action?merchantBriefActionHTML(action):''}<button class="btn ai-entry" data-action="open-assistant">${icon('spark')} 问问智能助手 ${icon('arrow')}</button></div></section>`;
}
function questionMetric(question,metrics){
 const aliases={gmv:/支付金额|成交金额|成交额|GMV|卖了多少钱/i,orders:/订单|几单|多少单/,newBuyerRate:/新客|新买家/,buyers:/支付人数|支付用户|买家|用户|多少人/,plays:/播放/,exposure:/曝光|流量/,clickRate:/点击率/,payRate:/支付转化|成交转化|转化率/,creators:/达人数|几个达人|多少达人/,videos:/视频数|几条视频|发布数量/,activeRate:/合作达人成交率/};
 return Object.entries(metrics).find(([,metric])=>question.includes(metric.label))||Object.entries(aliases).map(([key,re])=>[key,metrics[key],re]).filter(([,metric,re])=>metric&&re.test(question)).map(([key,metric])=>[key,metric])[0];
}
function metricDiagnosis(fieldKey,metricKey,period=state.period,config=state.published){
 if(typeof dashboardRuleMetricIssue==='function'&&curatedActive())return dashboardRuleMetricIssue(metricKey,fieldKey,period);
 if(typeof curatedActive==='function'&&curatedActive())return curatedMetricIssue(metricKey,fieldKey,period);
 const field=fieldData(fieldKey),metric=field.metrics[metricKey],configured=fieldDiagnoses(fieldKey,period,config).find(issue=>issue.fieldKey===fieldKey&&issue.metric===metricKey);
 if(configured)return configured;
 const actions={gmv:'优化成交承接',exposure:'优化流量来源',plays:'优化内容发布与播放表现',clickRate:'优化商品展示与点击',payRate:'优化商品支付承接',buyers:'优化支付用户结构',newBuyerRate:'优化新客承接',orders:'优化订单转化',creators:'优化达人合作覆盖',videos:'优化内容供给',activeRate:'优化达人成交覆盖'};
 return {metric:metricKey,fieldKey,warning:metricChange(metric,period)<0,title:`${metric.label}${Math.abs(metricChange(metric,period))<.05?'总体持平':metricChange(metric,period)<0?'出现回落':'有所提升'}`,evidence:comparisonText(metric,period),action:actions[metricKey]||'查看优化建议',advice:field.hints[metricKey]||'结合当前指标与实际经营记录，继续定位可改善环节。'};
}
function fieldDiagnoses(fieldKey=state.fieldKey,period=state.period,config=state.published){
 const configured=config.fieldConfigs&&Object.hasOwn(config.fieldConfigs,fieldKey)?config.fieldConfigs[fieldKey]:aiddRuntimeConfig(fieldKey,period);
 if(configured)return aiddMerchantRows(fieldKey,period,configured);
 if(fieldKey==='overview'){
  const all=FIELD_KEYS.flatMap(key=>fieldDiagnoses(key,period,config));
  const ranked=all.slice().sort((a,b)=>(Number(b.warning)-Number(a.warning))||(goalData(b.fieldKey,period).gap-goalData(a.fieldKey,period).gap));
  const selected=[];for(const row of ranked){if(!selected.some(x=>x.fieldKey===row.fieldKey))selected.push(row);if(selected.length===2)break;}return selected;
 }
 const field=fieldData(fieldKey);
 const rows=field.issues.map(issue=>{const metric=field.metrics[issue.metric],warning=metricChange(metric,period)<=issue.threshold;return {...issue,fieldKey,warning,title:warning?issue.title:issue.steady,evidence:comparisonText(metric,period)};});
 // The existing AIDD editor governs the live / seven-day scene only.
 if(fieldKey==='live'&&period==='week'){
  const keys={click_drop:'clickRate',exposure_drop:'exposure',payment_drop:'payRate'};
  const hits=evaluate(config,SAMPLE.normal).filter(x=>x.hit);
  const liveRows=hits.map(hit=>{
   const key=keys[hit.strategy.metric],base=field.issues.find(x=>x.metric===key)||{metric:key,action:'检查流量渠道与开播安排',advice:field.hints.exposure};
   const actionInfo=field.issues.find(x=>x.action===hit.strategy.action)||(hit.strategy.action==='检查流量渠道与开播安排'?{advice:field.hints.exposure}:hit.strategy.action==='完善商品主图与标题'?{advice:'检查商品主图、标题和详情是否准确、一致。'}:base);
   return {...base,advice:actionInfo.advice,fieldKey,warning:true,title:hit.strategy.name,action:hit.strategy.action,evidence:comparisonText(field.metrics[key],period)};
  });
  const rest=rows.filter(row=>!liveRows.some(x=>x.metric===row.metric)).map(row=>({...row,warning:false,title:row.steady}));
  return [...liveRows,...rest].slice(0,Math.max(2,liveRows.length));
 }
 return rows;
}

function merchantPeriodSelector(){return `<div class="period">${icon('clock')}<select id="merchant-period" aria-label="统计周期"><option value="week" ${state.period==='week'?'selected':''}>近7天</option><option value="day" ${state.period==='day'?'selected':''}>昨日</option></select><span class="period-date">${periodRange()}</span></div>`;}
function merchantFieldTabs(){return `<div class="field-bar"><nav class="field-tabs" role="tablist" aria-label="经营场域">${Object.entries(MERCHANT_FIELDS).map(([key,field])=>`<button id="field-tab-${key}" role="tab" aria-selected="${state.fieldKey===key}" aria-controls="field-panel" tabindex="${state.fieldKey===key?0:-1}" data-field="${key}" class="field-tab ${state.fieldKey===key?'active':''}">${icon(field.icon)}${key==='overview'?'全店总览':field.name}</button>`).join('')}</nav>${state.merchantScreen==='dashboard'?'':merchantPeriodSelector()}</div>`;}
function merchantCampaign(){return `<section class="merchant-campaign" aria-label="双11购物节活动"><div class="campaign-copy"><h1><span>双11</span>购物节</h1><p>活动期 10.14—11.15</p></div><a class="campaign-detail-link" href="#merchant/dashboard/${state.fieldKey}/${state.period}" aria-label="数据详情"><span>数据详情</span></a></section>`;}
function merchantCoreMetricKeys(){if(typeof curatedActive==='function'&&curatedActive())return curatedCoreMetricIds();return {overview:['gmv','exposure','clickRate'],live:['gmv','exposure','clickRate'],video:['gmv','plays','clickRate'],shelf:['gmv','exposure','payRate'],creator:['gmv','creators','orders']}[state.fieldKey];}
function merchantHash(){return state.merchantScreen==='dashboard'?`#merchant/dashboard/${state.fieldKey}/${state.period}/${state.metricKey}`:'#merchant';}
function syncMerchantRoute(){if(state.merchantScreen==='dashboard')history.replaceState(null,'',merchantHash());}
function selectField(key,scroll=false){if(!Object.hasOwn(MERCHANT_FIELDS,key))return;state.fieldKey=key;state.metricKey=typeof curatedActive==='function'&&curatedActive()?curatedCoreMetricIds(key)[0]:'gmv';syncMerchantRoute();render();if(scroll)$('.field-bar').scrollIntoView({block:'start',behavior:'smooth'});}
function merchantMetricCards(dashboard=false){
 const metrics=fieldMetrics(),keys=dashboard?Object.keys(metrics):merchantCoreMetricKeys();
 return keys.map(key=>{
  const metric=metrics[key],selected=key===state.metricKey,change=metricChange(metric),title=`${metric.label}${metric.type==='money'?'（元）':metric.type==='count'?`（${metric.unit}）`:''}`;
  const figures=`<span class="core-metric-label">${esc(title)}</span><span class="core-metric-value">${metric.type==='money'?'<small>¥</small>':''}${metricValue(metric,metric[state.period].value)}</span><span class="core-metric-change"><span>较${compareName()}</span><b class="metric-change ${change>=0?'up':'down'}">${Math.abs(change)<.05?'→':change>0?'↑':'↓'} ${Math.abs(change).toFixed(1)}%</b></span>`;
  if(dashboard)return `<button class="card dashboard-metric ${selected?'selected':''}" data-metric-key="${key}" aria-pressed="${selected}" aria-label="${metric.label}，查看趋势">${figures}</button>`;
  return `<article class="card core-metric ${selected?'selected':''}" data-metric-card="${key}" aria-label="${metric.label}指标"><button class="core-metric-select" data-metric-key="${key}" aria-pressed="${selected}" aria-label="${metric.label}，查看趋势">${figures}</button></article>`;
 }).join('');
}
function chartAxisValue(metric,value){if(metric.type==='rate')return `${value.toFixed(value?1:0)}%`;if(value>=10000)return `${parseFloat((value/10000).toFixed(1))}万`;return Math.round(value).toLocaleString('en-US');}
function merchantChart(width=640,height=164){
 width=Math.max(200,Math.round(width));height=Math.max(72,Math.round(height));
 const metric=fieldMetrics()[state.metricKey],data=metric[state.period],rawStep=Math.max(...data.current,...data.previous)*1.12/3||1,magnitude=10**Math.floor(Math.log10(rawStep)),step=([1,1.5,2,2.5,3,4,5,6,8,10].find(n=>n*magnitude>=rawStep)||10)*magnitude,maximum=step*3;
 const left=50,right=width-18,top=height<96?10:14,bottom=height-(height<96?22:29),x=i=>left+i*(right-left)/6,y=v=>bottom-v/maximum*(bottom-top),path=values=>values.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
 const labels=state.period==='week'?(typeof curatedActive==='function'&&curatedActive()?['10/26','10/27','10/28','10/29','10/30','10/31','11/1']:['10/14','10/15','10/16','10/17','10/18','10/19','10/20']):['08时','10时','12时','14时','16时','18时','20时'];
 return `<svg class="mini-trend" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" data-chart-width="${width}" data-chart-height="${height}" data-series-key="${state.fieldKey}/${state.period}/${state.metricKey}" role="img" aria-label="${fieldData().name}${periodName()}${metric.label}趋势，本周期与上周期对比"><defs><linearGradient id="merchant-trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#f18b65" stop-opacity=".12"/><stop offset="100%" stop-color="#f18b65" stop-opacity="0"/></linearGradient></defs>${[0,1,2,3].map(i=>{const value=maximum*i/3,axisY=y(value);return `<path d="M${left} ${axisY}H${right}" fill="none" stroke="#e9edf2" stroke-dasharray="3 4"/><text x="${left-10}" y="${axisY+3}" text-anchor="end">${chartAxisValue(metric,value)}</text>`;}).join('')}<path d="${path(data.current)} L${right},${bottom} L${left},${bottom}Z" fill="url(#merchant-trend-fill)" stroke="none"/><path d="${path(data.previous)}" fill="none" stroke="#c4cdd9" stroke-width="1.8" stroke-dasharray="4 4"/><path d="${path(data.current)}" fill="none" stroke="#f18b65" stroke-width="2.2" stroke-linejoin="round"/>${data.current.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="2.8" fill="white" stroke="#f18b65" stroke-width="1.6"><title>${labels[i]} ${formattedMetric(metric,v)}</title></circle>`).join('')}${labels.map((label,i)=>`<text x="${x(i)}" y="${height-8}" text-anchor="middle">${label}</text>`).join('')}</svg>`;
}
let merchantChartObserver;
function syncMerchantChart(){
 const chart=$('#metric-trend .chart');if(!chart)return;
 const style=getComputedStyle(chart),width=Math.round(chart.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)),height=Math.round(chart.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom));
 if(width<200||height<72)return;
 const svg=$('svg',chart),key=`${state.fieldKey}/${state.period}/${state.metricKey}`;
 if(svg?.dataset.chartWidth===String(width)&&svg.dataset.chartHeight===String(height)&&svg.dataset.seriesKey===key)return;
 chart.innerHTML=merchantChart(width,height);
}
function watchMerchantChart(){
 merchantChartObserver?.disconnect();const chart=$('#metric-trend .chart');if(!chart)return;
 syncMerchantChart();if(typeof ResizeObserver==='function'){merchantChartObserver??=new ResizeObserver(syncMerchantChart);merchantChartObserver.observe(chart);}
}
window.addEventListener('resize',syncMerchantChart);
function merchantTrend(){const metric=fieldMetrics()[state.metricKey],data=metric[state.period],change=metricChange(metric);return `<div class="card-head"><h2 id="trend-title">${metric.label}趋势</h2><div class="chart-tools"><span class="legend"><i></i>${periodName()}</span><span class="legend gray"><i></i>${compareName()}</span></div></div><div class="chart">${merchantChart()}</div><div class="trend-summary"><span>${periodName()} <strong>${formattedMetric(metric,data.value)}</strong></span><span class="metric-change ${change>=0?'up':'down'}">${Math.abs(change)<.05?'环比持平':`环比${change>0?'上升':'下降'} ${Math.abs(change).toFixed(1)}%`}</span></div>`;}
function selectMetric(key){if(!Object.hasOwn(fieldMetrics(),key))return;state.metricKey=key;syncMerchantRoute();$$('[data-metric-key]').forEach(b=>{const selected=b.dataset.metricKey===key;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));b.closest('[data-metric-card]')?.classList.toggle('selected',selected);});$('#metric-trend').innerHTML=merchantTrend();watchMerchantChart();}

function merchantGoalFields(period=state.period){
 const amount=value=>Number.isFinite(value)?(Math.abs(value)>=10000?(value/10000).toLocaleString('zh-CN',{maximumFractionDigits:2})+'万':value.toLocaleString('zh-CN',{maximumFractionDigits:2})):'—';
 return `<div class="goal-field-breakdown"><div class="goal-field-heading"><h4>分场域目标达成</h4><span>达成率 · 已完成 / 目标（元）</span></div><div class="goal-field-list">${FIELD_KEYS.map(field=>{
  const goal=typeof curatedActive==='function'&&curatedActive()?curatedGoalData(field,period):goalData(field,period),name=fieldData(field).name,rate=goal?goal.rate.toFixed(1)+'%':'待补充';
  return `<button type="button" class="goal-field-row ${field===state.fieldKey?'is-current':''}" data-field="${field}" aria-label="${esc(name)}，目标完成${rate}，已完成${amount(goal?.actual)}元，目标${amount(goal?.target)}元，查看该场域"><span class="goal-field-name">${esc(name)}</span><span class="goal-field-progress" aria-hidden="true"><i style="width:${goal?Math.min(100,goal.rate):0}%"></i></span><strong>${rate}</strong><span class="goal-field-amounts">${amount(goal?.actual)} / ${amount(goal?.target)}</span></button>`;
 }).join('')}</div></div>`;
}
function goalDiagnosis(){
 if(typeof curatedActive==='function'&&curatedActive())return curatedGoalDiagnosis();
 const key=state.fieldKey,goal=goalData(key,state.period);
 return `<section class="goal-panel" aria-labelledby="goal-title"><div class="compact-goal-heading"><h3 id="goal-title">目标诊断</h3><button class="btn ai-entry goal-ask" data-ask-goal="${key}">分析目标差距 ${icon('arrow')}</button></div><div class="compact-goal-main"><div class="goal-rate">${goal.rate.toFixed(1)}<span>%</span></div><span>目标完成</span></div><div class="goal-progress" role="progressbar" aria-label="${fieldData().name}支付金额目标完成率" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,+goal.rate.toFixed(1))}"><span style="width:${Math.min(100,goal.rate)}%"></span></div><p class="compact-goal-gap">${goal.gap?`距目标还差 <strong>¥${money(goal.gap)}</strong>`:'本周期目标已达成'}</p>${merchantGoalFields()}</section>`;
}
function merchantDiagnosis(){if(typeof dashboardRuleDiagnosis==='function'&&curatedActive())return dashboardRuleDiagnosis();const diagnoses=fieldDiagnoses(),warnings=diagnoses.filter(x=>x.warning),rows=warnings.slice(0,2);return `<section class="card merchant-diagnosis compact-diagnosis" aria-labelledby="diagnosis-title"><div class="overview-head"><div class="section-title">${icon('spark')}<h2 id="diagnosis-title">经营诊断</h2></div>${pill(warnings.length?`${warnings.length}项待改善`:typeof curatedActive==='function'&&curatedActive()?'暂无命中条件':'暂无明显异常',warnings.length?'purple':'green')}</div><div class="diagnosis-body">${goalDiagnosis()}<div class="diagnosis-findings"><h3 class="findings-title">问题诊断</h3><div class="diagnosis-grid ${rows.length<2?'single-issue':''}">${rows.length?rows.map(issue=>`<article class="diagnosis-card"><div class="diagnosis-topline"><span class="diagnosis-scope">${fieldData(issue.fieldKey).name}</span></div><h3>${esc(issue.title)}</h3><p class="diagnosis-evidence">${esc(issue.evidence)}</p><div class="diagnosis-actions">${merchantActionLinks(issue,'btn')}<button class="text-btn ai-entry" data-diagnosis-question="${esc(merchantQuestion(issue.fieldKey,state.period,`${issue.title}，以及下一步应该怎么做`))}" data-context-field="${issue.fieldKey}">${icon('spark')} 问问智能助手</button></div></article>`).join(''):'<div class="diagnosis-clear"><span>'+icon('check')+'</span><div><p>'+esc(typeof curatedActive==='function'&&curatedActive()?diagnoses[0]?.title||'暂无可执行的诊断配置':'暂无需要优先改善的问题')+'</p><button class="text-btn ai-entry" data-action="open-assistant">问问智能助手 '+icon('arrow')+'</button></div></div>'}</div></div></div></section>`;}

function merchantDashboard(){return `<div class="merchant-dashboard"><div class="dashboard-heading"><h2>核心数据与更多指标</h2><span>${Object.keys(fieldMetrics()).length} 个指标</span></div><div class="dashboard-metric-grid" role="group" aria-label="${fieldData().name}全部经营指标">${merchantMetricCards(true)}</div><section class="card chart-card dashboard-chart" id="metric-trend" aria-labelledby="trend-title">${merchantTrend()}</section></div>`;}

function merchantView(){if(typeof curatedActive==='function'&&curatedActive()&&!Object.hasOwn(fieldMetrics(),state.metricKey))state.metricKey=merchantCoreMetricKeys()[0]||Object.keys(fieldMetrics())[0]||'';const dashboard=state.merchantScreen==='dashboard';return `<div class="app-layout merchant-layout"><section class="merchant-wrap">
 <div class="product-top"><div class="store-name">${icon('store')}山野生活旗舰店 ${pill('跃迁期 · 多场域经营','outline')}</div><div class="row"><span class="demo-data">演示数据</span><span>${typeof curatedActive==='function'&&curatedActive()?'2026.11.02':'2026.10.21'}</span></div></div>
 ${dashboard?`<div class="welcome"><div class="merchant-page-heading"><a class="text-btn dashboard-back" href="#merchant">${icon('chev')} 返回经营概览</a><h1>经营数据看板</h1></div>${merchantPeriodSelector()}</div>`:merchantCampaign()}
 ${merchantFieldTabs()}<div class="merchant-content" id="field-panel" role="tabpanel" aria-labelledby="field-tab-${state.fieldKey}">${dashboard?merchantDashboard():`<section aria-labelledby="overview-title"><div class="overview-head"><div class="section-title"><h2 id="overview-title">经营概览</h2>${pill(fieldData().name,'outline')}</div></div>${merchantBusinessSummary()}<div class="merchant-overview"><div class="metric-panel"><div class="metric-panel-head"><h3>关键指标</h3><a class="text-btn metrics-more" href="#merchant/dashboard/${state.fieldKey}/${state.period}">更多指标 ${icon('arrow')}</a></div><div class="core-metric-grid" id="merchant-metrics" role="group" aria-label="${fieldData().name}核心经营指标">${merchantMetricCards()}</div></div><section class="card chart-card" id="metric-trend" aria-labelledby="trend-title">${merchantTrend()}</section></div></section>${merchantDiagnosis()}`}</div><div class="merchant-footer">${icon('info')}虚构店铺与示例数据，仅供交互体验。</div>
 </section></div>${dashboard?'':`<button class="diagnosis-float" data-action="open-float" data-draggable-float aria-label="智能助手浮标" title="智能助手 · 点击打开，拖动调整位置">${icon('spark')}<span>智能助手</span></button>`}`;}

function resolveQuestionContext(question,context){
 if(typeof curatedActive==='function'&&curatedActive())return curatedResolveContext(question,context);
 const next={...context};
 if(/全店|整体/.test(question))next.fieldKey='overview';
 else for(const key of FIELD_KEYS){if(question.includes(fieldData(key).name)){next.fieldKey=key;break;}}
 if(/昨天|昨日/.test(question))next.period='day';else if(/近7天|近七天/.test(question))next.period='week';
 const metric=questionMetric(question,fieldData(next.fieldKey).metrics);if(metric)next.metricKey=metric[0];else if(next.fieldKey!==context.fieldKey)delete next.metricKey;
 return next;
}
function merchantSpecialAnswer(question,context,footer){
 const field=fieldData(context.fieldKey),period=context.period;
 const suggestions=`<div class="chat-suggestions"><button data-chat-question="${merchantQuestion(context.fieldKey,period)}">分析${field.name}经营表现</button><button data-chat-question="查一下${periodName(period)}${field.name}的经营数据">查看已接入数据</button></div>`;
 if(/政策|扶持|补贴|权益|入驻规则/.test(question))return `<h3>新商扶持与政策，需要结合官方规则确认</h3><p>当前示例尚未接入最新政策、活动规则及店铺资格信息，暂不能判断可领取的扶持或可参与的活动。</p><p>请结合店铺入驻时间、经营阶段、类目和活动要求，查看商家后台对应的政策与权益说明。</p>${actionDestination({name:'查看新商扶持建议',description:'先核对店铺资格与活动适用条件，再以官方活动页面公布的权益、有效期及参与方式为准。'})}${footer}`;
 if(/同行|行业|竞对|对标|排名|最高|最低/.test(question))return `<h3>当前数据不足以判断${/退货|退款/.test(question)?'退货或退款率的行业排名':'同行对标结果'}</h3><p>当前示例未接入${/退货|退款/.test(question)?'店铺退货或退款明细，以及':''}同周期、同类目、同口径的同行或竞对数据，无法判断是否高于同行，更不能认定为行业最高。</p><p>需要先确定比较指标、统计周期和可比商家范围，再对照店铺值与同行分布。</p>${suggestions}${footer}`;
 if(/退货|退款|售后|利润|毛利|开播时长|直播时长|客服|发货时效/.test(question))return `<h3>这个指标尚未接入当前示例</h3><p>你问的是“${esc(question)}”。当前页面没有对应的明细或指标，暂不能给出数值、原因判断或改善结论。</p>${suggestions}${footer}`;
 if(/头部商家|优秀案例|行业经验|别人怎么做/.test(question))return `<h3>当前还没有可引用的商家案例</h3><p>当前示例未接入已验证的头部商家案例，不能将通用做法当作真实案例。可以先结合你的场域与经营数据，定位需要改善的环节。</p>${suggestions}${footer}`;
 if(/哪个商品|哪些商品|具体商品|哪个达人|哪些达人/.test(question))return `<h3>需要明细数据才能定位具体对象</h3><p>当前已展示${field.name}${periodName(period)}的汇总指标，尚未接入逐商品或逐达人明细，暂不能判断具体是哪个对象拖累表现。</p>${suggestions}${footer}`;
 return null;
}
function merchantAnswer(branch,q,config,context){
 if(typeof curatedActive==='function'&&curatedActive())return curatedMerchantAnswer(branch,q,context);
 const {fieldKey,period}=context,field=fieldData(fieldKey),metrics=field.metrics,goal=goalData(fieldKey,period);
 const footer='<div class="answer-footer"><span>以上内容基于演示数据，仅供体验。</span></div>';
 const special=merchantSpecialAnswer(q,context,footer);if(special)return special;
 if(branch==='fixed')return `<h3>你好，我是你的智能助手。</h3><p>我可以结合${field.name}${periodName(period)}的示例数据，帮你看经营现状、分析目标差距、定位问题并提供优化建议与行动链接。</p><div class="chat-suggestions"><button data-chat-question="${merchantQuestion(fieldKey,period)}">开始经营分析</button><button data-chat-question="${merchantQuestion(fieldKey,period,'目标差距')}">分析目标差距</button></div>${footer}`;

 if(branch==='data'){const entry=questionMetric(q,metrics),entries=entry?[entry]:Object.entries(metrics);return `<h3>${field.name} · ${periodName(period)}${entry?entry[1].label:'经营数据'}</h3><p>统计周期：2026.${periodRange(period)}，对比${compareName(period)}。</p><div class="result-metrics">${entries.map(([,metric])=>`<div class="result-metric"><span>${metric.label}</span><b>${formattedMetric(metric,metric[period].value)}</b><small>${changePhrase(metric,period)}</small></div>`).join('')}</div>${footer}`;}
 if(branch==='knowledge'){
  if(/标题|主图/.test(q))return `<h3>${/主图/.test(q)?'商品主图':'商品标题'}优化建议</h3><p>${/主图/.test(q)?'主图应清晰展示商品本体、关键规格和有依据的卖点，并与标题、详情及实际商品保持一致。':'标题应写清核心品类与关键规格，表达有依据的商品卖点，并与主图、详情及实际商品保持一致。'}</p>${actionDestination(config.fieldConfigs?.live?.actions?.find(action=>action.name==='完善商品主图与标题')||{name:'完善商品主图与标题',description:'先明确商品品类、规格和有依据的卖点，再对照主图、标题与详情的一致性。'})}${footer}`;
  return `<h3>当前示例暂未覆盖这个问题</h3><p>你可以继续问当前场域的经营表现、目标差距、已接入指标或商品信息优化建议。</p>${footer}`;
 }
 return merchantDemoBrief(q,context,config);
}
