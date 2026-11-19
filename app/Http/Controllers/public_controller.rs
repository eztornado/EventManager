use std::collections::HashMap;

use larust_support::axum::extract::{Path, Query};
use larust_support::axum::response::Html;
use larust_support::axum::Json;
use larust_support::orm::sqlx;
use larust_support::serde_json::{json, Value};

use crate::models::{Coupon, EventRow, Gift, Modality, Order, Registration};
use crate::services::email;
use crate::services::util::{
    current_price, is_valid_email, json_text, normalize_dt, now_iso, parse_json_object, random_code,
};
use crate::services::ApiError;

fn value_as_i64(value: Option<&Value>) -> Option<i64> {
    value.and_then(|v| {
        v.as_i64()
            .or_else(|| v.as_f64().map(|f| f as i64))
            .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
    })
}

fn value_as_string(value: Option<&Value>) -> String {
    value
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn event_is_open(event: &EventRow) -> bool {
    if event.status != "Inscripciones abiertas" {
        return false;
    }
    let deadline = normalize_dt(&event.registration_deadline, true);
    deadline.is_empty() || deadline >= now_iso()
}

async fn registration_count(event_id: i64, modality_id: Option<i64>) -> Result<i64, ApiError> {
    let pool = larust_support::orm::pool()?;
    let count: i64 = match modality_id {
        Some(modality_id) => {
            sqlx::query_scalar(
                "SELECT COUNT(*) FROM registrations WHERE event_id = ? AND modality_id = ? AND status != 'cancelled'",
            )
            .bind(event_id)
            .bind(modality_id)
            .fetch_one(pool)
            .await?
        }
        None => {
            sqlx::query_scalar(
                "SELECT COUNT(*) FROM registrations WHERE event_id = ? AND status != 'cancelled'",
            )
            .bind(event_id)
            .fetch_one(pool)
            .await?
        }
    };
    Ok(count)
}

async fn organizer_json(organizer_id: Option<i64>) -> Result<Option<Value>, ApiError> {
    let Some(id) = organizer_id else {
        return Ok(None);
    };
    let pool = larust_support::orm::pool()?;
    let row: Option<(i64, String, String, String)> = sqlx::query_as(
        "SELECT id, name, slug, logo_url FROM organizers WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(id, name, slug, logo_url)| {
        json!({ "id": id, "name": name, "slug": slug, "logoUrl": logo_url })
    }))
}

async fn modality_json(modality: &Modality) -> Result<Value, ApiError> {
    let (price, tier) = current_price(modality.id, modality.base_price).await?;
    let count = registration_count(modality.event_id, Some(modality.id)).await?;
    let spots_left = modality.max_participants.map(|max| (max - count).max(0));
    let mut value = serde_json::to_value(modality)
        .map_err(|e| ApiError::internal(e))?;
    if let Some(object) = value.as_object_mut() {
        object.insert("currentPrice".into(), json!(price));
        object.insert(
            "currentTier".into(),
            json!(tier.as_ref().map(|tier| tier.name.clone())),
        );
        object.insert("registrationCount".into(), json!(count));
        object.insert("spotsLeft".into(), json!(spots_left));
        object.insert(
            "dynamicFields".into(),
            serde_json::from_str(&modality.dynamic_fields)
                .unwrap_or_else(|_| Value::Array(vec![])),
        );
    }
    Ok(value)
}

async fn event_json(event: &EventRow, detail: bool) -> Result<Value, ApiError> {
    let pool = larust_support::orm::pool()?;
    let mut value = serde_json::to_value(event).map_err(|e| ApiError::internal(e))?;
    let organizer = organizer_json(event.organizer_id).await?;
    let modalities: Vec<Modality> = sqlx::query_as(
        "SELECT * FROM modalities WHERE event_id = ? AND active = 1 ORDER BY sort_order ASC, id ASC",
    )
    .bind(event.id)
    .fetch_all(pool)
    .await?;
    let mut modality_values = Vec::new();
    let mut min_price: Option<f64> = None;
    for modality in &modalities {
        let value = modality_json(modality).await?;
        if let Some(price) = value.get("currentPrice").and_then(Value::as_f64) {
            min_price = Some(min_price.map_or(price, |current| current.min(price)));
        }
        modality_values.push(value);
    }
    let count = registration_count(event.id, None).await?;
    let spots_left = event.max_participants.map(|max| (max - count).max(0));
    if let Some(object) = value.as_object_mut() {
        object.insert("organizer".into(), organizer.unwrap_or(Value::Null));
        object.insert("modalityCount".into(), json!(modalities.len()));
        object.insert("minPrice".into(), json!(min_price));
        object.insert("registrationCount".into(), json!(count));
        object.insert("spotsLeft".into(), json!(spots_left));
        object.insert("registrationOpen".into(), json!(event_is_open(event)));
        object.insert("statusLabel".into(), json!(status_label(event, &modalities)));
        if detail {
            object.insert("modalities".into(), Value::Array(modality_values));
        }
    }
    Ok(value)
}

fn status_label(event: &EventRow, modalities: &[Modality]) -> String {
    if modalities.is_empty() {
        return "Sin modalidades asignadas".to_string();
    }
    event.status.clone()
}

