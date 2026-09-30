$code = @'
using System;
using System.Runtime.InteropServices;

public enum ActivateOptions
{
    None = 0x00000000,
    DesignMode = 0x00000001,
    NoErrorUI = 0x00000002,
    NoSplashScreen = 0x00000004
}

[ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IApplicationActivationManager
{
    IntPtr ActivateApplication([In] String appUserModelId, [In] String arguments, [In] ActivateOptions options, [Out] out UInt32 processId);
    IntPtr ActivateForFile([In] String appUserModelId, [In] IntPtr pShellItemArray, [In] String verb, [Out] out UInt32 processId);
    IntPtr ActivateForProtocol([In] String appUserModelId, [In] IntPtr pAddressResolutionAlternative, [Out] out UInt32 processId);
}

[ComImport, Guid("45ba127d-10a8-46ea-8ab7-5641a6899444")]
public class ApplicationActivationManager : IApplicationActivationManager
{
    [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.InternalCall, MethodCodeType = System.Runtime.CompilerServices.MethodCodeType.Runtime)]
    public extern IntPtr ActivateApplication([In] String appUserModelId, [In] String arguments, [In] ActivateOptions options, [Out] out UInt32 processId);
    [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.InternalCall, MethodCodeType = System.Runtime.CompilerServices.MethodCodeType.Runtime)]
    public extern IntPtr ActivateForFile([In] String appUserModelId, [In] IntPtr pShellItemArray, [In] String verb, [Out] out UInt32 processId);
    [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.InternalCall, MethodCodeType = System.Runtime.CompilerServices.MethodCodeType.Runtime)]
    public extern IntPtr ActivateForProtocol([In] String appUserModelId, [In] IntPtr pAddressResolutionAlternative, [Out] out UInt32 processId);
}

public class AppLauncher
{
    public static uint Launch(string aumid)
    {
        var mgr = new ApplicationActivationManager();
        uint pid;
        mgr.ActivateApplication(aumid, null, ActivateOptions.None, out pid);
        return pid;
    }
}
'@

Add-Type -TypeDefinition $code
$pidOut = [AppLauncher]::Launch("Microsoft.WindowsNotepad_8wekyb3d8bbwe!App")
Write-Host "Activated Notepad with PID: $pidOut"
Start-Sleep -Seconds 2
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_after_uwp_activate.jpg"
