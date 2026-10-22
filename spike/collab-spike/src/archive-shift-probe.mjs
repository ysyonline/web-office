/**
 * 分支 C 探针：公式档案坐标键在「结构操作」下是否随单元格一起迁移
 *
 * 假设前提（来自评审人）：
 *   - 公式档案以 `formula-archive:{sheetId}:{row}:{col}` 为键（坐标键）
 *   - 结构操作（插行/删行/插列/删列/排序/剪切粘贴）走服务端定序 oplog，
 *     只作用于 Univer cellData，不会自动改写第三方侧车档案
 *
 * 要回答：
 *   在 A5 处插入一行后，原本属于「A5」的缓存值 0.087 与档案条目 4:0
 *   是否仍然指向同一个格子？若不是，导出时 f 会被挂到哪个格子？
 *
 * 运行：node src/archive-shift-probe.mjs
 */
import {
    Univer,
    UniverInstanceType,
    IUniverInstanceService,
    ICommandService,
    LocaleType,
    Direction,
} from '@univerjs/core';
import { UniverSheetsPlugin, InsertRowCommand } from '@univerjs/sheets';

const UNIT_ID = 'shift-book';
const SUB_UNIT_ID = 'shift-sheet';
const ARCHIVE_KEY_ROW = 4;
const ARCHIVE_KEY_COL = 0;

const univer = new Univer({ locale: LocaleType.ZH_CN, locales: {} });
univer.registerPlugin(UniverSheetsPlugin);

// 档案（模拟 resources 侧车）：锁定 A5
const archive = {
    [`formula-archive:${SUB_UNIT_ID}:${ARCHIVE_KEY_ROW}:${ARCHIVE_KEY_COL}`]: {
        f: '=IRR(A1:A4)',
        v: 0.087,
        fn: 'IRR',
    },
};

const workbook = univer.createUnit(UniverInstanceType.UNIVER_SHEET, {
    id: UNIT_ID,
    name: 'shift-probe',
    appVersion: '1.0.2',
    locale: 'zhCN',
    sheetOrder: [SUB_UNIT_ID],
    styles: {},
    sheets: {
        [SUB_UNIT_ID]: {
            id: SUB_UNIT_ID,
            name: 'Sheet1',
            cellData: {
                0: { 0: { v: 11, t: 2 } },
                1: { 0: { v: 22, t: 2 } },
                2: { 0: { v: 33, t: 2 } },
                3: { 0: { v: 44, t: 2 } },
                // A5 = 白名单外公式 IRR 的缓存值（已剥 f）
                4: { 0: { v: 0.087, t: 2 } },
            },
        },
    },
});

const injector = univer.__getInjector();
const commandService = injector.get(ICommandService);

function findCell(snapshotData, v) {
    for (const [r, row] of Object.entries(snapshotData)) {
        for (const [c, cell] of Object.entries(row)) {
            if (cell && cell.v === v) return { row: Number(r), col: Number(c) };
        }
    }
    return null;
}

function readCell(snapshotData, r, c) {
    return snapshotData?.[r]?.[c] ?? null;
}

const before = workbook.save().sheets[SUB_UNIT_ID].cellData ?? {};
const posBefore = findCell(before, 0.087);
console.log('[插入前]');
console.log(`  缓存值 0.087 实际位置 : row=${posBefore.row} col=${posBefore.col}`);
console.log(`  档案键               : row=${ARCHIVE_KEY_ROW} col=${ARCHIVE_KEY_COL}`);
console.log(`  是否对齐             : ${posBefore.row === ARCHIVE_KEY_ROW && posBefore.col === ARCHIVE_KEY_COL ? '是' : '否'}`);

async function main() {
// 在第 0 行插入一行（UP），整表下移 1
console.log('\n[动作] 在第 0 行插入一行（Direction.UP）');
const ok = await commandService.executeCommand(InsertRowCommand.id, {
    unitId: UNIT_ID,
    subUnitId: SUB_UNIT_ID,
    range: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 9 },
    direction: Direction.UP,
});
console.log('  命令执行结果:', ok);

const after = workbook.save().sheets[SUB_UNIT_ID].cellData ?? {};
const posAfter = findCell(after, 0.087);
console.log('\n[插入后]');
console.log(`  缓存值 0.087 实际位置 : row=${posAfter ? posAfter.row : '(丢失)'} col=${posAfter ? posAfter.col : '-'}`);
console.log(`  档案键               : row=${ARCHIVE_KEY_ROW} col=${ARCHIVE_KEY_COL}`);
console.log(`  是否对齐             : ${posAfter && posAfter.row === ARCHIVE_KEY_ROW && posAfter.col === ARCHIVE_KEY_COL ? '是' : '否 ← 错位'}`);
console.log(`  档案键 row=${ARCHIVE_KEY_ROW} 处现在的格子: ${JSON.stringify(readCell(after, ARCHIVE_KEY_ROW, ARCHIVE_KEY_COL))}`);

console.log('\n[结论演示] 导出时按档案键还原 f：');
console.log(`  -> row=${ARCHIVE_KEY_ROW} col=${ARCHIVE_KEY_COL} 会被写上 ${JSON.stringify(archive[`formula-archive:${SUB_UNIT_ID}:${ARCHIVE_KEY_ROW}:${ARCHIVE_KEY_COL}`].f)}`);
console.log(`  -> 而它对应的真实缓存值 0.087 已位于 row=${posAfter ? posAfter.row : '?'}`);

console.log('\n[done]');
}

main().catch((e) => {
    console.error('[probe error]', e);
    process.exit(1);
});
