use std::collections::HashMap;

use larust_support::axum::extract::{Path, Query};
use larust_support::axum::Json;
use larust_support::orm::sqlx;
use larust_support::serde_json::{json, Value};

use crate::models::{Club, Coupon, EventRow, Modality, PriceTier};
use crate::services::auth::CurrentUser;
use crate::services::util::{
    current_price, event_category_label, normalize_dt, normalize_event_category, now_iso, random_code,
    slugify,
};
use crate::services::ApiError;

fn body_str(body: &Value, key: &str) -> String {
    body.get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn body_opt_str(body: &Value, key: &str) -> Option<String> {
    body.get(key).map(|_| body_str(body, key))
}

fn body_i64(body: &Value, key: &str) -> Option<i64> {
    body.get(key).and_then(|value| {
        value
            .as_i64()
            .or_else(|| value.as_f64().map(|f| f as i64))
            .or_else(|| value.as_str().and_then(|text| text.parse().ok()))
    })
}

fn body_f64(body: &Value, key: &str, default: f64) -> f64 {
    body.get(key)
        .and_then(|value| {
            value
                .as_f64()
                .or_else(|| value.as_str().and_then(|text| text.parse().ok()))
        })
        .unwrap_or(default)
}

fn body_bool(body: &Value, key: &str) -> Option<bool> {
    body.get(key).and_then(|value| {
        value
            .as_bool()
            .or_else(|| value.as_i64().map(|number| number != 0))
    })
}

fn json_fields(body: &Value) -> String {
    match body.get("dynamicFields") {
        Some(Value::String(text)) => serde_json::from_str::<Value>(text)
            .map(|value| value.to_string())
            .unwrap_or_else(|_| "[]".to_string()),
        Some(value @ Value::Array(_)) => value.to_string(),
        _ => "[]".to_string(),
    }
}

async fn get_event(id: i64) -> Result<EventRow, ApiError> {
    let pool = larust_support::orm::pool()?;
    sqlx::query_as("SELECT * FROM events WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Event not found."))
}

async fn get_modality(id: i64) -> Result<Modality, ApiError> {
    let pool = larust_support::orm::pool()?;
    sqlx::query_as("SELECT * FROM modalities WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Modality not found."))
}

async fn get_tier(id: i64) -> Result<PriceTier, ApiError> {
    let pool = larust_support::orm::pool()?;
    sqlx::query_as("SELECT * FROM price_tiers WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Price tier not found."))
}

async fn unique_slug(base: &str, exclude_id: Option<i64>) -> Result<String, ApiError> {
    let pool = larust_support::orm::pool()?;
    let base = slugify(base);
    let mut candidate = base.clone();
    let mut counter = 2;
    loop {
        let existing: Option<i64> =
            sqlx::query_scalar("SELECT id FROM events WHERE slug = ? AND id != ?")
                .bind(&candidate)
                .bind(exclude_id.unwrap_or(0))
                .fetch_optional(pool)
                .await?;
        if existing.is_none() {
            return Ok(candidate);
        }
        candidate = format!("{}-{}", base, counter);
        counter += 1;
    }
}