pub async fn list_events(
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let search = params.get("search").cloned().unwrap_or_default();
    let province = params.get("province").cloned().unwrap_or_default();
    let mut events: Vec<EventRow> = sqlx::query_as(
        "SELECT * FROM events WHERE published = 1 AND status != 'Borrador' ORDER BY start_date ASC",
    )
    .fetch_all(pool)
    .await?;
    events.retain(|event| {
        (search.is_empty()
            || event.name.to_lowercase().contains(&search.to_lowercase())
            || event.city.to_lowercase().contains(&search.to_lowercase()))
            && (province.is_empty() || event.province.eq_ignore_ascii_case(&province))
    });
    let mut items = Vec::new();
    for event in &events {
        items.push(event_json(event, false).await?);
    }
    let provinces: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT province FROM events WHERE published = 1 AND province != '' ORDER BY province",
    )
    .fetch_all(pool)
    .await?;
    Ok(Json(json!({ "items": items, "provinces": provinces })))
}

pub async fn get_event(Path(slug): Path<String>) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let event: EventRow = sqlx::query_as("SELECT * FROM events WHERE slug = ? AND published = 1")
        .bind(&slug)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Event not found."))?;
    Ok(Json(event_json(&event, true).await?))
}

pub async fn event_participants(Path(slug): Path<String>) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let event: EventRow = sqlx::query_as("SELECT * FROM events WHERE slug = ? AND published = 1")
        .bind(&slug)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Event not found."))?;
    let rows: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT r.first_name, r.last_name, r.club_name, m.name
         FROM registrations r JOIN modalities m ON m.id = r.modality_id
         WHERE r.event_id = ? AND r.status != 'cancelled'
         ORDER BY m.sort_order ASC, r.last_name ASC, r.first_name ASC",
    )
    .bind(event.id)
    .fetch_all(pool)
    .await?;
    let items: Vec<Value> = rows
        .into_iter()
        .map(|(first_name, last_name, club_name, modality)| {
            json!({
                "firstName": first_name,
                "lastName": last_name,
                "clubName": club_name,
                "modality": modality
            })
        })
        .collect();
    Ok(Json(json!({
        "event": { "id": event.id, "name": event.name, "slug": event.slug },
        "items": items
    })))
}

pub async fn list_clubs() -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let clubs: Vec<crate::models::Club> =
        sqlx::query_as("SELECT * FROM clubs WHERE active = 1 ORDER BY name ASC")
            .fetch_all(pool)
            .await?;
    Ok(Json(json!(clubs)))
}

pub async fn validate_coupon(Json(body): Json<Value>) -> Result<Json<Value>, ApiError> {
    let code = value_as_string(body.get("code"));
    let event_id = value_as_i64(body.get("eventId"))
        .ok_or_else(|| ApiError::bad_request("Event is required."))?;
    let modality_id = value_as_i64(body.get("modalityId"))
        .ok_or_else(|| ApiError::bad_request("Modality is required."))?;
    let (price, _) = {
        let pool = larust_support::orm::pool()?;
        let modality: Modality = sqlx::query_as("SELECT * FROM modalities WHERE id = ? AND event_id = ?")
            .bind(modality_id)
            .bind(event_id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| ApiError::not_found("Modality not found."))?;
        current_price(modality.id, modality.base_price).await?
    };
    let (coupon, discount, error) = apply_coupon(&code, event_id, modality_id, price).await?;
    if let Some(error) = error {
        return Ok(Json(json!({ "valid": false, "message": error })));
    }
    let total = (price - discount).max(0.0);
    Ok(Json(json!({
        "valid": true,
        "coupon": coupon,
        "discount": discount,
        "price": price,
        "total": total
    })))
}

async fn apply_coupon(
    code: &str,
    event_id: i64,
    modality_id: i64,
    price: f64,
) -> Result<(Option<Coupon>, f64, Option<String>), ApiError> {
    if code.trim().is_empty() {
        return Ok((None, 0.0, None));
    }
    let pool = larust_support::orm::pool()?;
    let coupon: Option<Coupon> =
        sqlx::query_as("SELECT * FROM coupons WHERE UPPER(code) = UPPER(?)")
            .bind(code.trim())
            .fetch_optional(pool)
            .await?;
    let Some(coupon) = coupon else {
        return Ok((None, 0.0, Some("El cupón no existe.".to_string())));
    };
    if coupon.active == 0 {
        return Ok((None, 0.0, Some("El cupón no está activo.".to_string())));
    }
    if coupon.event_id.is_some_and(|id| id != event_id) {
        return Ok((None, 0.0, Some("El cupón no es válido para este evento.".to_string())));
    }
    if coupon.modality_id.is_some_and(|id| id != modality_id) {
        return Ok((None, 0.0, Some("El cupón no es válido para esta modalidad.".to_string())));
    }
    let now = now_iso();
    let from = normalize_dt(&coupon.valid_from, false);
    let until = normalize_dt(&coupon.valid_until, true);
    if (!from.is_empty() && from > now) || (!until.is_empty() && until < now) {
        return Ok((None, 0.0, Some("El cupón está fuera de su periodo de validez.".to_string())));
    }
    if coupon.max_uses.is_some_and(|max| coupon.uses >= max) {
        return Ok((None, 0.0, Some("El cupón ha alcanzado su límite de usos.".to_string())));
    }
    let discount = match coupon.kind.as_str() {
        "fixed" => coupon.value,
        "gift" => price,
        _ => price * coupon.value / 100.0,
    }
    .min(price)
    .max(0.0);
    Ok((Some(coupon), discount, None))
}

