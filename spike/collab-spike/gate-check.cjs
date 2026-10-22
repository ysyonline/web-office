const yaml = require('js-yaml');
const fs = require('fs');
const ok = (name, pass, detail = '') => console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' -- ' + detail : ''}`);
let fails = 0;
const check = (name, pass, detail) => { ok(name, pass, detail); if (!pass) fails++; };

// 1. whitelist 数组恰 119
const wl = fs.readFileSync('D:/code/web-office/docs/formula/function-whitelist.md', 'utf8');
const m = wl.match(/```text\n([\s\S]*?)```/);
const lines = m[1].trim().split('\n').map((l) => l.trim()).filter(Boolean);
check('W1 数组行数 = 119', lines.length === 119, String(lines.length));
check('W2 全大写（点号合法）', lines.every((l) => /^[A-Z][A-Z.]*$/.test(l)));
check('W3 无重复', new Set(lines).size === lines.length);
const pm = `SUM, SUMIF, SUMIFS, SUMPRODUCT, SUBTOTAL, PRODUCT, ABS, ROUND, ROUNDUP, ROUNDDOWN, TRUNC, INT, MOD, SQRT, EXP, LN, LOG, CEILING, RAND, RANDBETWEEN,
AVERAGE, AVERAGEIF, AVERAGEIFS, COUNT, COUNTA, COUNTBLANK, COUNTIF, COUNTIFS, MAX, MIN, LARGE, SMALL, MEDIAN, STDEV, STDEVP, VAR, VARP, RANK, RANK.EQ,
IF, IFS, AND, OR, NOT, IFERROR, IFNA,
LEFT, RIGHT, MID, LEN, LENB, FIND, SEARCH, REPLACE, SUBSTITUTE, TRIM, CLEAN, UPPER, LOWER, PROPER, CONCAT, TEXTJOIN, TEXT, VALUE, EXACT,
TODAY, NOW, DATE, TIME, YEAR, MONTH, DAY, HOUR, MINUTE, SECOND, WEEKDAY, WEEKNUM, EDATE, EOMONTH, DATEDIF, DAYS, NETWORKDAYS, WORKDAY, DATEVALUE, TIMEVALUE,
VLOOKUP, HLOOKUP, XLOOKUP, INDEX, MATCH, XMATCH, LOOKUP, CHOOSE, ROW, COLUMN, ROWS, COLUMNS, TRANSPOSE,
PMT, IPMT, PPMT, RATE, NPER, PV, FV, NPV, IRR, XNPV, XIRR, SLN, DDB, SYD, DB,
ISBLANK, ISERROR, ISNA, ISNUMBER, ISTEXT, N`.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
check('W4 与 PM 名单逐项一致', JSON.stringify(pm) === JSON.stringify(lines));
check('W5 volatile 规则保留', wl.includes('静态化') && wl.includes('RANDBETWEEN'));
check('W6 UI 口径：AlertCircle 12px 琥珀右上', wl.includes('AlertCircle') && wl.includes('12px') && wl.includes('琥珀'));
check('W7 公式栏灰态只读', wl.includes('灰态只读'));
check('W8 导出保留原文本', wl.includes('导出时同样保留原文本') || wl.includes('导出保留原文本'));
check('W9 修订记录 v1.2', wl.includes('| v1.2 |'));

// 2. openapi
const os = fs.readFileSync('D:/code/web-office/docs/api/openapi.yaml', 'utf8');
const doc = yaml.load(os);
const refs = [...os.matchAll(/\$ref:\s*'([^']+)'/g)];
let bad = 0;
for (const r of refs) {
    if (!r[1].startsWith('#/')) continue;
    let n = doc;
    for (const p of r[1].slice(2).split('/')) { if (n && p in n) n = n[p]; else { bad++; break; } }
}
check('O1 refs 零悬空', bad === 0, `${refs.length} refs, ${bad} bad`);
check('O2 ROLE_UPGRADE 帧入契约', os.includes('0x05 ROLE_UPGRADE') && os.includes('role-upgrade-ack') && os.includes('role-upgrade-reject'));
check('O3 满席 reject 保持只读', os.includes('满席回发 role-upgrade-reject') && os.includes('保持只读') || os.includes('连接保持 view'));
const lsProps = Object.keys(doc.paths['/api/v1/license/status'].get.responses['200'].content['application/json'].schema.properties);
check('O4 status 含 current/peakConcurrent', lsProps.includes('currentConcurrent') && lsProps.includes('peakConcurrent'), lsProps.join(','));
check('O5 4410 独立于席位', os.includes('互不替代'));
check('O6 4412 容量保护独立', os.includes('4412') && os.includes('容量保护'));
check('O7 ws/ticket 端点', !!doc.paths['/api/v1/ws/ticket']);
check('O8 users 端点 5 操作', ['get', 'post'].every((op) => doc.paths['/api/v1/users'][op]) && doc.paths['/api/v1/users/{id}'].get && doc.paths['/api/v1/users/{id}'].patch && !!doc.paths['/api/v1/users/{id}/unlock'].post);

// 3. schema + license design
const sc = fs.readFileSync('D:/code/web-office/docs/db/schema.md', 'utf8');
check('S1 peak_concurrent 在 3.7 实体块', /peakConcurrent:\s*number/.test(sc) && sc.includes("name: 'peak_concurrent'"));
check('S2 修订记录 v1.4', sc.includes('| v1.4 |'));
const ld = fs.readFileSync('D:/code/web-office/docs/license/design.md', 'utf8');
check('L1 商务备注', ld.includes('销售物料') && ld.includes('并发编辑用户数，查看不限'));
check('L2 容器权重表 0.40', ld.includes('0.40'));
check('L3 修订记录 v1.3', ld.includes('| v1.3 |'));

// 4. plan.md 导入策略
const pl = fs.readFileSync('D:/code/web-office/docs/import-export/plan.md', 'utf8');
check('P1 WI-5 AlertCircle 口径', pl.includes('AlertCircle') && pl.includes('灰态只读'));
check('P2 whitelist-foreign 用例', pl.includes('whitelist-foreign.xlsx'));

console.log(fails === 0 ? '\n门禁自检：全部通过' : `\n门禁自检：${fails} 项 FAIL`);
process.exit(fails ? 1 : 0);
