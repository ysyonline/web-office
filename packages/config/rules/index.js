/**
 * 自定义 P0 规则注册表（P3-001 §5.2 ⑥）。
 *
 * 这里是唯一注册点：新增规则必须同时登记到 WO_RULE_NAMES，
 * `scripts/check-workspace-deps.mjs` 会断言 preset 里 error 级规则名与本表一致（防注册表漂移）。
 */
import noEmoji from './no-emoji.js';
import noHardcodedColor from './no-hardcoded-color.js';
import requestSchemaStrict from './request-schema-strict.js';

export const WO_RULE_NAMES = ['no-emoji', 'no-hardcoded-color', 'request-schema-strict'];

export const woPlugin = {
  meta: {
    name: 'wo',
    version: '0.0.0',
  },
  rules: {
    'no-emoji': noEmoji,
    'no-hardcoded-color': noHardcodedColor,
    'request-schema-strict': requestSchemaStrict,
  },
};

export default woPlugin;
