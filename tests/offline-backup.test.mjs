import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePackage,themeFromBackup,mergeTheme} from '../dist/core/packages.js';
import {PEER_KEY,DRAW_KEY} from '../dist/core/offline-tools.js';
import {MOVES_KEY,moveBlock} from '../dist/core/moves.js';
import {validateEnvelope} from '../dist/core/model.js';

test('完整备份保留朋友课表、抽签和调课，主题分享排除这些私人数据',()=>{
 const own=validateEnvelope({version:1,settings:{startDate:'2026-08-31',totalWeeks:16},courses:[{id:'source',name:'备份验收课',teacher:'验收',day:1,start:1,end:2,weeks:[8],location:'A101'}]});
 const peer={version:1,name:'本机朋友',importedAt:'2026-10-21T00:00:00Z',envelope:own},draw={version:1,selectedId:'d',lists:[{id:'d',name:'私人选项',items:['选项甲','选项乙']}]},moves=moveBlock({version:1,entries:[]},own.courses[0],own.settings,{schoolId:'gzist-zfsoft',week:8,sourceStart:1,sourceEnd:2,targetDay:2,targetStart:5});
 const raw={format:'course-compass.backup',version:1,state:{'course-compass.v1':JSON.stringify(own),[PEER_KEY]:JSON.stringify(peer),[DRAW_KEY]:JSON.stringify(draw),[MOVES_KEY]:JSON.stringify(moves)},assets:{},themes:[]};
 const checked=validatePackage(raw);assert.deepEqual(JSON.parse(checked.state[PEER_KEY]),peer);assert.deepEqual(JSON.parse(checked.state[DRAW_KEY]),draw);assert.deepEqual(JSON.parse(checked.state[MOVES_KEY]),moves);
 const theme=themeFromBackup(checked);assert.ok(!JSON.stringify(theme).includes('本机朋友'));assert.ok(!JSON.stringify(theme).includes('私人选项'));const merged=mergeTheme(checked,theme);for(const key of [PEER_KEY,DRAW_KEY,MOVES_KEY])assert.equal(merged.state[key],checked.state[key]);
 assert.throws(()=>validatePackage({...raw,state:{...raw.state,[MOVES_KEY]:JSON.stringify({version:1,entries:[{...moves.entries[0],targetPeriod:13}]})}}),/调课/);
});
