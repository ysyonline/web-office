/**
 * ZodValidationPipe 四条分流用例（P3-011-04 包级断言的执行面）。
 *
 * 四条判据（台账原文）：body 未知键/错类型 → 400+7001、query 越界 → 400+7002、
 * path 非法 → 400+7004、非法 JSON → 400+7003。
 *
 * 测试分层（为什么不起 HTTP）：四条分流里 7001/7002/7004 都是「管道 + 异常对象」
 * 的行为，用管道直喂即确定；7003 是 JSON 解析层的行为（非法 JSON 到不了管道，
 * 由 Nest 内建 bodyParser 抛 BadRequestException），归异常过滤器分支处理。
 * 端点级「摘掉 pipe 必红」的反向验证与全端点遍历归 P3-037 的 E-CV 门禁（D1-13
 * 决议：漏挂防线不在本包）——本文件在过滤器用例里补一条「无 tag 异常不产 7xxx」
 * 的反断言，保证过滤器分支本身非恒真。
 *
 * query 越界用例照抄 D1-13-B「query/path 前置」行的 coerce 形态：
 * z.coerce.number().int().min(1).max(100)（Limit 组件逐项对齐）；limit=0 与
 * limit=''（→coerce 成 0）是缺 .min(1) 时的唯一探测器，故 7002 用例带 limit=0。
 */
import { type ArgumentsHost, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ValidationCode } from '../errors/validation-codes';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { ZodValidationException, ZodValidationPipe } from './zod-validation.pipe';

import './zh-locale';

/** 与 openapi components.parameters/Limit 逐项对齐的 query schema（D1-13-B 前置行）。 */
const LimitQuery = z.coerce.number().int().min(1).max(100);
/** 与 openapi FileId 组件对齐的 path schema（format: uuid）。 */
const FileIdPath = z.uuid();

