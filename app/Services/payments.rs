use std::collections::HashMap;

use hmac::{Hmac, Mac};
use larust_support::serde_json::{json, Value};
use sha2::Sha256;

use crate::services::ApiError;

fn setting(key: &str) -> String {
    crate::config::app::config()[key]
        .as_str()
        .unwrap_or_default()
        .to_string()
}

fn api_base() -> String {
    let value = setting("stripe_api_base");
    if value.is_empty() {
        "https://api.stripe.com/v1".to_string()
    } else {
        value
    }
}

/// Active payment provider: `demo` (simulated) or `stripe` (hosted Checkout).
pub fn provider() -> String {
    let value = setting("payment_provider");
    if value == "stripe" {
        "stripe".to_string()
    } else {
        "demo".to_string()
    }
}

pub fn is_stripe() -> bool {
    provider() == "stripe"
}

pub fn currency() -> String {
    let value = setting("stripe_currency");
    if value.is_empty() {
        "eur".to_string()
    } else {
        value
    }
}

pub fn frontend_url() -> String {
    let value = setting("frontend_url");
    if value.is_empty() {
        "http://localhost:8099".to_string()
    } else {
        value.trim_end_matches('/').to_string()
    }
}

/// Safe, public payment information for the storefront.
pub fn public_config() -> Value {
    json!({
        "provider": provider(),
        "currency": currency(),
        "stripeEnabled": is_stripe(),
        "providerLabel": if is_stripe() { "Stripe" } else { "Pasarela de demostración" }
    })
}

pub struct CheckoutSession {
    pub id: String,
    pub url: String,
}

pub struct StripeSession {
    pub id: String,
    pub payment_status: String,
    pub status: String,
    pub metadata: HashMap<String, String>,
}

fn stripe_secret() -> Result<String, ApiError> {
    let secret = setting("stripe_secret_key");
    if secret.trim().is_empty() {
        return Err(ApiError::new(
            larust_support::axum::http::StatusCode::SERVICE_UNAVAILABLE,
            "Stripe no está configurado. Define STRIPE_SECRET_KEY para activar esta pasarela.",
        ));
    }
    Ok(secret)
}

fn stripe_error(status: reqwest::StatusCode, payload: &Value) -> ApiError {
    let message = payload
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .unwrap_or("La pasarela de pago ha devuelto un error.");
    tracing::warn!(status = %status, message = %message, "stripe request failed");
    ApiError::new(
        larust_support::axum::http::StatusCode::BAD_GATEWAY,
        format!("Stripe: {message}"),
    )
}

async fn client() -> Result<reqwest::Client, ApiError> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(ApiError::internal)
}

/// Creates a hosted Stripe Checkout Session and returns its redirect URL.
pub async fn create_checkout(
    order_code: &str,
    amount: f64,
    description: &str,
    customer_email: &str,
    success_path: &str,
    cancel_path: &str,
) -> Result<CheckoutSession, ApiError> {
    let secret = stripe_secret()?;
    let cents = (amount * 100.0).round() as i64;
    if cents <= 0 {
        return Err(ApiError::bad_request(
            "Este pedido no requiere pago con tarjeta.",
        ));
    }
    let frontend = frontend_url();
    let success_url = format!(
        "{}{}{}session_id={{CHECKOUT_SESSION_ID}}",
        frontend,
        success_path,
        if success_path.contains('?') { "&" } else { "?" }
    );
    let cancel_url = format!("{frontend}{cancel_path}");
    let currency = currency();

    let mut params: Vec<(String, String)> = vec![
        ("mode".into(), "payment".into()),
        ("success_url".into(), success_url),
        ("cancel_url".into(), cancel_url),
        ("client_reference_id".into(), order_code.to_string()),
        ("line_items[0][quantity]".into(), "1".into()),
        (
            "line_items[0][price_data][currency]".into(),
            currency.to_string(),
        ),
        (
            "line_items[0][price_data][unit_amount]".into(),
            cents.to_string(),
        ),
        (
            "line_items[0][price_data][product_data][name]".into(),
            description.to_string(),
        ),
        ("metadata[orderCode]".into(), order_code.to_string()),
        (
            "payment_intent_data[metadata][orderCode]".into(),
            order_code.to_string(),
        ),
    ];
    if crate::services::util::is_valid_email(customer_email) {
        params.push(("customer_email".into(), customer_email.to_string()));
    }

    let response = client()
        .await?
        .post(format!("{}/checkout/sessions", api_base()))
        .bearer_auth(secret)
        .form(&params)
        .send()
        .await
        .map_err(|error| ApiError::internal(format!("stripe checkout request: {error}")))?;

    let status = response.status();
    let payload: Value = response.json().await.unwrap_or_else(|_| json!({}));
    if !status.is_success() {
        return Err(stripe_error(status, &payload));
    }
    let id = payload
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::internal("Stripe no ha devuelto el identificador de la sesión."))?;
    let url = payload
        .get("url")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::internal("Stripe no ha devuelto la URL de pago."))?;
    Ok(CheckoutSession {
        id: id.to_string(),
        url: url.to_string(),
    })
}

