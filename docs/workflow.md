# 业务节点与变量

以下来自本次导出的 Main_agent 当前画布，保留实际节点名称。主业务只展开为一层；技术适配层负责 DeepSeek 协议。

| 节点 | 输入 | 处理 | 输出 |
|---|---|---|---|
| 开始 | 商家提问与可选上下文 | 工作流的起始节点，用于设定启动工作流需要的信息 | `question`、`sellerId`、`pageContext`、`history`、`chatId`、`requestId` |
| 意图识别 | `question`、`sellerId`、`pageContext`、`history`、`chatId`、`requestId` | 先识别商家的明确问法，承接本轮问题、聊天和页面中已确认的信息，确定候选任务、场域和周期。这里只做需求识别，不生成经营结论。 | `question`、`analysisContext`、`branch`、`clarification`、`scopeErrors`、`needsUnderstanding`、`usageJson` |
| 需要模型理解吗？ | `needsUnderstanding` | 简单提问时不经过模型，减少等待时间；复杂提问时需要模型推理 | 所选路径 |
| 理解复杂问法（deepseek） | `stage`、`history`、`pageContext`、`question` | 仅在问法复杂时运行。结合本轮问题与聊天上下文，识别商家想诊断、查数还是了解经营知识，并给出候选场域和周期。 | `intent`、`fieldKey`、`period`、`metricKey`、`fieldSource`、`periodSource`、`metricSource`、`reason`、`reasoning_content`、`summary`、`explanations`、`goalDiagnosis`、`result`、`usageJson` |
| 确认本次分析范围 | `question`、`sellerId`、`pageContext`、`history`、`chatId`、`requestId`、`intent`、`fieldKey`、`period`、`metricKey`、`fieldSource`、`periodSource`、`metricSource`、`reason`、`usageJson` | 核对模型识别结果与商家的明确要求，确认本轮商家、场域和周期；本轮明确要求优先，页面信息只作参考。范围无效时转入补充信息。 | `question`、`analysisContext`、`branch`、`clarification`、`scopeErrors`、`usageJson` |
| 上下文汇总处理 | 各已执行分支的同名变量 | 接住快速识别或模型识别中实际执行的那条路径，输出统一的任务与分析范围。这里只汇合信息，不增加经营判断。 | `question`、`analysisContext`、`branch`、`clarification`、`scopeErrors`、`usageJson` |
| 任务分流 | `branch` | 经营表现和目标差距进入诊断；只问数值进入查询；问概念或方法进入知识答疑；信息不足时请商家补充。同一轮只执行匹配的任务。 | 所选路径 |
| 场景路由 + API 取数 + 匹配框架策略 | `context`、`question` | 对应原流程的取数与配置匹配：读取本轮场景、指标、行动点及已发布框架和策略，核算变化、目标差距和金额分解，按优先级选择最多3个问题。此处不生成原因文案。 | `calculationJson`、`materials` |
| 核对数据与计算结果 | `calculationJson`、`materials`、`context`、`question` | 确认返回的商家范围、场域和周期正确，金额分解合计能对上，行动点编号有效；再把独立问题分成可并行解释的任务，目标诊断只保留一个任务。 | `calculationJson`、`materials`、`explanationTasks`、`streamEvent` |
| （流式输出）展示已取得的指标 | `streamEvent` | 对应原流程的流式展示：先把本轮已经取得的经营指标送到聊天框，模型继续生成原因和建议。这里只提前展示真实返回的数据，不提前给出最终诊断。 | — |
| think + action（deepseek） | `stage`、`materials` | Think／Action：根据本轮核验过的证据解释原因、说明待验证事项，并从已发布行动点中给出操作与复看方法。最多3个独立问题并行解释，目标诊断单次生成。 | `outputList` |
| 核查诊断说明与行动 | `calculationJson`、`outputs` | 核对模型是否覆盖本次问题，判断、依据和待验证事项是否完整，行动是否引用已有经营工具；同时拦截常见口径错误及未经核实就直接调整经营的建议。 | `result`、`passed`、`validationErrors`、`usageJson` |
| 回答通过核查了吗？ | `passed` | 通过核查就汇总返回；未通过才进入一次补全。它只决定是否需要补全回答，不重新排序问题，也不改变诊断策略。 | 所选路径 |
| 补全未通过核查的回答（deepseek） | `stage`、`materials`、`validationErrors` | 仅初次回答未通过核查时运行。根据具体缺口，用同一份证据补齐原因说明、验证方法或行动引用，最多补全一次，不无限重试。 | `intent`、`fieldKey`、`period`、`metricKey`、`fieldSource`、`periodSource`、`metricSource`、`reason`、`reasoning_content`、`summary`、`explanations`、`goalDiagnosis`、`result`、`usageJson` |
| 复核补全后的回答 | `calculationJson`、`summary`、`explanations`、`goalDiagnosis`、`usageJson`、`previousUsageJson` | 再次核对补全内容与行动引用。仍不完整时如实保留缺口，不把失败包装成成功，也不再重复调用模型。 | `result`、`passed`、`validationErrors`、`usageJson` |
| 智能取数 | `context`、`question` | 返回商家所问指标的当前值、前期值、单位和本轮范围。明确查数不需要生成诊断文案；没有数据时如实说明。 | `result` |
| 知识问答（deepseek） | `stage`、`history`、`question` | 调用 deepseek api，通用模型知识 | `intent`、`fieldKey`、`period`、`metricKey`、`fieldSource`、`periodSource`、`metricSource`、`reason`、`reasoning_content`、`summary`、`explanations`、`goalDiagnosis`、`result`、`usageJson` |
| 追问 | `analysisContext`、`clarification`、`scopeErrors` | 问题缺少必要范围，或指定了当前不支持的场域、周期时，告诉商家还需要补充什么。不会猜测指标数据或强行给出诊断。 | `result` |
| 汇合各任务的回答 | 各已执行分支的同名变量 | 从诊断、补全、查数、知识答疑或澄清中接住实际执行路径的回答，送往统一出口。不把不同任务的结果混在一起。 | `result`、`usageJson` |
| 整理统一返回格式 | `result`、`usageJson`、`scopeUsageJson` | 把上一节点的结果原样交给结束节点，保留网站现有读取格式。这里只整理交付格式，不调用模型，不改写数值、原因或行动。 | `result` |
| 结束 | `result` | 工作流的最终节点，用于返回工作流运行后的结果 | `result` |

