#
# Module manifest for the JobMcp PowerShell module.
#
# A thin Windows convenience wrapper around the `job-mcp` CLI. It discovers the
# installed CLI (prefers `npm install -g`, falls back to a local checkout) and
# exposes Start-JobMcpBridge / Stop-JobMcpBridge / Import-Job / Get-JobInbox.
# Nothing here talks to the network directly — it shells out to the local CLI
# and the loopback-only HTTP bridge.
#

@{

    # Script module or binary module file associated with this manifest.
    RootModule        = 'JobMcp.psm1'

    # Version number of this module.
    ModuleVersion     = '0.3.0'

    # Supported PSEditions
    CompatiblePSEditions = @('Desktop', 'Core')

    # ID used to uniquely identify this module
    GUID              = '8f3c2a1e-4b5d-4e2a-9c7b-1a6d8e0f2a3c'

    # Author
    Author            = 'Job Application MCP contributors'

    # Company or vendor
    CompanyName       = 'Job Application MCP'

    # Copyright
    Copyright         = '(c) Job Application MCP contributors. AGPL-3.0-or-later.'

    # Description
    Description       = 'Windows convenience wrapper for the job-application-mcp CLI (local-first MCP job application assistant).'

    # Minimum version of the Windows PowerShell engine
    PowerShellVersion = '5.1'

    # Functions to export — keep this explicit so users get a clean surface.
    FunctionsToExport = @(
        'Start-JobMcpBridge',
        'Stop-JobMcpBridge',
        'Get-JobMcpStatus',
        'Import-Job',
        'Get-JobInbox'
    )

    # Cmdlets to export
    CmdletsToExport   = @()

    # Variables to export
    VariablesToExport = @()

    # Aliases to export
    AliasesToExport   = @()

    # Help URI (project README)
    HelpInfoURI       = 'https://github.com/firyomaefx/job-application-mcp'

}