from pydantic import BaseModel


class CreateOrderRequest(BaseModel):
    plan_id: str = "pro"
    currency: str = "USD"


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
