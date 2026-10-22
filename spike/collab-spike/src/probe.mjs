// probe: 能否在 Node 无头环境启动 Univer 并执行命令
import { Univer, UniverInstanceType, ICommandService, IUniverInstanceService, CommandType } from '@univerjs/core';
import { UniverSheetsPlugin, SetRangeValuesMutation, SetRangeValuesCommand } from '@univerjs/sheets';

function buildWorkbookData(id) {
  return {
    id,
    name: 'spike',
    appVersion: '1.0.2',
    locale: 'zhCN',
    sheetOrder: ['sheet-1'],
    styles: {},
    sheets: {
      'sheet-1': {
        id: 'sheet-1',
        name: 'Sheet1',
        cellData: {},
        rowCount: 20,
        columnCount: 10,
        defaultColumnWidth: 90,
        defaultRowHeight: 24,
        mergeData: [],
        rowData: {},
        columnData: {},
        status: 1,
      },
    },
  };
}

const univer = new Univer({ locale: 'zhCN', logLevel: 0 });
univer.registerPlugin(UniverSheetsPlugin);

const workbook = univer.createUnit(UniverInstanceType.UNIVER_SHEET, buildWorkbookData('book-1'));
console.log('[probe] workbook created:', workbook.getUnitId());

const injector = univer.__getInjector();
const commandService = injector.get(ICommandService);

console.log('[probe] SetRangeValuesMutation.id =', SetRangeValuesMutation.id);
console.log('[probe] SetRangeValuesCommand.id =', SetRangeValuesCommand.id);
console.log('[probe] mutation type =', SetRangeValuesMutation.type, '(CommandType.MUTATION =', CommandType.MUTATION, ')');

// 监听 onMutationExecutedForCollab（Univer 1.0.2 内建协作钩子）
const disposal = commandService.onMutationExecutedForCollab((info) => {
  console.log('[probe] collab hook fired:', info.id, JSON.stringify(info.params));
});
console.log('[probe] onMutationExecutedForCollab registered:', typeof disposal === 'object' || typeof disposal === 'function');

const r = commandService.syncExecuteCommand(SetRangeValuesMutation.id, {
  unitId: 'book-1',
  subUnitId: 'sheet-1',
  cellValue: { '0': { '0': { v: 'hello' }, '1': { v: 42 } } },
});
console.log('[probe] mutation executed ->', r);

const sheet = workbook.getSheetBySheetId('sheet-1');
console.log('[probe] A1 =', JSON.stringify(sheet.getCell(0, 0)?.v));
console.log('[probe] B1 =', JSON.stringify(sheet.getCell(0, 1)?.v));

console.log('[probe] snapshot cellData =', JSON.stringify(workbook.save().sheets['sheet-1'].cellData));
