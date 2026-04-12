param()
$ErrorActionPreference = "Stop"
Write-Host "Removing old venv..."
if (Test-Path venv) { Remove-Item -Recurse -Force venv }
$py_path = "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
Write-Host "Creating new venv using $py_path..."
& $py_path -m venv venv
Write-Host "Upgrading pip..."
.\venv\Scripts\python.exe -m pip install --upgrade pip
Write-Host "Installing dependencies without cache..."
.\venv\Scripts\python.exe -m pip install pandas scikit-learn tensorflow --no-cache-dir
Write-Host "Done!"
