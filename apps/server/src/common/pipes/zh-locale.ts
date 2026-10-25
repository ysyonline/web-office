/**
 * zod 中文文案全局配置（P3-011-04）。
 *
 * 为什么单独成文件而不是写在管道里：z.config 是**进程级全局**副作用，管道是被
 * import 即实例化的类——把 config 写进管道模块会让「import 管道」产生隐式全局
 * 变更，而 shared 包的侧-effect 禁令（P3-001 §5.3）同理约束 server 侧。
 * 本文件由 app.module.ts 显式 import 一次（side-effect import），单一入口。
 *
 * 实测依据（zod 4.6.7）：z.locales.zhCN() 使 issue.message 变中文，其中
 * unrecognized_keys 的默认文案自带键名（「出现未知的键(key): \"zz\"」）——满足
 * D1-13-B「message 模板必须内联未知键名」的强制要求，禁止覆盖成泛化文案。
 * 现成 locales 无 zh-CN 尾缀名，导出名是 zhCN（实测 Object.keys(z.locales)）。
 */
import { z } from 'zod';

z.config(z.locales.zhCN());
