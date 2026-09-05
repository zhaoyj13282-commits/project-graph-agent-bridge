import { spawnSync } from 'node:child_process';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { expect,test } from 'vitest';
test('actual CLI parses UTF-8 stdin and applies the exact quoted search',async()=>{
 const root=await mkdtemp(join(tmpdir(),'prg-stdin-'));
 try {
  const graph=join(root,'protocol.prg'),config=join(root,'bridge.json');
  await writeFile(graph,'opaque protocol double');
  await writeFile(config,JSON.stringify({cli:{executable:process.execPath,prefixArgs:[resolve('tests/fixtures/bridge-process.mjs')]},allowedRoots:[root],projects:{demo:{path:graph}}}));
  const result=spawnSync(process.execPath,[resolve('dist/index.js'),'call','prg_inspect','--config',config,'--input-stdin'],{input:JSON.stringify({project:'demo',search:'中文 "quoted"'}),encoding:'utf8',windowsHide:true});
  expect(result.status,result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({total:1,objects:[{text:'中文 "quoted"'}]});
 } finally {await rm(root,{recursive:true,force:true});}
});
