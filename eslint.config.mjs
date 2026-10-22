import { woPreset } from './packages/config/eslint-preset.js';

/**
 * 仓库根 flat config。所有规则与忽略项在 packages/config/eslint-preset.js 内定义，
 * 本文件只决定「开关」：typeAware 在后端骨架（P3-011）落地后打开。
 */
export default woPreset({ typeAware: false });
