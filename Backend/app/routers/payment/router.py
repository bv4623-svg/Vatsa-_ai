import logging

from fastapi import APIRouter

logger = logging.getLogger("PaymentWebhook")

router = APIRouter(tags=["payment"])
