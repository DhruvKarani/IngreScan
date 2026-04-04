import logging
import mimetypes
import os
import sys
import webbrowser
from pathlib import Path
from threading import Timer

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse

from score_api import analyze_legacy_product, get_scoring_health

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

if getattr(sys, 'frozen', False):
    bundle_dir = sys._MEIPASS
    sys.path.insert(0, bundle_dir)
    DIST_DIR = os.path.join(bundle_dir, 'dist')
else:
    PARENT_DIR = os.path.dirname(ROOT_DIR)
    DIST_DIR = os.path.join(PARENT_DIR, 'dist')

STATIC_DIR = Path(DIST_DIR)
INDEX_FILE = STATIC_DIR / 'index.html'

mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title='IngreScan Bundled Server', docs_url=None, redoc_url=None)


@app.get('/health')
async def health():
    scoring_health = get_scoring_health()
    return {
        'status': 'healthy',
        'service': 'IngreScan Bundled Server',
        'version': scoring_health['version'],
        'ml_available': scoring_health['ml_available'],
        'personalized_scoring_available': scoring_health['personalized_scoring_available'],
        'endpoints': scoring_health['endpoints'],
    }


@app.post('/analyze')
async def analyze(payload: dict):
    try:
        return analyze_legacy_product(payload)
    except ValueError as exc:
        return JSONResponse(status_code=400, content={'error': str(exc)})
    except LookupError as exc:
        return JSONResponse(status_code=404, content={'error': str(exc)})
    except Exception as exc:
        logger.exception('Scoring failed')
        return JSONResponse(status_code=500, content={'error': 'scoring_failed', 'message': str(exc)})


@app.get('/')
async def serve_root():
    if INDEX_FILE.exists():
        return FileResponse(str(INDEX_FILE))
    return JSONResponse(status_code=404, content={'error': 'dist_not_found'})


@app.get('/{path:path}')
async def serve_spa(path: str):
    requested_file = STATIC_DIR / path
    if path and requested_file.exists() and requested_file.is_file():
        return FileResponse(str(requested_file))

    if INDEX_FILE.exists():
        return FileResponse(str(INDEX_FILE))

    return JSONResponse(status_code=404, content={'error': 'dist_not_found'})


def open_browser() -> None:
    url = 'http://127.0.0.1:5000/'
    logger.info('Opening browser at %s', url)
    webbrowser.open_new(url)


if __name__ == '__main__':
    import uvicorn

    print('---------------------------------------------------')
    print('IngreScan Server Starting...')
    print('Do NOT close this window while using the app.')
    print('---------------------------------------------------')
    Timer(1.5, open_browser).start()
    uvicorn.run('app_bundled:app', host='127.0.0.1', port=5000, log_level='info')