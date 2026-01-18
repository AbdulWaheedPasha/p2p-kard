def funding_progress_pct(amount_pooled_cents, amount_needed_cents):
    if not amount_needed_cents or amount_needed_cents <= 0:
        return 0
    pct = int((amount_pooled_cents / amount_needed_cents) * 100)
    if pct < 0:
        return 0
    if pct > 100:
        return 100
    return pct


def prefixed_id(prefix, value):
    if value is None:
        return None
    return f"{prefix}_{value}"


def parse_prefixed_id(prefix, value):
    if value is None:
        return None
    if isinstance(value, str) and value.startswith(f"{prefix}_"):
        return value.split(f"{prefix}_", 1)[1]
    return value
