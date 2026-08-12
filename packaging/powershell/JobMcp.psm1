# JobMcp.psm1 — Windows convenience wrapper around the `job-mcp` CLI.
#
# Discovers the CLI, then exposes Start/Stop/Status/Import/Inbox helpers that
# talk to the loopback-only HTTP bridge (127.0.0.1). No direct network egress:
# only localhost. The bridge token (if set) is read from $env:JOB_MCP_HTTP_TOKEN.

# Default bridge endpoint. Override with $env:JOB_MCP_HTTP_PORT.
function Get-BridgeUrl {
    $port = if ($env:JOB_MCP_HTTP_PORT) { $env:JOB_MCP_HTTP_PORT } else { '8787' }
    return "http://127.0.0.1:$port"
}

# Locate the `job-mcp` executable. Prefers one on PATH, then a local repo build.
function Resolve-JobMcpCli {
    $cmd = Get-Command job-mcp -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    # Fall back to a sibling checkout's dist build if present.
    $local = Join-Path $PSScriptRoot '..\..\dist\cli\cli.js'
    $local = (Resolve-Path $local -ErrorAction SilentlyContinue).Path
    if ($local) { return $local }
    throw "job-mcp CLI not found. Install with 'npm install -g job-application-mcp' or run 'npm run build' in the repo."
}

# Internal: call the bridge /call endpoint with a tool name + arguments object.
function Invoke-Bridge {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [object]$Arguments
    )
    $url = "$(Get-BridgeUrl)/call"
    $body = @{ name = $Name; arguments = ($Arguments ?? @{}) } | ConvertTo-Json -Depth 10 -Compress
    $headers = @{ 'Content-Type' = 'application/json' }
    if ($env:JOB_MCP_HTTP_TOKEN) { $headers['Authorization'] = "Bearer $env:JOB_MCP_HTTP_TOKEN" }
    try {
        $resp = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body
        return $resp
    }
    catch {
        throw "Bridge call '$Name' failed: $($_.Exception.Message). Is the bridge running? (Start-JobMcpBridge)"
    }
}

<#
.SYNOPSIS
  Start the local job-mcp HTTP bridge in a background job.

.DESCRIPTION
  Shells out to `job-mcp serve:http`. The bridge binds 127.0.0.1 only.
  Returns the job object so you can stop it with Stop-JobMcpBridge.

.PARAMETER AiProvider
  Optional AI provider flag forwarded as `--ai` (mock|openai|anthropic|ollama).
#>
function Start-JobMcpBridge {
    [CmdletBinding()]
    param([string]$AiProvider)
    $cli = Resolve-JobMcpCli
    $args = @('serve:http')
    if ($AiProvider) { $args += @('--ai', $AiProvider) }
    $j = Start-Job -ScriptBlock {
        param($cli, $cliArgs)
        & node $cli @cliArgs
    } -ArgumentList $cli, $args
    # Give it a moment to bind the port.
    Start-Sleep -Seconds 1
    return $j
}

<#
.SYNOPSIS
  Stop a bridge started by Start-JobMcpBridge.
#>
function Stop-JobMcpBridge {
    [CmdletBinding()]
    param([Parameter(ValueFromPipeline)]$Job)
    if ($Job) { Stop-Job -Job $Job -ErrorAction SilentlyContinue; Remove-Job -Job $Job -Force }
    else { Get-Job -Name 'job-mcp*' -ErrorAction SilentlyContinue | Stop-Job -ErrorAction SilentlyContinue | Remove-Job -Force }
}

<#
.SYNOPSIS
  Show bridge health + version (GET /health).
#>
function Get-JobMcpStatus {
    [CmdletBinding()]
    param()
    try {
        return Invoke-RestMethod -Uri "$(Get-BridgeUrl)/health"
    }
    catch {
        return [pscustomobject]@{ status = 'down'; error = $_.Exception.Message }
    }
}

<#
.SYNOPSIS
  Analyze + save a job posting from its description text.

.PARAMETER Description
  The job posting body (min 20 chars).

.PARAMETER Title
  Optional job title; guessed if omitted.
#>
function Import-Job {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string]$Description,
        [string]$Title
    )
    $args = @{ description = $Description }
    if ($Title) { $args['title'] = $Title }
    return Invoke-Bridge -Name 'analyze_job' -Arguments $args
}

<#
.SYNOPSIS
  List jobs in your inbox, optionally filtered by status.

.PARAMETER Status
  One of: new, triaged, applied, archived.
#>
function Get-JobInbox {
    [CmdletBinding()]
    param([ValidateSet('new','triaged','applied','archived')] [string]$Status)
    $args = @{}
    if ($Status) { $args['status'] = $Status }
    return Invoke-Bridge -Name 'list_job_inbox' -Arguments $args
}

Export-ModuleMember -Function Start-JobMcpBridge, Stop-JobMcpBridge, Get-JobMcpStatus, Import-Job, Get-JobInbox