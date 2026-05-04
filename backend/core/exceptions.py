class AuthenticationError(Exception):
    """Invalid credentials or token."""


class AuthorizationError(Exception):
    """Authenticated but not allowed to perform the action."""


class UserNotFoundError(Exception):
    """User record missing."""


class ProductNotFoundError(Exception):
    pass


class LowConfidenceError(Exception):
    def __init__(self, message: str = "Confidence below threshold", confidence_score: float = 0.0):
        self.confidence_score = confidence_score
        super().__init__(message)


class MissingFieldsError(Exception):
    def __init__(self, message: str = "Required fields are missing", missing_fields: list[str] | None = None):
        self.missing_fields = missing_fields or []
        super().__init__(message)


class QuotationBuildError(Exception):
    pass


class EnquiryParseError(Exception):
    pass


class LLMCallError(Exception):
    pass
