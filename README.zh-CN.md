# VariantGuard Lab

**语言 / Language**：本页是简体中文版。英文版见 [English](./README.md)，该页顶部同样链接回本页。应用界面右上角也提供 `English / 中文` 切换按钮，切换结果会保存在本地浏览器中。

---

## 产品定位

VariantGuard Lab 是一个导入前的风险检查工具，面向准备用 CSV 覆盖式导入（Overwrite products with matching handles）更新 Shopify 商品的商家。你提供两份文件——店铺当前的导出（`baseline.csv`，即基线文件）和你准备导入的文件（`proposed.csv`，即待导入文件）——它会逐行比对，并告诉你这次导入会把商品目录改成什么样子：哪些变体在文件里没有对应行而会被丢弃，哪些库存会被一个空单元格清空，哪些选项值的改动会让 Shopify 重建变体，以及哪些 Handle 的细微差异会静悄悄地多出一个商品而不是更新原来的那个。它不连接店铺，不问你要账号或令牌，也不会把你的文件发到任何地方。两份 CSV 都在页面里用 `File.arrayBuffer()` 读取并解码，包括 UTF-16。工具同时提供英文与简体中文界面。

## 核心功能

检测引擎由 **26 条风险规则**和 **11 类文件格式发现**组成。规则覆盖 `VG-PRD-*`（商品）、`VG-VAR-*`（变体）与 `VG-FMT-*`（格式）三类；文件格式发现（编码异常、缺 `Handle` 列、重复列名、行数不齐、空文件等）在解析阶段就会报出，早于任何比对——结构已经不完整的文件，会让后续每一步比对都不可靠。报告里的分类与界面上的筛选器一致：商品结构、变体丢失、库存、店铺前台展示、商品 / 变体身份标识、常规变更、文件格式。逐条规则的证据来源见 [docs/RULES.md](docs/RULES.md)。

严重度分为**高、中、低**，分别对应 9 条、11 条和 6 条规则。这里请注意一件事：**严重度描述的是影响，不是确定性。**一条「高」发现表示如果你的理解是对的，后果就很严重；它不表示这条判断有多可靠。确定性由另一条正交的轴——依据等级——给出，每条发现都会说明自己属于哪一类：

- **Shopify 官方文档支持**：背后有 Shopify 的原文表述。
- **推断**：从已获文档证实的行为推出来的，但 Shopify 没有针对这个具体场景给出说明。
- **启发式判断**：模式匹配，没有任何官方依据。

如果一条发现需要依赖下面提到的检测假设来成立，它会明确写出来是「依赖于」哪一条假设。

### 6 条可切换的检测假设

引擎的行为由 6 条检测假设（detection assumptions）决定，每一条都是界面上的一个开关：

1. 导入使用「Overwrite products with matching handles」（非官方译文：覆盖 Handle 相同的商品）。
2. 空单元格会清空该值；文件中不存在的列会让该值保持不变。
3. 店铺中存在、但在文件中没有对应行的变体，会在导入时被删除。
4. 文件中缺失的商品不会被删除。
5. 一个变体由它的 Handle 加上 `Option1`–`Option3` 的值共同标识。
6. Handle 的匹配是精确匹配——大小写和 Unicode 形式都必须一致。

关掉其中任何一条，报告会按新的假设重新计算，你可以直接看到有多少条发现依赖于 Shopify 从未公布过的行为。其中第 3 条（变体丢失）**未获官方文档证实**，只来自社区用户报告，但它支撑着本工具全部最高严重度的发现；第 6 条（Handle 精确匹配）**推断**而来，Shopify 只说明了 Handle 唯一标识商品、匹配 Handle 会被覆盖，没有说明这一比较是否区分大小写、是否做 Unicode 规范化。

### 一切的基础：单元格的三种状态

Shopify 对覆盖式导入的说明是精确的：

> 「If a non-required column in the import CSV file is blank, then the matching value in the product list is overwritten as blank.」
>
> 「If a non-required column isn't included in the import CSV file, but is included in the existing product list, then the value in the product list remains the same.」

所以三种状态不能互相混淆：

| 状态 | 含义 | 后果 |
|---|---|---|
| **缺失（absent）** | 这一列不在本次文件里 | 已保存的值保持不变 |
| **空（empty）** | 这一列存在，这个单元格长度为 0 | 已保存的值被覆盖为空 |
| **有值（value）** | 长度不为 0 的字符串 | 已保存的值被覆盖为这个值 |

本工具里的每个单元格都严格属于这三者之一。只含空白字符的单元格算**有值**，因为 Shopify 看到的就是这样——这也是一类典型的静默不匹配来源。上面列出的绝大多数规则都是这张表的推论：`VG-PRD-006`（删掉一列会保住数据）和 `VG-VAR-007`（把单元格清空会清掉数据）说的其实是同一件事，方向相反而已。

## 使用方法

页面上方有两个上传槽位：

- **`baseline.csv`（基线文件）**——你店铺当前的导出文件，也就是此刻 Shopify 里的内容。
- **`proposed.csv`（待导入文件）**——你编辑之后、即将导入的文件。

两者都可以直接把 CSV 拖进去，也可以点击选择文件。文件仅在你的浏览器里读取，不支持 `.csv` 以外的格式，大小上限为 60 MB。

不想准备自己的文件时，内置了 **16 个示例场景**，覆盖常规操作、危险操作、格式错误的输入和容易误报的场景，例如常规价格修改、变体行缺失、选项改名、库存被清空、列被删掉、重复的选项组合、下架商品、SKU 重复、`Status` 留空、`Handle` 拼写错误等。每个场景都可以单独下载 `baseline.csv`、单独下载 `proposed.csv`，或者把两个文件打成 zip 下载。