async fn organizer_json(id: Option<i64>) -> Result<Value, ApiError> {
    let Some(id) = id else {
        return Ok(Value::Null);
    };
    let pool = larust_support::orm::pool()?;
    let row: Option<(i64, String, String)> =
        sqlx::query_as("SELECT id, name, slug FROM organizers WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
    Ok(row
        .map(|(id, name, slug)| json!({ "id": id, "name": name, "slug": slug }))
        .unwrap_or(Value::Null))
}

async fn event_counts(event_id: i64, modality_id: Option<i64>) -> Result<(i64, f64), ApiError> {
    let pool = larust_support::orm::pool()?;
    let (count, amount): (i64, f64) = match modality_id {
        Some(modality_id) => sqlx::query_as(
            "SELECT COUNT(*), CAST(COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) AS REAL)
             FROM registrations WHERE event_id = ? AND modality_id = ? AND status != 'cancelled'",
        )
        .bind(event_id)
        .bind(modality_id)
        .fetch_one(pool)
        .await?,
        None => sqlx::query_as(
            "SELECT COUNT(*), CAST(COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) AS REAL)
             FROM registrations WHERE event_id = ? AND status != 'cancelled'",
        )
        .bind(event_id)
        .fetch_one(pool)
        .await?,
    };
    Ok((count, amount))
}

async fn modality_admin_json(modality: &Modality) -> Result<Value, ApiError> {
    let pool = larust_support::orm::pool()?;
    let tiers: Vec<PriceTier> = sqlx::query_as(
        "SELECT * FROM price_tiers WHERE modality_id = ? ORDER BY starts_at ASC",
    )
    .bind(modality.id)
    .fetch_all(pool)
    .await?;
    let (current, _) = current_price(modality.id, modality.base_price).await?;
    let (count, revenue) = event_counts(modality.event_id, Some(modality.id)).await?;
    let mut value = serde_json::to_value(modality).map_err(ApiError::internal)?;
    if let Some(object) = value.as_object_mut() {
        object.insert("currentPrice".into(), json!(current));
        object.insert("registrationCount".into(), json!(count));
        object.insert("revenue".into(), json!(revenue));
        object.insert(
            "dynamicFields".into(),
            serde_json::from_str(&modality.dynamic_fields).unwrap_or_else(|_| json!([])),
        );
        object.insert("tiers".into(), serde_json::to_value(tiers).unwrap_or(Value::Null));
    }
    Ok(value)
}

async fn event_admin_json(event: &EventRow) -> Result<Value, ApiError> {
    let pool = larust_support::orm::pool()?;
    let modalities: Vec<Modality> =
        sqlx::query_as("SELECT * FROM modalities WHERE event_id = ? ORDER BY sort_order ASC, id ASC")
            .bind(event.id)
            .fetch_all(pool)
            .await?;
    let mut modality_values = Vec::new();
    for modality in &modalities {
        modality_values.push(modality_admin_json(modality).await?);
    }
    let coupons: Vec<Coupon> = sqlx::query_as(
        "SELECT * FROM coupons WHERE event_id = ? ORDER BY created_at DESC",
    )
    .bind(event.id)
    .fetch_all(pool)
    .await?;
    let (count, revenue) = event_counts(event.id, None).await?;
    let paid: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM registrations WHERE event_id = ? AND status = 'paid'",
    )
    .bind(event.id)
    .fetch_one(pool)
    .await?;
    let gifts: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM gifts WHERE event_id = ?")
        .bind(event.id)
        .fetch_one(pool)
        .await?;

    let status_label = if modalities.is_empty() {
        "Sin modalidades asignadas".to_string()
    } else {
        event.status.clone()
    };
    let mut value = serde_json::to_value(event).map_err(ApiError::internal)?;
    if let Some(object) = value.as_object_mut() {
        object.insert("organizer".into(), organizer_json(event.organizer_id).await?);
        object.insert(
            "categoryLabel".into(),
            json!(event_category_label(&event.category)),
        );
        object.insert("statusLabel".into(), json!(status_label));
        object.insert("registrationCount".into(), json!(count));
        object.insert("paidCount".into(), json!(paid));
        object.insert("revenue".into(), json!(revenue));
        object.insert("giftCount".into(), json!(gifts));
        object.insert("modalities".into(), Value::Array(modality_values));
        object.insert("coupons".into(), serde_json::to_value(coupons).unwrap_or(Value::Null));
    }
    Ok(value)
}

pub async fn list_events(user: CurrentUser) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let mut events: Vec<EventRow> =
        sqlx::query_as("SELECT * FROM events ORDER BY start_date DESC").fetch_all(pool).await?;
    if user.is_organizer() {
        events.retain(|event| event.organizer_id == user.organizer_id);
    }
    let mut items = Vec::new();
    for event in &events {
        items.push(event_admin_json(event).await?);
    }
    Ok(Json(json!(items)))
}

