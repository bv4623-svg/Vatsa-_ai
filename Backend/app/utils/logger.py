import logging
import re

SENSITIVE_PATTERNS = [
    (r"(?i)password\s*[:=]\s*\S+", "password=***"),
    (r"(?i)api[-_]?key\s*[:=]\s*\S+", "api_key=***"),
    (r"(?i)secret\s*[:=]\s*\S+", "secret=***"),
    (r"Bearer\s+[\w-]+\.[\w-]+\.[\w-]+", "Bearer ***"),
]

def mask_sensitive_data(text: str) -> str:
    if not isinstance(text, str):
        return text
    masked = text
    for pattern, replacement in SENSITIVE_PATTERNS:
        masked = re.sub(pattern, replacement, masked, flags=re.IGNORECASE)
    return masked

def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    # Monkey-patch to mask data
    original_info = logger.info
    original_error = logger.error
    original_warning = logger.warning
    original_debug = logger.debug

    def masked_info(msg, *args, **kwargs):
        return original_info(mask_sensitive_data(msg), *args, **kwargs)
    # Similarly for others... but simple way:
    # We will override methods
    logger.info = lambda msg, *args, **kwargs: original_info(mask_sensitive_data(msg), *args, **kwargs)
    logger.error = lambda msg, *args, **kwargs: original_error(mask_sensitive_data(msg), *args, **kwargs)
    logger.warning = lambda msg, *args, **kwargs: original_warning(mask_sensitive_data(msg), *args, **kwargs)
    logger.debug = lambda msg, *args, **kwargs: original_debug(mask_sensitive_data(msg), *args, **kwargs)
    
    return logger