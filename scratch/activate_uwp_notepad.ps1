Add-Type @"
using System;
using System.Runtime.InteropServices;

public enum ActivateOptions {
    None = 0x00000000,
    DesignMode = 0x00000001,
    NoErrorUI = 0x00000002,
    NoSplashScreen = 0x00000004
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("2e941141-7f97-4756-ba1d-9decde894a3d")]
public interface IApplicationActivationManager {
    IntPtr ActivateApplication([In] String appUserModelId, [In] String arguments, [In] ActivateOptions options, [Out] out UInt32 processId);
    IntPtr ActivateForFile([In] String appUserModelId, [In] IntPtr /*IShellItemArray* */ itemArray, [In] String verb, [Out] out UInt32 processId);
    IntPtr ActivateForProtocol([In] String appUserModelId, [In] IntPtr /* IShellItemArray* */ itemArray, [Out] out UInt32 processId);
}

[ComImport, Guid("45ba127d-10a8-46ea-8ab7-5651642d5cee")]
public class ApplicationActivationManager {}

public class UwpLauncher {
    public static uint Launch(string aumid, string args) {
        var mgr = (IApplicationActivationManager) new ApplicationActivationManager();
        uint pid = 0;
        mgr.ActivateApplication(aumid, args, ActivateOptions.None, out pid);
        return pid;
    }
}
"@

$aumid = "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App"
Write-Output "Activating $aumid via IApplicationActivationManager..."
$pidVal = [UwpLauncher]::Launch($aumid, "")
Write-Output "Activated PID: $pidVal"
Start-Sleep -Milliseconds 2500
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_uwp_activated.jpg"