**重新导入下载下来的这对文件，会得到完全相同的报告。**这一点由 `tests/roundtrip.test.ts` 覆盖：套件会下载场景文件、再把它当作上传输入重新跑一遍，并断言产出与内置场景一致；同时还断言这套比较不是空转的，并且确实有可能失败。

## 导出报告

报告可以导出为 CSV 或 JSON。

CSV 的列名**始终保持英文**（`severity`、`category`、`rule_id`、`title`、`detail` 等），这样已有的表格模板、`awk` 脚本和 BI 导入不会因为切换语言而失效；而规则名称、发现内容、判断依据和处理建议这几列会**跟随你当前阅读的语言**。给机器用的契约保持稳定，给人读的内容用当前语言。中文 CSV 会带 **UTF-8 BOM** 写出，否则默认配置的 Excel 会按系统代码页读取并显示成乱码；英文导出不写 BOM。

JSON 保留原有的英文机器可读键名和规则 ID，schema 不做任何改动；中文导出会额外增加一个 `localized` 块，把本地化的规则文本和免责声明放进去，而不是把原字段翻译掉。这样按旧 schema 编写的消费方无需修改即可继续工作。CSV 导出遵循 RFC 4180。

## 本地开发

需要 Node 20 或更高版本。

```bash
npm install
npm run dev        # http://localhost:4310
```

生产构建：

```bash
npm run build
npm run start      # http://localhost:4310
```

一次跑完全部检查：

```bash
npm run verify     # typecheck + lint + test + build
```

项目没有登录、没有数据库、没有后端路由、没有埋点。`src/app` 只有一个页面，不含任何 API handler。PapaParse 负责解析 CSV。Next.js 和 React 也是运行时依赖，它们负责页面，不接收 CSV。Tailwind 只在构建时使用。

## 测试

```bash
npm test           # 2026-10-17：7 个文件，383 项测试
npm run test:watch
```

`npm run test:coverage` 需要 `@vitest/coverage-v8`，当前没有安装，这条命令不能直接当覆盖率检查用。

测试文件：`tests/roundtrip.test.ts`、`tests/analysis.test.ts`、`tests/i18n.test.ts`、`tests/i18n-keys.test.ts`、`tests/csv.test.ts`、`tests/report.test.ts`、`tests/intake-path.test.tsx`。以 `npm test` 的输出为准，不要引用旧报告里的条数。

## 已知技术限制

请在依赖这份报告做任何决定之前读完这一节。

1. **无法检测全部导入风险。**报告干净只代表下列规则没有命中，不代表这次导入是安全的。
2. **这里的结论是推断，不是 Shopify 的行为。**发现来自 Shopify 已公布的 CSV 规则加上商家反馈，没有任何内容被发送到 Shopify，本工具也从未观察过一次真实的导入结果。
3. **Handle 的匹配严格性是我们自己的假设。**Shopify 没有说明比较是否区分大小写、是否做 Unicode 规范化。默认采用严格匹配，是因为反方向的错误——把一个并非新增的商品说成新增——才是危险的方向。
4. **UTF-16 与编码识别属于启发式判断。**工具会解码并提示 UTF-16 文件和乱码文件，但识别本身可能出错，请以文件实际保存的编码为准。
5. **本工具从未在真实的生产店铺上运行过。**这是一个实验，不是经过验证的产品。最高严重度的那些发现所依赖的行为，恰恰是 Shopify 官方文档中没有任何表述的那一条。
6. **CSV 导出假设输入遵循 RFC 4180。**带引号的换行、BOM 等情况已做处理，但不符合规范的 CSV 会让所有下游解析结果失去意义。
7. **变体身份按选项值识别。**因此选项值的改动会被报成「重建变体」，而不是「改名」。

完整的限制清单见 [docs/LIMITATIONS.md](docs/LIMITATIONS.md)，已核实的 Shopify 原文引用（含两条被验证推翻的初始假设）见 [docs/SHOPIFY-SEMANTICS.md](docs/SHOPIFY-SEMANTICS.md)。

## 免责声明

VariantGuard Lab 在你的浏览器本地分析两份 CSV 文件，并报告它认为一次覆盖式导入会造成的变更。这些是基于文件结构的推断，而不是 Shopify 的实际执行结果。本报告中的任何内容都未发送给 Shopify，也没有连接任何 Shopify 店铺。本工具无法检测全部导入风险。报告没有发现任何问题，只代表下列规则没有命中，并不代表这次导入是安全的。

本项目是一个实验，从未针对真实的 Shopify 生产店铺做过验证。请自行判断每一条发现是否适用于你的情况，并在导入前保留一份备份。

## 相关文档

- [docs/RULES.md](docs/RULES.md)——26 条规则逐条说明及其证据。
- [docs/I18N.md](docs/I18N.md)——界面语言、导出语言和本地保存的内容。
- [docs/LIMITATIONS.md](docs/LIMITATIONS.md)——完整的技术限制清单。
- [docs/SHOPIFY-SEMANTICS.md](docs/SHOPIFY-SEMANTICS.md)——核实过的 Shopify 文档原文。
- [docs/COMPETITIVE-OVERLAP.md](docs/COMPETITIVE-OVERLAP.md)——与现有产品的重叠与差异。
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)——第三方依赖与许可说明。

## 开源许可证

MIT，详见 [LICENSE](LICENSE)。
