import { mkdtemp, writeFile, readFile, copyFile, mkdir, rm, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, test } from 'vitest';
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
const shell=join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
async function setup(){
 const root=await mkdtemp(join(tmpdir(),'prg-public-setup-'));roots.push(root);
 await copyFile(resolve('install.ps1'),join(root,'install.ps1'));
 return root;
}
function install(root:string,bundle:string){return spawnSync(shell,['-NoProfile','-ExecutionPolicy','Bypass','-File',join(root,'install.ps1'),'-BundlePath',bundle,'-SkipCodexRegistration','-NoLaunch'],{encoding:'utf8',windowsHide:true,timeout:30000});}
async function manifest(root:string,sha256:string){await writeFile(join(root,'runtime-manifest.json'),JSON.stringify({version:'test',bundle:{name:'test.zip',url:'https://invalid.invalid/never-download',sha256}}));}
describe.skipIf(process.platform!=='win32')('Windows PowerShell 5.1 installation boundaries',()=>{
 test('rejects a tampered archive before execution or config creation',async()=>{
  const root=await setup(),zip=join(root,'bad.zip');await writeFile(zip,'not an archive');await manifest(root,'0'.repeat(64));
  const result=install(root,zip);expect(result.status).not.toBe(0);expect(result.stderr).toContain('SHA256 mismatch');
  await expect(access(join(root,'bridge.local.json'))).rejects.toThrow();
 });
 test('preserves existing configuration before touching runtime files',async()=>{
  const root=await setup(),config=join(root,'bridge.local.json');await writeFile(config,'keep this configuration');
  const result=install(root,join(root,'missing.zip'));expect(result.status).not.toBe(0);expect(result.stderr).toContain('already exists');
  expect(await readFile(config,'utf8')).toBe('keep this configuration');await expect(access(join(root,'.bridge-runtime'))).rejects.toThrow();
 });
 test('rejects a checksum-valid archive entry escaping the staging root',async()=>{
  const root=await setup(),zip=join(root,'traversal.zip'),maker=join(root,'make.ps1');
  await writeFile(maker,"$ErrorActionPreference=\u0027Stop\u0027\nAdd-Type -AssemblyName System.IO.Compression\nAdd-Type -AssemblyName System.IO.Compression.FileSystem\n$zip=[IO.Compression.ZipFile]::Open("+quote(zip)+",[IO.Compression.ZipArchiveMode]::Create)\n$entry=$zip.CreateEntry('../escape.txt')\n$writer=New-Object IO.StreamWriter($entry.Open())\n$writer.Write('harmless test')\n$writer.Dispose()\n$zip.Dispose()\n");
  const made=spawnSync(shell,['-NoProfile','-ExecutionPolicy','Bypass','-File',maker],{encoding:'utf8',windowsHide:true});expect(made.status,made.stderr).toBe(0);
  await manifest(root,createHash('sha256').update(await readFile(zip)).digest('hex'));
  const result=install(root,zip);expect(result.status).not.toBe(0);expect(result.stderr).toContain('escapes');
  await expect(access(join(root,'.bridge-runtime/escape.txt'))).rejects.toThrow();
 });
 test('PowerShell wrapper preserves quoted Unicode JSON over stdin',async()=>{
  const root=await setup(),scripts=join(root,'scripts'),bundle=join(root,'bundle');
  await mkdir(scripts);await mkdir(join(root,'.bridge-runtime'));await mkdir(join(bundle,'bridge/dist'),{recursive:true});
  await copyFile(resolve('scripts/bridge.ps1'),join(scripts,'bridge.ps1'));
  await writeFile(join(root,'bridge.local.json'),JSON.stringify({cli:{executable:process.execPath}}));
  await writeFile(join(root,'.bridge-runtime/active.json'),JSON.stringify({path:bundle}));
  await writeFile(join(bundle,'bridge/dist/index.js'),"let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(s))));");
  const input={project:'demo',search:'中文 "quoted" O\'Reilly $()'};
  const driver=join(root,'driver.ps1');await writeFile(driver,'\uFEFF[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)\n& '+quote(join(scripts,'bridge.ps1'))+' prg_inspect -InputJson '+quote(JSON.stringify(input))+'\n');
  const result=spawnSync(shell,['-NoProfile','-ExecutionPolicy','Bypass','-File',driver],{encoding:'utf8',windowsHide:true,timeout:30000});
  expect(result.status,result.stderr).toBe(0);expect(JSON.parse(result.stdout)).toEqual(input);
 });
});
