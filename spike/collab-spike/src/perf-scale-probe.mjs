/**
 * 分支 E 探针：Univer 无头「规模-耗时-体积」曲线（性能红线的成本模型输入）
 *
 * 覆盖不了什么（先说清）：P95 FPS 是 Canvas 渲染指标，无头环境测不到，
 * 必须由 Playwright 真浏览器测。本探针只测数据层与公式引擎，
 * 即「编辑 -> 重算收敛」与「快照物化」这两段的成本。
 *
 * 每档规模测量：
 *   T1 createUnit 建表耗时（含公式文本入库）
 *   T2 save() 快照序列化耗时
 *   T3 JSON.stringify 体积 / gzip 后体积 / gzip 耗时   —— 物化节流与 32MB 上限的成本输入
 *   T4 单次编辑 -> 依赖格重算收敛时延（含 10ms 去抖）
 *   M  rss / heapUsed
 *
 * 运行：node --max-old-space-size=4096 src/perf-scale-probe.mjs [最大单元格数]
 */
import { gzipSync } from 'node:zlib';
import os from 'node:os';
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

const MAX_CELLS = Number(process.argv[2] ?? 100000);
const SCALES = (process.env.SCALES
    ? process.env.SCALES.split(',').map(Number)
    : [10000, 50000, 100000, 500000, 1000000]
).filter((n) => n <= MAX_CELLS);
const FORMULA_RATIO = 0.1; // 10% 的格子是公式

console.log(`硬件: ${os.cpus()[0]?.model ?? '?'} | ${os.cpus().length} 核 | ${(os.totalmem() / 1024 ** 3).toFixed(1)}GB`);
console.log(`Node ${process.version} | ${process.platform}-${process.arch}\n`);

function buildCellData(rows, cols) {
    const cellData = {};
    const colLetter = (c) => {
        let s = '';
        c += 1;
        while (c > 0) {
            const m = (c - 1) % 26;
            s = String.fromCharCode(65 + m) + s;
            c = Math.floor((c - 1) / 26);
        }
        return s;
    };
    let fi = 0;
    const samples = [];
    for (let r = 0; r < rows; r++) {
        const row = {};
        for (let c = 0; c < cols; c++) {
            if ((r * cols + c) % Math.floor(1 / FORMULA_RATIO) === 0 && r > 0) {
                fi++;
                // 每个公式求上方 10 格之和
                const start = Math.max(1, r - 9);
                row[c] = { v: 0, t: 2, f: `=SUM(${colLetter(c)}${start}:${colLetter(c)}${r})` };
                if (r >= 10 && samples.length < 3) samples.push({ r, c, depRow: r - 1 });
            } else {
                row[c] = { v: (r * cols + c) % 97, t: 2 };
            }
        }
        cellData[r] = row;
    }
    return { cellData, formulaCount: fi, samples };
}

const rows = [];
for (const cells of SCALES) {
    const cols = Math.round(Math.sqrt(cells * 2));
    const r = Math.round(cells / cols);
    const univer = new Univer({ locale: LocaleType.ZH_CN, locales: {} });
    univer.registerPlugin(UniverSheetsPlugin);
    univer.registerPlugin(UniverFormulaEnginePlugin);
    univer.registerPlugin(UniverSheetsFormulaPlugin);

    const { cellData, formulaCount, samples } = buildCellData(r, cols);
    const actualCells = r * cols;

    const t0 = Date.now();
    const workbook = univer.createUnit(UniverInstanceType.UNIVER_SHEET, {
        id: `perf-${cells}`,
        name: 'perf',
        appVersion: '1.0.2',
        locale: 'zhCN',
        sheetOrder: ['s1'],
        styles: {},
        sheets: { s1: { id: 's1', name: 'Sheet1', cellData } },
    });
    const t1 = Date.now();

    const injector = univer.__getInjector();
    const commandService = injector.get(ICommandService);
    injector.get(IUniverInstanceService).focusUnit(`perf-${cells}`);

    const snap = workbook.save();
    const t2 = Date.now();

    const json = JSON.stringify(snap);
    const g0 = Date.now();
    const gz = gzipSync(Buffer.from(json));
    const t3 = Date.now();

    const sheet = workbook.getSheetBySheetId('s1');
    const val = (s) => sheet.getCell(s.r, s.c)?.v;

    // --- 段 1：载入后首次全量重算（所有公式格初始 v=0，变为非 0 即收敛）---
    const loadStart = Date.now();
    let initialCalc = -1;
    for (let i = 0; i < 600; i++) {
        await new Promise((res) => setTimeout(res, 10));
        if (samples.every((s) => val(s) !== 0)) {
            initialCalc = Date.now() - loadStart;
            break;
        }
    }

    // --- 段 2：稳态下一次编辑的增量重算收敛 ---
    const s0 = samples[0];
    const before = val(s0);
    await commandService.executeCommand(SetRangeValuesCommand.id, {
        unitId: `perf-${cells}`,
        subUnitId: 's1',
        range: { startRow: s0.depRow, endRow: s0.depRow, startColumn: s0.c, endColumn: s0.c },
        value: { v: 999999, t: 2 },
    });
    const editDone = Date.now();
    let converge = -1;
    for (let i = 0; i < 600; i++) {
        await new Promise((res) => setTimeout(res, 10));
        if (val(s0) !== before) {
            converge = Date.now() - editDone;
            break;
        }
    }

    // --- 段 3：第二次编辑（判断首次 5s 是「一次性全量建图」还是「每次都付」）---
    const before2 = val(s0);
    await commandService.executeCommand(SetRangeValuesCommand.id, {
        unitId: `perf-${cells}`,
        subUnitId: 's1',
        range: { startRow: s0.depRow, endRow: s0.depRow, startColumn: s0.c, endColumn: s0.c },
        value: { v: 888888, t: 2 },
    });
    const edit2Done = Date.now();
    let converge2 = -1;
    for (let i = 0; i < 600; i++) {
        await new Promise((res) => setTimeout(res, 10));
        if (val(s0) !== before2) {
            converge2 = Date.now() - edit2Done;
            break;
        }
    }

    const mem = process.memoryUsage();
    rows.push({
        cells: actualCells,
        formulas: formulaCount,
        create: t1 - t0,
        save: t2 - t1,
        gzip: t3 - g0,
        jsonMB: +(json.length / 1024 ** 2).toFixed(2),
        gzMB: +(gz.length / 1024 ** 2).toFixed(2),
        initialCalc,
        converge,
        converge2,
        rssMB: +(mem.rss / 1024 ** 2).toFixed(0),
        heapMB: +(mem.heapUsed / 1024 ** 2).toFixed(0),
    });
    console.log(
        `cells=${String(actualCells).padStart(7)} formulas=${String(formulaCount).padStart(6)} | ` +
            `create=${String(t1 - t0).padStart(6)}ms save=${String(t2 - t1).padStart(6)}ms ` +
            `gzip=${String(t3 - g0).padStart(5)}ms | json=${(json.length / 1024 ** 2).toFixed(2)}MB ` +
            `gz=${(gz.length / 1024 ** 2).toFixed(2)}MB | 首编重算=${converge}ms ` +
            `二次编辑重算=${converge2}ms | rss=${(mem.rss / 1024 ** 2).toFixed(0)}MB heap=${(mem.heapUsed / 1024 ** 2).toFixed(0)}MB`
    );
}

console.log('\n--- 汇总 ---');
console.table(rows);
console.log('\n注：P95 FPS 需 Playwright 真浏览器测量，本探针不涉及。');
