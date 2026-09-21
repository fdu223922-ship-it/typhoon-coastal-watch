# 沿海台风通 · Typhoon Coastal Watch

面向沿海居民的台风信息看板，展示台风名称、经纬度、移向、移速、中心风力及分机构预报。

- 网站：https://fdu223922-ship-it.github.io/typhoon-coastal-watch/
- 数据来源：[上海市水务局台风路径发布系统](https://bmxx.swj.sh.gov.cn/typhoon/)
- 自动更新：[GitHub Actions](https://github.com/fdu223922-ship-it/typhoon-coastal-watch/actions)

## 当前实现

原生 HTML/CSS/JavaScript + Node.js 无依赖采集脚本 + GitHub Pages。已替换旧演示数据，不再展示虚构台风和模拟预警。路径图按真实经纬度绘制，无地理底图；不是导航地图，也不表示影响范围。预报机构保持源站名称，默认选“中国”，可分别切换，避免混合机构路线。

**地区预警尚未接入。** 当前路径接口没有地区预警信号；颜色仅为图例。没有数据不等于没有预警，本站不会根据台风中心风力推算地方官方预警。

## 开发与验证

需要 Node.js 22 或更新版本，无需安装 npm 依赖。

```sh
npm run fetch:data
npm run dev
npm run check
npm test
npm run build
```

预览地址为 `http://127.0.0.1:8016/`，使用 `PORT` 可修改端口。前端使用模块与 JSON 请求，需要 HTTP 服务，不能直接以 file:// 打开。`npm run build` 将发布文件复制到 `_site/`。

| 文件 | 职责 |
| --- | --- |
| `index.html` / `styles.css` | 页面结构、响应式布局、数据说明 |
| `app.js` | 同源快照读取、时效提示、路径与机构交互 |
| `lib/typhoon.js` | 来源字段规范化、时区、验证、故障状态 |
| `scripts/fetch-data.mjs` | 采集当前及上一年活动台风、恢复上次有效快照 |
| `data/latest.json` | 初始真实快照；自动更新产生的新数据随站点发布 |
| `scripts/build.mjs` | 仅打包站点所需文件到 `_site/` |
| `.github/workflows/update-and-deploy.yml` | 定时采集、测试、构建与 Pages 部署 |
| `tests/data.test.mjs` | 时区、单位、缺测、错误和跨年等数据处理测试 |

## 自动更新与时效

Actions 在每小时第 7、22、37、52 分钟触发，每次间隔 15 分钟，另支持 main 分支代码推送和手动 Run workflow。浏览器每分钟读取本站快照，第三方接口由服务器端脚本读取。

GitHub 的定时任务可能延迟或在高负载时丢弃，不能保证准点。公开仓库连续 60 天没有活动时，GitHub 可能禁用定时工作流，维护者需检查 Actions 并重新启用。参见 [GitHub schedule 文档](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。

数据标注源站定位时间、最近成功采集时间、最近尝试时间；统一显示北京时间。采集失败保留上次记录，并发布失败提示。超过 45 分钟未成功采集提示延迟，源站最后定位超过 6 小时单独提示；页面读取失败也明确提示。无活动台风只表示来源有效列表中的状态，不代表当地安全。

快照通过 Pages artifact 发布，不每 15 分钟提交 Git；仓库内种子数据不代表线上最新数据。失败时优先从上次线上部署恢复快照。若连构建或部署也失败，旧页面仍会按时间自动显示过期状态。

## 部署与维护

仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。工作流使用 `contents: read`；部署任务使用 `pages: write` 与 `id-token: write`，不需要另存 API 密钥。修改默认分支或仓库名称时，同步修改工作流触发分支、`PUBLISHED_DATA_URL`、采集脚本域名白名单及文档地址。

手动刷新：Actions → 更新台风数据并发布 Pages → Run workflow。失败时查看 build 的采集步骤；即使保留数据已发布，采集失败仍将整次工作流标记失败。禁止把失效接口返回的错误对象当成无台风。

## 文档与边界

- [原项目计划书](docs/项目计划书.md)：范围基线，原技术选型为拟议方案。
- [实时数据接入与部署](docs/实时数据接入与部署.md)：端点、字段、异常处理及验证记录。
- [原数据来源核验](docs/数据来源与核验记录.md)：规划阶段记录，当前接入以新文档为准。
- [演示页面验收](docs/演示页面验收.md)：旧演示版本历史记录，不代表当前实况功能。

接口为源站前端使用的公开接口，没有公开的稳定性承诺，结构可能改变；本项目不冒充官方平台。业务判断与应急行动请核对官方原站和当地部门最新通知。仓库暂未选择开源许可证；第三方数据权利归相关权利人，后续扩大服务范围需另行核实许可。