fn valid_session_id(session_id: &str) -> bool {
    !session_id.is_empty()
        && session_id.len() <= 255
        && session_id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
}

/// Reads a Checkout Session back from Stripe to verify its payment state.
pub async fn retrieve_session(session_id: &str) -> Result<StripeSession, ApiError> {
    if !valid_session_id(session_id) {
        return Err(ApiError::bad_request("El identificador de pago no es válido."));
    }
    let secret = stripe_secret()?;
    let response = client()
        .await?
        .get(format!("{}/checkout/sessions/{session_id}", api_base()))
        .bearer_auth(secret)
        .send()
        .await
        .map_err(|error| ApiError::internal(format!("stripe session request: {error}")))?;
    let status = response.status();
    let payload: Value = response.json().await.unwrap_or_else(|_| json!({}));
    if !status.is_success() {
        return Err(stripe_error(status, &payload));
    }
    let metadata = payload
        .get("metadata")
        .and_then(Value::as_object)
        .map(|object| {
            object
                .iter()
                .filter_map(|(key, value)| {
                    value.as_str().map(|value| (key.clone(), value.to_string()))
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(StripeSession {
        id: payload
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or(session_id)
            .to_string(),
        payment_status: payload
            .get("payment_status")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        status: payload
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        metadata,
    })
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 0x0f) as usize] as char);
    }
    out
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    let mut diff = 0u8;
    for (a, b) in left.iter().zip(right) {
        diff |= a ^ b;
    }
    diff == 0
}

/// Verifies Stripe's `Stripe-Signature` header (HMAC SHA-256 + timestamp).
pub fn verify_webhook(payload: &[u8], signature_header: &str) -> Result<(), ApiError> {
    let secret = setting("stripe_webhook_secret");
    if secret.trim().is_empty() {
        return Err(ApiError::new(
            larust_support::axum::http::StatusCode::SERVICE_UNAVAILABLE,
            "El webhook de Stripe no está configurado.",
        ));
    }
    let mut timestamp: Option<&str> = None;
    let mut signatures: Vec<&str> = Vec::new();
    for part in signature_header.split(',') {
        let mut pieces = part.trim().splitn(2, '=');
        match (pieces.next(), pieces.next()) {
            (Some("t"), Some(value)) => timestamp = Some(value),
            (Some("v1"), Some(value)) => signatures.push(value),
            _ => {}
        }
    }
    let timestamp = timestamp
        .ok_or_else(|| ApiError::bad_request("Firma de Stripe incompleta."))?;
    let timestamp_value: i64 = timestamp
        .parse()
        .map_err(|_| ApiError::bad_request("La marca de tiempo de Stripe no es válida."))?;
    if (chrono::Utc::now().timestamp() - timestamp_value).abs() > 300 {
        return Err(ApiError::bad_request("La firma de Stripe ha caducado."));
    }
    if signatures.is_empty() {
        return Err(ApiError::bad_request("Firma de Stripe incompleta."));
    }
    let signed_payload = [timestamp.as_bytes(), b".", payload].concat();
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
        .map_err(|error| ApiError::internal(format!("stripe webhook key: {error}")))?;
    mac.update(&signed_payload);
    let expected = hex_encode(&mac.finalize().into_bytes());
    if signatures
        .iter()
        .any(|signature| constant_time_eq(signature.as_bytes(), expected.as_bytes()))
    {
        Ok(())
    } else {
        Err(ApiError::bad_request("La firma de Stripe no es válida."))
    }
}
