# 网站接口

| 接口 | 实际职责 |
|---|---|
| `POST /api/diagnose` | 鉴权、暂存发布配置并流式调用 Coze Main_agent，返回核验后的模型结果与费用回执 |
| `POST /api/aidd/generate` | 独立生成 / 解析框架与策略，直接调用 DeepSeek，不调用商家工作流 |
| `POST /api/dashboard/snapshot` | 读取已生成看板快照；管理员显式生成时运行 Coze |
| `/api/dashboard/action-mappings` | 读取或管理员发布行动映射 |
| `GET /api/coze/status` | 返回服务就绪与工作流绑定状态，不返回密钥 |

生产鉴权依赖宿主提供的可信身份和管理员白名单。DeepSeek 与 Coze 密钥只在服务端或扣子在线鉴权中配置。

AIDD 有 D1 原子预算预留、结构和引用校验，以及人工审核后发布流程。`AIDD_MONTHLY_LIMIT_USD` 是本应用预算保护，不是模型账户全局限额；代码中的历史单价须在自行部署时复核。

`/api/evaluation/*` 是源码留存的专用评测入口，缺少评测密钥 / 有效期限配置时关闭；查阅版不附带其在线权限。

[接入说明](../../docs/setup.md) · [版本边界](../../docs/provenance.md)
