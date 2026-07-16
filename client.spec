# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['src\\S\\client.py'],
    pathex=[],
    binaries=[],
    datas=[('src/S/board.py', '.'), ('src/S/game.py', '.'), ('src/S/harbor.py', '.'), ('src/S/logic.py', '.'), ('src/S/player.py', '.'), ('src/S/resource.py', '.'), ('src/S/settings.py', '.'), ('src/S/tile.py', '.'), ('src/S/vertex.py', '.'), ('src/S/edge.py', '.'), ('src/S/bot.py', '.'), ('src/S/forestBright.png', '.'), ('src/S/fieldBright.png', '.'), ('src/S/desert.png', '.'), ('src/S/mountain.png', '.'), ('src/S/pastureBright.png', '.'), ('src/S/hillBright.png', '.'), ('src/S/water.png', '.'), ('src/S/background.jpeg', '.'), ('src/S/background2.png', '.'), ('src/S/pokal.png', '.')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='client',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
