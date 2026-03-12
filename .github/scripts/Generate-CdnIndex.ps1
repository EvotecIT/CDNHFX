[CmdletBinding()]
param(
    [string] $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-VersionDirectories {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    if (-not (Test-Path $Path)) {
        return @()
    }

    Get-ChildItem -Path $Path -Directory |
        Sort-Object { [Version]$_.Name } -Descending
}

function Get-PreviewDirectories {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    if (-not (Test-Path $Path)) {
        return @()
    }

    Get-ChildItem -Path $Path -Directory |
        Sort-Object LastWriteTimeUtc -Descending
}

function ConvertTo-RelativeHref {
    param(
        [Parameter(Mandatory = $true)]
        [string] $BasePrefix,
        [Parameter(Mandatory = $true)]
        [string] $Child
    )

    $trimmed = $BasePrefix.Trim('/')
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
        return "/$Child"
    }

    return "/$trimmed/$Child"
}

function New-LinkList {
    param(
        [Parameter(Mandatory = $true)]
        [System.Collections.IEnumerable] $Items,
        [Parameter(Mandatory = $true)]
        [scriptblock] $Renderer
    )

    $rows = New-Object System.Collections.Generic.List[string]
    foreach ($item in $Items) {
        $rows.Add((& $Renderer $item))
    }

    if ($rows.Count -eq 0) {
        return "<p class='empty'>Nothing published here yet.</p>"
    }

    $joinedRows = $rows -join "`n"
    return "<ul class='link-list'>`n$joinedRows`n</ul>"
}

