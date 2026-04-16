$filePath = "c:\Users\User\Downloads\MyPortFolio\index.html"
$content = [System.IO.File]::ReadAllText($filePath)

# New CSS for logo
$newStyle = ".nav-logo {`r`n  display: flex;`r`n  align-items: center;`r`n}`r`n.nav-logo-img {`r`n  height: 28px;`r`n  width: auto;`r`n  transition: transform var(--transition);`r`n}`r`n.nav-logo:hover .nav-logo-img {`r`n  transform: scale(1.05);`r`n}"

# Regex to match the old style more flexibly
$pattern = '(?s)\.nav-logo\s*\{[^}]*pop-family:[^}]*\}\r?\n\.nav-logo\s+span\s*\{[^}]*\}'
# Actually, let's be even simpler - just replace the whole section between known comments if possible, 
# or just match exactly what view_file shows.

$oldNavLogo = '.nav-logo {' + "`r`n" +
'  font-family: ''Syne'', sans-serif;' + "`r`n" +
'  font-weight: 800;' + "`r`n" +
'  font-size: 1.15rem;' + "`r`n" +
'  letter-spacing: -0.02em;' + "`r`n" +
'}' + "`r`n" +
'.nav-logo span { color: var(--accent); }'

# Try direct replacement first
if ($content.Contains($oldNavLogo)) {
    $content = $content.Replace($oldNavLogo, $newStyle)
} else {
    # Fallback: try with \n only (in case of linux line endings)
    $oldNavLogoLF = $oldNavLogo.Replace("`r`n", "`n")
    if ($content.Contains($oldNavLogoLF)) {
        $content = $content.Replace($oldNavLogoLF, $newStyle)
    } else {
        Write-Output "Could not find exact match for nav-logo style"
    }
}

[System.IO.File]::WriteAllText($filePath, $content)
Write-Output "Successfully updated CSS"
