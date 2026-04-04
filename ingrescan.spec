# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['server/app_bundled.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('dist', 'dist'),  # Include the frontend build directory
        ('health_rules.json', '.'),  # Include the health rules file
        ('server', 'server'), # Include server dir if needed, though app_bundled is entry
    ],
    hiddenimports=[
        'engine',
        'scoring_engine',
        'fastapi',
        'starlette',
        'pydantic',
        'uvicorn',
        'logging',
        'webbrowser',
        'threading',
        'anyio'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='IngreScan',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Set to False to hide terminal window in production
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='assets/icon.png' # Optional: Add icon if available, but might fail if .png not supported directly without conversion
)
