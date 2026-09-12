import { execFile } from 'node:child_process';

function powershell(script) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = String(stdout || '');
        error.stderr = String(stderr || '');
        reject(error);
        return;
      }
      resolve(String(stdout || ''));
    });
  });
}

function parseJson(text, fallback = null) {
  try { return JSON.parse(text); } catch { return fallback; }
}

export async function inspectPc() {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'PC inventory currently targets Windows.' };
  }

  const script = `
$os = Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,OSArchitecture,LastBootUpTime
$cpu = Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed
$ram = Get-CimInstance Win32_ComputerSystem | Select-Object @{N='TotalGB';E={[math]::Round($_.TotalPhysicalMemory/1GB,1)}}
$board = Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer,Product,Version,SerialNumber
$bios = Get-CimInstance Win32_BIOS | Select-Object Manufacturer,SMBIOSBIOSVersion,Version,ReleaseDate
$gpu = Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,DriverDate,@{N='VRAM_GB';E={if($_.AdapterRAM){[math]::Round($_.AdapterRAM/1GB,1)}else{$null}}}
$disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,FileSystem,@{N='SizeGB';E={[math]::Round($_.Size/1GB,1)}},@{N='FreeGB';E={[math]::Round($_.FreeSpace/1GB,1)}}
$top = Get-Process | Where-Object {$_.CPU -ne $null} | Sort-Object CPU -Descending | Select-Object -First 12 Name,Id,@{N='CPUSeconds';E={[math]::Round($_.CPU,1)}},WorkingSet64 | ForEach-Object { [pscustomobject]@{Name=$_.Name;Id=$_.Id;CPUSeconds=$_.CPUSeconds;RAM_MB=[math]::Round($_.WorkingSet64/1MB,0)} }
[pscustomobject]@{os=$os;cpu=$cpu;ram=$ram;motherboard=$board;bios=$bios;gpu=$gpu;disks=$disks;topProcesses=$top} | ConvertTo-Json -Depth 6 -Compress
`;

  const raw = await powershell(script);
  const data = parseJson(raw.trim());
  if (!data) throw new Error('Windows inventory returned invalid JSON.');
  return { ok: true, platform: 'windows', ...data };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  inspectPc().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
