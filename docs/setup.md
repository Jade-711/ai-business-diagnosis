# 本地预览与自行接入

## 只查阅与预览

安装 Node.js 22.13 或更高版本（测试使用 `node:sqlite`）。本项目无额外 npm 依赖。

```sh
npm run build
npm test
npm run dev
```

预览地址：http://127.0.0.1:4173/#merchant。

`npm run build` 只调用网站资产构建；不会重生成 `coze/` 导出或发布任何服务。预览服务器向 Worker 传入空环境，故不会读取 `.env`，也不会调用 Coze / DeepSeek。

## 自行部署

当前代码面向 Sites / Cloudflare Worker 运行环境。GitHub Pages 只能托管静态页面，无法单独提供本项目的后端问答、鉴权、D1 数据库和密钥管理。

| 组件 | 需要配置 |
|---|---|
| 主工作流 | 在自己的扣子空间创建工作流，导入 / 重建 `coze/` 中节点，重新绑定四处适配层 ID 与发布版本 |
| 模型适配层 | HTTP 节点请求 DeepSeek；Bearer 密钥由自己的在线鉴权配置提供，导出文件中为空 |
| 取数与配置资源服务 | 实现配置暂存 `POST /request` 与工作流调用的 `/api/workflow-input`、`/api/workflow-calculate`；替换 `resource-service.example` |
| 网站后端 | 配置自己的 Coze token、工作流 ID / 版本、资源地址与资源写入凭证 |
| AIDD 生产 | 单独配置网站运行环境的 DeepSeek 密钥与模型；该路径不调用扣子 |
| 数据库 | D1 绑定 `DB`，应用 `site/drizzle/` 迁移；不要导入所有者线上数据库 |
| 管理员身份 | 当前实现依赖托管平台注入可信身份并通过管理员白名单校验；迁移到其他宿主时应接入该宿主可信登录，不能信任浏览器自填身份头 |

从 [site/.env.example](../site/.env.example) 查看变量名。它是配置清单，不代表把文件放在本地就会自动启用在线调用。

`site/.openai/hosting.json` 使用占位项目 ID；自行创建宿主项目后再填写。复现资源服务需要自行部署对应接口，本仓库不附带他人的资源服务密钥或授权链接。

## 工作流材料怎么使用

- `coze/main-agent-current.workflow.json`：方便阅读的图结构。
- `coze/main-agent-current.clipboard.json`：扣子剪贴板格式；在支持该格式的编辑器中使用，导入后按自己空间重新绑定依赖，不覆盖原项目。
- `coze/deepseek-adapter-v0.0.6.workflow.json`：5 节点适配层的无密钥构建源。
- `coze/deepseek-prompts.json`：四类系统提示词、用户提示模板、输出字段与预算。

导入可读不等于已经部署可运行。发布前需用自己的配置验证输入输出、资源取数、规则命中、缺证据处理、行动引用及真实模型返回。

## 费用与数据

DeepSeek 的 provider usage 与 Coze 的 workflow usage 分开记账；推理 token 属于 DeepSeek 输出 token 的子集，不能重复累加。Coze token、平台显示 cost 与积分账单也不能直接当作同一种单位。

当前仓库包含合成演示商家和指标。固定看板优先读取已生成快照；实时问答通过 Coze 主工作流。AIDD 生产与看板批量生成属于不同操作，前者不走 Coze，后者会显式运行诊断工作流。
