use chrono::{SecondsFormat, Utc};
use rand::distributions::Alphanumeric;
use rand::Rng;
use serde_json::Value;

use crate::models::{PriceTier};
use crate::services::ApiError;

/// Current UTC timestamp in the same shape used across the database
/// (`2026-03-01T10:00:00Z`), so plain string comparisons are valid.
pub fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

/// Normalizes a date coming from a browser date/datetime input into the
/// canonical UTC-ish format used for comparisons. Empty stays empty.
pub fn normalize_dt(value: &str, end_of_day: bool) -> String {
    let value = value.trim();
    if value.is_empty() {
        return String::new();
    }
    match value.len() {
        10 => format!(
            "{}T{}",
            value,
            if end_of_day { "23:59:59Z" } else { "00:00:00Z" }
        ),
        16 => format!("{}:00Z", value),
        19 => format!("{}Z", value),
        _ => value.to_string(),
    }
}

pub fn random_code(len: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(|c| c.to_ascii_uppercase() as char)
        .collect()
}

pub fn slugify(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut last_dash = false;
    for ch in value.chars() {
        let ch = ch.to_lowercase().next().unwrap_or(ch);
        let ch = match ch {
            'á' | 'à' | 'ä' | 'â' | 'ã' => 'a',
            'é' | 'è' | 'ë' | 'ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' | 'õ' => 'o',
            'ú' | 'ù' | 'ü' | 'û' => 'u',
            'ñ' => 'n',
            'ç' => 'c',
            other => other,
        };
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            last_dash = false;
        } else if !last_dash && !out.is_empty() {
            out.push('-');
            last_dash = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    if out.is_empty() {
        out.push_str("evento");
    }
    out
}

/// Serializes a JSON value for a TEXT column, falling back to `{}`.
pub fn json_text(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "{}".to_string())
}

/// The active price for a modality: the active tier whose window contains
/// "now", or the modality base price when no tier applies.
pub async fn current_price(
    modality_id: i64,
    base_price: f64,
) -> Result<(f64, Option<PriceTier>), ApiError> {
    let pool = larust_support::orm::pool()?;
    let tiers: Vec<PriceTier> = sqlx::query_as(
        "SELECT * FROM price_tiers WHERE modality_id = ? AND active = 1 ORDER BY starts_at ASC",
    )
    .bind(modality_id)
    .fetch_all(pool)
    .await?;
    let now = now_iso();
    let mut chosen: Option<PriceTier> = None;
    for tier in tiers {
        let starts = normalize_dt(&tier.starts_at, false);
        let ends = normalize_dt(&tier.ends_at, true);
        if (starts.is_empty() || starts <= now) && (ends.is_empty() || ends >= now) {
            chosen = Some(tier);
        }
    }
    Ok(match chosen {
        Some(tier) => (tier.price, Some(tier)),
        None => (base_price, None),
    })
}

/// Writes an email to the local outbox. Mail delivery is intentionally
/// simulated: every message is stored and logged so the full flow can be
/// inspected from the backoffice without an SMTP server.
pub async fn send_email(
    to: &str,
    subject: &str,
    body: &str,
) -> Result<(), ApiError> {
    let pool = larust_support::orm::pool()?;
    sqlx::query(
        "INSERT INTO email_outbox (to_email, subject, body, status, created_at) VALUES (?, ?, ?, 'sent', ?)",
    )
    .bind(to)
    .bind(subject)
    .bind(body)
    .bind(now_iso())
    .execute(pool)
    .await?;
    tracing::info!(to = %to, subject = %subject, "outbox email queued");
    Ok(())
}

pub fn is_valid_email(value: &str) -> bool {
    let value = value.trim();
    value.len() >= 5
        && value.contains('@')
        && value.split('@').nth(1).is_some_and(|domain| domain.contains('.'))
        && !value.contains(' ')
}

pub fn csv_escape(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

pub fn parse_json_object(value: &str) -> Value {
    serde_json::from_str::<Value>(value)
        .ok()
        .filter(Value::is_object)
        .unwrap_or_else(|| Value::Object(Default::default()))
}

pub fn as_bool(value: Option<&Value>, default: bool) -> bool {
    value.and_then(Value::as_bool).unwrap_or(default)
}

pub fn as_i64(value: Option<&Value>) -> Option<i64> {
    value.and_then(|v| {
        v.as_i64()
            .or_else(|| v.as_f64().map(|f| f as i64))
            .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
    })
}

pub fn as_f64(value: Option<&Value>, default: f64) -> f64 {
    value
        .and_then(|v| {
            v.as_f64()
                .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        })
        .unwrap_or(default)
}

pub fn as_str(value: Option<&Value>, default: &str) -> String {
    value
        .and_then(Value::as_str)
        .unwrap_or(default)
        .trim()
        .to_string()
}
