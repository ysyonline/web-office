/**
 * P0-1 快照体积实测（REPORT 附录 A 数据源，A.1 + A.2 两场景）
 *
 * 场景 A.1 混合内容（60% 数字 / 20% 中文文本 / 10% 日期 / 10% 公式，20 列宽）：
 *   直接实测 10 万 / 100 万 / 200 万 / 500 万格（非推算），体积与格数线性可验
 * 场景 A.2 全中文文本（每格 12-16 字符，20 列宽）：直接实测 100 万格
 *
 * gzip 统一 level 6（落库与传输同口径）。Node >= 22，大数据档位建议 --max-old-space-size=4096
 *
 * 运行：node --max-old-space-size=4096 src/size-probe.mjs
 */
import { Univer, UniverInstanceType } from '@univerjs/core';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { gzipSync } from 'node:zlib';

const SUB = 'sheet-1';

/** 伪随机（固定种子，保证两场景每次运行数值可复现） */
function makeRand(seed) {
    return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
}

/** A.1 混合内容：60% 短数字、20% 中文短文本、10% 日期数字、10% 公式文本 */
function buildMixed(rows) {
    const rand = makeRand(42);
    const cellData = {};
    for (let r = 0; r < rows; r++) {
        const row = {};
        for (let c = 0; c < 20; c++) {
            const dice = rand();
            if (dice < 0.6) row[c] = { v: Math.floor(rand() * 1000000) };
            else if (dice < 0.8) row[c] = { v: `部门${Math.floor(rand() * 99)}季度数据` };
            else if (dice < 0.9) row[c] = { v: 45000 + Math.floor(rand() * 365) };
            else row[c] = { f: `SUM(A${r + 1}:T${r + 1})` };
        }
        cellData[r] = row;
    }
    return cellData;
}

/** A.2 全中文文本：每格 12-16 字符（REPORT 附录 A.2 场景） */
function buildAllChinese(rows) {
    const rand = makeRand(7);
    const cellData = {};
    for (let r = 0; r < rows; r++) {
        const row = {};
        for (let c = 0; c < 20; c++) {
            row[c] = { v: `合同编号审核意见栏目标注第${Math.floor(rand() * 9999)}号` };
        }
        cellData[r] = row;
    }
    return cellData;
}

function measure(label, rows, cellData) {
    const univer = new Univer({ locale: 'zhCN', locales: { zhCN: {} }, logLevel: 0 });
    univer.registerPlugin(UniverSheetsPlugin);
    const wb = univer.createUnit(UniverInstanceType.UNIVER_SHEET, {
        id: 'book-size',
        name: 'size-probe',
        appVersion: '1.0.2',
        locale: 'zhCN',
        sheetOrder: [SUB],
        styles: {},
        sheets: {
            [SUB]: {
                id: SUB, name: 'Sheet1', cellData, rowCount: rows, columnCount: 20,
                defaultColumnWidth: 90, defaultRowHeight: 24, mergeData: [], rowData: {}, columnData: {}, status: 1,
            },
        },
    });
    // 走完整 save()：Univer 会归一化类型标记 t 等字段，实测真实落库形态
    const json = JSON.stringify(wb.save());
    const gz = gzipSync(Buffer.from(json), { level: 6 });
    univer.dispose();
    const cells = rows * 20;
    console.log(`${label} ${cells} 格（${rows} 行 x 20 列）：JSON ${fmt(json.length)} / gzip(6) ${fmt(gz.length)} / 压缩比 ${(json.length / gz.length).toFixed(1)}x`);
    return { cells, json: json.length, gzip: gz.length };
}

function fmt(bytes) {
    if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + 'MB';
    return (bytes / 1024).toFixed(1) + 'KB';
}

console.log('=== A.1 混合内容场景 ===');
const mixed = [];
for (const rows of [5000, 50000, 100000, 250000]) {
    mixed.push(measure('[A.1]', rows, buildMixed(rows)));
}

console.log('\n=== A.2 全中文文本场景（REPORT 附录 A.2）===');
const chinese = measure('[A.2]', 50000, buildAllChinese(50000));

// 线性度核对（A.1）
const perCellJson = mixed[3].json / mixed[3].cells;
const perCellGz = mixed[3].gzip / mixed[3].cells;
console.log('\n--- 线性度核对（A.1）---');
console.log(`每格 JSON ~${(perCellJson).toFixed(1)} 字节，500 万格档推算 100 万格 gzip：~${fmt(perCellGz * 1000000)}（与实测 100 万格 ${fmt(mixed[1].gzip)} 对照）`);

console.log('\n--- 实测数据表（REPORT 附录 A 用）---');
console.log('| 场景 | 规模 | JSON 原始 | gzip(6) | 压缩比 |');
for (const r of mixed) {
    console.log(`| A.1 混合 | ${r.cells} 格 | ${fmt(r.json)} | ${fmt(r.gzip)} | ${(r.json / r.gzip).toFixed(1)}x |`);
}
console.log(`| A.2 全中文 | ${chinese.cells} 格 | ${fmt(chinese.json)} | ${fmt(chinese.gzip)} | ${(chinese.json / chinese.gzip).toFixed(1)}x |`);
