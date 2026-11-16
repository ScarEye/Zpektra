# Keeps the Vite dev server in a Windows job that dies with this window,
# and applies letter-z.png as the launcher icon.
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not ('ZpektraDev' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public static class ZpektraDev {
    const uint CREATE_SUSPENDED = 0x00000004;
    const uint WAIT_OBJECT_0 = 0;
    const int JobObjectExtendedLimitInformation = 9;
    const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
    const int CTRL_C_EVENT = 0;
    const int CTRL_BREAK_EVENT = 1;
    const int CTRL_CLOSE_EVENT = 2;
    const int CTRL_LOGOFF_EVENT = 5;
    const int CTRL_SHUTDOWN_EVENT = 6;

    static IntPtr _job;
    static IntPtr _process;
    static IntPtr _thread;
    static int _processId;
    static int _stopOnce;
    static ConsoleCtrlDelegate _handler;

    public static int StoppedByUser;
    public static bool JobBound;
    public static int LastError;

    delegate bool ConsoleCtrlDelegate(int ctrlType);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct STARTUPINFO {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct IO_COUNTERS {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CreateProcess(
        string lpApplicationName,
        StringBuilder lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetInformationJobObject(IntPtr hJob, int jobObjectInfoClass, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool TerminateJobObject(IntPtr hJob, uint uExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern uint ResumeThread(IntPtr hThread);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetConsoleCtrlHandler(ConsoleCtrlDelegate handler, bool add);

    [DllImport("kernel32.dll")]
    static extern void ExitProcess(uint uExitCode);

    [DllImport("kernel32.dll")]
    static extern IntPtr GetConsoleWindow();

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetConsoleIcon(IntPtr hIcon);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr LoadImage(IntPtr hInst, string name, uint type, int cx, int cy, uint load);

    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    public static bool Start(string fileName, string arguments, string workingDirectory, out string error) {
        error = null;
        StoppedByUser = 0;
        JobBound = false;
        _stopOnce = 0;

        var startup = new STARTUPINFO();
        startup.cb = Marshal.SizeOf(typeof(STARTUPINFO));
        PROCESS_INFORMATION info;
        var commandLine = new StringBuilder(32768);
        commandLine.Append('"').Append(fileName).Append('"');
        if (!string.IsNullOrEmpty(arguments)) {
            commandLine.Append(' ').Append(arguments);
        }

        if (!CreateProcess(fileName, commandLine, IntPtr.Zero, IntPtr.Zero, true, CREATE_SUSPENDED, IntPtr.Zero, workingDirectory, ref startup, out info)) {
            error = "Could not start the dev server (Win32 " + Marshal.GetLastWin32Error() + ").";
            return false;
        }

        _process = info.hProcess;
        _thread = info.hThread;
        _processId = info.dwProcessId;

        _job = CreateJobObject(IntPtr.Zero, null);
        if (_job != IntPtr.Zero) {
            var limits = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
            IntPtr buffer = Marshal.AllocHGlobal(length);
            try {
                Marshal.StructureToPtr(limits, buffer, false);
                if (!SetInformationJobObject(_job, JobObjectExtendedLimitInformation, buffer, (uint)length)) {
                    LastError = Marshal.GetLastWin32Error();
                    CloseHandle(_job);
                    _job = IntPtr.Zero;
                }
            } finally {
                Marshal.FreeHGlobal(buffer);
            }
        }

        if (_job != IntPtr.Zero && AssignProcessToJobObject(_job, _process)) {
            JobBound = true;
        } else if (_job != IntPtr.Zero) {
            LastError = Marshal.GetLastWin32Error();
        }

        _handler = OnConsoleCtrl;
        SetConsoleCtrlHandler(_handler, true);

        if (ResumeThread(_thread) == 0xFFFFFFFF) {
            error = "Could not resume the dev server (Win32 " + Marshal.GetLastWin32Error() + ").";
            StopJob();
            return false;
        }

        return true;
    }

    public static bool WaitTimedOut(uint milliseconds) {
        if (_process == IntPtr.Zero) return false;
        uint result = WaitForSingleObject(_process, milliseconds);
        return result != WAIT_OBJECT_0 && result != 0xFFFFFFFF;
    }

    public static uint ExitCode() {
        uint code;
        if (_process == IntPtr.Zero || !GetExitCodeProcess(_process, out code)) return 1;
        return code;
    }

    static void KillProcesses() {
        if (_job != IntPtr.Zero) {
            TerminateJobObject(_job, 1);
        }
        if (_processId > 0) {
            try {
                var killer = Process.Start(new ProcessStartInfo {
                    FileName = "taskkill.exe",
                    Arguments = "/F /T /PID " + _processId,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                });
                if (killer != null) killer.WaitForExit(4000);
            } catch {
            }
        }
    }

    public static void StopJob() {
        if (System.Threading.Interlocked.Exchange(ref _stopOnce, 1) != 0) return;
        KillProcesses();
        _processId = 0;

        if (_job != IntPtr.Zero) {
            CloseHandle(_job);
            _job = IntPtr.Zero;
        }
        if (_thread != IntPtr.Zero) {
            CloseHandle(_thread);
            _thread = IntPtr.Zero;
        }
        if (_process != IntPtr.Zero) {
            CloseHandle(_process);
            _process = IntPtr.Zero;
        }
    }

    static bool OnConsoleCtrl(int ctrlType) {
        if (ctrlType == CTRL_C_EVENT || ctrlType == CTRL_BREAK_EVENT) {
            StoppedByUser = 1;
            KillProcesses();
            return true;
        }
        if (ctrlType == CTRL_CLOSE_EVENT || ctrlType == CTRL_LOGOFF_EVENT || ctrlType == CTRL_SHUTDOWN_EVENT) {
            StoppedByUser = 1;
            KillProcesses();
            ExitProcess(0);
        }
        return false;
    }

    public static void ApplyIcon(string icoPath) {
        const uint IMAGE_ICON = 1;
        const uint LR_LOADFROMFILE = 0x10;
        const uint WM_SETICON = 0x80;
        IntPtr small = LoadImage(IntPtr.Zero, icoPath, IMAGE_ICON, 16, 16, LR_LOADFROMFILE);
        IntPtr big = LoadImage(IntPtr.Zero, icoPath, IMAGE_ICON, 32, 32, LR_LOADFROMFILE);
        IntPtr hwnd = GetConsoleWindow();
        if (hwnd != IntPtr.Zero) {
            if (small != IntPtr.Zero) SendMessage(hwnd, WM_SETICON, IntPtr.Zero, small);
            if (big != IntPtr.Zero) SendMessage(hwnd, WM_SETICON, new IntPtr(1), big);
        }
        if (big != IntPtr.Zero) SetConsoleIcon(big);
    }
}
'@
}

function Write-IcoFromPng {
    param(
        [Parameter(Mandatory)][string]$PngPath,
        [Parameter(Mandatory)][string]$IcoPath
    )

    Add-Type -AssemblyName System.Drawing
    $source = [System.Drawing.Image]::FromFile($PngPath)
    try {
        $sizes = @(16, 24, 32, 48, 64, 256)
        $pngs = New-Object System.Collections.Generic.List[byte[]]
        foreach ($size in $sizes) {
            $bitmap = New-Object System.Drawing.Bitmap $size, $size
            try {
                $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
                try {
                    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                    $graphics.Clear([System.Drawing.Color]::Transparent)
                    $graphics.DrawImage($source, 0, 0, $size, $size)
                } finally {
                    $graphics.Dispose()
                }
                $stream = New-Object System.IO.MemoryStream
                try {
                    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
                    $pngs.Add($stream.ToArray())
                } finally {
                    $stream.Dispose()
                }
            } finally {
                $bitmap.Dispose()
            }
        }

        $header = New-Object System.Collections.Generic.List[byte]
        foreach ($value in @(0, 0, 1, 0, $sizes.Count, 0)) {
            $header.Add([byte]$value)
        }

        $offset = 6 + (16 * $sizes.Count)
        for ($i = 0; $i -lt $sizes.Count; $i++) {
            $size = $sizes[$i]
            $dimension = if ($size -ge 256) { 0 } else { $size }
            $length = $pngs[$i].Length
            $header.Add([byte]$dimension)
            $header.Add([byte]$dimension)
            $header.Add(0)
            $header.Add(0)
            $header.Add(1)
            $header.Add(0)
            $header.Add(32)
            $header.Add(0)
            $header.Add([byte]($length -band 0xFF))
            $header.Add([byte](($length -shr 8) -band 0xFF))
            $header.Add([byte](($length -shr 16) -band 0xFF))
            $header.Add([byte](($length -shr 24) -band 0xFF))
            $header.Add([byte]($offset -band 0xFF))
            $header.Add([byte](($offset -shr 8) -band 0xFF))
            $header.Add([byte](($offset -shr 16) -band 0xFF))
            $header.Add([byte](($offset -shr 24) -band 0xFF))
            $offset += $length
        }

        $file = [System.IO.File]::Create($IcoPath)
        try {
            $file.Write($header.ToArray(), 0, $header.Count)
            foreach ($png in $pngs) {
                $file.Write($png, 0, $png.Length)
            }
        } finally {
            $file.Dispose()
        }
    } finally {
        $source.Dispose()
    }
}

function Update-LauncherIcon {
    $png = Join-Path $Root 'letter-z.png'
    $ico = Join-Path $Root 'letter-z.ico'
    if (-not (Test-Path -LiteralPath $png)) {
        return
    }

    $pngTime = (Get-Item -LiteralPath $png).LastWriteTimeUtc
    $icoMissing = -not (Test-Path -LiteralPath $ico)
    if ($icoMissing -or $pngTime -gt (Get-Item -LiteralPath $ico).LastWriteTimeUtc) {
        Write-IcoFromPng -PngPath $png -IcoPath $ico
    }

    $shortcutPath = Join-Path $Root 'dev.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $Root 'dev.bat'
    $shortcut.WorkingDirectory = $Root
    $shortcut.WindowStyle = 1
    $shortcut.Description = 'Zpektra dev server. Close the window to stop it.'
    $shortcut.IconLocation = "$ico,0"
    $shortcut.Save()

    try {
        [ZpektraDev]::ApplyIcon($ico)
    } catch {
        # The server still runs if the console host rejects the icon.
    }
}

function Test-DevPort {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $wait = $client.BeginConnect('127.0.0.1', 5173, $null, $null)
        if (-not $wait.AsyncWaitHandle.WaitOne(250, $false)) {
            return $false
        }
        $client.EndConnect($wait)
        return $client.Connected
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Open-DevPage {
    if ($env:ZPEKTRA_NO_OPEN -eq '1') {
        return
    }
    Start-Process 'http://127.0.0.1:5173/zpektra/'
}

function Start-ZpektraDev {
    try {
        Update-LauncherIcon
    } catch {
        Write-Host "Could not apply letter-z.png as the icon."
    }
    $Host.UI.RawUI.WindowTitle = 'Zpektra dev'

    Write-Host 'Zpektra dev server'
    Write-Host 'Close this window to stop it.'
    Write-Host ''

    if (Test-DevPort) {
        Write-Host 'Already running at http://127.0.0.1:5173/zpektra/'
        Write-Host 'Close the other Zpektra dev window, or run stop.bat.'
        Open-DevPage
        return 0
    }

    $errorText = ''
    $started = [ZpektraDev]::Start($env:ComSpec, '/d /c npm run dev', $Root, [ref] $errorText)
    if (-not $started) {
        throw $errorText
    }

    $code = 0
    try {
        $opened = $false
        while ([ZpektraDev]::WaitTimedOut(500)) {
            if (-not $opened -and (Test-DevPort)) {
                $opened = $true
                Open-DevPage
            }
        }
        if ([ZpektraDev]::StoppedByUser -ne 1) {
            $code = [ZpektraDev]::ExitCode()
        }
    } finally {
        [ZpektraDev]::StopJob()
    }

    if ([ZpektraDev]::StoppedByUser -eq 1 -or $code -eq 259) {
        return 0
    }
    return [int]$code
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        $exitCode = Start-ZpektraDev
    } catch {
        Write-Host $_.Exception.Message -ForegroundColor Red
        $exitCode = 1
    }
    exit $exitCode
}
