$sig = @'
[DllImport("user32.dll")]
public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
[DllImport("kernel32.dll")]
public static extern uint SetThreadExecutionState(uint esFlags);
'@
$u = Add-Type -MemberDefinition $sig -Name 'Win32Wake' -Namespace 'System' -PassThru
# ES_SYSTEM_REQUIRED (0x1) | ES_DISPLAY_REQUIRED (0x2)
$u::SetThreadExecutionState(0x80000003)
$u::mouse_event(0x0001, 2, 2, 0, 0)
Start-Sleep -Milliseconds 100
$u::mouse_event(0x0001, -2, -2, 0, 0)
Write-Output "WAKE_COMMAND_EXECUTED"