四处适配层调用沿用统一的返回协议，所以输出会包含本阶段未使用的字段；这不表示每个节点都执行了其他任务。诊断分支最多并行解释 3 个已选择问题；初次核验未通过才进入一次补全。

## 关键变量

| 变量 | 说明 |
|---|---|
| `question` | 本轮商家问题 |
| `sellerId` | 本轮商家标识；仓库示例为合成商家 |
| `pageContext` | 页面提供的场域、周期、指标背景；明确提问优先 |
| `history` | 最近对话及此前已确认的范围 |
| `chatId` / `requestId` | 会话与本次配置 / 数据请求的关联标识 |
| `intent` / `branch` | 候选意图 / 实际执行任务：诊断、查数、知识、澄清 |
| `fieldKey` / `period` / `metricKey` | 场域、统计周期与指标 |
| `fieldSource` / `periodSource` / `metricSource` | 范围依据来自本轮问题、历史、页面或未知 |
| `analysisContext` / `context` | 经代码确认的本轮商家与统计范围 |
| `needsUnderstanding` | 是否需要模型理解复杂问法 |
| `clarification` / `scopeErrors` | 待补充信息与范围问题 |
| `calculationJson` | 确定性计算、规则命中及候选问题结果 |
| `materials` | 提供给模型的已发布资产、证据与计算结果 |
| `explanationTasks` | 按独立问题拆出的并行解释任务 |
| `stage` | 适配层调用类型，决定使用哪套提示词 |
| `summary` / `explanations` / `goalDiagnosis` | 经营小结、逐问题说明、目标诊断 |
| `passed` / `validationErrors` | 回答是否通过校验及具体缺口 |
| `streamEvent` | 提前展示的实际指标 / 进度消息 |
| `usageJson` | DeepSeek 实际用量回执，不是平台积分估值 |
| `result` | 本轮最终结构化回答 |

框架决定检查方向和顺序；策略定义可执行的条件及行动映射；模型在证据边界内解释，不能把缺证据的原因写成确定结论。
