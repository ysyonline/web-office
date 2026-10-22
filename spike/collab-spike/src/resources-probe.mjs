/**
 * 分支 C 探针：公式档案（snapshot.resources 侧车）在 Univer save/load 往返中的存活情况
 *
 * 背景：架构师选方案 C——白名单外公式剥 f，原文存 snapshot `resources`
 *      （Univer 官方插件级侧车结构），随物化一体持久化。
 * 要回答的三问：
 *   Q1 resources 是 IWorkbookData 的合法字段吗？（类型层）
 *   Q2 未注册任何 resource hook 的自定义 resources 条目，能随 save() 原样读出吗？
 *   Q3 经历「save -> createUnit -> save」一次物化/加载往返后，条目还在吗？
 *
 * 运行：node src/resources-probe.mjs
 */
import { Univer, UniverInstanceType, IUniverInstanceService, LocaleType } from '@univerjs/core';
import { UniverSheetsPlugin } from '@univerjs/sheets';

const UNIT_ID = 'res-book';
const SUB_UNIT_ID = 'res-sheet';

const univer = new Univer({ locale: LocaleType.ZH_CN, locales: {} });
univer.registerPlugin(UniverSheetsPlugin);

const ARCHIVE = [
    {
        id: 'formula-archive',
        name: 'FORMULA_ARCHIVE',
        data: {
            // 模拟三个白名单外公式格：sheet-1 的 A5 / C3 / Z100
            'formula-archive:res-sheet:4:0': { f: '=IRR(A1:A4)', v: 0.087, fn: 'IRR' },
            'formula-archive:res-sheet:2:2': { f: '=AGGREGATE(1,6,B1:B9)', v: 42, fn: 'AGGREGATE' },
            'formula-archive:res-sheet:99:25': { f: '=OFFSET(A1,1,0)', v: 7, fn: 'OFFSET' },
        },
    },
];

function snapshot(id) {
    return {
        id,
        name: 'res-probe',
        appVersion: '1.0.2',
        locale: 'zhCN',
        sheetOrder: [SUB_UNIT_ID],
        styles: {},
        resources: JSON.parse(JSON.stringify(ARCHIVE)),
        sheets: {
            [SUB_UNIT_ID]: {
                id: SUB_UNIT_ID,
                name: 'Sheet1',
                // 剥 f 后的形态：只有 v/t，没有 f
                cellData: {
                    4: { 0: { v: 0.087, t: 2 } },
                    2: { 2: { v: 42, t: 2 } },
                    99: { 25: { v: 7, t: 2 } },
                },
            },
        },
    };
}

console.log('[Q1] IWorkbookData.resources 为合法字段 —— 见 typedef.d.ts:72');

const wb1 = univer.createUnit(UniverInstanceType.UNIVER_SHEET, snapshot(UNIT_ID));
const saved1 = wb1.save();

const arc1 = saved1.resources?.find((r) => r.id === 'formula-archive');
console.log('\n[Q2] 未注册 hook 的自定义 resources 能否随 save() 读出？');
console.log('  resources 顶层存在:', !!saved1.resources);
console.log('  archive 条目存在   :', !!arc1);
console.log('  条目数             :', arc1 ? Object.keys(arc1.data).length : 0);
console.log('  A5 档案原文        :', arc1 ? JSON.stringify(arc1.data['formula-archive:res-sheet:4:0']) : '(丢失)');

// ---------- Q3：物化 -> 加载 -> 再物化 ----------
console.log('\n[Q3] 经历一次 物化->加载->再物化 往返后是否存活？');
const univer2 = new Univer({ locale: LocaleType.ZH_CN, locales: {} });
univer2.registerPlugin(UniverSheetsPlugin);
const wb2 = univer2.createUnit(UniverInstanceType.UNIVER_SHEET, saved1);
const saved2 = wb2.save();
const arc2 = saved2.resources?.find((r) => r.id === 'formula-archive');
console.log('  往返后 archive 存在:', !!arc2);
console.log('  往返后条目数       :', arc2 ? Object.keys(arc2.data).length : 0);
console.log('  往返后 A5 档案原文 :', arc2 ? JSON.stringify(arc2.data['formula-archive:res-sheet:4:0']) : '(丢失)');

// ---------- 附加：剥 f 的格子在往返后是否长出了 f ----------
console.log('\n[附] 剥 f 格在往返后是否被写回 f（应为无 f）');
[4, 2, 99].forEach((r) => {
    const c = r === 4 ? 0 : r === 2 ? 2 : 25;
    const cell = saved2.sheets[SUB_UNIT_ID].cellData?.[r]?.[c];
    console.log(`  row${r} col${c}: ${JSON.stringify(cell)}`);
});

console.log('\n[done]');