fn validate_dynamic(modality: &Modality, data: &Value) -> Result<(), ApiError> {
    let fields = serde_json::from_str::<Value>(&modality.dynamic_fields)
        .ok()
        .and_then(|value| value.as_array().cloned())
        .unwrap_or_default();
    let object = data.as_object();
    for field in fields {
        let Some(key) = field.get("key").and_then(Value::as_str) else {
            continue;
        };
        let label = field
            .get("label")
            .and_then(Value::as_str)
            .unwrap_or(key)
            .to_string();
        let required = field
            .get("required")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let value = object.and_then(|object| object.get(key));
        let empty = value.is_none_or(|value| {
            value.is_null()
                || value.as_str().is_some_and(|text| text.trim().is_empty())
                || value
                    .as_array()
                    .is_some_and(|array| array.is_empty())
        });
        if required && empty {
            return Err(ApiError::bad_request(format!("El campo «{label}» es obligatorio.")));
        }
        if empty {
            continue;
        }
        match field.get("type").and_then(Value::as_str).unwrap_or("text") {
            "number" => {
                let valid = value
                    .and_then(|value| {
                        value
                            .as_f64()
                            .or_else(|| value.as_str().and_then(|text| text.parse::<f64>().ok()))
                    })
                    .is_some();
                if !valid {
                    return Err(ApiError::bad_request(format!(
                        "El campo «{label}» debe ser numérico."
                    )));
                }
            }
            "select" => {
                let selected = value.and_then(Value::as_str).unwrap_or_default();
                let options = field
                    .get("options")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                if !options.iter().any(|option| {
                    option.as_str() == Some(selected)
                        || option.get("value").and_then(Value::as_str) == Some(selected)
                }) {
                    return Err(ApiError::bad_request(format!(
                        "El valor de «{label}» no es válido."
                    )));
                }
            }
            _ => {}
        }
    }
    Ok(())
}

const GENDERS: [&str; 4] = ["Femenino", "Masculino", "No binario", "Prefiero no decirlo"];

fn validate_personal(
    first_name: &str,
    last_name: &str,
    email: &str,
    gender: &str,
) -> Result<(), ApiError> {
    if first_name.trim().is_empty() || last_name.trim().is_empty() {
        return Err(ApiError::bad_request("Nombre y apellidos son obligatorios."));
    }
    if !is_valid_email(email) {
        return Err(ApiError::bad_request("El correo electrónico no es válido."));
    }
    if !gender.is_empty() && !GENDERS.contains(&gender) {
        return Err(ApiError::bad_request("El género seleccionado no es válido."));
    }
    Ok(())
}

fn modality_embedded_value(modality: &Modality) -> Value {
    let mut value = serde_json::to_value(modality).unwrap_or_else(|_| json!({}));
    if let Some(object) = value.as_object_mut() {
        object.insert(
            "dynamicFields".into(),
            serde_json::from_str(&modality.dynamic_fields)
                .unwrap_or_else(|_| Value::Array(vec![])),
        );
    }
    value
}

fn build_registration_value(registration: &Registration, event: &EventRow, modality: &Modality) -> Value {
    let mut value = serde_json::to_value(registration).unwrap_or_else(|_| json!({}));
    if let Some(object) = value.as_object_mut() {
        object.insert("event".into(), serde_json::to_value(event).unwrap_or(Value::Null));
        object.insert(
            "modality".into(),
            modality_embedded_value(modality),
        );
        object.insert(
            "dynamicData".into(),
            serde_json::from_str(&registration.dynamic_data).unwrap_or_else(|_| json!({})),
        );
        object.insert("modalityName".into(), json!(modality.name));
        object.insert("eventName".into(), json!(event.name));
        object.insert("eventSlug".into(), json!(event.slug));
    }
    value
}

async fn load_registration(locator: &str) -> Result<(Registration, EventRow, Modality), ApiError> {
    let pool = larust_support::orm::pool()?;
    let registration: Registration = sqlx::query_as("SELECT * FROM registrations WHERE UPPER(locator) = UPPER(?)")
        .bind(locator.trim())
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("No encontramos ninguna inscripción con ese localizador."))?;
    let event: EventRow = sqlx::query_as("SELECT * FROM events WHERE id = ?")
        .bind(registration.event_id)
        .fetch_one(pool)
        .await?;
    let modality: Modality = sqlx::query_as("SELECT * FROM modalities WHERE id = ?")
        .bind(registration.modality_id)
        .fetch_one(pool)
        .await?;
    Ok((registration, event, modality))
}