pub async fn create_event(
    user: CurrentUser,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let name = body_str(&body, "name");
    if name.is_empty() {
        return Err(ApiError::bad_request("El nombre del evento es obligatorio."));
    }
    let start_date = normalize_dt(&body_str(&body, "startDate"), false);
    if start_date.is_empty() {
        return Err(ApiError::bad_request("La fecha de inicio es obligatoria."));
    }
    let category = normalize_event_category(&body_str(&body, "category"))
        .unwrap_or_else(|| "sports".to_string());
    let organizer_id = if user.is_organizer() {
        user.organizer_id
    } else {
        body_i64(&body, "organizerId")
    };
    if organizer_id.is_none() {
        return Err(ApiError::bad_request("Selecciona un organizador."));
    }
    let pool = larust_support::orm::pool()?;
    let slug_base = body_str(&body, "slug");
    let slug = unique_slug(
        if slug_base.is_empty() { &name } else { &slug_base },
        None,
    )
    .await?;
    let event_id: i64 = sqlx::query_scalar(
        "INSERT INTO events (organizer_id, name, slug, category, description, venue, address, city,
         province, country, cover_image_url, start_date, end_date, registration_deadline, status,
         max_participants, published, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id",
    )
    .bind(organizer_id)
    .bind(&name)
    .bind(&slug)
    .bind(&category)
    .bind(body_str(&body, "description"))
    .bind(body_str(&body, "venue"))
    .bind(body_str(&body, "address"))
    .bind(body_str(&body, "city"))
    .bind(body_str(&body, "province"))
    .bind(if body_str(&body, "country").is_empty() {
        "España".to_string()
    } else {
        body_str(&body, "country")
    })
    .bind(body_str(&body, "coverImageUrl"))
    .bind(&start_date)
    .bind(normalize_dt(&body_str(&body, "endDate"), true))
    .bind(normalize_dt(&body_str(&body, "registrationDeadline"), true))
    .bind({
        let status = body_str(&body, "status");
        if status.is_empty() { "Programada".to_string() } else { status }
    })
    .bind(body_i64(&body, "maxParticipants"))
    .bind(body_bool(&body, "published").unwrap_or(true) as i64)
    .bind(now_iso())
    .fetch_one(pool)
    .await?;
    let event = get_event(event_id).await?;
    Ok(Json(event_admin_json(&event).await?))
}

pub async fn get_event_detail(
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<Value>, ApiError> {
    let event = user.require_event_access(id).await?;
    Ok(Json(event_admin_json(&event).await?))
}

pub async fn update_event(
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let event = user.require_event_access(id).await?;
    let pool = larust_support::orm::pool()?;
    let name = body_opt_str(&body, "name").unwrap_or_else(|| event.name.clone());
    if name.trim().is_empty() {
        return Err(ApiError::bad_request("El nombre del evento es obligatorio."));
    }
    let slug = if let Some(slug) = body_opt_str(&body, "slug") {
        if slug.trim().is_empty() {
            unique_slug(&name, Some(event.id)).await?
        } else {
            unique_slug(&slug, Some(event.id)).await?
        }
    } else {
        event.slug.clone()
    };
    let organizer_id = if user.is_organizer() {
        event.organizer_id
    } else {
        body_i64(&body, "organizerId").or(event.organizer_id)
    };
    let category = body_opt_str(&body, "category")
        .and_then(|value| normalize_event_category(&value))
        .unwrap_or_else(|| event.category.clone());
    sqlx::query(
        "UPDATE events SET organizer_id = ?, name = ?, slug = ?, category = ?, description = ?,
         venue = ?, address = ?, city = ?, province = ?, country = ?, cover_image_url = ?,
         start_date = ?, end_date = ?, registration_deadline = ?, status = ?, max_participants = ?,
         published = ? WHERE id = ?",
    )
    .bind(organizer_id)
    .bind(&name)
    .bind(&slug)
    .bind(&category)
    .bind(body_opt_str(&body, "description").unwrap_or_else(|| event.description.clone()))
    .bind(body_opt_str(&body, "venue").unwrap_or_else(|| event.venue.clone()))
    .bind(body_opt_str(&body, "address").unwrap_or_else(|| event.address.clone()))
    .bind(body_opt_str(&body, "city").unwrap_or_else(|| event.city.clone()))
    .bind(body_opt_str(&body, "province").unwrap_or_else(|| event.province.clone()))
    .bind(body_opt_str(&body, "country").unwrap_or_else(|| event.country.clone()))
    .bind(body_opt_str(&body, "coverImageUrl").unwrap_or_else(|| event.cover_image_url.clone()))
    .bind(
        body_opt_str(&body, "startDate")
            .map(|value| normalize_dt(&value, false))
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| event.start_date.clone()),
    )
    .bind(
        body_opt_str(&body, "endDate")
            .map(|value| normalize_dt(&value, true))
            .unwrap_or_else(|| event.end_date.clone()),
    )
    .bind(
        body_opt_str(&body, "registrationDeadline")
            .map(|value| normalize_dt(&value, true))
            .unwrap_or_else(|| event.registration_deadline.clone()),
    )
    .bind(body_opt_str(&body, "status").unwrap_or_else(|| event.status.clone()))
    .bind(body.get("maxParticipants").map(|_| body_i64(&body, "maxParticipants")).unwrap_or(event.max_participants))
    .bind(body_bool(&body, "published").unwrap_or(event.published != 0) as i64)
    .bind(event.id)
    .execute(pool)
    .await?;
    let event = get_event(event.id).await?;
    Ok(Json(event_admin_json(&event).await?))
}

