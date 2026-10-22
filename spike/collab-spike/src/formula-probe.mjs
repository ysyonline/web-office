/**
 * 导入场景运行时行为探针（评审人自建，非架构师产出）
 *
 * 目的：验证 import-export/plan.md WI-5「白名单外公式保留公式文本 + 缓存值」策略
 *       在 Univer 运行时（而非 IR 静态层）是否真的成立。
 *
 * 关注点：
 *   1. snapshot 载入后，携带 v(缓存值)+f(公式) 的单元格读回是否为 v
 *   2. 白名单外函数（=IRR）在 Univer 引擎中的运行时表现
 *   3. 触发重算（编辑被引用单元格）后，白名单外公式格与引用它的空白名单公式格会变成什么
 *
 * 运行：node src/formula-probe.mjs
 */
import {
    Univer,
    UniverInstanceType,
    IUniverInstanceService,
    ICommandService,
    LocaleType,
} from '@univerjs/core';
import { UniverSheetsPlugin, SetRangeValuesCommand } from '@univerjs/sheets';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';

const UNIT_ID = 'probe-book';
const SUB_UNIT_ID = 'probe-sheet';

const univer = new Univer({ locale: LocaleType.ZH_CN, locales: {} });
univer.registerPlugin(UniverSheetsPlugin);
univer.registerPlugin(UniverFormulaEnginePlugin);
univer.registerPlugin(UniverSheetsFormulaPlugin);

console.log('[step] plugins registered');

function buildCellData() {
    return {
        0: {
            // A1 数值
            0: { v: 1, t: 2 },
            // B1 白名单内公式 SUM
            1: { v: 3, t: 2, f: '=SUM(A1:A2)' },
            // C1 白名单外公式 IRR + 缓存值
            2: { v: 0.087, t: 2, f: '=IRR(A1:A3)' },
            // D1 白名单内公式，但引用了白名单外公式的结果
            3: { v: 0.174, t: 2, f: '=C1*2' },
        },
        1: {
            // A2 数值
            0: { v: 2, t: 2 },
        },
    };
}

const workbook = univer.createUnit(UniverInstanceType.UNIVER_SHEET, {
    id: UNIT_ID,
    name: 'probe',
    appVersion: '1.0.2',
    locale: 'zhCN',
    sheetOrder: [SUB_UNIT_ID],
    styles: {},
    sheets: {
        [SUB_UNIT_ID]: {
            id: SUB_UNIT_ID,
            name: 'Sheet1',
            cellData: buildCellData(),
        },
    },
});

console.log('[step] workbook created');

const injector = univer.__getInjector();
const instanceService = injector.get(IUniverInstanceService);
const commandService = injector.get(ICommandService);
instanceService.focusUnit(UNIT_ID);

function readRow(row) {
    const sheet = workbook.getSheetBySheetId(SUB_UNIT_ID);
    return [0, 1, 2, 3].map((c) => {
        const cell = sheet.getCell(row, c);
        if (!cell) return '(empty)';
        return JSON.stringify({ v: cell.v, f: cell.f, t: cell.t });
    });
}

console.log('\n--- 载入后立即读回 row 0 (A1/B1/C1/D1) ---');
readRow(0).forEach((s, i) => console.log(`  col${i}: ${s}`));

// 触发一次编辑，引发重算
console.log('\n[step] 编辑 A1 = 5 (触发依赖重算)');
commandService.executeCommand(SetRangeValuesCommand.id, {
    unitId: UNIT_ID,
    subUnitId: SUB_UNIT_ID,
    range: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
    value: { v: 5, t: 2 },
});

console.log('\n--- 重算后读回 row 0 ---');
readRow(0).forEach((s, i) => console.log(`  col${i}: ${s}`));

console.log('\n[done] probe finished');