pub async fn create_registration(Json(body): Json<Value>) -> Result<Json<Value>, ApiError> {
    let event_id = value_as_i64(body.get("eventId"))
        .ok_or_else(|| ApiError::bad_request("El evento es obligatorio."))?;
    let modality_id = value_as_i64(body.get("modalityId"))
        .ok_or_else(|| ApiError::bad_request("La modalidad es obligatoria."))?;
    let pool = larust_support::orm::pool()?;
    let event: EventRow = sqlx::query_as("SELECT * FROM events WHERE id = ? AND published = 1")
        .bind(event_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Event not found."))?;
    if !event_is_open(&event) {
        return Err(ApiError::conflict("Las inscripciones para este evento no están abiertas."));
    }
    let modality: Modality =
        sqlx::query_as("SELECT * FROM modalities WHERE id = ? AND event_id = ? AND active = 1")
            .bind(modality_id)
            .bind(event_id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| ApiError::not_found("Modality not found."))?;

    let first_name = value_as_string(body.get("firstName"));
    let last_name = value_as_string(body.get("lastName"));
    let email = value_as_string(body.get("email")).to_lowercase();
    let gender = value_as_string(body.get("gender"));
    validate_personal(&first_name, &last_name, &email, &gender)?;

    let dynamic_data = body
        .get("dynamicData")
        .cloned()
        .unwrap_or_else(|| json!({}));
    validate_dynamic(&modality, &dynamic_data)?;

    let event_count = registration_count(event.id, None).await?;
    if event.max_participants.is_some_and(|max| event_count >= max) {
        return Err(ApiError::conflict("El evento ha alcanzado el número máximo de participantes."));
    }
    let modality_count = registration_count(event.id, Some(modality.id)).await?;
    if modality
        .max_participants
        .is_some_and(|max| modality_count >= max)
    {
        return Err(ApiError::conflict("Esta modalidad ha alcanzado su cupo máximo."));
    }

    let duplicate: Option<i64> = sqlx::query_scalar(
        "SELECT id FROM registrations WHERE event_id = ? AND LOWER(email) = LOWER(?) AND status != 'cancelled' LIMIT 1",
    )
    .bind(event.id)
    .bind(&email)
    .fetch_optional(pool)
    .await?;
    if duplicate.is_some() {
        return Err(ApiError::conflict("Ya existe una inscripción con este correo para el evento."));
    }

    let (price, _) = current_price(modality.id, modality.base_price).await?;
    let coupon_code = value_as_string(body.get("couponCode"));
    let (coupon, discount, coupon_error) =
        apply_coupon(&coupon_code, event.id, modality.id, price).await?;
    if let Some(error) = coupon_error {
        return Err(ApiError::bad_request(error));
    }
    let total = (price - discount).max(0.0);

    let club_id = value_as_i64(body.get("clubId"));
    let club_name = if let Some(club_id) = club_id {
        let name: Option<String> = sqlx::query_scalar("SELECT name FROM clubs WHERE id = ? AND active = 1")
            .bind(club_id)
            .fetch_optional(pool)
            .await?;
        name.unwrap_or_else(|| value_as_string(body.get("clubName")))
    } else {
        value_as_string(body.get("clubName"))
    };

    let locator = random_code(8);
    let now = now_iso();
    let registration_id: i64 = sqlx::query_scalar(
        "INSERT INTO registrations
         (event_id, modality_id, locator, first_name, last_name, email, phone, birth_date, gender,
          document_id, province, country, club_id, club_name, dynamic_data, base_price, discount,
          total, coupon_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
         RETURNING id",
    )
    .bind(event.id)
    .bind(modality.id)
    .bind(&locator)
    .bind(&first_name)
    .bind(&last_name)
    .bind(&email)
    .bind(value_as_string(body.get("phone")))
    .bind(value_as_string(body.get("birthDate")))
    .bind(&gender)
    .bind(value_as_string(body.get("documentId")))
    .bind(value_as_string(body.get("province")))
    .bind(value_as_string(body.get("country")))
    .bind(club_id)
    .bind(&club_name)
    .bind(json_text(&dynamic_data))
    .bind(price)
    .bind(discount)
    .bind(total)
    .bind(coupon.as_ref().map(|coupon| coupon.id))
    .bind(&now)
    .bind(&now)
    .fetch_one(pool)
    .await?;

    let registration: Registration =
        sqlx::query_as("SELECT * FROM registrations WHERE id = ?")
            .bind(registration_id)
            .fetch_one(pool)
            .await?;

    let order_code = random_code(12);
    sqlx::query(
        "INSERT INTO orders (code, registration_id, amount, status, payment_method, payer_name, payer_email, created_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)",
    )
    .bind(&order_code)
    .bind(registration.id)
    .bind(total)
    .bind(value_as_string(body.get("paymentMethod")))
    .bind(format!("{} {}", first_name, last_name))
    .bind(&email)
    .bind(&now)
    .execute(pool)
    .await?;
    let order: Order = sqlx::query_as("SELECT * FROM orders WHERE code = ?")
        .bind(&order_code)
        .fetch_one(pool)
        .await?;

    Ok(Json(json!({
        "registration": build_registration_value(&registration, &event, &modality),
        "order": order
    })))
}

pub async fn get_registration(Path(locator): Path<String>) -> Result<Json<Value>, ApiError> {
    let (registration, event, modality) = load_registration(&locator).await?;
    let pool = larust_support::orm::pool()?;
    let order: Option<Order> = sqlx::query_as(
        "SELECT * FROM orders WHERE registration_id = ? ORDER BY id DESC LIMIT 1",
    )
    .bind(registration.id)
    .fetch_optional(pool)
    .await?;
    let mut value = build_registration_value(&registration, &event, &modality);
    if let Some(object) = value.as_object_mut() {
        object.insert("order".into(), serde_json::to_value(order).unwrap_or(Value::Null));
        object.insert("canModify".into(), json!(event_is_open(&event) && registration.status != "cancelled"));
        object.insert("registrationOpen".into(), json!(event_is_open(&event)));
    }
    Ok(Json(value))
}

pub async fn update_registration(
    Path(locator): Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let (mut registration, event, modality) = load_registration(&locator).await?;
    if !event_is_open(&event) {
        return Err(ApiError::conflict("El plazo de modificación ha finalizado."));
    }
    if registration.status == "cancelled" {
        return Err(ApiError::conflict("Esta inscripción está cancelada."));
    }
    let first_name = body
        .get("firstName")
        .map(|_| value_as_string(body.get("firstName")))
        .unwrap_or_else(|| registration.first_name.clone());
    let last_name = body
        .get("lastName")
        .map(|_| value_as_string(body.get("lastName")))
        .unwrap_or_else(|| registration.last_name.clone());
    let email = body
        .get("email")
        .map(|_| value_as_string(body.get("email")).to_lowercase())
        .unwrap_or_else(|| registration.email.clone());
    let gender = body
        .get("gender")
        .map(|_| value_as_string(body.get("gender")))
        .unwrap_or_else(|| registration.gender.clone());
    validate_personal(&first_name, &last_name, &email, &gender)?;
    let dynamic_data = body
        .get("dynamicData")
        .cloned()
        .unwrap_or_else(|| parse_json_object(&registration.dynamic_data));
    validate_dynamic(&modality, &dynamic_data)?;

    let club_id = body
        .get("clubId")
        .map(|value| value.as_i64())
        .unwrap_or(registration.club_id);
    let club_name = if let Some(club_id) = club_id {
        let pool = larust_support::orm::pool()?;
        let name: Option<String> = sqlx::query_scalar("SELECT name FROM clubs WHERE id = ?")
            .bind(club_id)
            .fetch_optional(pool)
            .await?;
        name.unwrap_or_else(|| value_as_string(body.get("clubName")))
    } else {
        value_as_string(body.get("clubName"))
    };

    if email != registration.email {
        let pool = larust_support::orm::pool()?;
        let duplicate: Option<i64> = sqlx::query_scalar(
            "SELECT id FROM registrations WHERE event_id = ? AND LOWER(email) = LOWER(?) AND id != ? AND status != 'cancelled' LIMIT 1",
        )
        .bind(event.id)
        .bind(&email)
        .bind(registration.id)
        .fetch_optional(pool)
        .await?;
        if duplicate.is_some() {
            return Err(ApiError::conflict("Ya existe otra inscripción con este correo."));
        }
    }

    let pool = larust_support::orm::pool()?;
    sqlx::query(
        "UPDATE registrations SET first_name = ?, last_name = ?, email = ?, phone = ?, birth_date = ?,
         gender = ?, document_id = ?, province = ?, country = ?, club_id = ?, club_name = ?,
         dynamic_data = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&first_name)
    .bind(&last_name)
    .bind(&email)
    .bind(
        body.get("phone")
            .map(|_| value_as_string(body.get("phone")))
            .unwrap_or_else(|| registration.phone.clone()),
    )
    .bind(
        body.get("birthDate")
            .map(|_| value_as_string(body.get("birthDate")))
            .unwrap_or_else(|| registration.birth_date.clone()),
    )
    .bind(&gender)
    .bind(value_as_string_or(body.get("documentId"), &registration.document_id))
    .bind(value_as_string_or(body.get("province"), &registration.province))
    .bind(value_as_string_or(body.get("country"), &registration.country))
    .bind(club_id)
    .bind(&club_name)
    .bind(json_text(&dynamic_data))
    .bind(now_iso())
    .bind(registration.id)
    .execute(pool)
    .await?;

    registration = sqlx::query_as("SELECT * FROM registrations WHERE id = ?")
        .bind(registration.id)
        .fetch_one(pool)
        .await?;
    Ok(Json(build_registration_value(&registration, &event, &modality)))
}

fn value_as_string_or(value: Option<&Value>, fallback: &str) -> String {
    match value {
        Some(Value::String(text)) => text.trim().to_string(),
        Some(Value::Null) | None => fallback.to_string(),
        Some(other) => other.to_string(),
    }
}

pub async fn cancel_registration(Path(locator): Path<String>) -> Result<Json<Value>, ApiError> {
    let (registration, event, _) = load_registration(&locator).await?;
    if !event_is_open(&event) {
        return Err(ApiError::conflict("El plazo para cancelar la inscripción ha finalizado."));
    }
    if registration.status == "cancelled" {
        return Ok(Json(json!({ "message": "La inscripción ya estaba cancelada." })));
    }
    let pool = larust_support::orm::pool()?;
    sqlx::query("UPDATE registrations SET status = 'cancelled', updated_at = ? WHERE id = ?")
        .bind(now_iso())
        .bind(registration.id)
        .execute(pool)
        .await?;
    sqlx::query("UPDATE orders SET status = 'cancelled' WHERE registration_id = ? AND status = 'pending'")
        .bind(registration.id)
        .execute(pool)
        .await?;
    Ok(Json(json!({ "message": "Inscripción cancelada correctamente." })))
}

pub async fn recover_registration(Json(body): Json<Value>) -> Result<Json<Value>, ApiError> {
    let email = value_as_string(body.get("email")).to_lowercase();
    if !is_valid_email(&email) {
        return Err(ApiError::bad_request("El correo electrónico no es válido."));
    }
    let pool = larust_support::orm::pool()?;
    let rows: Vec<Registration> = sqlx::query_as(
        "SELECT * FROM registrations WHERE LOWER(email) = LOWER(?) ORDER BY id DESC LIMIT 1",
    )
    .bind(&email)
    .fetch_all(pool)
    .await?;
    if let Some(registration) = rows.first() {
        let event: EventRow = sqlx::query_as("SELECT * FROM events WHERE id = ?")
            .bind(registration.event_id)
            .fetch_one(pool)
            .await?;
        email::recovery(registration, &event).await?;
    }
    Ok(Json(json!({
        "message": "Si el correo está registrado, recibirás un mensaje con tu localizador en unos instantes."
    })))
}

pub async fn pay_order(
    Path(code): Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let order: Order = sqlx::query_as("SELECT * FROM orders WHERE code = ?")
        .bind(&code)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Order not found."))?;
    if order.status == "completed" {
        return Ok(Json(json!({ "order": order, "alreadyPaid": true })));
    }
    if order.status != "pending" {
        return Err(ApiError::conflict("Este pedido ya no se puede pagar."));
    }
    let outcome = value_as_string(body.get("outcome"));
    if outcome == "failure" {
        return Err(ApiError::new(
            larust_support::axum::http::StatusCode::PAYMENT_REQUIRED,
            "El pago ha sido rechazado por la pasarela. Puedes intentarlo de nuevo.",
        ));
    }
    let reference = format!("SIM-{}", random_code(10));
    let now = now_iso();
    sqlx::query(
        "UPDATE orders SET status = 'completed', reference = ?, paid_at = ? WHERE id = ?",
    )
    .bind(&reference)
    .bind(&now)
    .bind(order.id)
    .execute(pool)
    .await?;
    let order: Order = sqlx::query_as("SELECT * FROM orders WHERE id = ?")
        .bind(order.id)
        .fetch_one(pool)
        .await?;

    if let Some(registration_id) = order.registration_id {
        sqlx::query("UPDATE registrations SET status = 'paid', updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(registration_id)
            .execute(pool)
            .await?;
        let registration: Registration =
            sqlx::query_as("SELECT * FROM registrations WHERE id = ?")
                .bind(registration_id)
                .fetch_one(pool)
                .await?;
        if let Some(coupon_id) = registration.coupon_id {
            sqlx::query("UPDATE coupons SET uses = uses + 1 WHERE id = ?")
                .bind(coupon_id)
                .execute(pool)
                .await?;
        }
        let event: EventRow = sqlx::query_as("SELECT * FROM events WHERE id = ?")
            .bind(registration.event_id)
            .fetch_one(pool)
            .await?;
        let modality: Modality = sqlx::query_as("SELECT * FROM modalities WHERE id = ?")
            .bind(registration.modality_id)
            .fetch_one(pool)
            .await?;
        email::registration_confirmed(&registration, &event, &modality.name).await?;
        return Ok(Json(json!({
            "order": order,
            "registration": build_registration_value(&registration, &event, &modality)
        })));
    }

    if let Some(gift_id) = order.gift_id {
        sqlx::query("UPDATE gifts SET status = 'available' WHERE id = ?")
            .bind(gift_id)
            .execute(pool)
            .await?;
        let gift: Gift = sqlx::query_as("SELECT * FROM gifts WHERE id = ?")
            .bind(gift_id)
            .fetch_one(pool)
            .await?;
        let event: EventRow = sqlx::query_as("SELECT * FROM events WHERE id = ?")
            .bind(gift.event_id)
            .fetch_one(pool)
            .await?;
        let modality: Modality = sqlx::query_as("SELECT * FROM modalities WHERE id = ?")
            .bind(gift.modality_id)
            .fetch_one(pool)
            .await?;
        email::gift_purchased(&gift, &event, &modality.name).await?;
        return Ok(Json(json!({ "order": order, "gift": gift })));
    }

    Ok(Json(json!({ "order": order })))
}

pub async fn create_gift(Json(body): Json<Value>) -> Result<Json<Value>, ApiError> {
    let event_id = value_as_i64(body.get("eventId"))
        .ok_or_else(|| ApiError::bad_request("El evento es obligatorio."))?;
    let modality_id = value_as_i64(body.get("modalityId"))
        .ok_or_else(|| ApiError::bad_request("La modalidad es obligatoria."))?;
    let pool = larust_support::orm::pool()?;
    let event: EventRow = sqlx::query_as("SELECT * FROM events WHERE id = ?")
        .bind(event_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Event not found."))?;
    if !event_is_open(&event) {
        return Err(ApiError::conflict("Las inscripciones para este evento no están abiertas."));
    }
    let modality: Modality =
        sqlx::query_as("SELECT * FROM modalities WHERE id = ? AND event_id = ? AND active = 1")
            .bind(modality_id)
            .bind(event_id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| ApiError::not_found("Modality not found."))?;
    let buyer_name = value_as_string(body.get("buyerName"));
    let buyer_email = value_as_string(body.get("buyerEmail")).to_lowercase();
    let recipient_name = value_as_string(body.get("recipientName"));
    let recipient_email = value_as_string(body.get("recipientEmail")).to_lowercase();
    if buyer_name.is_empty() || !is_valid_email(&buyer_email) {
        return Err(ApiError::bad_request("Los datos del comprador no son válidos."));
    }
    if recipient_name.is_empty() || !is_valid_email(&recipient_email) {
        return Err(ApiError::bad_request("Los datos de la persona que recibe el regalo no son válidos."));
    }
    let (price, _) = current_price(modality.id, modality.base_price).await?;
    let code = random_code(10);
    let now = now_iso();
    let gift_id: i64 = sqlx::query_scalar(
        "INSERT INTO gifts (event_id, modality_id, buyer_name, buyer_email, recipient_name,
         recipient_email, message, code, price_paid, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
         RETURNING id",
    )
    .bind(event.id)
    .bind(modality.id)
    .bind(&buyer_name)
    .bind(&buyer_email)
    .bind(&recipient_name)
    .bind(&recipient_email)
    .bind(value_as_string(body.get("message")))
    .bind(&code)
    .bind(price)
    .bind(&now)
    .fetch_one(pool)
    .await?;
    let gift: Gift = sqlx::query_as("SELECT * FROM gifts WHERE id = ?")
        .bind(gift_id)
        .fetch_one(pool)
        .await?;
    let order_code = random_code(12);
    sqlx::query(
        "INSERT INTO orders (code, gift_id, amount, status, payment_method, payer_name, payer_email, created_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)",
    )
    .bind(&order_code)
    .bind(gift.id)
    .bind(price)
    .bind(value_as_string(body.get("paymentMethod")))
    .bind(&buyer_name)
    .bind(&buyer_email)
    .bind(&now)
    .execute(pool)
    .await?;
    let order: Order = sqlx::query_as("SELECT * FROM orders WHERE code = ?")
        .bind(&order_code)
        .fetch_one(pool)
        .await?;
    Ok(Json(json!({ "gift": gift, "order": order })))
}

pub async fn get_gift(Path(code): Path<String>) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let gift: Gift = sqlx::query_as("SELECT * FROM gifts WHERE UPPER(code) = UPPER(?)")
        .bind(code.trim())
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("No encontramos ningún regalo con ese código."))?;
    let event: EventRow = sqlx::query_as("SELECT * FROM events WHERE id = ?")
        .bind(gift.event_id)
        .fetch_one(pool)
        .await?;
    let modality: Modality = sqlx::query_as("SELECT * FROM modalities WHERE id = ?")
        .bind(gift.modality_id)
        .fetch_one(pool)
        .await?;
    let mut value = serde_json::to_value(&gift).unwrap_or_else(|_| json!({}));
    if let Some(object) = value.as_object_mut() {
        object.insert("event".into(), serde_json::to_value(&event).unwrap_or(Value::Null));
        object.insert(
            "modality".into(),
            modality_embedded_value(&modality),
        );
    }
    Ok(Json(value))
}

pub async fn claim_gift(
    Path(code): Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let gift: Gift = sqlx::query_as("SELECT * FROM gifts WHERE UPPER(code) = UPPER(?)")
        .bind(code.trim())
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("No encontramos ningún regalo con ese código."))?;
    if gift.status != "available" {
        return Err(ApiError::conflict(if gift.status == "claimed" {
            "Este regalo ya se ha canjeado."
        } else {
            "Este regalo todavía no está disponible."
        }));
    }
    let event: EventRow = sqlx::query_as("SELECT * FROM events WHERE id = ?")
        .bind(gift.event_id)
        .fetch_one(pool)
        .await?;
    let modality: Modality = sqlx::query_as("SELECT * FROM modalities WHERE id = ?")
        .bind(gift.modality_id)
        .fetch_one(pool)
        .await?;

    let first_name = value_as_string(body.get("firstName"));
    let last_name = value_as_string(body.get("lastName"));
    let email = {
        let provided = value_as_string(body.get("email"));
        if provided.is_empty() {
            gift.recipient_email.clone()
        } else {
            provided.to_lowercase()
        }
    };
    let gender = value_as_string(body.get("gender"));
    validate_personal(&first_name, &last_name, &email, &gender)?;
    let dynamic_data = body.get("dynamicData").cloned().unwrap_or_else(|| json!({}));
    validate_dynamic(&modality, &dynamic_data)?;

    let duplicate: Option<i64> = sqlx::query_scalar(
        "SELECT id FROM registrations WHERE event_id = ? AND LOWER(email) = LOWER(?) AND status != 'cancelled' LIMIT 1",
    )
    .bind(event.id)
    .bind(&email)
    .fetch_optional(pool)
    .await?;
    if duplicate.is_some() {
        return Err(ApiError::conflict("Ya existe una inscripción con este correo para el evento."));
    }

    let club_id = value_as_i64(body.get("clubId"));
    let club_name = if let Some(club_id) = club_id {
        let name: Option<String> = sqlx::query_scalar("SELECT name FROM clubs WHERE id = ?")
            .bind(club_id)
            .fetch_optional(pool)
            .await?;
        name.unwrap_or_else(|| value_as_string(body.get("clubName")))
    } else {
        value_as_string(body.get("clubName"))
    };

    let locator = random_code(8);
    let now = now_iso();
    let registration_id: i64 = sqlx::query_scalar(
        "INSERT INTO registrations
         (event_id, modality_id, locator, first_name, last_name, email, phone, birth_date, gender,
          document_id, province, country, club_id, club_name, dynamic_data, base_price, discount,
          total, gift_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 'paid', ?, ?)
         RETURNING id",
    )
    .bind(event.id)
    .bind(modality.id)
    .bind(&locator)
    .bind(&first_name)
    .bind(&last_name)
    .bind(&email)
    .bind(value_as_string(body.get("phone")))
    .bind(value_as_string(body.get("birthDate")))
    .bind(&gender)
    .bind(value_as_string(body.get("documentId")))
    .bind(value_as_string(body.get("province")))
    .bind(value_as_string(body.get("country")))
    .bind(club_id)
    .bind(&club_name)
    .bind(json_text(&dynamic_data))
    .bind(gift.id)
    .bind(&now)
    .bind(&now)
    .fetch_one(pool)
    .await?;
    let registration: Registration =
        sqlx::query_as("SELECT * FROM registrations WHERE id = ?")
            .bind(registration_id)
            .fetch_one(pool)
            .await?;
    sqlx::query("UPDATE gifts SET status = 'claimed', claimed_at = ? WHERE id = ?")
        .bind(&now)
        .bind(gift.id)
        .execute(pool)
        .await?;
    email::gift_claimed(&gift, &registration, &event).await?;
    Ok(Json(json!({
        "registration": build_registration_value(&registration, &event, &modality)
    })))
}

/// Printable receipt (a self-contained HTML document, opened in a new tab).
pub async fn registration_receipt(Path(locator): Path<String>) -> Result<Html<String>, ApiError> {
    let (registration, event, modality) = load_registration(&locator).await?;
    let pool = larust_support::orm::pool()?;
    let order: Option<Order> = sqlx::query_as(
        "SELECT * FROM orders WHERE registration_id = ? ORDER BY id DESC LIMIT 1",
    )
    .bind(registration.id)
    .fetch_optional(pool)
    .await?;
    let dynamic = parse_json_object(&registration.dynamic_data);
    let dynamic_rows: String = dynamic
        .as_object()
        .map(|object| {
            object
                .iter()
                .map(|(key, value)| {
                    format!(
                        "<tr><th>{}</th><td>{}</td></tr>",
                        html_escape(key),
                        html_escape(&value_to_display(value))
                    )
                })
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default();
    let status = match registration.status.as_str() {
        "paid" => "Pagada",
        "pending" => "Pendiente de pago",
        "cancelled" => "Cancelada",
        other => other,
    };
    let html = format!(
        r#"<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Recibo {locator}</title>
<style>
body{{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f1f5f9;margin:0;padding:32px;color:#0f172a}}
.card{{max-width:720px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 10px 40px rgba(15,23,42,.08)}}
header{{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f766e;padding-bottom:20px;margin-bottom:28px}}
h1{{margin:0;font-size:22px}} .muted{{color:#64748b;font-size:13px}}
table{{width:100%;border-collapse:collapse;margin-top:16px}} th,td{{text-align:left;padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:14px}}
th{{width:38%;color:#475569;font-weight:600}} .locator{{font-family:ui-monospace,SFMono-Regular,monospace;font-size:22px;letter-spacing:3px}}
.total{{font-size:20px;font-weight:700;color:#0f766e}} .actions{{margin-top:28px;text-align:right}}
button{{background:#0f766e;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:14px;cursor:pointer}}
@media print{{body{{background:#fff;padding:0}}.card{{box-shadow:none}}.actions{{display:none}}}}
</style></head><body><div class="card">
<header><div><h1>{event_name}</h1><div class="muted">{city} · {start_date}</div></div>
<div style="text-align:right"><div class="muted">Localizador</div><div class="locator">{locator}</div></div></header>
<table>
<tr><th>Participante</th><td>{first_name} {last_name}</td></tr>
<tr><th>Correo</th><td>{email}</td></tr>
<tr><th>Modalidad</th><td>{modality}</td></tr>
<tr><th>Estado</th><td>{status}</td></tr>
<tr><th>Importe</th><td>{total:.2} €</td></tr>
<tr><th>Pedido</th><td>{order_code}</td></tr>
{dynamic_rows}
</table>
<p class="muted" style="margin-top:28px">Presenta este recibo el día del evento. Documento generado automáticamente por EventManager.</p>
<div class="actions"><button onclick="window.print()">Imprimir</button></div>
</div></body></html>"#,
        locator = html_escape(&registration.locator),
        event_name = html_escape(&event.name),
        city = html_escape(&event.city),
        start_date = html_escape(&event.start_date),
        first_name = html_escape(&registration.first_name),
        last_name = html_escape(&registration.last_name),
        email = html_escape(&registration.email),
        modality = html_escape(&modality.name),
        total = registration.total,
        order_code = html_escape(order.as_ref().map(|o| o.code.as_str()).unwrap_or("—")),
    );
    Ok(Html(html))
}

fn value_to_display(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Null => String::new(),
        Value::Bool(value) => (if *value { "Sí" } else { "No" }).to_string(),
        other => other.to_string(),
    }
}

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
