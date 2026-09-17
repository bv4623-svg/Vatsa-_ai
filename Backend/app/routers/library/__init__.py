"""Library API: real storage accounting, item CRUD, folders, sharing.
One APIRouter combining the split submodules, mounted once from
app.main the same way app.routers.auth's package is."""
from fastapi import APIRouter

from app.routers.library.storage import router as storage_router
from app.routers.library.items_list import router as items_list_router
from app.routers.library.items_mutate import router as items_mutate_router
from app.routers.library.folders import router as folders_router
from app.routers.library.download import router as download_router
from app.routers.library.preview import router as preview_router
from app.routers.library.sharing import router as sharing_router

router = APIRouter(tags=["library"])
router.include_router(storage_router)
router.include_router(items_list_router)
router.include_router(items_mutate_router)
router.include_router(folders_router)
router.include_router(download_router)
router.include_router(preview_router)
router.include_router(sharing_router)
