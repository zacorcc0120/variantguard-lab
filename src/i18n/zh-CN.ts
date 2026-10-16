/*
 * zh-CN dictionary.
 *
 * Hand-written translation of `en.ts`. The key set is the contract: every key in
 * `en.ts` appears here exactly once, plus the three `finding.note.*` fragments
 * the `note:` tokens need to place an inline conditional where Chinese grammar
 * wants it.
 *
 * Templates use `{name}` placeholders resolved by `interpolate()` in
 * `src/i18n/index.ts` — unknown names are left visible rather than blanked, so a
 * placeholder here must match a param the engine actually supplies
 * (`riskParams`: `handle` / `variant` / `field` / `baseline*` / `proposed*`,
 * then `risk.meta`, then `risk.i18n.params`).
 *
 * Never translated on purpose: product handles, SKUs, option values, and
 * Shopify's own column names (`Handle`, `Option1 Value`, `Variant Compare At
 * Price`, `Published on online store`, …) and literal values (`Default Title`,
 * `active` / `draft` / `archived`, `true` / `false`). Verbatim Shopify quotes
 * stay in English inside 「」 with any Chinese marked 非官方译文, so a reader can
 * never mistake this file for something Shopify published.
 */
import type { Dictionary } from './types';

export const zhCN: Dictionary = {
  ui: {
    "report.disclaimer": 'VariantGuard Lab 在你的浏览器本地分析两份 CSV 文件，并报告它认为一次覆盖式导入会造成的变更。这些是基于文件结构的推断，而不是 Shopify 的实际执行结果。本报告中的任何内容都未发送给 Shopify，也没有连接任何 Shopify 店铺。本工具无法检测全部导入风险。报告没有发现任何问题，只代表下列规则没有命中，并不代表这次导入是安全的。',
    'app.a11y.dropHint': '把 CSV 拖进来 — 第一个文件是基线文件，第二个是待导入文件',
    'app.a11y.summary': '{count} 条发现，其中 {high} 条为高严重度。',
    'app.badge.localOnly': '完全在你的浏览器里运行',
    'app.badge.noShopify': '不连接 Shopify · 不需要账号 · 不上传文件',
    'app.empty': '载入两个文件，或选一个示例场景，即可开始检查。',
    'app.footer.disclaimer':
      '本工具报告的是它认为覆盖式导入会改动的内容。这些结论来自对 Shopify 已公布 CSV 规则的推断，以及商家反馈，不是来自 Shopify 的实测结果。这里没有任何内容被发送到 Shopify，也没有连接过任何 Shopify 店铺。没有发现不代表这次导入是安全的。',
    'app.footer.version': 'v0.1.0 · 离线 · MIT',
    'app.hero':
      '把 Shopify 的基线导出文件和你即将重新导入的 CSV 做对比，看看哪些行会丢失变体、清空库存，或悄悄创建出第二个商品。文件只在这个标签页里解析，绝不会离开你的机器。',
    'assumptions.blurb':
      '下面每条规则都依赖这些假设。改动其中一条，报告会重新计算，因此你能确切看出哪些发现的可靠性只和某条假设相当。',
    'assumptions.evidenceLabel': '以上原文的非官方译文。',
    'assumptions.heading': '检测假设',
    'assumptions.sensitiveMany': '{count} 条发现依赖非官方假设',
    'assumptions.sensitiveOne': '{count} 条发现依赖非官方假设',
    'assumptions.turnedOff': '已关闭。',
    'finding.after': '导入后',
    'finding.before': '导入前',
    'finding.cellAbsent': '文件中没有这一列',
    'finding.cellEmpty': '空单元格 — 会清空该值',
    'finding.cellZeroLength': '（零长度）',
    'finding.collapse': '收起发现详情',
    'finding.dependsOn': '依赖于',
    'finding.expand': '展开发现详情',
    'finding.ruleFooter': '规则：{title} · 默认严重度 {severity}',
    'finding.spansLines': '跨 {count} 行',
    'finding.spansLinesTitle': '这条记录跨 {count} 个物理行，因为某个单元格中含有换行符。',
    'finding.whatToDo': '处理建议',
    'finding.why': '我们这样判断的依据',
    'lang.en': '英文',
    'lang.label': '语言',
    'lang.switchTo': '切换到{language}',
    'lang.zhCN': '中文',
    'report.allCategories': '全部分类',
    'report.analysedIn': '用时 {ms} 毫秒',
    'report.emptyExplain':
      '这两个文件里没有任何内容触发规则。这并不保证导入是安全的——它只说明本工具检查的那些具体风险没有出现。',
    'report.exportCsv': '下载 CSV 报告',
    'report.exportJson': '下载 JSON 报告',
    'report.exportNote':
      'CSV 的列名保持英文，以免影响下游工具；规则名称、发现、依据和建议这几列会跟随你当前阅读的语言。',
    'report.filterHint': '清空搜索条件，或重新启用一个严重度筛选。',
    'report.isClean': '没有高严重度或中严重度的发现。',
    'report.needsAttention': '{count} 条需要你在导入前处理。',
    'report.noFindings': '没有发现。',
    'report.noMatches': '没有符合当前筛选条件的发现。',
    'report.ofTotal': '{shown} / {total}',
    'report.products': '{count} 个商品',
    'report.readFirst': '在相信这份报告之前，请先读完这一段',
    'report.searchPlaceholder': '搜索 Handle、变体、字段、规则或行号……',
    'report.teachesLabel': '这个示例场景想说明什么',
    'report.statAll': '全部',
    'report.variants': '{count} 个变体',
    'scenarios.blurb':
      '每个场景都是一份只有五个商品的小目录里发生的真实编辑失误。它们与测试套件跑的是同一批样例文件。下载一对文件，拖到上方的两个上传区域，你应该会得到和这里看到的完全一样的报告。',
    'scenarios.downloadBaseline': '下载「{title}」场景的 baseline.csv',
    'scenarios.downloadBaselineLabel': 'baseline.csv',
    'scenarios.downloadBoth': '把「{title}」场景的两个 CSV 文件打成 zip 下载',
    'scenarios.downloadBothLabel': 'both .zip',
    'scenarios.downloadProposed': '下载「{title}」场景的 proposed.csv',
    'scenarios.downloadProposedLabel': 'proposed.csv',
    'scenarios.heading': '或者从一个示例场景开始',
    'scenarios.load': '载入「{title}」场景',
    'slot.baseline.hint': '你店铺当前的导出文件，也就是此刻 Shopify 里的内容。',
    'slot.baseline.title': 'baseline.csv',
    'slot.choose': '为 {title} 选择一个 CSV 文件',
    'slot.clear': '清除',
    'slot.dropHere': '把 CSV 拖到这里，或点击选择',
    'slot.formats': '.csv · UTF-8 · 只在你的浏览器里读取',
    'slot.loaded': '{kb} KB · {rows} 行 · {products} 个商品',
    'slot.proposed.hint': '你编辑之后、即将导入的文件。',
    'slot.proposed.title': 'proposed.csv',
    'slot.replace': '把替换文件拖到这里',
    'slot.tooLarge': '文件超过 60 MB。Shopify 的商品 CSV 上限是 15 MB。',
    'slot.unsupported': '只能检查 .csv 文件。这个文件没有被读取。',
    'slot.unreadable': '无法读取这个文件。',
  },

  term: {
    'assumptionBasis.community': '社区用户报告，未获官方文档证实',
    'assumptionBasis.inference': '本工具推断',
    'assumptionBasis.official-doc': 'Shopify 官方文档支持',
    'basis.documented': 'Shopify 官方文档支持',
    'basis.heuristic': '启发式判断',
    'basis.inference': '根据已获文档证实的行为推断',
    'basisShort.documented': '官方文档支持',
    'basisShort.heuristic': '启发式判断',
    'basisShort.inference': '推断',
    'category.format': '文件格式',
    'category.identity': '商品 / 变体身份标识',
    'category.inventory': '库存',
    'category.routine': '常规变更',
    'category.structure': '商品结构',
    'category.variant-loss': '变体丢失',
    'category.visibility': '店铺前台展示',
    'file.baseline': '基线文件',
    'file.proposed': '待导入文件',
    'severity.high': '高',
    'severity.low': '低',
    'severity.medium': '中',
  },

  // ---- rule metadata: the generic rule name/rationale/suggestion ----
  rule: {
    'VG-FMT-001': {
      title: '这一列不是 Shopify 商品 CSV 的已知列名',
      rationale: 'Shopify 官方文档支持：Collection 是唯一一个可以在不破坏格式的前提下加进商品 CSV 的列。',
      suggestion:
        '如果这一列本该是 Collection，请改名。如果它是自定义列，Shopify 可能拒绝这个文件，也可能忽略它——无论哪种情况，你的意图都不会生效。',
    },
    'VG-FMT-002': {
      title: '变体 metafield 列不会被写入',
      rationale:
        "Shopify 官方文档：「Variant metafields aren't supported for product CSV import/export. To edit your variant metafields in bulk, you need to use the variant bulk editor, and then add metafield columns.」（非官方译文：商品 CSV 的导入/导出不支持变体 metafield。要批量修改变体 metafield，你需要使用变体批量编辑器，然后添加 metafield 列。）",
      suggestion:
        '把这些列仅当作说明来看。写入变体 metafield 需要用变体批量编辑器或 Admin API，而不是商品 CSV。',
    },
    'VG-FMT-003': {
      title: '身份标识列中存在前导或尾随空白字符',
      rationale:
        '我们比较 Handle 和选项值时会先去掉首尾空白，因此一个多余的空格会让我们判定为匹配，而 Shopify（按原始字符串匹配）可能不会。',
      suggestion: '导入前先去掉 Handle 和选项值列中的首尾空格。',
    },
    'VG-FMT-004': {
      title: 'Status 列存在，但内容为空',
      rationale:
        "Shopify 官方文档：「If this column is present, then it needs a value. If the column isn't present, then the product status is automatically uploaded as active.」（非官方译文：如果存在这一列，它就必须有值；如果不存在这一列，商品状态会自动按 active 上传。）",
      suggestion:
        '把每个 Status 单元格填成 active / draft / archived，或者干脆删掉整个 Status 列，让原有状态保持不变。',
    },
    'VG-FMT-005': {
      title: '有内容的行缺少 Handle，因此没有参与比较',
      rationale:
        'Handle 为空的行会被单独搁置，不进入商品和变体比较。如果这一行的其他单元格仍有内容，这些内容就没有被检查。',
      suggestion:
        '给这一行补上 Handle，或者如果它只是编辑残留就删掉。不要把「没有其他发现」理解成每一行都检查过了。',
    },
    'VG-PRD-001': {
      title: '基线文件中存在的商品，在待导入文件中缺失',
      rationale:
        "Shopify 官方文档：「CSV files can't be used to delete products in bulk.」（非官方译文：CSV 文件不能用于批量删除商品。）文件中缺失的 Handle 不会影响该商品。",
      suggestion: '这个商品会保持原样。列出这条是为了完整性，让你能确认它是有意为之，而不是误删了行。',
    },
    'VG-PRD-002': {
      title: '待导入文件中出现了新商品',
      rationale: 'Shopify 按 Handle 匹配；一个在店铺里找不到匹配的 Handle 没有可覆盖的对象，因此会被创建。',
      suggestion: '确认这是你确实想新增的商品。',
    },
    'VG-PRD-003': {
      title: '商品似乎是通过改 Handle 改名的',
      rationale:
        '启发式判断：旧 Handle 消失了，同时出现了一个新的 Handle，并带着相同的 SKU、标题和价格。Shopify 按 Handle 匹配，因此改过的 Handle 没有可覆盖的对象。',
      suggestion:
        '如果你本意是更新，请保留原来的 Handle，只改你真正想改的那个字段。如果你本意是移动商品，请记住旧商品仍会留在店铺里。',
    },
    'VG-PRD-004': {
      title: '商品将变为未发布或被隐藏',
      rationale:
        'Shopify 官方文档支持 Status 的取值 active / draft / archived，以及 Published on online store 列的 true / false。',
      suggestion: '导入后在后台重新发布；如果这不是你的本意，请去掉这项改动。',
    },
    'VG-PRD-005': {
      title: '更新已有商品的那一行上，Title 被清空',
      rationale:
        'Shopify 官方文档：「When you update products using a CSV file, the only required columns are URL handle and Title.」（非官方译文：使用 CSV 文件更新商品时，唯一必需的列是 URL handle 和 Title。）',
      suggestion: '把 Title 恢复到该商品的第一行。只有同一商品的后续行才应让 Title 留空。',
    },
    'VG-PRD-006': {
      title: '某一列在基线文件与待导入文件之间被删除',
      rationale:
        "Shopify 官方文档：「If a non-required column isn't included in the import CSV file, but is included in the existing product list, then the value in the product list remains the same.」（非官方译文：如果某个非必需列没有出现在导入 CSV 文件中，但它存在于现有商品列表里，那么商品列表中的该值保持不变。）以及「If a non-required column is included in the import CSV file that relies on other column data not included in the file, then existing data is deleted or removed.」（非官方译文：如果导入 CSV 文件中包含某个非必需列，而它依赖的其他列数据并未包含在文件中，那么现有数据会被删除。）",
      suggestion:
        '想让某个字段保持不变，就删掉这一列（现在就是这样）；想清空某个字段，就保留这一列并把单元格留空。两者都不做是不行的。',
    },
    'VG-VAR-001': {
      title: '该变体在待导入文件中没有对应行',
      rationale:
        '未获官方文档证实。本工具依据的是社区用户报告的行为——覆盖式导入会把文件视为每个匹配 Handle 的完整变体列表；同时也依据 Shopify 自己的说法：修改选项值「sees this as creating new variants. Consequently, the previous variants and their inventory are removed.」（非官方译文：这会被视为创建新变体，因此原有的变体及其库存会被移除。）（来自 Support，由商家在 community.shopify.com/t/inventory-values-deleted-from-csv-upload/260795 中引用）',
      suggestion:
        '把缺失的变体行补回去。如果这个变体确实要停用，请在后台明确地删除它，这样你能亲眼看到这次变更。',
    },
    'VG-VAR-002': {
      title: '选项值已更改 — Shopify 会重建该变体',
      rationale:
        'Shopify 官方文档：「Changing data in the Option1 value, Option2 value, or Option3 value columns of the product CSV file deletes existing variant IDs, and creates new variant IDs. Any change to variant IDs values can break third-party dependencies on variant IDs.」（非官方译文：修改商品 CSV 文件中 Option1 value、Option2 value 或 Option3 value 列的数据，会删除已有的变体 ID 并创建新的变体 ID。变体 ID 的任何变动都可能破坏第三方对变体 ID 的依赖。）',
      suggestion:
        '请预期变体 ID 会变化。任何以变体 ID 为键的集成都必须更新。如果你只是想换个标签，请在后台改名。',
    },
    'VG-VAR-003': {
      title: '该商品现在使用的选项位置更少了',
      rationale:
        'Shopify 官方文档支持：选项值构成变体身份标识，更改选项值会重建变体。少填一个位置，会让已有的变体行在文件中找不到任何对应行。',
      suggestion: '保持第三个选项位置有值，或者接受变体会合并成更少的变体。',
    },
    'VG-VAR-004': {
      title: '待导入文件中存在重复的选项组合',
      rationale:
        'Shopify 官方文档：「Validation failed: options are not unique. This error is caused when a product has duplicate options. You might have set up a product with two variants with the same option values.」（非官方译文：验证失败：选项不唯一。出现这个错误是因为商品存在重复选项，可能是你给同一个商品的两个变体设置了相同的选项值。）',
      suggestion: '让每个变体的选项值互不相同，或者把差异挪到一个不属于选项值的字段里。',
    },
    'VG-VAR-005': {
      title: '该 Handle 开启了第二个商品区块',
      rationale:
        'Shopify 官方文档：「The handle is used to uniquely identify each individual product. Make sure you have a unique handle for each product in your CSV.」（非官方译文：Handle 用于唯一标识每一个商品。请确保你的 CSV 中每个商品都有唯一的 Handle。）重复出现的商品区块会被报告为「Ignored line # because handle already exists」（非官方译文：已忽略该行，因为 Handle 已存在）。',
      suggestion:
        '每个 Handle 只保留一行商品行，后面跟着它的变体行。同一个 Handle 出现两个商品区块，通常是因为把两次导出拼接在了一起，或者恢复了一段被删掉的区块。',
    },
    'VG-VAR-006': {
      title: '选项值被移到了另一个位置',
      rationale:
        'Shopify 官方文档：「The CSV import fails when a file tries to assign an existing option value to a new option position, creating a conflict as variant options must be unique.」（非官方译文：当文件试图把一个已有的选项值分配到新的选项位置时，CSV 导入会失败，因为变体选项必须唯一，由此产生冲突。）',
      suggestion: '要交换的是列里的内容，而不是列名，这样每个选项名才能留在原来的位置。',
    },
    'VG-VAR-007': {
      title: '变体的这个字段会被清空',
      rationale:
        'Shopify 官方文档：「If a non-required column in the import CSV file is blank, then the matching value in the product list is overwritten as blank.」（非官方译文：如果导入 CSV 文件中某个非必需列为空，那么商品列表中对应的值会被覆盖为空。）',
      suggestion:
        '把值补回去，或者干脆把这一列从文件中删掉——官方文档中，让某个值保持不变的做法就是让这一列不存在。',
    },
    'VG-VAR-008': {
      title: '库存数量会被清零或大幅减少',
      rationale:
        '「空值即清空」这条规则对 On hand / On hand (new) 的适用方式，与对其他任何列完全相同。商家最常想改的是价格而不是库存，结果库存作为副作用丢失了。',
      suggestion:
        '把数量恢复回去。Shopify 官方文档支持：On hand (new) 是用来设置新数量的列，在不想改动数量时也可以安全地留空。',
    },
    'VG-VAR-009': {
      title: 'SKU 被修改、清空或重复',
      rationale:
        '修改 SKU 并未被说明会重建变体，但 Shopify 官方文档支持：只导入 SKU 列而没有对应的选项列时，变体的选项会被删除。SKU 同时也是商品数据源、库存系统和订单导出之间惯用的关联键。',
      suggestion: '除非你有意为整个目录重新编号，否则请保持 SKU 稳定，并确保文件内每个 SKU 都是唯一的。',
    },
    'VG-VAR-010': {
      title: '价格变动幅度异常',
      rationale: '启发式判断：价格向上或向下变动超过 50%，或者降到 0。',
      suggestion: '导入前抽查一下价格列。',
    },
    'VG-VAR-011': {
      title: '设置了划线价，这会让该变体进入促销状态',
      rationale: '启发式判断：Compare at Price 原本不存在或为空，现在有了一个高于变体价格的值。',
      suggestion: '确认这次促销是有意为之——它会改变顾客在店铺前台看到的内容。',
    },
    'VG-VAR-012': {
      title: '单选项商品没有使用 Default Title',
      rationale:
        'Shopify 官方文档：「A product can have up to 3 options. If a product has only one option, then this value should be Default Title.」（非官方译文：一个商品最多可以有 3 个选项。如果一个商品只有一个选项，那么这个值应当是 Default Title。）',
      suggestion: '如果这个商品确实只有一个选项，请把 Option1 Value 设为 Default Title。',
    },
    'VG-VAR-013': {
      title: '图片行被删除',
      rationale:
        '根据有文档支持的覆盖写入约定推断：文件中不存在的值会被保留，因此删除图片行不应删除图片。之所以标记它，是因为商家往往以为图片行就是图片本身，而这一点需要在真实店铺上确认。',
      suggestion: '在一个测试商品上确认删除图片行是否会导致图片被解绑。如果会，请把这些行补回去。',
    },
    'VG-VAR-014': {
      title: '选项名称已更改',
      rationale:
        'Shopify 官方文档支持：选项「值」的更改会重建变体 ID。选项「名称」的更改则没有任何一方的官方说明；之所以标记它，是因为选项名称是面向顾客的，它会改变筛选标签和主题文案。',
      suggestion: '确认选项标签的更改是有意为之；它会改变店铺前台的筛选文案。',
    },
    'VG-VAR-015': {
      title: '变体行中有一个选项值为空',
      rationale:
        '一行因为某个选项有值而被识别为变体，但后面的某个位置缺少值，就会在变体矩阵中留下一个空洞。',
      suggestion: '把缺失的选项值补上，或者把数据挪到最靠前的那个已填位置。',
    },
  },

  // ---- finding-level text, one entry per emitted sentence ----
  finding: {
    'finding.note.priceNote': '没有价格的变体将无法售出。',
    'finding.note.sku': '（SKU {sku}）',
    'finding.note.titleNote': '——这可能会使该变体退出促销状态',

    'finding.VG-FMT-001.title': '无法识别的列「{field}」',
    'finding.VG-FMT-001.detail.1': '这一列在两个文件中都存在，但它不在 Shopify 商品 CSV 的文档列之内。',
    'finding.VG-FMT-001.detail.2': '这一列是待导入文件新增的，且不在 Shopify 商品 CSV 的文档列之内。',
    'finding.VG-FMT-001.detail.3': '这一列存在于基线导出中，但不在待导入文件里。',
    'finding.VG-FMT-001.rationale':
      "Shopify 官方文档：「The Collection column is the only column that you can add to the CSV file that doesn't break the format.」（非官方译文：Collection 是唯一一个可以添加到 CSV 文件而不会破坏格式的列。）",
    'finding.VG-FMT-001.suggestion':
      '确认列名的拼写，或者确认你并不需要它。未知列中的值无法被原生导入器写入。',

    'finding.VG-FMT-002.title': '变体 metafield 列「{field}」无法导入',
    'finding.VG-FMT-002.detail':
      '即使导入过程可能报告成功，这一列中的值也不会被原生商品 CSV 导入写入你的店铺。',
    'finding.VG-FMT-002.rationale': 'Shopify 官方文档支持：商品 CSV 的导入/导出不支持变体 metafield。',
    'finding.VG-FMT-002.suggestion':
      '这类数据请用变体批量编辑器（Settings → Custom data → Variants → 添加列）或 Admin API。导入成功并不等于这些值已经写入。',

    'finding.VG-FMT-003.title.1': 'Handle 中有前导或尾随空白字符',
    'finding.VG-FMT-003.title.2': '{field} 中有前导或尾随空白字符',
    'finding.VG-FMT-003.detail.1': '{file}文件第 {baselineLine} 行，Handle 值前后被空格包围。',
    'finding.VG-FMT-003.detail.2': '{file}文件第 {baselineLine} 行，{field} 值前后被空格包围。',
    'finding.VG-FMT-003.rationale.1': '身份标识列中多余的空白字符会导致无法与店铺中的值精确匹配。',
    'finding.VG-FMT-003.rationale.2': '变体身份标识列中多余的空白字符会导致无法与店铺中的值精确匹配。',
    'finding.VG-FMT-003.suggestion.1': '去掉 Handle 单元格的首尾空格后重新检查。',
    'finding.VG-FMT-003.suggestion.2': '去掉该单元格的首尾空格后重新检查。',

    'finding.VG-FMT-004.title': '待导入文件中 Status 单元格为空',
    'finding.VG-FMT-004.detail':
      '待导入文件有 Status 列，但这一行把它留空了。Shopify 官方文档支持：只要 Status 列存在，就必须有值。',
    'finding.VG-FMT-004.rationale':
      'Shopify 官方文档：「If this column is present, then it needs a value.」（非官方译文：如果存在这一列，它就必须有值。）这里留空是一次验证失败，不是把状态重置为 active。',
    'finding.VG-FMT-005.title': '有内容的行缺少 Handle，因此没有参与比较',
    'finding.VG-FMT-005.detail':
      '{file}文件第 {baselineLine} 行的其他单元格有内容，但没有 Handle，所以这一行没有参与比较。报告里如果没有别的发现，并不表示每一行都检查过了。',
    'finding.VG-FMT-005.rationale':
      'Handle 为空的行会被单独搁置，不进入商品和变体比较。如果这一行的其他单元格仍有内容，这些内容就没有被检查。',
    'finding.VG-FMT-005.suggestion':
      '给这一行补上 Handle，或者如果它只是编辑残留就删掉。不要把「没有其他发现」理解成每一行都检查过了。',
    'finding.VG-FMT-004.suggestion':
      '把该单元格设为 active / draft / archived，或者删掉整个 Status 列，让原有状态得以保留。',

    'finding.VG-PRD-001.title': '商品「{handle}」不在待导入文件中',
    'finding.VG-PRD-001.detail.1':
      '商品「{handle}」的全部 {variants} 个变体在待导入文件中都没有对应行，而且你已关闭「缺失商品会被保留」这一假设。',
    'finding.VG-PRD-001.detail.2':
      '商品「{handle}」的全部 {variants} 个变体在待导入文件中都没有对应行。Shopify 无法通过 CSV 批量删除商品，因此这个商品应该会原封不动地留在你的店铺里。',
    'finding.VG-PRD-001.rationale':
      "Shopify 官方文档：「CSV files can't be used to delete products in bulk.」（非官方译文：CSV 文件不能用于批量删除商品。）这就是为什么缺失商品 Handle 的风险是低，与缺失变体行不同。",
    'finding.VG-PRD-001.suggestion.1': '如果你不是有意移除这个商品，请把商品行恢复回去。',
    'finding.VG-PRD-001.suggestion.2':
      '商品本身无需处理——但请查看它下面的变体，因为「商品还在、变体缺失」属于另一条规则。',

    'finding.VG-PRD-002.title': '新商品「{handle}」将被创建',
    'finding.VG-PRD-002.detail': '有 {variants} 个变体行引用了一个在基线导出中不存在的 Handle。',
    'finding.VG-PRD-002.rationale':
      '不存在可被覆盖的匹配 Handle，因此 Shopify 没有可更新的对象，会创建这个商品。',
    'finding.VG-PRD-002.suggestion': '核实这个 Handle 不是某个已有商品 Handle 的拼写错误。',

    'finding.VG-PRD-003.title': '「{handle}」看起来被改名成了「{newHandle}」',
    'finding.VG-PRD-003.detail':
      '旧 Handle 已从待导入文件中消失，同时出现了一个内容相同的新 Handle。由于 Shopify 按 Handle 匹配，新 Handle 不会更新旧商品——它会创建出第二个商品，并把原来的留在原处。',
    'finding.VG-PRD-003.rationale': '基于内容的启发式匹配：{why}。',
    'finding.VG-PRD-003.suggestion':
      '如果你本意是更新这个商品，请在 CSV 中保留原来的 Handle。Handle 的改动是「导入成功但什么都没发生」以及意外产生重复商品的最常见原因。',

    'finding.VG-PRD-004.title': '「{handle}」将在店铺前台被隐藏',
    'finding.VG-PRD-004.detail': '{field} 从 {baselineValue} 变为 {proposedValue}。',
    'finding.VG-PRD-004.rationale': 'Shopify 官方文档支持：{field} 决定商品在店铺前台的可见性。',
    'finding.VG-PRD-004.suggestion':
      '把它改回可见的取值，或者在导入后到后台重新发布这个商品。',

    'finding.VG-PRD-005.title': '商品「{handle}」的 Title 为空',
    'finding.VG-PRD-005.detail.1':
      'Title 在基线文件中有值，而在待导入文件中为空。空单元格会把已有值覆盖为空，而 Title 是更新商品所需的两列之一。',
    'finding.VG-PRD-005.detail.2': 'Title 在待导入文件中为空。',
    'finding.VG-PRD-005.rationale':
      'Shopify 官方文档支持：空单元格会把对应的值覆盖为空，并明确指出更新商品时唯一必需的列是 URL handle 和 Title。',
    'finding.VG-PRD-005.suggestion':
      '把标题补回这个商品的第一行。只有同一商品的后续行才需要让 Title 留空。',

    'finding.VG-PRD-006.title.1': '列「{field}」不在待导入文件中',
    'finding.VG-PRD-006.title.2': '列「{field}」是待导入文件中新增的',
    'finding.VG-PRD-006.detail.1':
      '「{field}」被删掉了，但它依赖的列仍然存在。Shopify 官方文档支持：如果导入了一个其所依赖的列缺失的列，现有数据会被删除。',
    'finding.VG-PRD-006.detail.2':
      '「{field}」中的每个值都不会被这次导入改动，因为文件中没有这一列。',
    'finding.VG-PRD-006.detail.3':
      '待导入文件中的每一行都带有这一列，因此每个匹配到的商品都会带着这一列的值被写入。',
    'finding.VG-PRD-006.rationale.1':
      'Shopify 官方文档支持这条约定的两半：空单元格会覆盖为空，而不存在的列则让已有值保持不变。',
    'finding.VG-PRD-006.rationale.2': '「{field}」是一个历史遗留的列名，不在 Shopify 当前的文档列清单中。',
    'finding.VG-PRD-006.rationale.3': '基线导出中没有这一列。',
    'finding.VG-PRD-006.suggestion.1': '把「{field}」恢复回去，或者把它依赖的那些列删掉。不要让文件处于半完成状态。',
    'finding.VG-PRD-006.suggestion.2':
      '这正是让「{field}」保持不变的正确做法。如果你本意是清空它，就保留这一列并把单元格留空。',
    'finding.VG-PRD-006.suggestion.3':
      "对照 Shopify 当前的模板检查列名拼写；列名写错就不会被写入。",
    'finding.VG-PRD-006.suggestion.4': '确认这一列的填写是有意为之且内容正确。',

    'finding.VG-VAR-001.title': '变体「{variant}」在待导入文件中缺失',
    'finding.VG-VAR-001.detail.1':
      '「{handle}」在基线文件中有 {variants} 个变体。变体「{variant}」{note:sku}在待导入文件中没有对应行，而按预期，这个商品文件中的每一行都应代表一个变体。',
    'finding.VG-VAR-001.detail.2': '「{handle}」：变体「{variant}」在待导入文件中没有对应行。',
    'finding.VG-VAR-001.rationale.1':
      '本条依赖的是社区用户报告的「文件即完整变体列表」这一行为；Shopify 对此没有官方文档说明。',
    'finding.VG-VAR-001.rationale.2': '你已关闭「缺失变体会被删除」这一假设，因此本条仅供参考。',
    'finding.VG-VAR-001.suggestion.1':
      '把变体行补回去。如果是有意停用某个变体，请改为在后台删除它，这样变更是可见的、也是可撤销的。',
    'finding.VG-VAR-001.suggestion.2': '本条不假定会发生删除。列出它是为了让你确认这一遗漏是有意为之。',

    'finding.VG-VAR-002.title': '{field} 在「{variant}」上发生了变化',
    'finding.VG-VAR-002.detail':
      '{field} 从「{baselineValue}」变为「{proposedValue}」。Shopify 官方文档支持：修改选项值会删除已有的变体 ID 并创建一个新的，这会破坏所有引用该变体的东西——订单历史导出、数据源连接器，以及变体 ID 本身。',
    'finding.VG-VAR-002.rationale':
      'Shopify 官方文档：「Changing data in the Option1 value, Option2 value, or Option3 value columns of the product CSV file deletes existing variant IDs, and creates new variant IDs.」（非官方译文：修改商品 CSV 文件中 Option1 value、Option2 value 或 Option3 value 列的数据，会删除已有的变体 ID，并创建新的变体 ID。）',
    'finding.VG-VAR-002.suggestion':
      '请预期变体 ID 会变化。任何以变体 ID 为键的集成都必须更新。如果你只是想换个标签，请在后台改名。',

    'finding.VG-VAR-003.title': '「{handle}」的选项位置从 {baselineOptions} 个减少到 {proposedOptions} 个',
    'finding.VG-VAR-003.detail':
      '基线文件中的变体行填满了 {baselineOptions} 个选项位置；待导入文件最多只填 {proposedOptions} 个。带着那个被去掉位置的变体行，在待导入文件中没有对应行。',
    'finding.VG-VAR-003.rationale':
      '源自 Shopify 有文档支持的选项值身份标识：一行如果不再填同样的位置，它就是另一个变体。',
    'finding.VG-VAR-003.suggestion':
      '重新检查文件中的选项列。把两个选项位置合并成一个，是变体意外合并的最常见原因。',

    'finding.VG-VAR-004.title': '「{handle}」上存在重复的选项组合',
    'finding.VG-VAR-004.detail':
      '待导入文件中有 {count} 行使用了相同的选项值「{variant}」。Shopify 会以「Validation failed: options are not unique」（非官方译文：验证失败：选项不唯一）拒绝重复的选项组合。',
    'finding.VG-VAR-004.rationale': 'Shopify 官方文档说明了这个确切的验证错误及其成因。',
    'finding.VG-VAR-004.suggestion':
      '注意：我们的比较会把尾随空格和 Unicode 形式差异视为相同，因此在你看来不同的两行，在这里也可能被标记。',

    'finding.VG-VAR-005.title': 'Handle「{handle}」在{file}文件中开启了 {count} 个商品区块',
    'finding.VG-VAR-005.detail':
      '第 {lines} 行的这些行各自携带了商品「{handle}」的商品级数据。重复出现该 Handle 的变体行和图片行属于正常情况，不会被标记。{conflict}',
    'finding.VG-VAR-005.rationale':
      'Shopify 要求每个商品的 Handle 唯一，并会把重复的 Handle 报告为「Ignored line # because handle already exists」（非官方译文：已忽略该行，因为 Handle 已存在）。',
    'finding.VG-VAR-005.suggestion':
      '每个 Handle 只保留一行商品行，后面跟着它的变体行。如果这些行在 Title 或 Vendor 上不一致，那很可能是两个不同的商品，需要两个 Handle。',

    'finding.VG-VAR-006.title': '「{value}」被移到了另一个选项位置',
    'finding.VG-VAR-006.detail':
      '在「{handle}」上，选项值「{value}」在基线文件中位于另一个位置，现在却出现在 Option{position}。Shopify 官方文档支持：这种冲突会导致导入失败。',
    'finding.VG-VAR-006.rationale':
      'Shopify 官方文档支持：把已有的选项值分配到新的选项位置时，导入会失败。',
    'finding.VG-VAR-006.suggestion':
      '这通常意味着 Option1 Name 和 Option2 Name 连同它们的值一起被互换了。请恢复原来的位置。',

    'finding.VG-VAR-007.title': '{field} 会被清空{note:titleNote}',
    'finding.VG-VAR-007.detail.1':
      '「{variant}」在基线文件中的 {field} = {baselineValue}，而在待导入文件中该单元格为空。这个空值是一次写入，而不是遗漏，因此已保存的值会被覆盖为空。{note:priceNote}',
    'finding.VG-VAR-007.detail.2': '「{variant}」：{field} 在待导入文件中为空。',
    'finding.VG-VAR-007.rationale':
      'Shopify 官方文档：「If a non-required column in the import CSV file is blank, then the matching value in the product list is overwritten as blank.」（非官方译文：如果导入 CSV 文件中某个非必需列为空，那么商品列表中对应的值会被覆盖为空。）',
    'finding.VG-VAR-007.suggestion.1':
      '把该单元格补回去。如果这个字段应保持店铺中现有的值，就改为把整列从文件里删掉。',
    'finding.VG-VAR-007.suggestion.2': '本条不假定会被清空。如果这个值重要，请把单元格补回去。',

    'finding.VG-VAR-008.title.1': '{field} 会在「{variant}」上被清空',
    'finding.VG-VAR-008.title.2': '{field} 在「{variant}」上被设为 0',
    'finding.VG-VAR-008.title.3': '{field} 在「{variant}」上下降 {dropPct}%',
    'finding.VG-VAR-008.detail.1':
      '该变体在基线文件中的 {field} = {baselineQty}，而在待导入文件中该单元格为空。空单元格会被写入为空，因此数量不会保留。',
    'finding.VG-VAR-008.detail.2':
      '该变体在基线文件中的 {field} = {baselineQty}，而在待导入文件中该单元格为空。由于「空值即清空」这一假设已关闭，我们不断言数量会发生变化。',
    'finding.VG-VAR-008.detail.3':
      '数量从 {baselineQty} 降到 0。该变体会缺货，并可能因库存策略而停止销售。',
    'finding.VG-VAR-008.detail.4':
      '数量从 {baselineQty} 降到 {proposedQty}。对一次导入来说这是很大的变化，误用公式填充很容易造成这种结果。',
    'finding.VG-VAR-008.rationale.1':
      'Shopify 官方文档支持：导入文件中的空单元格会把对应的值覆盖为空。库存列与其他任何列一样适用这一规则。',
    'finding.VG-VAR-008.rationale.2': '文件中的数值会覆盖已保存的数量。',
    'finding.VG-VAR-008.rationale.3':
      '启发式判断：降幅至少 50%，且至少 5 个单位（{baselineQty} → {proposedQty}）。',
    'finding.VG-VAR-008.suggestion.1':
      '把数量恢复回去，或者从文件中删掉 {field} 列，让数量保持不变。',
    'finding.VG-VAR-008.suggestion.2': '如果这个数量重要，请把它恢复回去。',
    'finding.VG-VAR-008.suggestion.3':
      '确认这是有意为之——一旦导入，这里的 0 和被删除的行一样无法撤销。',
    'finding.VG-VAR-008.suggestion.4': '导入前请确认这个数量是正确的。',

    'finding.VG-VAR-009.title.1': 'SKU「{sku}」被 {count} 个变体使用',
    'finding.VG-VAR-009.title.2': 'SKU 会在「{variant}」上被清空',
    'finding.VG-VAR-009.title.3': 'SKU 在「{variant}」上发生变化',
    'finding.VG-VAR-009.detail.1':
      '「{sku}」出现在 {owners} 中。一个 SKU 被多个变体共用，会让库存自动化产生歧义——按 SKU 查询库存的系统无法分辨查到的是哪个变体。',
    'finding.VG-VAR-009.detail.2': 'SKU「{baselineValue}」变为空。空单元格会被写入为空，因此该 SKU 被移除。',
    'finding.VG-VAR-009.detail.3': 'SKU「{baselineValue}」变为「{proposedValue}」。',
    'finding.VG-VAR-009.rationale.1':
      '商家反馈的做法：变体之间重复使用 SKU 会破坏数据源和库存的同步。这只是我们标记的一种模式，并不是 Shopify 的验证错误。',
    'finding.VG-VAR-009.rationale.2':
      'SKU 是店铺、库存系统与销售渠道之间惯用的关联键。此外，Shopify 另有文档说明：只导入 SKU 列而没有选项列时，变体的选项会被删除。',
    'finding.VG-VAR-009.suggestion.1': '如果有系统按 SKU 查询库存，请给每个变体分配独立的 SKU。',
    'finding.VG-VAR-009.suggestion.2': '把 SKU 恢复回去。保持每个变体的 SKU 唯一。',
    'finding.VG-VAR-009.suggestion.3': '确认新 SKU 是有意为之且唯一的，并确保下游系统已同步更新。',

    'finding.VG-VAR-010.title': '价格在「{variant}」上变动 {ratioPct}%',
    'finding.VG-VAR-010.detail': 'Variant Price 从 {baselineValue} 变为 {proposedValue}。',
    'finding.VG-VAR-010.rationale': '启发式判断：变动至少 50%（{baselineValue} → {proposedValue}）。',
    'finding.VG-VAR-010.suggestion': '确认新价格是有意为之。',

    'finding.VG-VAR-011.title': '在「{variant}」上设置了划线价',
    'finding.VG-VAR-011.detail':
      'Variant Compare At Price 从 {baselineValue} 变为「{proposedValue}」，这会让该变体显示为促销中。',
    'finding.VG-VAR-011.rationale':
      'Compare At Price 高于 Variant Price，正是在店铺前台上渲染出促销标签和划线价的原因。',
    'finding.VG-VAR-011.suggestion': '确认这次促销是有意为之。',

    'finding.VG-VAR-012.title': '单选项商品「{handle}」使用了「{value}」而不是「{defaultTitle}」',
    'finding.VG-VAR-012.detail':
      '只有 Option1 Value 被填写，其值为「{value}」。Shopify 官方文档支持：只有一个选项的商品应当使用「{defaultTitle}」。',
    'finding.VG-VAR-012.rationale':
      'Shopify 官方文档：「If a product has only one option, then this value should be Default Title.」（非官方译文：如果一个商品只有一个选项，那么这个值应当是 Default Title。）',
    'finding.VG-VAR-012.suggestion': '除非这个商品确实需要一个真实选项，否则请使用「{defaultTitle}」。',

    'finding.VG-VAR-013.title': '「{handle}」的图片行从 {baselineImages} 行减少到 {proposedImages} 行',
    'finding.VG-VAR-013.detail':
      '待导入文件中这个商品的图片行更少了。根据有文档支持的覆盖写入约定，我们预期已有图片会保留在原处，但这一行为并未针对图片行单独作出官方文档说明。',
    'finding.VG-VAR-013.rationale':
      'Shopify 官方文档支持：文件中不存在的值会被保留。但它并未专门说明删除图片行的行为，因此请把这条当作一个待验证项，而不是一个预测结论。',
    'finding.VG-VAR-013.suggestion': '在导入整个文件之前，先用一个商品测试。',

    'finding.VG-VAR-014.title': '{field} 在「{handle}」上发生变化',
    'finding.VG-VAR-014.detail':
      '{field} 从「{baselineValue}」变为「{proposedValue}」。选项标签是面向顾客的：它会出现在筛选菜单里，而主题通常把选项名硬编码在文案中。',
    'finding.VG-VAR-014.rationale':
      'Shopify 对此没有官方文档说明。之所以标记它，是因为选项名称对顾客可见，而且常常会被批量本地化或统一。',
    'finding.VG-VAR-014.suggestion': '如果这是有意改名，请检查所有引用了旧名称的主题文案。',

    'finding.VG-VAR-015.title': '「{handle}」的选项位置存在空档',
    'finding.VG-VAR-015.detail':
      'Option{firstPosition} 有值，但 Option{gapAt} 为空，而 Option{nextPosition} 却有值。Shopify 期望选项值按顺序依次填入各位置。',
    'finding.VG-VAR-015.rationale': '启发式判断：选项矩阵中的空洞通常来自编辑过程中某一列被错位。',
    'finding.VG-VAR-015.suggestion': '把值整体左移，让已填的位置保持连续。',
  },

  // ---- parse-level findings (malformed file, bad encoding) ----
  parse: {
    BOM_UTF8: {
      message: '{label} 以 UTF-8 BOM 开头。解析时已将其剥离，因此表头名称可以正确比较。',
      title: '已剥离 UTF-8 BOM',
      rationale: '该问题在解析文件阶段就已发现，早于任何比对。文件本身存在结构问题，会让后续所有比对结果变得不可靠。',
      suggestion: '请先修复文件，再参考本报告的结论。',
    },
    DUPLICATE_HEADER: {
      message: '表头「{name}」出现了 {count} 次（第 {firstColumn} 列和第 {secondColumn} 列）。只有第一列会被比较。',
      title: '列名重复',
      rationale: '该问题在解析文件阶段就已发现，早于任何比对。文件本身存在结构问题，会让后续所有比对结果变得不可靠。',
      suggestion: '请先修复文件，再参考本报告的结论。',
    },
    EMPTY_FILE: {
      message: '{label} 是空文件，没有任何内容可供比较。',
      title: '文件为空',
      rationale: '该问题在解析文件阶段就已发现，早于任何比对。文件本身存在结构问题，会让后续所有比对结果变得不可靠。',
      suggestion: '请先修复文件，再参考本报告的结论。',
    },
    ENCODING_MOJIBAKE: {
      message: '{label} 疑似编码错误（UTF-8 字节被按 Latin-1 读取）。商品文案、Handle 和 SKU 将无法与店铺匹配，即使是正确的差异比对也会显示为「全部都变了」。请将文件重新另存为 UTF-8。',
      title: '文件疑似编码错误',
      rationale: '该问题在解析文件阶段就已发现，早于任何比对。文件本身存在结构问题，会让后续所有比对结果变得不可靠。',
      suggestion: '请将文件重新另存为 UTF-8 编码的 CSV 后再上传。在确认文件文本无误之前，请勿导入。',
    },
    ENCODING_UTF16: {
      message: '{label} 是 UTF-16 编码（Excel 另存为「Unicode Text」的典型情况）。这里已正确解码，但上传到 Shopify 前请重新另存为 UTF-8，以免商品文案乱码。',
      title: '文件是 UTF-16 编码，不是 UTF-8',
      rationale: '该问题在解析文件阶段就已发现，早于任何比对。文件本身存在结构问题，会让后续所有比对结果变得不可靠。',
      suggestion: '请先修复文件，再参考本报告的结论。',
    },
    NO_DATA_ROWS: {
      message: '{label} 有表头行，但没有数据行。',
      title: '有表头但没有数据行',
      rationale: '该问题在解析文件阶段就已发现，早于任何比对。文件本身存在结构问题，会让后续所有比对结果变得不可靠。',
      suggestion: '请先修复文件，再参考本报告的结论。',
    },
    NO_HANDLE_COLUMN: {
      message: '{label} 没有 Handle 列。本工具的所有比较都以 Handle 为键，缺少它的话结果没有意义。',
      title: '缺少 Handle 列',
      rationale: '该问题在解析文件阶段就已发现，早于任何比对。文件本身存在结构问题，会让后续所有比对结果变得不可靠。',
      suggestion: '请先修复文件，再参考本报告的结论。',
    },
    NO_HEADER: {
      message: '{label} 无法被解析成任何 CSV 记录。',
      title: '缺少可用的表头行',
      rationale: '该问题在解析文件阶段就已发现，早于任何比对。文件本身存在结构问题，会让后续所有比对结果变得不可靠。',
      suggestion: '请先修复文件，再参考本报告的结论。',
    },
    RAGGED_ROW_EXTRA_CELLS: {
      message: '第 {startLine} 行有 {cellCount} 个单元格，但表头只有 {headerCount} 列。多出的单元格会被忽略。',
      title: '该行的单元格数多于表头列数',
      rationale: '该问题在解析文件阶段就已发现，早于任何比对。文件本身存在结构问题，会让后续所有比对结果变得不可靠。',
      suggestion: '请先修复文件，再参考本报告的结论。',
      detail: '通常意味着未加引号的字段里含有逗号。',
    },
    RAGGED_ROW_MISSING_CELLS: {
      message: '第 {startLine} 行有 {cellCount} 个单元格，但表头有 {headerCount} 列。末尾缺失的单元格会被视为「不在文件中」，而不是「空值」。',
      title: '该行的单元格数少于表头列数',
      rationale: '该问题在解析文件阶段就已发现，早于任何比对。文件本身存在结构问题，会让后续所有比对结果变得不可靠。',
      suggestion: '请先修复文件，再参考本报告的结论。',
      detail: '短行并不会清空缺失的列；末尾缺失的单元格会被读作「不在文件中」。',
    },
    UNUSUAL_FIELD_COUNT: {
      message: '{label} 只有 {count} 列。Shopify 商品 CSV 通常远多于此。',
      title: '列数明显偏少',
      rationale: '该问题在解析文件阶段就已发现，早于任何比对。文件本身存在结构问题，会让后续所有比对结果变得不可靠。',
      suggestion: '请先修复文件，再参考本报告的结论。',
    },
    _suggestion: {
      message: '请先修复文件，再参考本报告的结论。',
      rationale: '该问题在解析文件阶段就已发现，早于任何比对。文件本身存在结构问题，会让后续所有比对结果变得不可靠。',
    },
  },

  // ---- detection assumptions ----
  assumption: {
    absentProductIsRetained: {
      label: '文件中缺失的商品不会被删除',
      whenOff: '待导入文件中缺失的商品会被报告为「可能已被删除」，而不会被标记为安全。',
      caveat: 'Shopify 说明商品 CSV 不能批量删除商品，因此仅仅是从文件中缺少某个 Handle，不会影响该商品。',
      evidenceZh: 'Shopify 官方文档：「CSV files can\'t be used to delete products in bulk.」（CSV 文件无法批量删除商品。）',
    },
    absentVariantIsDeleted: {
      label: '店铺中存在、但在文件中没有对应行的变体，会在导入时被删除',
      whenOff: '关于「待导入文件中缺失的变体」的发现会降级为参考信息式的「已从文件中移除」提示，而不再是删除警告。',
      caveat:
        '未获官方文档证实。我们没能找到任何一方的官方说明。这是最值得拿真实店铺验证的一条假设，因为它决定我们那些最高严重度的发现是否成立。',
      evidence:
        'Shopify 的商品 CSV 文档中没有这样的说明。商家们反复报告了这一情况，例如 Shopify 社区帖子「CSV product import deleted variants」（community.shopify.com/t/csv-product-import-deleted-variants-shopify-you-got-some-explaining-to-do/582717），以及 Shopify Support 在「Inventory values deleted from CSV upload」中被引用的解释：修改选项值「sees this as creating new variants. Consequently, the previous variants and their inventory are removed.」（非官方译文：这会被视为创建新变体，因此原有的变体及其库存会被移除。）',
      evidenceZh: '来源：Shopify 社区主题「CSV product import deleted variants」及 Shopify 支持部门的说明——修改选项值「会被视为创建新的变体，因此原有变体及其库存会被移除」。这些均为用户报告，Shopify 官方文档并未证实。',
    },
    blankClearsMissingPreserves: {
      label: '空单元格会清空该值；文件中不存在的列会让该值保持不变',
      whenOff: '字段级的「将被清空 / 将被覆盖」类发现会被隐藏。结构类发现（变体丢失、Handle 变更）仍会照常运行。',
      caveat: '这是整个工具中最吃重的一条假设，也是文档支持最好的一条。',
      evidence:
        "Shopify 官方文档：「If a non-required column in the import CSV file is blank, then the matching value in the product list is overwritten as blank.」（非官方译文：如果导入 CSV 文件中某个非必需列为空，那么商品列表中对应的值会被覆盖为空。）— 「If a non-required column isn't included in the import CSV file, but is included in the existing product list, then the value in the product list remains the same.」（非官方译文：如果某个非必需列没有出现在导入 CSV 文件中，但它存在于现有商品列表里，那么商品列表中的该值保持不变。）",
      evidenceZh: 'Shopify 官方文档：「If a non-required column in the import CSV file is blank, then the matching value in the product list is overwritten as blank.」以及「If a non-required column isn\'t included in the import CSV file, but is included in the existing product list, then the value in the product list remains the same.」（非必填列为空会覆盖为空白；非必填列未包含在导入文件中则保留原值。）',
    },
    handleMatchIsExact: {
      label: 'Handle 的匹配是精确匹配 —— 大小写和 Unicode 形式都必须一致',
      whenOff:
        'Handle 的比较将不区分大小写，并在 Unicode 规范化之后进行，因此「Tee-Shirt」和「tee-shirt」会被视为同一个商品。',
      caveat:
        '这是我们自己的推断。如果 Shopify 的匹配比较宽松，本工具会报出一些并不存在的不匹配；如果它匹配严格，那么它就是对的。反方向的错误——把一个并非新增的商品说成新增——才是危险的方向，所以我们默认采用严格匹配。',
      evidence:
        'Shopify 官方文档支持：Handle 唯一标识一个商品，并且匹配的 Handle 会被覆盖。但官方文档没有说明这一比较是否不区分大小写、是否经过 Unicode 规范化。',
      evidenceZh: 'Shopify 官方文档说明了 Handle 唯一标识商品、匹配 Handle 会被覆盖，但没有说明比较是否区分大小写或是否做 Unicode 规范化。这一条属于本工具的推断。',
    },
    overwriteMatchingHandles: {
      label: '导入使用「Overwrite products with matching handles」（非官方译文：覆盖 Handle 相同的商品）',
      whenOff: '匹配到的商品在导入时会被忽略。这里几乎所有发现都将失去意义——这就是本工具默认假设为覆盖模式的原因。',
      caveat: 'Shopify 说明存在这个选项，并且匹配的 Handle 会在对应列上被覆盖。',
      evidenceZh: 'Shopify 官方文档：「When you import a CSV file, you can select the option Overwrite products with matching handles.」（导入 CSV 时可以选择「Overwrite products with matching handles」选项。选中后，当导入文件的 Handle 与现有商品匹配时，导入文件中的值会覆盖对应列。）',
    },
    variantIdentityIsOptionValues: {
      label: '一个变体由它的 Handle 加上 Option1–3 的值共同标识',
      whenOff: '变体会改为按位置匹配，这会消除所有与选项变更有关的发现。不建议这样设置。',
      caveat:
        'Shopify 官方文档支持：修改选项「值」会删除并重建变体 ID；只有当选项值构成变体身份标识时，这才有意义。',
      evidenceZh: 'Shopify 官方文档：「Changing data in the Option1 value, Option2 value, or Option3 value columns of the product CSV file deletes existing variant IDs, and creates new variant IDs.」（修改 Option 值列会删除并重建变体 ID。）',
    },
  },

  // ---- sample scenarios ----
  scenario: {
    clean: {
      title: '常规价格修改',
      blurb: '价格变了，没有动任何结构性的东西。',
      teaches: '这就是一次安全修改的样子。整份报告的关键，在于编辑之后选项值、Handle 和列集合是否都还在。',
    },
    'column-dropped': {
      title: '列从文件里被删掉',
      blurb: '待导入的导出文件里整个去掉了 On hand。',
      teaches: '缺失的列会让已保存的值保持不变；留空的列则会清空它。两个看起来很像的文件，结果完全相反。',
    },
    'duplicate-options': {
      title: '重复的变体选项组合',
      blurb: 'Tee 多出第二行 Black / Medium。',
      teaches:
        'Shopify 会用「Validation failed: options are not unique」（非官方译文：验证失败：选项不唯一）拒绝这个文件——而且要等你上传完、等出结果之后才知道。',
    },
    everything: {
      title: '单个文件包含多项异常',
      blurb: '删掉一行、改了选项名、清空库存、清空 SKU，还有一个被隐藏的商品。',
      teaches: '一份赶在周五导出的真实文件大致就是这样。用它来看看，当没有一处是干净的时候，报告会如何排优先级。',
    },
    'handle-typo': {
      title: 'Handle 拼写错误',
      blurb: 'studio-mug 变成 studio-mugg，SKU 完全相同。',
      teaches: 'Shopify 按 Handle 匹配，所以改过的 Handle 不会更新这个商品——它会创建出第二个商品，而把原来的留在原处。',
    },
    'image-rows-removed': {
      title: '图片行被删除',
      blurb: 'Hoodie 的每一行图片都被删掉了。',
      teaches:
        '这是一个待验证项，而不是一个预测：我们最合理的解读是图片会保留，但 Shopify 并未就删除图片行作出官方文档说明，因此值得用单个商品测一次。',
    },
    'inventory-blanked': {
      title: '空白单元格导致库存字段可能被清空',
      blurb: '更新价格的同时，Hoodie 每一行的 On hand 都被清空了。',
      teaches: '空单元格是在说「这里没有值」，而不是「这里没写」。为了重新录入而清空数字，等于把库存也清掉了。',
    },
    'inventory-zeroed': {
      title: '重新录入数量时把库存清零',
      blurb: 'Notebook 的 On hand 被统一设成了 0。',
      teaches: '数值 0 和其他任何数字一样会被照写不误。这一步会静悄悄地成功，只有当顾客无法下单时才会被发现。',
    },
    'missing-variant': {
      title: '商品变体行缺失',
      blurb: '从一个 6 变体的商品中删掉了一行。',
      teaches: '最常见的真实故障：编辑表格时丢了一行。文件里没有任何地方写着「删除」——这一行只是不见了。',
    },
    'option-rename': {
      title: '变体选项值被修改',
      blurb: '三个 Tee 变体的 Black 都变成了 Jet。',
      teaches: 'Shopify 官方文档支持：修改选项值会删除变体 ID 并创建一个新的。任何以该变体 ID 为键的东西都会出问题。',
    },
    'option-swap': {
      title: '选项位置被互换',
      blurb: 'Notebook 的 Size 从 Option1 挪到了 Option2。',
      teaches: 'Shopify 官方文档支持：这个具体的冲突会直接导致导入失败，因为选项值必须在各个位置之间保持唯一。',
    },
    'quoted-newlines': {
      title: '单元格里的逗号、引号和换行',
      blurb: '正文文本中含有内嵌换行和引号字符。',
      teaches: '行号必须能扛住带引号的换行，否则每一条发现都会指向商家文件里错误的那一行。',
    },
    'sku-duplicates': {
      title: '所有变体共用一个 SKU',
      blurb: 'Tee 的全部 6 个变体现在共用同一个 SKU。',
      teaches:
        '这不是 Shopify 的验证错误，但任何按 SKU 查询库存的系统——数据源、仓储系统、第三方平台——都无法再区分这些变体。',
    },
    'status-blank': {
      title: 'Status 列留空',
      blurb: '文件里加了一列 Status，却一直没有填内容。',
      teaches: 'Shopify 官方文档支持：Status 列只要存在就必须有值。留空是一次验证失败，不是「保持 active」。',
    },
    'title-wiped': {
      title: '商品行上的 Title 被清空',
      blurb: '一次查找替换把每个第一行的 Title 都清空了。',
      teaches: 'Shopify 明确指出更新商品时唯一必需的列是 URL handle 和 Title。Title 留空，就是在写入一条「清空必填字段」的指令。',
    },
    unpublish: {
      title: '商品被隐藏',
      blurb: 'Notebook 的 Published on online store 被翻成了 FALSE。',
      teaches: '可见性的变化是无声的：导入报告成功，而商品就这样从店铺前台消失了。',
    },
  },
};

export default zhCN;