describe('ZodValidationPipe 四条分流（P3-011-04）', () => {
  const LoginRequest = z.strictObject({
    username: z.string().min(3).max(64),
    password: z.string().min(8).max(128),
  });

  it('① body 未知键/错类型 → 7001，错误体形状 {code,message,detail:{errors:[{field,rule,message}]}}', () => {
    const pipe = new ZodValidationPipe(LoginRequest);
    // 未知键 + 错类型同时喂（-03 实测：首个 issue 可能是 invalid_type，断言必须查集合）
    const thrown = (() => {
      try {
        pipe.transform({ username: 'ab', password: 123, __probe_unknown__: 1 }, {} as never);
        return null;
      } catch (e) {
        return e;
      }
    })();

    expect(thrown).toBeInstanceOf(ZodValidationException);
    const vex = thrown as ZodValidationException;
    expect(vex.validationCode).toBe(ValidationCode.Body);
    const body = vex.getResponse() as Record<string, unknown>;
    expect(body['code']).toBe(7001);
    expect(body['message']).toBe('请求参数校验失败');
    const detail = body['detail'] as { errors: { field: string; rule: string; message: string }[] };
    const rules = detail.errors.map((e) => e.rule);
    expect(rules).toContain('unrecognized_keys');
    expect(rules).toContain('invalid_type');
    // field 形状：未知键在根级 → (root)；错类型在字段 → 点路径
    const unknownItem = detail.errors.find((e) => e.rule === 'unrecognized_keys');
    expect(unknownItem?.field).toBe('(root)');
    const typeItem = detail.errors.find((e) => e.rule === 'invalid_type');
    expect(typeItem?.field).toBe('password');
    // message 中文（zh-locale 生效），且必须内联未知键名（D1-13-B 强制要求，
    // 禁泛化文案——「存在未允许的字段」这类不带键名的模板过不了这条断言）
    expect(unknownItem?.message).toContain('__probe_unknown__');
    expect(unknownItem?.message).toMatch(/未知|未知的键/);
    // 三字段齐全，无第四字段（契约 ValidationErrorItem AP:false 的镜像约束）
    expect(Object.keys(unknownItem ?? {}).sort()).toEqual(['field', 'message', 'rule']);
  });

  it('② query 越界 → 7002（coerce 形态：limit=0 必须被 .min(1) 拦下）', () => {
    const pipe = new ZodValidationPipe(LimitQuery, { source: 'query' });
    // limit=0 是 D1-13-B 点名的「缺 .min(1) 缺陷唯一探测器」
    for (const evil of ['0', '101', '']) {
      const thrown = (() => {
        try {
          pipe.transform(evil, {} as never);
          return null;
        } catch (e) {
          return e;
        }
      })();
      expect(thrown).toBeInstanceOf(ZodValidationException);
      expect((thrown as ZodValidationException).validationCode).toBe(ValidationCode.Query);
      const body = (thrown as ZodValidationException).getResponse() as Record<string, unknown>;
      expect(body['code']).toBe(7002);
    }
    // happy path：'20' 被 coerce 成 20 且放行（coerce 不改写值——管道返回原值给服务层再转）
    expect(pipe.transform('20', {} as never)).toBe('20');
  });

  it('③ path 非法 → 7004（FileId：非 uuid）', () => {
    const pipe = new ZodValidationPipe(FileIdPath, { source: 'path' });
    const thrown = (() => {
      try {
        pipe.transform('not-a-uuid', {} as never);
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(thrown).toBeInstanceOf(ZodValidationException);
    expect((thrown as ZodValidationException).validationCode).toBe(ValidationCode.Path);
    const body = (thrown as ZodValidationException).getResponse() as Record<string, unknown>;
    expect(body['code']).toBe(7004);
    const detail = body['detail'] as { errors: { field: string }[] };
    // 单值 schema 的 issue path 为空 → (root)
    expect(detail.errors[0]?.field).toBe('(root)');
    // 合法 uuid 放行
    expect(pipe.transform('0b8b3f5e-1c2d-4e5f-8a9b-0c1d2e3f4a5b', {} as never)).toBe(
      '0b8b3f5e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
    );
  });

  it('④ 非法 JSON → 400+7003（过滤器分支：Nest 包装后的解析错误转 7003）', () => {
    const filter = new AllExceptionsFilter();
    const written: { status?: number; body?: unknown } = {};
    const res = {
      status(code: number) {
        written.status = code;
        return this;
      },
      json(body: unknown) {
        written.body = body;
        return this;
      },
    } as unknown as Response;
    const host = {
      switchToHttp: () => ({ getResponse: () => res }),
    } as unknown as ArgumentsHost;

    // 实测（test/__probe-err.spec.ts，用后即删）：Nest core 的 mapExternalException
    // 在路由层把 body-parser 的 SyntaxError 包装成 BadRequestException(message)，原始
    // type/statusCode 属性面已丢失——过滤器收到的就是 400 的 BadRequestException。
    // message 是 body-parser 的解析描述（unexpected token / is not valid JSON）。
    filter.catch(
      new BadRequestException(`Unexpected token 'o', ..."ername": not-json}" is not valid JSON`),
      host,
    );

    expect(written.status).toBe(400);
    const body = written.body as { code: number; message: string; detail: unknown };
    expect(body.code).toBe(7003);
    expect(body.detail).toBeNull();
  });

  it('反断言（过滤器非恒真）：无 tag 的普通异常不落 7xxx 校验分支', () => {
    const filter = new AllExceptionsFilter();
    const written: { status?: number; body?: unknown } = {};
    const res = {
      status(code: number) {
        written.status = code;
        return this;
      },
      json(body: unknown) {
        written.body = body;
        return this;
      },
    } as unknown as Response;
    const host = {
      switchToHttp: () => ({ getResponse: () => res }),
    } as unknown as ArgumentsHost;

    // 普通 BadRequestException（无 VALIDATION_ERROR_TAG）不该被当成校验异常（400+7xxx 带 errors）
    filter.catch(new BadRequestException('some http error'), host);
    const body = written.body as { code: number; detail: unknown };
    expect(written.status).toBe(400);
    expect(body.code).not.toBe(7001); // Nest 原生 BadRequest 走 HttpException 分支 → 9001 骨架兜底
    expect(body.detail).toBeNull();

    // 未知异常 → 500+9001，不裸奔
    filter.catch(new Error('boom'), host);
    expect(written.status).toBe(500);
  });

  it('反断言（管道非恒真）：合法输入直通，不抛异常', () => {
    const pipe = new ZodValidationPipe(LoginRequest);
    const value = { username: 'abc', password: '12345678' };
    expect(pipe.transform(value, {} as never)).toBe(value);
  });
});
