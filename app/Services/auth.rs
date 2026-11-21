use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use larust_support::axum::extract::FromRequestParts;
use larust_support::axum::http::header::AUTHORIZATION;
use larust_support::axum::http::request::Parts;
use larust_support::orm::sqlx;
use serde::{Deserialize, Serialize};

use crate::models::EventRow;
use crate::services::ApiError;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentUser {
    pub id: i64,
    pub name: String,
    pub email: String,
    pub role: String,
    pub organizer_id: Option<i64>,
}

impl CurrentUser {
    pub fn is_organizer(&self) -> bool {
        self.role == "organizer"
    }

    pub fn is_superadmin(&self) -> bool {
        self.role == "superadmin"
    }

    /// Admins see every event; organizer accounts only their own.
    pub fn can_access_event(&self, event: &EventRow) -> bool {
        !self.is_organizer() || event.organizer_id == self.organizer_id
    }

    pub async fn require_event_access(&self, event_id: i64) -> Result<EventRow, ApiError> {
        let pool = larust_support::orm::pool()?;
        let event: Option<EventRow> =
            sqlx::query_as("SELECT * FROM events WHERE id = ?").bind(event_id).fetch_optional(pool).await?;
        let event = event.ok_or_else(|| ApiError::not_found("Event not found."))?;
        if !self.can_access_event(&event) {
            return Err(ApiError::forbidden("You do not have access to this event."));
        }
        Ok(event)
    }

    pub fn require_admin(&self) -> Result<(), ApiError> {
        if self.is_organizer() {
            Err(ApiError::forbidden("Administrator access is required."))
        } else {
            Ok(())
        }
    }

    pub fn require_superadmin(&self) -> Result<(), ApiError> {
        if self.is_superadmin() {
            Ok(())
        } else {
            Err(ApiError::forbidden("Superadmin access is required."))
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: i64,
    role: String,
    organizer_id: Option<i64>,
    exp: usize,
}

fn secret() -> String {
    std::env::var("JWT_SECRET")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            "eventmanager-development-secret-change-me-in-production".to_string()
        })
}

pub fn issue_token(id: i64, role: &str, organizer_id: Option<i64>) -> Result<String, ApiError> {
    let exp = (Utc::now() + Duration::days(7)).timestamp() as usize;
    let claims = Claims {
        sub: id,
        role: role.to_string(),
        organizer_id,
        exp,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret().as_bytes()),
    )
    .map_err(ApiError::internal)
}

fn decode_token(token: &str) -> Result<Claims, ApiError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret().as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|_| ApiError::unauthorized("Your session has expired. Please sign in again."))
}

pub fn hash_password(password: &str) -> Result<String, ApiError> {
    larust_support::auth::hash_password(password).map_err(ApiError::internal)
}

pub fn verify_password(hash: &str, password: &str) -> Result<bool, ApiError> {
    larust_support::auth::verify_password(hash, password).map_err(|_| {
        ApiError::unauthorized("Those credentials do not match our records.")
    })
}

#[larust_support::axum::async_trait]
impl<S> FromRequestParts<S> for CurrentUser
where
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| ApiError::unauthorized("Sign in to continue."))?;
        let token = header
            .strip_prefix("Bearer ")
            .or_else(|| header.strip_prefix("bearer "))
            .ok_or_else(|| ApiError::unauthorized("Invalid authorization header."))?;
        let claims = decode_token(token)?;
        let pool = larust_support::orm::pool()?;

        if claims.role == "organizer" {
            let row: Option<(i64, String, String, Option<i64>)> = sqlx::query_as(
                "SELECT id, name, email, organizer_id FROM organizer_accounts WHERE id = ? AND active = 1",
            )
            .bind(claims.sub)
            .fetch_optional(pool)
            .await?;
            let (id, name, email, organizer_id) =
                row.ok_or_else(|| ApiError::unauthorized("This account is no longer active."))?;
            Ok(CurrentUser {
                id,
                name,
                email,
                role: "organizer".to_string(),
                organizer_id,
            })
        } else {
            let row: Option<(i64, String, String, String)> = sqlx::query_as(
                "SELECT id, name, email, role FROM admin_users WHERE id = ? AND active = 1",
            )
            .bind(claims.sub)
            .fetch_optional(pool)
            .await?;
            let (id, name, email, role) =
                row.ok_or_else(|| ApiError::unauthorized("This account is no longer active."))?;
            Ok(CurrentUser {
                id,
                name,
                email,
                role,
                organizer_id: None,
            })
        }
    }
}
