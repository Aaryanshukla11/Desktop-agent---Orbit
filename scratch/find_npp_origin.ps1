$lines = Get-Content 'C:\Users\Aaryan shukla\.gemini\antigravity-ide\brain\0e3ea434-2b5c-4667-9e76-48bc877c6067\.system_generated\logs\transcript.jsonl'
foreach ($line in $lines) {
    $obj = ConvertFrom-Json $line
    if ($obj.step_index -ge 2478 -and $obj.step_index -le 2486 -and $obj.type -eq "RUN_COMMAND") {
        Write-Output "Step $($obj.step_index) content:"
        Write-Output $obj.content
    }
}