function New-PageHtml {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Title,
        [Parameter(Mandatory = $true)]
        [string] $Lead,
        [Parameter(Mandatory = $true)]
        [string] $Body,
        [string] $Eyebrow = "CDNHFX"
    )

    @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>$Title</title>
  <style>
    :root {
      --bg: #eef3f7;
      --panel: rgba(255,255,255,0.82);
      --panel-strong: #ffffff;
      --ink: #163046;
      --muted: #5c7288;
      --line: rgba(22,48,70,0.12);
      --accent: #0f8aa8;
      --accent-strong: #0b6d86;
      --accent-soft: rgba(15,138,168,0.12);
      --shadow: 0 24px 60px rgba(17, 43, 62, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Helvetica Neue", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(15,138,168,0.18), transparent 34%),
        radial-gradient(circle at top right, rgba(30,100,180,0.12), transparent 26%),
        linear-gradient(180deg, #f7fafc 0%, var(--bg) 100%);
      min-height: 100vh;
    }
    main {
      width: min(1120px, calc(100% - 32px));
      margin: 32px auto 56px;
    }
    .hero {
      background: linear-gradient(135deg, rgba(255,255,255,0.88), rgba(255,255,255,0.76));
      border: 1px solid var(--line);
      border-radius: 28px;
      padding: 32px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(12px);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent-strong);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    h1 {
      margin: 18px 0 10px;
      font-size: clamp(32px, 5vw, 56px);
      line-height: 1.02;
      letter-spacing: -0.04em;
    }
    .lead {
      max-width: 760px;
      margin: 0;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.7;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 18px;
      margin-top: 24px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 22px;
      padding: 22px;
      box-shadow: 0 16px 34px rgba(18, 39, 58, 0.08);
      backdrop-filter: blur(10px);
    }
    .card h2, .card h3 {
      margin: 0 0 14px;
      font-size: 20px;
      letter-spacing: -0.02em;
    }
    .card p {
      margin: 0 0 14px;
      color: var(--muted);
      line-height: 1.65;
    }
    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(22,48,70,0.06);
      color: var(--ink);
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
    }
    .pill:hover {
      background: var(--accent-soft);
      color: var(--accent-strong);
    }
    a {
      color: var(--accent-strong);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    code {
      font-family: Consolas, "SFMono-Regular", monospace;
      font-size: 0.95em;
      background: rgba(22,48,70,0.06);
      padding: 2px 6px;
      border-radius: 8px;
    }
    .link-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 12px;
    }
    .link-list li {
      padding: 14px 16px;
      border-radius: 16px;
      background: rgba(255,255,255,0.75);
      border: 1px solid var(--line);
    }
    .link-list strong {
      display: block;
      margin-bottom: 6px;
      font-size: 16px;
    }
    .link-list span {
      color: var(--muted);
      font-size: 14px;
    }
    .section-title {
      margin: 28px 0 14px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .empty {
      margin: 0;
      color: var(--muted);
      font-style: italic;
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="eyebrow">$Eyebrow</div>
      <h1>$Title</h1>
      <p class="lead">$Lead</p>
    </section>
    $Body
  </main>
</body>
</html>
"@
}

function New-PublishedFolderPageBody {
    param(
        [Parameter(Mandatory = $true)]
        [string] $BasePath,
        [Parameter(Mandatory = $true)]
        [string] $KindLabel,
        [Parameter(Mandatory = $true)]
        [string] $Description
    )

    @"
<div class="grid">
  <article class="card">
    <h2>$KindLabel</h2>
    <p>$Description</p>
    <div class="pill-row">
      <a class="pill" href="$BasePath/Scripts/dataTables.min.js">Scripts</a>
      <a class="pill" href="$BasePath/Styles/hfx-default.css">Styles</a>
      <a class="pill" href="$BasePath/Fonts/">Fonts</a>
      <a class="pill" href="$BasePath/Images/">Images</a>
    </div>
  </article>
  <article class="card">
    <h2>Quick Links</h2>
    <p>These folders are primarily consumed by HtmlForgeX, but having a landing page makes them easier to inspect and validate manually.</p>
    <div class="pill-row">
      <a class="pill" href="/">CDNHFX Home</a>
      <a class="pill" href="/v/">Version Index</a>
      <a class="pill" href="/preview/">Preview Index</a>
    </div>
  </article>
</div>
"@
}

$versions = @(Get-VersionDirectories -Path (Join-Path $RepoRoot "v"))
$previews = @(Get-PreviewDirectories -Path (Join-Path $RepoRoot "preview"))
$latestVersion = if ($versions.Count -gt 0) { $versions[0].Name } else { "" }

$versionList = New-LinkList -Items $versions -Renderer {
    param($dir)
    $name = $dir.Name
    "<li><strong><a href='/v/$name/'>$name</a></strong><span><a href='/v/$name/Scripts/dataTables.min.js'>Scripts</a> · <a href='/v/$name/Styles/hfx-default.css'>Styles</a></span></li>"
}

$previewList = New-LinkList -Items $previews -Renderer {
    param($dir)
    $name = $dir.Name
    "<li><strong><a href='/preview/$name/'>$name</a></strong><span><a href='/preview/$name/Scripts/dataTables.min.js'>Scripts</a> · <a href='/preview/$name/Styles/hfx-default.css'>Styles</a></span></li>"
}

$rootBody = @"
<div class="grid">
  <article class="card">
    <h2>Latest Release</h2>
    <p>The stable HtmlForgeX CDN flow publishes immutable assets under <code>/v/&lt;version&gt;</code> and mirrors current assets at the repository root.</p>
    <div class="pill-row">
      <a class="pill" href="/Scripts/dataTables.min.js">Latest Scripts</a>
      <a class="pill" href="/Styles/hfx-default.css">Latest Styles</a>
      $(if ($latestVersion) { "<a class='pill' href='/v/$latestVersion/'>Latest Version: $latestVersion</a>" })
    </div>
  </article>
  <article class="card">
    <h2>Delivery Modes</h2>
    <p>Use <a href="https://cdnhfx.evotec.xyz">cdnhfx.evotec.xyz</a> for the custom-domain mirror, <a href="https://evotecit.github.io/CDNHFX/">GitHub Pages</a> for raw Pages hosting, and jsDelivr for immutable tagged delivery.</p>
    <div class="pill-row">
      $(if ($latestVersion) { "<a class='pill' href='https://cdn.jsdelivr.net/gh/evotecit/cdnhfx@$latestVersion/Scripts/dataTables.min.js'>jsDelivr Example</a>" })
      <a class="pill" href="/v/">Version Index</a>
      <a class="pill" href="/preview/">Preview Index</a>
    </div>
  </article>
</div>
<div class="section-title">Versioned Releases</div>
<section class="card">
  <h3>Published Versions</h3>
  <p>Immutable release assets are available under <code>/v/&lt;version&gt;</code>. These are the safest links to bake into released HtmlForgeX builds.</p>
  $versionList
</section>
<div class="section-title">Preview Builds</div>
<section class="card">
  <h3>Preview Channels</h3>
  <p>Preview paths are disposable CDN-shaped publishes for PRs, workspaces, and smoke tests. They are not immutable releases.</p>
  $previewList
</section>
"@

$versionBody = @"
<div class="section-title">Versioned Releases</div>
<section class="card">
  <h2>Immutable Assets</h2>
  <p>Each version folder contains a complete snapshot of CDN assets. Release pipelines should prefer these paths over root-level files.</p>
  $versionList
</section>
"@

$previewBody = @"
<div class="section-title">Preview Builds</div>
<section class="card">
  <h2>Preview Paths</h2>
  <p>Preview folders are generated by the pull-based HtmlForgeX publish workflow to validate branches and commits without creating immutable version tags.</p>
  $previewList
</section>
"@

$rootHtml = New-PageHtml -Title "CDNHFX Asset Index" -Lead "Static assets for HtmlForgeX, with stable versioned releases and disposable preview channels for validation." -Body $rootBody
$versionsHtml = New-PageHtml -Title "CDNHFX Versions" -Lead "Immutable HtmlForgeX CDN snapshots published under /v/&lt;version&gt;." -Body $versionBody -Eyebrow "CDNHFX Versions"
$previewHtml = New-PageHtml -Title "CDNHFX Previews" -Lead "Branch and commit previews published for browser validation before release." -Body $previewBody -Eyebrow "CDNHFX Previews"

[IO.File]::WriteAllText((Join-Path $RepoRoot "index.html"), $rootHtml, [Text.Encoding]::UTF8)
New-Item -ItemType Directory -Path (Join-Path $RepoRoot "v") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $RepoRoot "preview") -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $RepoRoot "v/index.html"), $versionsHtml, [Text.Encoding]::UTF8)
[IO.File]::WriteAllText((Join-Path $RepoRoot "preview/index.html"), $previewHtml, [Text.Encoding]::UTF8)

foreach ($dir in $versions) {
    $name = $dir.Name
    $page = New-PageHtml `
        -Title "CDNHFX Version $name" `
        -Lead "Immutable HtmlForgeX CDN assets for version $name." `
        -Eyebrow "CDNHFX Release" `
        -Body (New-PublishedFolderPageBody -BasePath "/v/$name" -KindLabel "Version $name" -Description "This release folder contains the exact Scripts, Styles, Fonts, and Images that shipped with HtmlForgeX CDN version $name.")
    [IO.File]::WriteAllText((Join-Path $dir.FullName "index.html"), $page, [Text.Encoding]::UTF8)
}

foreach ($dir in $previews) {
    $name = $dir.Name
    $page = New-PageHtml `
        -Title "CDNHFX Preview $name" `
        -Lead "Disposable HtmlForgeX preview assets for validation before release." `
        -Eyebrow "CDNHFX Preview" `
        -Body (New-PublishedFolderPageBody -BasePath "/preview/$name" -KindLabel "Preview $name" -Description "This preview folder was generated from a specific HtmlForgeX branch or commit for browser-level validation without creating a tagged CDN release.")
    [IO.File]::WriteAllText((Join-Path $dir.FullName "index.html"), $page, [Text.Encoding]::UTF8)
}
