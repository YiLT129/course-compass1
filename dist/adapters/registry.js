export const adapters=[];
export function registerAdapter(adapter){if(!adapter.id||typeof adapter.detect!=='function'||typeof adapter.parse!=='function')throw Error('适配器缺少 id/detect/parse');if(adapters.some(a=>a.id===adapter.id))throw Error('适配器 ID 重复');adapters.push(adapter);}
export function importData(raw){const adapter=adapters.find(a=>a.detect(raw));if(!adapter)throw Error('没有识别到课表数据。请选择课间备份、通用课程 JSON 或正方课表 JSON；其他系统可使用通用表格。');return {...adapter.parse(raw),adapter:adapter.title};}
