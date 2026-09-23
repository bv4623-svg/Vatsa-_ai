import logging

from fastapi import APIRouter

logger = logging.getLogger("PaymentHistory")

router = APIRouter(tags=["payment-history"])