pub async fn delete_event(user: CurrentUser, Path(id): Path<i64>) -> Result<Json<Value>, ApiError> {
    let event = user.require_event_access(id).await?;
    let pool = larust_support::orm::pool()?;
    sqlx::query("DELETE FROM events WHERE id = ?")
        .bind(event.id)
        .execute(pool)
        .await?;
    Ok(Json(json!({ "message": "Evento eliminado." })))
}

// --- Modalities -----------------------------------------------------------

pub async fn list_modalities(
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<Value>, ApiError> {
    user.require_event_access(id).await?;
    let pool = larust_support::orm::pool()?;
    let modalities: Vec<Modality> =
        sqlx::query_as("SELECT * FROM modalities WHERE event_id = ? ORDER BY sort_order ASC, id ASC")
            .bind(id)
            .fetch_all(pool)
            .await?;
    let mut items = Vec::new();
    for modality in &modalities {
        items.push(modality_admin_json(modality).await?);
    }
    Ok(Json(json!(items)))
}

pub async fn create_modality(
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    user.require_event_access(id).await?;
    let name = body_str(&body, "name");
    if name.is_empty() {
        return Err(ApiError::bad_request("El nombre de la modalidad es obligatorio."));
    }
    let pool = larust_support::orm::pool()?;
    let modality_id: i64 = sqlx::query_scalar(
        "INSERT INTO modalities (event_id, name, description, distance_km, start_time,
         max_participants, base_price, dynamic_fields, active, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id",
    )
    .bind(id)
    .bind(&name)
    .bind(body_str(&body, "description"))
    .bind(body.get("distanceKm").and_then(|value| value.as_f64()))
    .bind(body_str(&body, "startTime"))
    .bind(body_i64(&body, "maxParticipants"))
    .bind(body_f64(&body, "basePrice", 0.0))
    .bind(json_fields(&body))
    .bind(body_bool(&body, "active").unwrap_or(true) as i64)
    .bind(body_i64(&body, "sortOrder").unwrap_or(0))
    .bind(now_iso())
    .fetch_one(pool)
    .await?;
    let modality = get_modality(modality_id).await?;
    Ok(Json(modality_admin_json(&modality).await?))
}

pub async fn update_modality(
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let modality = get_modality(id).await?;
    user.require_event_access(modality.event_id).await?;
    let pool = larust_support::orm::pool()?;
    sqlx::query(
        "UPDATE modalities SET name = ?, description = ?, distance_km = ?, start_time = ?,
         max_participants = ?, base_price = ?, dynamic_fields = ?, active = ?, sort_order = ?
         WHERE id = ?",
    )
    .bind(body_opt_str(&body, "name").unwrap_or_else(|| modality.name.clone()))
    .bind(body_opt_str(&body, "description").unwrap_or_else(|| modality.description.clone()))
    .bind(
        body.get("distanceKm")
            .map(|value| value.as_f64())
            .unwrap_or(modality.distance_km),
    )
    .bind(body_opt_str(&body, "startTime").unwrap_or_else(|| modality.start_time.clone()))
    .bind(
        body.get("maxParticipants")
            .map(|_| body_i64(&body, "maxParticipants"))
            .unwrap_or(modality.max_participants),
    )
    .bind(body_f64(&body, "basePrice", modality.base_price))
    .bind(if body.get("dynamicFields").is_some() {
        json_fields(&body)
    } else {
        modality.dynamic_fields.clone()
    })
    .bind(body_bool(&body, "active").unwrap_or(modality.active != 0) as i64)
    .bind(body_i64(&body, "sortOrder").unwrap_or(modality.sort_order))
    .bind(modality.id)
    .execute(pool)
    .await?;
    let modality = get_modality(modality.id).await?;
    Ok(Json(modality_admin_json(&modality).await?))
}

pub async fn delete_modality(
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<Value>, ApiError> {
    let modality = get_modality(id).await?;
    user.require_event_access(modality.event_id).await?;
    let pool = larust_support::orm::pool()?;
    let registrations: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM registrations WHERE modality_id = ?")
            .bind(id)
            .fetch_one(pool)
            .await?;
    if registrations > 0 {
        return Err(ApiError::conflict(
            "No se puede eliminar una modalidad con inscripciones. Desactívala en su lugar.",
        ));
    }
    sqlx::query("DELETE FROM modalities WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(Json(json!({ "message": "Modalidad eliminada." })))
}

// --- Price tiers ----------------------------------------------------------

pub async fn list_tiers(
    user: CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<Value>, ApiError> {
    let modality = get_modality(id).await?;
    user.require_event_access(modality.event_id).await?;
    let pool = larust_support::orm::pool()?;
    let tiers: Vec<PriceTier> =
        sqlx::query_as("SELECT * FROM price_tiers WHERE modality_id = ? ORDER BY starts_at ASC")
            .bind(id)
            .fetch_all(pool)
            .await?;
    Ok(Json(json!(tiers)))
}

pub async fn create_tier(
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let modality = get_modality(id).await?;
    user.require_event_access(modality.event_id).await?;
    let name = body_str(&body, "name");
    if name.is_empty() {
        return Err(ApiError::bad_request("El nombre del tramo es obligatorio."));
    }
    let pool = larust_support::orm::pool()?;
    let tier_id: i64 = sqlx::query_scalar(
        "INSERT INTO price_tiers (modality_id, name, price, starts_at, ends_at, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         RETURNING id",
    )
    .bind(id)
    .bind(&name)
    .bind(body_f64(&body, "price", 0.0))
    .bind(normalize_dt(&body_str(&body, "startsAt"), false))
    .bind(normalize_dt(&body_str(&body, "endsAt"), true))
    .bind(body_bool(&body, "active").unwrap_or(true) as i64)
    .bind(now_iso())
    .fetch_one(pool)
    .await?;
    let tier = get_tier(tier_id).await?;
    Ok(Json(json!(tier)))
}

pub async fn update_tier(
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let tier = get_tier(id).await?;
    let modality = get_modality(tier.modality_id).await?;
    user.require_event_access(modality.event_id).await?;
    let pool = larust_support::orm::pool()?;
    sqlx::query(
        "UPDATE price_tiers SET name = ?, price = ?, starts_at = ?, ends_at = ?, active = ? WHERE id = ?",
    )
    .bind(body_opt_str(&body, "name").unwrap_or_else(|| tier.name.clone()))
    .bind(body_f64(&body, "price", tier.price))
    .bind(
        body_opt_str(&body, "startsAt")
            .map(|value| normalize_dt(&value, false))
            .unwrap_or_else(|| tier.starts_at.clone()),
    )
    .bind(
        body_opt_str(&body, "endsAt")
            .map(|value| normalize_dt(&value, true))
            .unwrap_or_else(|| tier.ends_at.clone()),
    )
    .bind(body_bool(&body, "active").unwrap_or(tier.active != 0) as i64)
    .bind(tier.id)
    .execute(pool)
    .await?;
    let tier = get_tier(tier.id).await?;
    Ok(Json(json!(tier)))
}

pub async fn delete_tier(user: CurrentUser, Path(id): Path<i64>) -> Result<Json<Value>, ApiError> {
    let tier = get_tier(id).await?;
    let modality = get_modality(tier.modality_id).await?;
    user.require_event_access(modality.event_id).await?;
    let pool = larust_support::orm::pool()?;
    sqlx::query("DELETE FROM price_tiers WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(Json(json!({ "message": "Tramo eliminado." })))
}

// --- Coupons --------------------------------------------------------------

async fn coupon_json(coupon: &Coupon) -> Result<Value, ApiError> {
    let pool = larust_support::orm::pool()?;
    let event_name: Option<String> = match coupon.event_id {
        Some(id) => sqlx::query_scalar("SELECT name FROM events WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?,
        None => None,
    };
    let modality_name: Option<String> = match coupon.modality_id {
        Some(id) => sqlx::query_scalar("SELECT name FROM modalities WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?,
        None => None,
    };
    let mut value = serde_json::to_value(coupon).map_err(ApiError::internal)?;
    if let Some(object) = value.as_object_mut() {
        object.insert("eventName".into(), json!(event_name));
        object.insert("modalityName".into(), json!(modality_name));
    }
    Ok(value)
}

pub async fn list_coupons(
    user: CurrentUser,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let mut coupons: Vec<Coupon> =
        sqlx::query_as("SELECT * FROM coupons ORDER BY created_at DESC, id DESC")
            .fetch_all(pool)
            .await?;
    if user.is_organizer() {
        coupons.retain(|coupon| {
            coupon.event_id.is_some_and(|event_id| {
                // Event ownership is verified below against the in-memory list.
                event_id > 0
            })
        });
        let own_events: Vec<i64> = sqlx::query_scalar("SELECT id FROM events WHERE organizer_id = ?")
            .bind(user.organizer_id)
            .fetch_all(pool)
            .await?;
        coupons.retain(|coupon| coupon.event_id.is_some_and(|id| own_events.contains(&id)));
    }
    if let Some(event_id) = params.get("eventId").and_then(|value| value.parse::<i64>().ok()) {
        user.require_event_access(event_id).await?;
        coupons.retain(|coupon| coupon.event_id == Some(event_id));
    }
    if let Some(search) = params.get("search") {
        let search = search.to_lowercase();
        coupons.retain(|coupon| coupon.code.to_lowercase().contains(&search));
    }
    if let Some(status) = params.get("status") {
        coupons.retain(|coupon| match status.as_str() {
            "active" => coupon.active != 0 && coupon.max_uses.is_none_or(|max| coupon.uses < max),
            "inactive" => coupon.active == 0,
            "exhausted" => coupon.max_uses.is_some_and(|max| coupon.uses >= max),
            _ => true,
        });
    }
    let mut items = Vec::new();
    for coupon in &coupons {
        items.push(coupon_json(coupon).await?);
    }
    Ok(Json(json!(items)))
}

pub async fn create_coupon(
    user: CurrentUser,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let event_id = body_i64(&body, "eventId");
    if user.is_organizer() {
        let event_id = event_id
            .ok_or_else(|| ApiError::bad_request("Selecciona un evento para el cupón."))?;
        user.require_event_access(event_id).await?;
    } else if let Some(event_id) = event_id {
        user.require_event_access(event_id).await?;
    }
    let modality_id = body_i64(&body, "modalityId");
    if let (Some(event_id), Some(modality_id)) = (event_id, modality_id) {
        let exists: Option<i64> =
            sqlx::query_scalar("SELECT id FROM modalities WHERE id = ? AND event_id = ?")
                .bind(modality_id)
                .bind(event_id)
                .fetch_optional(larust_support::orm::pool()?)
                .await?;
        if exists.is_none() {
            return Err(ApiError::bad_request("La modalidad no pertenece al evento."));
        }
    }
    let kind = {
        let kind = body_str(&body, "kind");
        if kind.is_empty() { "percent".to_string() } else { kind }
    };
    if !["percent", "fixed", "gift"].contains(&kind.as_str()) {
        return Err(ApiError::bad_request("El tipo de descuento no es válido."));
    }
    let value = body_f64(&body, "value", 0.0);
    if kind == "percent" && (value < 0.0 || value > 100.0) {
        return Err(ApiError::bad_request("El porcentaje debe estar entre 0 y 100."));
    }
    let quantity = body_i64(&body, "quantity").unwrap_or(1).clamp(1, 100);
    let base_code = body_str(&body, "code").to_uppercase();
    let pool = larust_support::orm::pool()?;
    let mut created = Vec::new();
    for index in 0..quantity {
        let code = if base_code.is_empty() {
            random_code(10)
        } else if quantity == 1 {
            base_code.clone()
        } else {
            format!("{}-{}", base_code, index + 1)
        };
        let coupon_id: i64 = sqlx::query_scalar(
            "INSERT INTO coupons (event_id, modality_id, code, kind, value, max_uses, uses,
             valid_from, valid_until, active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
             RETURNING id",
        )
        .bind(event_id)
        .bind(modality_id)
        .bind(&code)
        .bind(&kind)
        .bind(value)
        .bind(body_i64(&body, "maxUses"))
        .bind(normalize_dt(&body_str(&body, "validFrom"), false))
        .bind(normalize_dt(&body_str(&body, "validUntil"), true))
        .bind(body_bool(&body, "active").unwrap_or(true) as i64)
        .bind(now_iso())
        .fetch_one(pool)
        .await?;
        let coupon: Coupon = sqlx::query_as("SELECT * FROM coupons WHERE id = ?")
            .bind(coupon_id)
            .fetch_one(pool)
            .await?;
        created.push(coupon_json(&coupon).await?);
    }
    if created.len() == 1 {
        Ok(Json(created.remove(0)))
    } else {
        Ok(Json(json!(created)))
    }
}

pub async fn update_coupon(
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let coupon: Coupon = sqlx::query_as("SELECT * FROM coupons WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Coupon not found."))?;
    if user.is_organizer() {
        let event_id = coupon
            .event_id
            .ok_or_else(|| ApiError::forbidden("No puedes editar cupones globales."))?;
        user.require_event_access(event_id).await?;
    }
    let kind = body_opt_str(&body, "kind").unwrap_or_else(|| coupon.kind.clone());
    let value = body_f64(&body, "value", coupon.value);
    if kind == "percent" && (value < 0.0 || value > 100.0) {
        return Err(ApiError::bad_request("El porcentaje debe estar entre 0 y 100."));
    }
    sqlx::query(
        "UPDATE coupons SET event_id = ?, modality_id = ?, code = ?, kind = ?, value = ?,
         max_uses = ?, valid_from = ?, valid_until = ?, active = ? WHERE id = ?",
    )
    .bind(if user.is_organizer() { coupon.event_id } else { body_i64(&body, "eventId").or(coupon.event_id) })
    .bind(body.get("modalityId").map(|_| body_i64(&body, "modalityId")).unwrap_or(coupon.modality_id))
    .bind({
        let code = body_str(&body, "code").to_uppercase();
        if code.is_empty() { coupon.code.clone() } else { code }
    })
    .bind(&kind)
    .bind(value)
    .bind(body.get("maxUses").map(|_| body_i64(&body, "maxUses")).unwrap_or(coupon.max_uses))
    .bind(
        body_opt_str(&body, "validFrom")
            .map(|value| normalize_dt(&value, false))
            .unwrap_or_else(|| coupon.valid_from.clone()),
    )
    .bind(
        body_opt_str(&body, "validUntil")
            .map(|value| normalize_dt(&value, true))
            .unwrap_or_else(|| coupon.valid_until.clone()),
    )
    .bind(body_bool(&body, "active").unwrap_or(coupon.active != 0) as i64)
    .bind(coupon.id)
    .execute(pool)
    .await?;
    let coupon: Coupon = sqlx::query_as("SELECT * FROM coupons WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
    Ok(Json(coupon_json(&coupon).await?))
}

pub async fn delete_coupon(user: CurrentUser, Path(id): Path<i64>) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let coupon: Coupon = sqlx::query_as("SELECT * FROM coupons WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Coupon not found."))?;
    if user.is_organizer() {
        let event_id = coupon
            .event_id
            .ok_or_else(|| ApiError::forbidden("No puedes eliminar cupones globales."))?;
        user.require_event_access(event_id).await?;
    }
    sqlx::query("DELETE FROM coupons WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(Json(json!({ "message": "Cupón eliminado." })))
}

// --- Clubs ----------------------------------------------------------------

pub async fn list_clubs_admin(_user: CurrentUser) -> Result<Json<Value>, ApiError> {
    let pool = larust_support::orm::pool()?;
    let clubs: Vec<Club> = sqlx::query_as("SELECT * FROM clubs ORDER BY name ASC")
        .fetch_all(pool)
        .await?;
    Ok(Json(json!(clubs)))
}

pub async fn create_club(user: CurrentUser, Json(body): Json<Value>) -> Result<Json<Value>, ApiError> {
    user.require_admin()?;
    let name = body_str(&body, "name");
    if name.is_empty() {
        return Err(ApiError::bad_request("El nombre del club es obligatorio."));
    }
    let pool = larust_support::orm::pool()?;
    let duplicate: Option<i64> = sqlx::query_scalar("SELECT id FROM clubs WHERE LOWER(name) = LOWER(?)")
        .bind(&name)
        .fetch_optional(pool)
        .await?;
    if duplicate.is_some() {
        return Err(ApiError::conflict("Ya existe un club con ese nombre."));
    }
    let club_id: i64 = sqlx::query_scalar(
        "INSERT INTO clubs (name, province, active, created_at) VALUES (?, ?, ?, ?) RETURNING id",
    )
    .bind(&name)
    .bind(body_str(&body, "province"))
    .bind(body_bool(&body, "active").unwrap_or(true) as i64)
    .bind(now_iso())
    .fetch_one(pool)
    .await?;
    let club: Club = sqlx::query_as("SELECT * FROM clubs WHERE id = ?")
        .bind(club_id)
        .fetch_one(pool)
        .await?;
    Ok(Json(json!(club)))
}

pub async fn update_club(
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    user.require_admin()?;
    let pool = larust_support::orm::pool()?;
    let club: Club = sqlx::query_as("SELECT * FROM clubs WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Club not found."))?;
    sqlx::query("UPDATE clubs SET name = ?, province = ?, active = ? WHERE id = ?")
        .bind(body_opt_str(&body, "name").unwrap_or_else(|| club.name.clone()))
        .bind(body_opt_str(&body, "province").unwrap_or_else(|| club.province.clone()))
        .bind(body_bool(&body, "active").unwrap_or(club.active != 0) as i64)
        .bind(club.id)
        .execute(pool)
        .await?;
    let club: Club = sqlx::query_as("SELECT * FROM clubs WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
    Ok(Json(json!(club)))
}

pub async fn delete_club(user: CurrentUser, Path(id): Path<i64>) -> Result<Json<Value>, ApiError> {
    user.require_admin()?;
    let pool = larust_support::orm::pool()?;
    let used: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM registrations WHERE club_id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
    if used > 0 {
        return Err(ApiError::conflict(
            "No se puede eliminar un club con inscripciones asociadas.",
        ));
    }
    sqlx::query("DELETE FROM clubs WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(Json(json!({ "message": "Club eliminado." })))
}
