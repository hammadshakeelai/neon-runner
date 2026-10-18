# Neon Runner — push helper
#
# Usage:
#   .\push-to-github.ps1 -RepoUrl https://github.com/<you>/<repo>.git
#
# It initialises the repo (if needed), commits everything, sets the remote
# and pushes to the "main" branch. It does NOT create the GitHub repo for you
# (you make an empty public repo first on github.com/new).

param(
    [Parameter(Mandatory = $true)]
    [string]$RepoUrl,

    [string]$Message = "Initial commit: Neon Runner WebGL2 demo"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "git is not installed or not on PATH."
}

if (-not (Test-Path ".git")) {
    Write-Host "Initialising git repository..." -ForegroundColor Cyan
    git init | Out-Null
}

git add -A
if (git diff --cached --quiet) {
    Write-Host "Nothing to commit." -ForegroundColor Yellow
} else {
    git commit -m "$Message" | Out-Null
    Write-Host "Committed." -ForegroundColor Green
}

git branch -M main

$existing = git remote
if ($existing -contains "origin") {
    git remote set-url origin $RepoUrl
} else {
    git remote add origin $RepoUrl
}

Write-Host "Pushing to $RepoUrl ..." -ForegroundColor Cyan
git push -u origin main

Write-Host ""
Write-Host "Done. Now enable Pages:" -ForegroundColor Green
Write-Host "  GitHub repo -> Settings -> Pages -> Source: Deploy from a branch"
Write-Host "  Branch: main / (root) -> Save"
