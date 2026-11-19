use larust_support::axum::http::StatusCode;
use larust_support::axum::response::{IntoResponse, Response};
use larust_support::axum::Json;
use larust_support::serde_json::json;

/// Errors returned by the JSON API. Every variant renders a small,
/// stable JSON body: `{ "message": "..." }`.
#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
}

impl ApiError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, message)
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, message)
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, message)
    }

    pub fn internal(error: impl std::fmt::Display) -> Self {
        tracing::error!(error = %error, "unhandled API error");
        eprintln!("internal error: {error}");
        Self::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "The server could not complete the request.",
        )
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "message": self.message }))).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        if matches!(error, sqlx::Error::RowNotFound) {
            ApiError::not_found("Resource not found.")
        } else {
            ApiError::internal(error)
        }
    }
}

impl From<larust_core::AppError> for ApiError {
    fn from(error: larust_core::AppError) -> Self {
        ApiError::internal(error)
    }
}

impl From<ApiError> for larust_core::AppError {
    fn from(error: ApiError) -> Self {
        larust_core::AppError::Http {
            status: error.status,
            message: error.message,
        }
    }
}
